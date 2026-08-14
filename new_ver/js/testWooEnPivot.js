/*
 * testWooEnPivot.js (EN Pivot 슬롯 추출)
 * ==================================================
 * 모든 NL은 전체 문장 번역 1회가 기본이다. 조사/청중명사로 번역을 건너뛰지 않는다.
 * - 동일 문장 재입력만 해시 캐시(TTL 1일 · 키에 __v 포함, 배포 후 구추출 재사용 금지).
 * concept는 (schema+xpath)에 이미 있으면 LLM 제안을 덮어쓰지 않는다.
 * 컬럼 도메인 값은 1회 번역해 nlMap 키를 {db, en[]} 으로 확장한다(키 삭제 금지).
 * litmus __v=174 (NL 캐시 키에 __v · ambiguous 카드 히트 금지).
 *
 * [Main Functions]
 * ===========
 * - extractSlots — 전체 NL 번역·추출 (캐시 히트만 0콜)
 * - translateAndExtract — 전체 NL 1회 번역·추출 JSON
 * - scanM1 — 원문 literal ⊂ NL (매칭용. 추출 스킵에 쓰지 않음)
 * - applyConceptLock — _source.concept 불변 · 다른 이름은 aliases
 * - toPipelineSlots — EnPivot slot → Pass0 형태 {id,text,searchKeywords}
 * - isNonConditionSlot — concept·resolvedName·en_literal 없으면 잔여. kind만으로는 조건 아님
 * - enrichDomainEn — 컬럼 distinct/enum/_bucket 1회 EN 사전화
 * - clearNlCache / putNlCache — NL 해시 캐시 (스모크)
 *
 * [Dependencies]
 * =========
 * - testWoo.fragContract.collectLexicon·splitByLexicon·isNoiseResidue·matchEnPivotSlot
 * - testWoo.llm.chat·parseJson — 기존 어댑터만 (json_object·외부 번역 API 금지)
 * - generatePlan이 extractSlots를 Pass0 앞에 호출. loadLibrary는 Llm보다 앞
 *
 * [Invariants]
 * =========
 * - 바인딩 문자열은 surface(원문). en_literal을 db 값으로 쓰지 않음
 * - JOSA/NOISE 사전 없음. M1→M2G(`_group`)→M2→M3→M2C 는 matchEnPivotSlot/generatePlan
 * - 추출 실패 → retryInput. Pass0·Foundry로 우회하지 않음
 * - concept·resolvedName·en_literal 없는 잔여만 드롭. kind만으로는 유지하지 않음
 */
var testWoo = testWoo || {};
testWoo.enPivot = (function () {
  "use strict";

  var CACHE_TTL_MS = 86400000;
  var MAX_CARDS = 80;
  var MAX_SLOTS = 8;
  var KIND_OK = { categorical: 1, range: 1, boolean: 1, other: 1 };
  var POL_OK = { include: 1, exclude: 1 };
  var _nlCache = {};

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  function _now() {
    return new Date().getTime();
  }

  function _normNl(s) {
    return _trim(s).replace(/\s+/g, " ").toLowerCase();
  }

  function _hash(s) {
    var h = 5381;
    var i;
    for (i = 0; i < s.length; i++)
      h = ((h << 5) + h) + s.charCodeAt(i);
    return String(h >>> 0);
  }

  function _isArray(x) {
    return Object.prototype.toString.call(x) === "[object Array]";
  }

  function _domainOf(card) {
    if (!testWoo.fragContract || !testWoo.fragContract.normalizeParamDomain)
      return {};
    return testWoo.fragContract.normalizeParamDomain(card && card.param_domain);
  }

  function _sourceOf(card) {
    var d = _domainOf(card);
    return (d && d._source && typeof d._source === "object") ? d._source : null;
  }

  function _lockedConcept(card) {
    var src = _sourceOf(card);
    return src ? _trim(src.concept || "") : "";
  }

  function _kindFromSource(card) {
    var src = _sourceOf(card);
    var t = src ? String(src.tier || "").toLowerCase() : "";
    if (t === "enum") return "categorical";
    if (t === "range") return "range";
    if (t === "boolean") return "boolean";
    return "";
  }

  function _hintCat(axis) {
    var a = String(axis || "").toLowerCase();
    if (a === "plan") return "plan";
    if (a === "joindate") return "signup";
    if (a === "consent" || a === "fatigue") return a;
    return "demo";
  }

  function _snake(s) {
    var t = _trim(s).toLowerCase().replace(/[^a-z0-9]+/g, "_");
    t = t.replace(/^_+|_+$/g, "");
    return t;
  }

  function _cacheKey(nl) {
    var gen = "";
    try { gen = String((testWoo.enPivot && testWoo.enPivot.__v) || ""); }
    catch (eG) { gen = ""; }
    return _hash(_normNl(nl) + "|" + gen);
  }

  function _cacheGet(nl) {
    var key = _cacheKey(nl);
    var row = _nlCache[key];
    if (!row) return null;
    if (_now() - row.ts > CACHE_TTL_MS) {
      try { delete _nlCache[key]; } catch (eD) { _nlCache[key] = null; }
      return null;
    }
    return row.payload;
  }

  function _cachePut(nl, payload) {
    _nlCache[_cacheKey(nl)] = { ts: _now(), payload: payload };
  }

  function clearNlCache() {
    _nlCache = {};
  }

  function _remainderAfter(nl, lexSlots) {
    var text = String(nl || "");
    if (!text) return "";
    var keys = [];
    var i;
    for (i = 0; i < (lexSlots || []).length; i++) {
      if (lexSlots[i] && lexSlots[i].text) keys.push(String(lexSlots[i].text));
    }
    keys.sort(function (a, b) { return b.length - a.length; });
    var used = [];
    var ui;
    for (ui = 0; ui < text.length; ui++) used.push(0);
    var hLow = text.toLowerCase();
    var ki, k, klen, pos, at, overlap, hi;
    for (ki = 0; ki < keys.length; ki++) {
      k = _trim(keys[ki]);
      klen = k.length;
      if (klen < 2) continue;
      pos = 0;
      while (pos <= hLow.length - klen) {
        at = hLow.indexOf(k.toLowerCase(), pos);
        if (at < 0) break;
        overlap = false;
        for (hi = 0; hi < klen; hi++) {
          if (used[at + hi]) { overlap = true; break; }
        }
        if (!overlap) {
          for (hi = 0; hi < klen; hi++) used[at + hi] = 1;
        }
        pos = at + 1;
      }
    }
    var out = "";
    for (ui = 0; ui < text.length; ui++)
      out += used[ui] ? " " : text.charAt(ui);
    return _trim(out.replace(/\s+/g, " "));
  }

  function _m1Slot(lexSlot) {
    var card = lexSlot && lexSlot.card;
    var axis = "";
    if (testWoo.fragContract && testWoo.fragContract.axisFromCard)
      axis = testWoo.fragContract.axisFromCard(card) || lexSlot.axis || "";
    else axis = lexSlot.axis || "";
    return {
      surface: String(lexSlot.text || ""),
      concept: _lockedConcept(card) || null,
      en_literal: "",
      kind: _kindFromSource(card) || "other",
      polarity: "include",
      is_new: _lockedConcept(card) ? false : true,
      resolvedName: String(lexSlot.resolvedName || (card && card.name) || ""),
      hintedCategory: lexSlot.hintedCategory || _hintCat(axis)
    };
  }

  function scanM1(nlText, candidateCards) {
    var empty = { slots: [], remainder: _trim(nlText), covered: false };
    if (!testWoo.fragContract) return empty;
    var fc = testWoo.fragContract;
    if (!fc.collectLexicon || !fc.splitByLexicon) return empty;
    var cards = candidateCards || [];
    var lex = fc.collectLexicon(cards) || [];
    var lexSlots = lex.length ? (fc.splitByLexicon(nlText, lex) || []) : [];
    var slots = [];
    var i;
    for (i = 0; i < lexSlots.length; i++) slots.push(_m1Slot(lexSlots[i]));
    var rem = _remainderAfter(nlText, lexSlots);
    var noise = !rem || (fc.isNoiseResidue && fc.isNoiseResidue(rem));
    return { slots: slots, remainder: rem, covered: !!(slots.length && noise) };
  }

  function _matchCard(slot, cards) {
    var i, card, hit;
    var fc = testWoo.fragContract;
    var surface = slot ? String(slot.surface || "") : "";
    var name = slot ? String(slot.resolvedName || "") : "";
    for (i = 0; i < (cards || []).length; i++) {
      card = cards[i];
      if (!card) continue;
      if (name && String(card.name) === name) return card;
      if (fc && fc.matchEnPivotSlot) {
        hit = fc.matchEnPivotSlot(card.param_domain, slot);
        if (hit && hit.layer && !hit.ambiguous) return card;
        continue;
      }
      if (!fc || !fc.domainMatchSlot || !surface) continue;
      hit = fc.domainMatchSlot(card.param_domain, surface);
      if (hit) return card;
    }
    return null;
  }

  function applyConceptLock(slots, candidateCards) {
    var out = [];
    var i, s, card, locked, proposed, aliases, copy;
    for (i = 0; i < (slots || []).length; i++) {
      s = slots[i] || {};
      copy = {
        surface: String(s.surface || ""),
        concept: s.concept == null ? null : String(s.concept),
        en_literal: String(s.en_literal || ""),
        kind: String(s.kind || "other"),
        polarity: String(s.polarity || "include"),
        is_new: !!s.is_new,
        reason: s.reason || "",
        resolvedName: String(s.resolvedName || ""),
        hintedCategory: String(s.hintedCategory || ""),
        conceptAliases: s.conceptAliases ? s.conceptAliases.slice(0) : []
      };
      card = _matchCard(copy, candidateCards);
      locked = _lockedConcept(card);
      if (card && !copy.resolvedName) copy.resolvedName = String(card.name || "");
      if (card && !copy.hintedCategory) {
        copy.hintedCategory = _hintCat(
          testWoo.fragContract && testWoo.fragContract.axisFromCard ?
            testWoo.fragContract.axisFromCard(card) : ""
        );
      }
      if (locked) {
        proposed = _snake(copy.concept || "");
        aliases = copy.conceptAliases;
        if (proposed && proposed !== locked) {
          aliases.push(proposed);
          try {
            logInfo("[testWoo.enPivot] concept_locked keep=" + locked +
              " alias=" + proposed);
          } catch (eL) { /* non-ACC */ }
        }
        copy.concept = locked;
        copy.is_new = false;
        copy.conceptAliases = aliases;
      }
      out.push(copy);
    }
    return out;
  }

  function _slimCards(cards) {
    var out = [];
    var i, card, src, n;
    n = cards && cards.length ? cards.length : 0;
    if (n > MAX_CARDS) n = MAX_CARDS;
    for (i = 0; i < n; i++) {
      card = cards[i];
      if (!card) continue;
      src = _sourceOf(card) || {};
      out.push({
        name: String(card.name || ""),
        tags: String(card.tags || ""),
        concept: _trim(src.concept || ""),
        schema: String(src.schema || ""),
        xpath: String(src.xpath || "")
      });
    }
    return out;
  }

  function _firstObject(text) {
    var src = String(text || "");
    var start = src.indexOf("{");
    if (start < 0) return null;
    var depth = 0;
    var inStr = false;
    var esc = false;
    var i, ch;
    for (i = start; i < src.length; i++) {
      ch = src.charAt(i);
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === "\"") inStr = false;
        continue;
      }
      if (ch === "\"") { inStr = true; continue; }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(src.substring(start, i + 1)); }
          catch (eP) { return null; }
        }
      }
    }
    return null;
  }

  function _normSlot(raw) {
    var surface = _trim(raw && raw.surface);
    var concept = raw && raw.concept != null ? _snake(raw.concept) : "";
    var kind = String((raw && raw.kind) || "other").toLowerCase();
    var pol = String((raw && raw.polarity) || "include").toLowerCase();
    if (!KIND_OK[kind]) kind = "other";
    if (!POL_OK[pol]) pol = "include";
    var slot = {
      surface: surface,
      concept: concept || null,
      en_literal: _trim(raw && raw.en_literal),
      kind: kind,
      polarity: pol,
      is_new: !!(raw && raw.is_new),
      reason: _trim(raw && raw.reason)
    };
    if (!slot.concept && !slot.reason) slot.reason = "concept_unknown";
    return slot;
  }

  function _isNonConditionSlot(s) {
    if (!s) return true;
    if (s.concept) return false;
    if (s.resolvedName) return false;
    if (s.en_literal) return false;
    return true;
  }

  function _emptyExtract(reason) {
    return { en: "", slots: [], error: String(reason || "extract_failed") };
  }

  function translateAndExtract(nlText, candidateCards) {
    var empty = _emptyExtract("llm_fail");
    if (!testWoo.llm || !testWoo.llm.chat) {
      try { logWarning("[testWoo.enPivot.translateAndExtract] llm.chat missing"); }
      catch (e0) { /* non-ACC */ }
      return _emptyExtract("llm_unavailable");
    }
    var cfg;
    try { cfg = testWoo.cfg.getConfig(); }
    catch (eC) {
      try { logWarning("[testWoo.enPivot.translateAndExtract] cfg missing"); }
      catch (e1) { /* non-ACC */ }
      return _emptyExtract("llm_unavailable");
    }
    var system = [
      "You translate Korean marketer targeting NL to English and extract atomic slots.",
      "ONE slot = ONE condition axis. Never merge two axes.",
      "Translate the FULL sentence. Korean may contain typos or broken spacing;",
      "recover the intended meaning in en and en_literal (typos in the source language).",
      "Keep surface as the original typed span, including typos, so the marketer can verify.",
      "concept = English snake_case. Prefer a concept from CANDIDATE_CARDS.",
      "If no candidate fits, propose a new concept and set is_new:true.",
      "If a card already has concept, use that exact string. Do not invent a parallel axis.",
      "Emit ONLY targeting-condition axes (region, plan, age, gender, consent, join date, etc.).",
      "Do NOT emit slots for sentence glue: particles, copulas, verbs (live/use), or audience nouns with no filter value.",
      "If a real condition cannot be named, still emit it with a snake_case concept and is_new:true.",
      "Never emit a slot with concept:null for glue or leftover spans.",
      "If you cannot recover any targeting condition, return slots:[] (do not guess SQL).",
      "Do not write SQL or fragment ids.",
      "kind: categorical|range|boolean|other. polarity: include|exclude.",
      "At most 8 slots. OUTPUT JSON ONLY. No prose, no markdown, no second JSON.",
      'Schema: {"en":"<English sentence>","slots":[{"surface":"...","concept":"...","en_literal":"...","kind":"categorical","polarity":"include","is_new":false}]}',
      "CANDIDATE_CARDS: " + JSON.stringify(_slimCards(candidateCards || []))
    ].join("\n");
    var user = "NL:\n" + String(nlText || "");
    var raw;
    var parsed;
    try {
      raw = testWoo.llm.chat(cfg, system, user, "enPivot", {});
    } catch (eChat) {
      try {
        logWarning("[testWoo.enPivot.translateAndExtract] chat failed: " +
          String(eChat.message || eChat));
      } catch (eL) { /* non-ACC */ }
      return empty;
    }
    try {
      if (testWoo.llm.parseJson) parsed = testWoo.llm.parseJson(raw, "enPivot");
    } catch (eJ) { parsed = null; }
    if (!parsed || typeof parsed !== "object") parsed = _firstObject(String(raw || ""));
    if (!parsed || typeof parsed !== "object") {
      try { logWarning("[testWoo.enPivot.translateAndExtract] JSON missing"); }
      catch (e2) { /* non-ACC */ }
      return empty;
    }
    var list = _isArray(parsed.slots) ? parsed.slots : [];
    var slots = [];
    var i, ns;
    for (i = 0; i < list.length && slots.length < MAX_SLOTS; i++) {
      ns = _normSlot(list[i]);
      if (!ns.surface) continue;
      if (_isNonConditionSlot(ns)) continue;
      slots.push(ns);
    }
    var en = _trim(parsed.en);
    try { logInfo("[testWoo.enPivot] en=" + en); } catch (eEn) { /* non-ACC */ }
    return { en: en, slots: slots, error: "" };
  }

  function putNlCache(nl, payload) {
    if (!payload) return;
    _cachePut(String(nl || ""), payload);
  }

  function extractSlots(nlText, candidateCards) {
    var nl = String(nlText || "");
    var cards = candidateCards || [];
    var cached = _cacheGet(nl);
    if (cached) {
      try { logInfo("[testWoo.enPivot] cache_hit llmCalls=0"); }
      catch (eC) { /* non-ACC */ }
      return cached;
    }
    var extracted = translateAndExtract(nl, cards);
    var skip = "llm";
    if (extracted.error === "llm_unavailable") skip = "llm_unavailable";
    else if (extracted.error) skip = "llm_fail";
    var locked = applyConceptLock(extracted.slots || [], cards);
    var ok = skip === "llm" && locked.length > 0;
    var result = {
      en: extracted.en || "",
      slots: ok ? locked : [],
      meta: {
        llmCalls: skip === "llm_unavailable" ? 0 : 1,
        skipReason: skip,
        retryInput: !ok,
        remainder: ""
      }
    };
    if (!ok) {
      try {
        logWarning("[testWoo.enPivot] retryInput skip=" + skip +
          " slots=" + locked.length);
      } catch (eF) { /* non-ACC */ }
      return result;
    }
    _cachePut(nl, result);
    try {
      logInfo("[testWoo.enPivot] skip=llm llmCalls=1 slots=" + result.slots.length +
        " en=" + result.en);
    } catch (eO) { /* non-ACC */ }
    return result;
  }

  function toPipelineSlots(pivotSlots) {
    var out = [];
    var i, s, kws, seen, addKw;
    for (i = 0; i < (pivotSlots || []).length; i++) {
      s = pivotSlots[i];
      if (!s || !s.surface) continue;
      if (_isNonConditionSlot(s)) continue;
      kws = [];
      seen = {};
      addKw = function (v) {
        var t = _trim(v);
        if (!t) return;
        var k = t.toLowerCase();
        if (seen[k]) return;
        seen[k] = 1;
        kws.push(t);
      };
      addKw(s.surface);
      addKw(s.en_literal);
      addKw(s.concept);
      out.push({
        id: "s" + (out.length + 1),
        text: s.surface,
        hintedCategory: s.hintedCategory || _hintCat(""),
        searchKeywords: kws,
        resolvedName: s.resolvedName || "",
        concept: s.concept || null,
        en_literal: s.en_literal || "",
        polarity: s.polarity || "include",
        kind: s.kind || ""
      });
    }
    return out;
  }

  function _nowIso() {
    var d = new Date();
    function pad(n) { return n < 10 ? "0" + n : String(n); }
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" +
      pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + ":" +
      pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds()) + "Z";
  }

  function _isEnPair(v) {
    return !!(v && typeof v === "object" && !_isArray(v) &&
      (v.db != null || _isArray(v.en)));
  }

  function _entryHasEn(v) {
    return _isEnPair(v) && _isArray(v.en) && v.en.length > 0;
  }

  function _collectPending(domain) {
    var out = [];
    var k, map, nk, v;
    function addFrom(mapRef, bucket) {
      if (!mapRef || typeof mapRef !== "object") return;
      for (nk in mapRef) {
        if (!mapRef.hasOwnProperty(nk)) continue;
        v = mapRef[nk];
        if (_entryHasEn(v)) continue;
        out.push({ bucket: !!bucket, key: String(nk), value: v });
      }
    }
    for (k in domain) {
      if (!domain.hasOwnProperty(k) || String(k).charAt(0) === "_") continue;
      addFrom(domain[k] && domain[k].nlMap, false);
    }
    if (domain._bucket) addFrom(domain._bucket.nlMap, true);
    return out;
  }

  function _wrapValue(oldVal, enArr) {
    var en = [];
    var i, t, seen;
    seen = {};
    for (i = 0; i < (enArr || []).length; i++) {
      t = _trim(enArr[i]);
      if (!t) continue;
      if (seen[t.toLowerCase()]) continue;
      seen[t.toLowerCase()] = 1;
      en.push(t);
    }
    if (_isEnPair(oldVal)) {
      oldVal.en = en.length ? en : (oldVal.en || []);
      if (oldVal.db == null) oldVal.db = oldVal.db;
      return oldVal;
    }
    return { db: oldVal, en: en };
  }

  function _applyEnEntries(domain, pending, parsed) {
    var byKey = {};
    var list = parsed && _isArray(parsed.entries) ? parsed.entries : [];
    var i, e, j;
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (!e || e.key == null) continue;
      byKey[String(e.key)] = e.en;
    }
    for (i = 0; i < pending.length; i++) {
      e = pending[i];
      if (e.bucket) {
        if (!domain._bucket) domain._bucket = { nlMap: {} };
        if (!byKey[e.key] || !byKey[e.key].length) continue;
        domain._bucket.nlMap[e.key] = _wrapValue(e.value, byKey[e.key]);
      } else {
        if (!byKey[e.key] || !byKey[e.key].length) continue;
        for (j in domain) {
          if (!domain.hasOwnProperty(j) || String(j).charAt(0) === "_") continue;
          if (domain[j] && domain[j].nlMap && domain[j].nlMap[e.key] != null) {
            domain[j].nlMap[e.key] = _wrapValue(e.value, byKey[e.key] || []);
            break;
          }
        }
      }
    }
  }

  function _lockSourceConcept(domain, proposed) {
    if (!domain._source || typeof domain._source !== "object") domain._source = {};
    var src = domain._source;
    var locked = _trim(src.concept || "");
    var next = _snake(proposed || "");
    if (locked) {
      if (next && next !== locked) {
        if (!_isArray(src.conceptAliases)) src.conceptAliases = [];
        src.conceptAliases.push(next);
      }
      return;
    }
    if (next) src.concept = next;
    if (!_isArray(src.conceptAliases)) src.conceptAliases = [];
  }

  function enrichDomainEn(domainRaw, opts) {
    opts = opts || {};
    var domain;
    if (testWoo.fragContract && testWoo.fragContract.normalizeParamDomain)
      domain = testWoo.fragContract.normalizeParamDomain(domainRaw);
    else domain = domainRaw && typeof domainRaw === "object" ? domainRaw : {};
    var pending = _collectPending(domain);
    if (!pending.length) {
      return { domain: domain, llmCalls: 0, changed: false, skipped: "fresh" };
    }
    if (pending.length > MAX_CARDS) pending = pending.slice(0, MAX_CARDS);
    var keys = [];
    var pi;
    for (pi = 0; pi < pending.length; pi++) keys.push(pending[pi].key);
    var locked = "";
    if (domain._source) locked = _trim(domain._source.concept || "");
    var parsed = null;
    var llmCalls = 0;
    if (testWoo.llm && testWoo.llm.chat && testWoo.cfg) {
      try {
        var cfg = testWoo.cfg.getConfig();
        var system = [
          "You translate Adobe Campaign targeting domain values to English aliases.",
          "Copy each INPUT key verbatim. Do not invent DB values.",
          "en = 1-4 English aliases (include synonyms, e.g. teenager/teens/10s).",
          "concept = English snake_case for the column meaning.",
          locked ? ("Use this concept exactly: " + locked) : "Propose one concept.",
          "OUTPUT JSON ONLY. No prose.",
          '{"concept":"snake_case","entries":[{"key":"...","en":["..."]}]}'
        ].join("\n");
        var raw = testWoo.llm.chat(cfg, system, "INPUT_KEYS:\n" + JSON.stringify(keys),
          "enPivot", {});
        llmCalls = 1;
        if (testWoo.llm.parseJson) parsed = testWoo.llm.parseJson(raw, "enPivot");
        if (!parsed) parsed = _firstObject(String(raw || ""));
      } catch (eC) {
        try {
          logWarning("[testWoo.enPivot.enrichDomainEn] " + String(eC.message || eC));
        } catch (eL) { /* non-ACC */ }
        parsed = null;
      }
    }
    _applyEnEntries(domain, pending, parsed || { entries: [] });
    _lockSourceConcept(domain, parsed && parsed.concept);
    var left = _collectPending(domain);
    var changed = left.length < pending.length;
    if (!left.length) {
      if (!domain._source) domain._source = {};
      domain._source.enRefreshedAt = _nowIso();
      try {
        if (testWoo.cfg && testWoo.cfg.getConfig)
          domain._source.enModel = String(testWoo.cfg.getConfig().llm.model || "");
      } catch (eM) { domain._source.enModel = ""; }
    }
    try {
      logInfo("[testWoo.enPivot] enrichDomainEn keys=" + keys.length +
        " llmCalls=" + llmCalls + " left=" + left.length);
    } catch (eI) { /* non-ACC */ }
    return { domain: domain, llmCalls: llmCalls, changed: changed, skipped: changed ? "" : "llm_fail" };
  }

  return {
    extractSlots: extractSlots,
    translateAndExtract: translateAndExtract,
    scanM1: scanM1,
    applyConceptLock: applyConceptLock,
    toPipelineSlots: toPipelineSlots,
    isNonConditionSlot: _isNonConditionSlot,
    enrichDomainEn: enrichDomainEn,
    clearNlCache: clearNlCache,
    putNlCache: putNlCache
  };
})();
testWoo.enPivot.__v = "174";
