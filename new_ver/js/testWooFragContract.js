/*
 * testWooFragContract.js (슬롯↔frag 공유 계약)
 * ==================================================
 * Stage A / libraryLookup / Foundry publish / Dedup / Compiler가
 * 각자 복제하던 축·색인·커버·샘플바인딩을 한곳에서 제공한다.
 * 같은 tags/name 축 frag는 값 사전 공백이어도 재사용하고, 별칭은 검증 후 merge한다.
 * NL 매칭은 M1 원문⊂문장 → M2 en[] → M3 concept. {db,en} 바인딩은 db만. litmus __v=175.
 * N대는 _bucket/ageMin·ageMax 축에서 번역 전에 {ageMin:N,ageMax:N+10}으로 묶는다.
 *
 * [Main Functions]
 * ===========
 * - axisFromSlot / axisFromCard / axesCompatible — concept·영문 힌트·정합
 * - buildIndexFields — publish용 synonyms·sample_questions. `_group` 별칭 포함
 * - matchProfile / likeFieldExprs / scoreWeights / coverFieldNames — Match 프로필
 * - keywordsFromSlot — Stage A 토큰(+축 태그). 조사 어간 없음
 * - collectLexicon / splitByLexicon / mergeLexiconSlots — 카탈로그 값⊂NL 분할. `_group` 별칭 포함. 겹치면 EnPivot 필드 복사. LLM 스팬이 더 길면 덮지 않음
 * - stemToken / isNoiseResidue — no-op (5단계: KO 사전 삭제)
 * - normalizeParamDomain / domainMatchSlot / entryDb — 도메인 정규화·값 매칭·{db,en} 원본. `_group` 별칭→members[]. 토큰 경계. N대는 _bucket 키·유도가 enum 접두보다 앞
 * - matchEnPivotSlot / conceptOf / kindCompatible — M1→M2G(`_group`)→M2→M3 매칭. N대는 EN 다히트 전에 묶음
 * - isNegative / markNegative / inHealCooldown / stampHeal — _negative·heal 쿨다운
 * - validateBind / attachAlias / mergeParamDomainJson — 바인딩 검증(배열은 원소별 enum)·별칭 보완(문장·공백 별칭 거부)·도메인 merge(`_group` 보존, nlMap 키 삭제 금지)
 * - sampleBindSql — {{param}} 검증/Dedup용 샘플 치환(유일 구현). 배열은 'a','b'
 * - promoteEqPlaceholderToIn — `col = {{p}}` → `col IN ({{p}})` (>= <= != 유지)
 * - coversSlot / libraryHitPredicate — 재사용·서가 히트(축 identity, 값 미등재≠신규)
 * - resolveNlParams — NL→params (Compiler bind 공유). `_group` 히트는 members[] (후보 교집합)
 * - upsertGroup — `_group` 별칭 기록(members는 후보 교집합, nlMap 키 유지)
 * - logCode / errorCodes — FRAG_CONTRACT:<code> 로그
 *
 * [Dependencies]
 * =========
 * - testWoo.cfg — search.maxTokens·MAX_TOKEN_LEN (없으면 기본값)
 * - 호출: Fragments·Feasibility·Foundry·Dedup·Compiler (loadLibrary 선행)
 */
var testWoo = testWoo || {};
testWoo.fragContract = (function () {
  "use strict";

  var ERROR_CODES = {
    AXIS_MISMATCH: "AXIS_MISMATCH",
    INDEX_MISS: "INDEX_MISS",
    DOMAIN_UNBOUND: "DOMAIN_UNBOUND",
    BIND_TYPE: "BIND_TYPE",
    SOURCE_MISSING: "SOURCE_MISSING",
    DEDUP_ASYMMETRIC: "DEDUP_ASYMMETRIC"
  };

  // Stage A LIKE / score / cover 가 동일 필드를 쓰도록 한 표
  var MATCH_PROFILE = {
    likeFields: [
      "label", "tags", "synonyms", "sample_questions",
      "name", "description", "param_domain"
    ],
    scoreWeights: {
      sample_questions: 8,
      synonyms: 6,
      param_domain: 7,
      label: 4,
      tags: 3,
      description: 2,
      name: 1
    },
    coverFields: [
      "label", "description", "tags", "synonyms",
      "sample_questions", "name", "param_domain"
    ],
    categoryHintBonus: 10,
    libraryRequiresSource: true
  };

  // Pass0 hintedCategory → 축 태그 별칭 (점수/정합 보조)
  var HINT_CAT_TO_AXIS = {
    plan: "plan",
    demo: "demo",
    consent: "consent",
    fatigue: "fatigue",
    signup: "joindate",
    other: ""
  };

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  function _isArray(x) {
    return Object.prototype.toString.call(x) === "[object Array]";
  }

  function _norm(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, "");
  }

  function _induceNDae(text) {
    var t = _trim(String(text || ""));
    var m = /^(\d{1,2})\uB300$/.exec(t);
    if (!m) m = /^(\d{1,2})s$/.exec(_norm(t));
    if (!m) return null;
    var n = Number(m[1]);
    if (isNaN(n) || n < 1 || n > 90) return null;
    return { ageMin: n, ageMax: n + 10 };
  }

  function _domainAcceptsNDae(domain) {
    if (!domain) return false;
    if (domain._bucket) return true;
    if (domain.ageMin && domain.ageMax) return true;
    return false;
  }

  function _ciHas(hay, needle) {
    if (hay == null || needle == null) return false;
    var h = String(hay).toLowerCase();
    var n = String(needle).toLowerCase();
    if (!n) return false;
    return h.indexOf(n) >= 0;
  }

  function _isWordChar(c) {
    return /[0-9a-zA-Z가-힣_]/.test(String(c || ""));
  }

  function _tokenAliasHit(token, alias, dbHint, isGroup) {
    var t = _norm(token);
    var a = _norm(alias);
    if (!t || !a || a.length < 2) return false;
    if (t === a) return true;
    if (t.indexOf(a) !== 0) return false;
    var rest = t.substring(a.length);
    if (!rest) return true;
    if (isGroup) return rest.length <= 2;
    var db = "";
    if (dbHint != null && typeof dbHint !== "object") db = _norm(String(dbHint));
    if (db && t.indexOf(db) >= 0) return true;
    if (db && db === a && rest.length <= 1) return true;
    return false;
  }

  function _boundHas(hay, needle, dbHint, isGroup) {
    if (hay == null || needle == null) return false;
    var n = String(needle);
    if (!n || n.length < 2) return false;
    var toks = String(hay).split(/[^0-9a-zA-Z가-힣_]+/);
    var i;
    for (i = 0; i < toks.length; i++) {
      if (_tokenAliasHit(toks[i], n, dbHint, isGroup)) return true;
    }
    return false;
  }

  function _aliasPrefixConflict(surface, alias, dbHint, isGroup) {
    var toks = String(surface || "").split(/[^0-9a-zA-Z가-힣_]+/);
    var i, t, a;
    a = _norm(alias);
    if (!a) return false;
    for (i = 0; i < toks.length; i++) {
      t = _norm(toks[i]);
      if (t && t.indexOf(a) === 0 && t !== a &&
          !_tokenAliasHit(toks[i], alias, dbHint, isGroup))
        return true;
    }
    return false;
  }

  function _lexHint(card, key) {
    var out = { db: "", group: false };
    var domain = normalizeParamDomain(card && card.param_domain);
    if (!domain || !key) return out;
    var k, spec, map, dbv, ei;
    for (k in domain) {
      if (!domain.hasOwnProperty(k) || String(k).charAt(0) === "_") continue;
      spec = domain[k] || {};
      map = spec.nlMap;
      if (map && map[key] != null) {
        dbv = entryDb(map[key]);
        out.db = (dbv != null && typeof dbv !== "object") ? String(dbv) : "";
        return out;
      }
      if (spec.enum && typeof spec.enum.length === "number") {
        for (ei = 0; ei < spec.enum.length; ei++) {
          if (String(spec.enum[ei]) === String(key)) {
            out.db = String(key);
            return out;
          }
        }
      }
    }
    if (domain._bucket && domain._bucket.nlMap && domain._bucket.nlMap[key] != null) {
      out.group = true;
      return out;
    }
    _eachGroup(domain, function (gpk, alias, gentry) {
      if (String(alias) === String(key)) out.group = true;
    });
    return out;
  }

  function _sqlLit(v) {
    if (typeof v === "number" && isFinite(v)) return String(v);
    return "'" + String(v).replace(/'/g, "''") + "'";
  }

  function _sqlLitJoin(v) {
    if (!_isArray(v)) return _sqlLit(v);
    if (!v.length) return "'__sample__'";
    var buf = [];
    var i;
    for (i = 0; i < v.length; i++) {
      if (v[i] != null && typeof v[i] === "object") continue;
      buf.push(_sqlLit(v[i]));
    }
    if (!buf.length) return "'__sample__'";
    return buf.join(",");
  }

  // col = {{param}} → col IN ({{param}}). >= <= != <> 는 그대로.
  function promoteEqPlaceholderToIn(sqlText) {
    return String(sqlText || "").replace(
      /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{\{(\w+)\}\}/g,
      "$1 IN ({{$2}})"
    );
  }

  function logCode(code, detail) {
    var c = ERROR_CODES[code] || String(code || "UNKNOWN");
    var msg = "[FRAG_CONTRACT:" + c + "]";
    if (detail) msg += " " + String(detail);
    try { logWarning(msg); } catch (eL) { /* non-ACC unit */ }
    return c;
  }

  function normalizeParamDomain(raw) {
    if (raw == null || raw === "") return {};
    if (typeof raw === "object" && !_isArray(raw)) return raw;
    try {
      var o = JSON.parse(String(raw));
      if (o && typeof o === "object" && !_isArray(o)) return o;
    } catch (e) { /* fall through */ }
    return {};
  }

  function _tagAxes(tagsStr) {
    var raw = String(tagsStr || "").split(/[,;\s]+/);
    var out = [];
    var seen = {};
    for (var i = 0; i < raw.length; i++) {
      var t = _trim(raw[i]).toLowerCase();
      if (!t || seen[t]) continue;
      seen[t] = 1;
      out.push(t);
    }
    return out;
  }

  function axisFromCard(card) {
    if (!card) return "";
    var axes = _tagAxes(card.tags);
    if (axes.length) return String(axes[0] || "").toLowerCase();
    var name = String(card.name || "").toLowerCase();
    var segs = name.split("__");
    if (segs.length >= 3) return segs[segs.length - 1];
    return "";
  }

  function axisFromSlot(slot) {
    var text = "";
    var hintCat = "";
    var concept = "";
    var kind = "";
    if (slot && typeof slot === "object") {
      text = String(slot.text || "");
      hintCat = String(slot.hintedCategory || "").toLowerCase();
      concept = String(slot.concept || "");
      kind = String(slot.kind || "");
    } else {
      text = String(slot || "");
    }
    var fromC = _axisFromConcept(concept, kind);
    if (fromC) return [fromC];
    var hints = _axisHintsFromText(text);
    if (hints.length) return hints;
    var mapped = HINT_CAT_TO_AXIS[hintCat];
    if (mapped) return [mapped];
    return [];
  }

  function _axisFromConcept(concept, kind) {
    var c = String(concept || "").toLowerCase();
    if (!c) return "";
    if (c.indexOf("gender") >= 0 || c.indexOf("sex") >= 0) return "gender";
    if (c.indexOf("region") >= 0 || c.indexOf("area") >= 0 ||
        c.indexOf("city") >= 0 || c.indexOf("province") >= 0) return "region";
    if (c.indexOf("age") >= 0) return "age";
    if (c.indexOf("plan") >= 0 || c.indexOf("fare") >= 0 || c.indexOf("tariff") >= 0)
      return "plan";
    if (c.indexOf("consent") >= 0) return "consent";
    if (c.indexOf("join") >= 0 || c.indexOf("signup") >= 0 || c.indexOf("tenure") >= 0)
      return "joindate";
    if (String(kind || "").toLowerCase() === "range" && c.indexOf("date") >= 0)
      return "joindate";
    return "";
  }

  function _axisHintsFromText(slotText) {
    var t = String(slotText || "");
    var hints = [];
    function push(a) {
      for (var i = 0; i < hints.length; i++) if (hints[i] === a) return;
      hints.push(a);
    }
    if (/\bgender\b|\bsex\b/i.test(t)) push("gender");
    if (/\bage\b|\bagegroup\b/i.test(t)) push("age");
    if (/\bplan\b/i.test(t)) push("plan");
    if (/\bregion\b|\barea\b/i.test(t)) push("region");
    if (/\bconsent\b/i.test(t)) push("consent");
    if (/join\s*date|\bcreated\b|\bsignup\b|\btenure\b/i.test(t)) push("joindate");
    return hints;
  }

  function _axisAliasMatch(hint, axis) {
    if (!hint || !axis) return false;
    if (hint === axis) return true;
    if (hint === "plan" && axis.indexOf("plan") >= 0) return true;
    if (hint === "consent" && (axis.indexOf("consent") >= 0 || axis.indexOf("marketing") >= 0))
      return true;
    if (hint === "age" && (axis === "age" || axis === "agegroup")) return true;
    if (hint === "gender" && (axis === "gender" || axis === "sex")) return true;
    if (hint === "region" && (axis === "region" || axis === "area")) return true;
    if (hint === "joindate" &&
        (axis.indexOf("join") >= 0 || axis.indexOf("signup") >= 0 ||
         axis.indexOf("created") >= 0 || axis === "tenure"))
      return true;
    return false;
  }

  function axesCompatible(card, slotOrText) {
    var hints;
    if (slotOrText && typeof slotOrText === "object")
      hints = axisFromSlot(slotOrText);
    else
      hints = _axisHintsFromText(slotOrText);
    if (!hints.length) return true;
    var axis = axisFromCard(card);
    if (!axis) return false;
    for (var i = 0; i < hints.length; i++) {
      if (_axisAliasMatch(hints[i], axis)) return true;
    }
    return false;
  }

  function stemToken(raw) {
    return _trim(raw);
  }

  function isNoiseToken(raw) {
    return !_trim(raw);
  }

  function isNoiseResidue(text) {
    return !_trim(text || "");
  }

  function collectLexicon(cards) {
    var out = [];
    var seen = {};
    var list = cards || [];
    function add(key, card) {
      var k = _trim(key);
      if (k.length < 2 || isNoiseToken(k)) return;
      var name = card && card.name ? String(card.name) : "";
      var id = _norm(k) + "|" + name;
      if (seen[id]) return;
      seen[id] = 1;
      out.push({
        key: k,
        name: name,
        axis: axisFromCard(card),
        card: card
      });
    }
    function addMap(map, card) {
      var nk, nv, dbv;
      if (!map || typeof map !== "object") return;
      for (nk in map) {
        if (!map.hasOwnProperty(nk)) continue;
        add(nk, card);
        nv = map[nk];
        dbv = entryDb(nv);
        if (dbv != null && typeof dbv !== "object") add(String(dbv), card);
      }
    }
    var ci, card, domain, k, spec, ei, syn, si, synParts;
    for (ci = 0; ci < list.length; ci++) {
      card = list[ci];
      if (!card) continue;
      domain = normalizeParamDomain(card.param_domain);
      for (k in domain) {
        if (!domain.hasOwnProperty(k) || String(k).charAt(0) === "_") continue;
        spec = domain[k] || {};
        addMap(spec.nlMap, card);
        if (spec.enum && typeof spec.enum.length === "number") {
          for (ei = 0; ei < spec.enum.length; ei++) add(spec.enum[ei], card);
        }
      }
      if (domain._bucket) addMap(domain._bucket.nlMap, card);
      _eachGroup(domain, function (gpk, alias, gentry) {
        add(alias, card);
        var gi;
        for (gi = 0; gi < gentry.members.length; gi++)
          add(gentry.members[gi], card);
      });
      syn = card.synonyms;
      if (typeof syn === "string") synParts = syn.split(/[,;]+/);
      else if (syn && typeof syn.length === "number") synParts = syn;
      else synParts = [];
      for (si = 0; si < synParts.length; si++) add(synParts[si], card);
    }
    return out;
  }

  function splitByLexicon(nl, lexicon) {
    var text = String(nl || "");
    if (!text || !lexicon || !lexicon.length) return [];
    var entries = [];
    var ei;
    for (ei = 0; ei < lexicon.length; ei++) entries.push(lexicon[ei]);
    entries.sort(function (a, b) {
      return String(b.key || "").length - String(a.key || "").length;
    });
    var used = [];
    var ui;
    for (ui = 0; ui < text.length; ui++) used.push(0);
    var hits = [];
    var k, klen, pos, at, overlap, hi, hLow, nLow;
    hLow = text.toLowerCase();
    for (ei = 0; ei < entries.length; ei++) {
      k = _trim(entries[ei] && entries[ei].key);
      klen = k.length;
      if (klen < 2) continue;
      nLow = k.toLowerCase();
      pos = 0;
      while (pos <= hLow.length - klen) {
        at = hLow.indexOf(nLow, pos);
        if (at < 0) break;
        overlap = false;
        for (hi = 0; hi < klen; hi++) {
          if (used[at + hi]) { overlap = true; break; }
        }
        if (!overlap) {
          var tokStart = at;
          var tokEnd = at + klen;
          while (tokStart > 0 && _isWordChar(text.charAt(tokStart - 1))) tokStart--;
          while (tokEnd < text.length && _isWordChar(text.charAt(tokEnd))) tokEnd++;
          var token = text.substring(tokStart, tokEnd);
          var hint = _lexHint(entries[ei].card, k);
          if (!_tokenAliasHit(token, k, hint.db, hint.group)) {
            pos = at + 1;
            continue;
          }
          for (hi = 0; hi < klen; hi++) used[at + hi] = 1;
          hits.push({
            start: at,
            key: k,
            name: entries[ei].name,
            axis: entries[ei].axis,
            card: entries[ei].card
          });
        }
        pos = at + 1;
      }
    }
    hits.sort(function (a, b) { return a.start - b.start; });
    var slots = [];
    var seen = {};
    var i, h, id, hintCat;
    for (i = 0; i < hits.length; i++) {
      h = hits[i];
      id = String(h.name || "") + ":" + _norm(h.key);
      if (seen[id]) continue;
      seen[id] = 1;
      hintCat = "demo";
      if (h.axis === "plan") hintCat = "plan";
      if (h.axis === "joindate") hintCat = "signup";
      slots.push({
        text: h.key,
        hintedCategory: hintCat,
        searchKeywords: [h.key, h.axis],
        resolvedName: h.name || ""
      });
    }
    return slots;
  }

  function mergeLexiconSlots(lexSlots, llmSlots) {
    var lex = lexSlots || [];
    var llm = llmSlots || [];
    if (!lex.length) return llm;
    var out = [];
    var i, j, s, covered, k;
    for (i = 0; i < lex.length; i++) out.push(lex[i]);
    for (i = 0; i < llm.length; i++) {
      s = llm[i];
      if (!s || isNoiseResidue(s.text)) continue;
      covered = false;
      for (j = 0; j < out.length; j++) {
        k = String(out[j].text || "");
        if (!k) continue;
        if (_ciHas(s.text, k) || _ciHas(k, s.text)) {
          var llmT = String(s.text || "");
          if (llmT.length > k.length && _ciHas(llmT, k) && !_ciHas(k, llmT))
            continue;
          covered = true;
          if (s.concept && !out[j].concept) out[j].concept = s.concept;
          if (s.en_literal && !out[j].en_literal) out[j].en_literal = s.en_literal;
          if (s.kind && !out[j].kind) out[j].kind = s.kind;
          break;
        }
      }
      if (!covered) out.push(s);
    }
    return out;
  }

  function _pushUniqueTok(arr, seen, raw) {
    var s = _trim(raw);
    if (s.length < 2) return;
    var key = s.toLowerCase();
    if (seen[key]) return;
    seen[key] = 1;
    arr.push(s);
  }

  function buildIndexFields(opts) {
    opts = opts || {};
    var slotText = _trim(opts.slotText || "");
    var rationale = _trim(opts.rationale || "");
    var label = _trim(opts.label || "");
    var name = _trim(opts.name || "");
    var domain = normalizeParamDomain(opts.param_domain != null ? opts.param_domain : opts.paramDomain);

    var samples = [];
    if (slotText) samples.push(slotText);
    if (rationale) samples.push(rationale);
    if (!samples.length) samples.push(label || name || "");

    var syn = [];
    var seen = {};
    var parts = String(slotText).split(/[^0-9a-zA-Z가-힣]+/);
    var pi;
    for (pi = 0; pi < parts.length; pi++) _pushUniqueTok(syn, seen, parts[pi]);
    if (slotText) _pushUniqueTok(syn, seen, slotText);

    function pushNlMap(sm) {
      if (!sm || typeof sm !== "object") return;
      for (var sn in sm) {
        if (!sm.hasOwnProperty(sn)) continue;
        _pushUniqueTok(syn, seen, sn);
        var stL = String(sn).toLowerCase();
        if (stL !== sn) _pushUniqueTok(syn, seen, stL);
      }
    }
    var sk;
    for (sk in domain) {
      if (!domain.hasOwnProperty(sk)) continue;
      if (sk.charAt(0) === "_") continue;
      pushNlMap(domain[sk] && domain[sk].nlMap);
    }
    if (domain._bucket) pushNlMap(domain._bucket.nlMap);
    _eachGroup(domain, function (gpk, alias, gentry) {
      _pushUniqueTok(syn, seen, alias);
      var gei;
      for (gei = 0; gei < gentry.en.length; gei++)
        _pushUniqueTok(syn, seen, gentry.en[gei]);
    });

    return {
      synonyms: syn.length ? syn.join(",") : "",
      sample_questions: samples,
      sample_questions_json: JSON.stringify(samples)
    };
  }

  function likeFieldExprs() {
    return MATCH_PROFILE.likeFields.slice(0);
  }

  function scoreWeights() {
    var w = MATCH_PROFILE.scoreWeights;
    var out = {};
    for (var k in w) if (w.hasOwnProperty(k)) out[k] = w[k];
    return out;
  }

  function coverFieldNames() {
    return MATCH_PROFILE.coverFields.slice(0);
  }

  function matchProfile() {
    return {
      likeFields: likeFieldExprs(),
      scoreWeights: scoreWeights(),
      coverFields: coverFieldNames(),
      categoryHintBonus: MATCH_PROFILE.categoryHintBonus,
      libraryRequiresSource: MATCH_PROFILE.libraryRequiresSource,
      hintCatToAxis: HINT_CAT_TO_AXIS
    };
  }

  function keywordsFromSlot(slot) {
    var maxTok = 12;
    var maxLen = 40;
    try {
      if (testWoo.cfg && testWoo.cfg.getConfig) {
        var cfg = testWoo.cfg.getConfig();
        if (cfg.search && cfg.search.maxTokens) maxTok = cfg.search.maxTokens;
        if (cfg.guard && cfg.guard.MAX_TOKEN_LEN) maxLen = cfg.guard.MAX_TOKEN_LEN;
      }
    } catch (eC) { /* defaults */ }
    var seen = {};
    var out = [];
    function push(raw) {
      var s = _trim(raw);
      if (!s || s.length < 2) return;
      if (s.length > maxLen) s = s.substring(0, maxLen);
      var key = s.toLowerCase();
      if (!seen[key]) {
        seen[key] = true;
        out.push(s);
      }
      var compact = _norm(s);
      if (compact && !seen[compact]) {
        seen[compact] = true;
        out.push(compact);
      }
    }
    if (!slot) return [];
    var kws = slot.searchKeywords;
    if (kws && _isArray(kws)) {
      for (var i = 0; i < kws.length; i++) push(kws[i]);
    }
    if (slot.text) {
      var raw = String(slot.text).split(/[^0-9a-zA-Z가-힣]+/);
      for (var j = 0; j < raw.length; j++) push(raw[j]);
    }
    // 값 토큰이 색인에 없어도 tags=age LIKE로 축 frag를 찾는다.
    var hints = axisFromSlot(slot);
    for (var hi = 0; hi < hints.length; hi++) push(hints[hi]);
    return out.slice(0, Math.max(maxTok * 3, 12));
  }

  function _fieldBlob(card, field) {
    if (!card) return "";
    var v = card[field];
    if (v == null) return "";
    if (field === "sample_questions") {
      if (typeof v === "object" && typeof v.length === "number") return v.join(" ");
      return String(v);
    }
    if (field === "param_domain") {
      if (typeof v === "object") {
        try { return JSON.stringify(v); } catch (eJ) { return String(v); }
      }
      return String(v);
    }
    return String(v);
  }

  function _coverBlob(card) {
    var fields = MATCH_PROFILE.coverFields;
    var parts = [];
    for (var i = 0; i < fields.length; i++)
      parts.push(_fieldBlob(card, fields[i]));
    return parts.join(" ").toLowerCase().replace(/\s+/g, "");
  }

  function coversSlot(card, slot) {
    if (!card) return false;
    var slotObj = (slot && typeof slot === "object") ? slot :
      { text: String(slot || ""), searchKeywords: [] };
    var slotText = String(slotObj.text || "");
    if (!axesCompatible(card, slotObj)) return false;
    var need = (slotObj.searchKeywords && slotObj.searchKeywords.length) ?
      slotObj.searchKeywords : slotText.split(/[^0-9a-zA-Z가-힣]+/);
    var blob = _coverBlob(card);
    var req = 0;
    var hit = 0;
    for (var i = 0; i < need.length; i++) {
      var t = String(need[i] || "").toLowerCase().replace(/\s+/g, "");
      if (t.length < 2) continue;
      req++;
      if (blob.indexOf(t) >= 0) hit++;
    }
    if (req > 0 && hit === req) return true;
    return false;
  }

  function _isEnPair(v) {
    return !!(v && typeof v === "object" && !_isArray(v) &&
      (v.db != null || _isArray(v.en)));
  }

  function entryDb(v) {
    if (_isEnPair(v) && v.db != null) return v.db;
    return v;
  }

  function _normalizeMembers(raw) {
    var arr = _isArray(raw) ? raw : (raw != null && raw !== "" ? [raw] : []);
    var out = [];
    var seen = {};
    var i, s;
    for (i = 0; i < arr.length; i++) {
      if (arr[i] != null && typeof arr[i] === "object") continue;
      s = String(arr[i]);
      if (!s || seen[s]) continue;
      seen[s] = 1;
      out.push(s);
    }
    return out;
  }

  function _normalizeGroupEntry(raw) {
    if (!raw || typeof raw !== "object" || _isArray(raw)) return null;
    var members = _normalizeMembers(raw.members);
    if (!members.length) return null;
    var src = String(raw.src || "llm").toLowerCase();
    if (src !== "human") src = "llm";
    var en = [];
    var seenEn = {};
    var ei, e;
    if (_isArray(raw.en)) {
      for (ei = 0; ei < raw.en.length; ei++) {
        if (raw.en[ei] != null && typeof raw.en[ei] === "object") continue;
        e = _trim(raw.en[ei]);
        if (e.length < 2 || seenEn[e.toLowerCase()]) continue;
        seenEn[e.toLowerCase()] = 1;
        en.push(e);
      }
    }
    return {
      members: members,
      src: src,
      verified: raw.verified === true || raw.verified === "true",
      en: en
    };
  }

  function _paramCandidates(domain, pk) {
    var out = [];
    var seen = {};
    function add(v) {
      if (v == null || typeof v === "object") return;
      var s = String(v);
      if (!s || seen[s]) return;
      seen[s] = 1;
      out.push(s);
    }
    var spec = (domain && domain[pk]) || {};
    var ei, nk;
    if (spec.enum && _isArray(spec.enum)) {
      for (ei = 0; ei < spec.enum.length; ei++) add(spec.enum[ei]);
    }
    if (spec.nlMap && typeof spec.nlMap === "object") {
      for (nk in spec.nlMap) {
        if (!spec.nlMap.hasOwnProperty(nk)) continue;
        add(entryDb(spec.nlMap[nk]));
      }
    }
    return out;
  }

  function _isCandDb(domain, pk, val) {
    if (val == null || typeof val === "object") return false;
    var cand = _paramCandidates(domain, pk);
    var s = String(val);
    var i;
    for (i = 0; i < cand.length; i++) {
      if (String(cand[i]) === s) return true;
    }
    return false;
  }

  function _finestValue(domain, pk, alias, stored) {
    var a = alias != null ? String(alias) : "";
    if (a && _isCandDb(domain, pk, a)) return a;
    return stored;
  }

  function _filterGroupMembers(domain, pk, members) {
    var cand = _paramCandidates(domain, pk);
    var src = _normalizeMembers(members);
    if (!cand.length) return src;
    var allow = {};
    var i, m, out = [];
    for (i = 0; i < cand.length; i++) allow[String(cand[i])] = 1;
    for (i = 0; i < src.length; i++) {
      m = String(src[i]);
      if (allow[m]) out.push(m);
    }
    return out;
  }

  function _eachGroup(domain, fn) {
    var g = domain && domain._group;
    if (!g || typeof g !== "object" || _isArray(g)) return;
    var pk, alias, bucket, entry;
    for (pk in g) {
      if (!g.hasOwnProperty(pk) || String(pk).charAt(0) === "_") continue;
      bucket = g[pk];
      if (!bucket || typeof bucket !== "object" || _isArray(bucket)) continue;
      for (alias in bucket) {
        if (!bucket.hasOwnProperty(alias)) continue;
        entry = _normalizeGroupEntry(bucket[alias]);
        if (!entry) continue;
        fn(String(pk), String(alias), entry);
      }
    }
  }

  function _mergeGroupBlock(base, incGroup) {
    if (!incGroup || typeof incGroup !== "object" || _isArray(incGroup)) return false;
    if (!base._group || typeof base._group !== "object" || _isArray(base._group))
      base._group = {};
    var changed = false;
    var pk, alias, incB, incE, baseE, mi, bj, found, merged;
    for (pk in incGroup) {
      if (!incGroup.hasOwnProperty(pk) || String(pk).charAt(0) === "_") continue;
      incB = incGroup[pk];
      if (!incB || typeof incB !== "object" || _isArray(incB)) continue;
      if (!base._group[pk] || typeof base._group[pk] !== "object")
        base._group[pk] = {};
      for (alias in incB) {
        if (!incB.hasOwnProperty(alias)) continue;
        incE = _normalizeGroupEntry(incB[alias]);
        if (!incE) continue;
        baseE = _normalizeGroupEntry(base._group[pk][alias]);
        if (!baseE) {
          base._group[pk][alias] = incE;
          changed = true;
          continue;
        }
        merged = baseE.members.slice(0);
        for (mi = 0; mi < incE.members.length; mi++) {
          found = false;
          for (bj = 0; bj < merged.length; bj++) {
            if (String(merged[bj]) === String(incE.members[mi])) { found = true; break; }
          }
          if (!found) {
            merged.push(incE.members[mi]);
            changed = true;
          }
        }
        baseE.members = merged;
        if (baseE.src !== "human") {
          if (incE.src === "human") {
            baseE.src = "human";
            changed = true;
          } else if (incE.src && incE.src !== baseE.src) {
            baseE.src = incE.src;
          }
        }
        if (!baseE.verified && incE.verified) {
          baseE.verified = true;
          changed = true;
        }
        if (incE.en && incE.en.length) {
          if (!baseE.en) baseE.en = [];
          for (mi = 0; mi < incE.en.length; mi++) {
            found = false;
            for (bj = 0; bj < baseE.en.length; bj++) {
              if (String(baseE.en[bj]).toLowerCase() === String(incE.en[mi]).toLowerCase()) {
                found = true;
                break;
              }
            }
            if (!found) {
              baseE.en.push(incE.en[mi]);
              changed = true;
            }
          }
        }
        base._group[pk][alias] = baseE;
      }
    }
    return changed;
  }

  function upsertGroup(domainRaw, param, alias, members, meta) {
    var domain = normalizeParamDomain(domainRaw);
    var pk = _trim(param);
    var a = _trim(alias);
    if (!pk || !a || a.length > 24) return domain;
    meta = meta || {};
    var enIn = meta.en;
    var block = {};
    block[pk] = {};
    block[pk][a] = {
      members: _normalizeMembers(members),
      src: String(meta.src || "llm").toLowerCase() === "human" ? "human" : "llm",
      verified: meta.verified === true || meta.verified === "true",
      en: _isArray(enIn) ? enIn : (enIn ? [enIn] : [])
    };
    _mergeGroupBlock(domain, block);
    var g = domain._group && domain._group[pk] && domain._group[pk][a];
    if (g && g.members)
      g.members = _filterGroupMembers(domain, pk, g.members);
    return domain;
  }

  function domainMatchSlot(domainRaw, slotText) {
    var domain = normalizeParamDomain(domainRaw);
    if (!domain) return null;
    var text = String(slotText || "");
    if (!text) return null;
    if (domain._bucket && domain._bucket.nlMap && domain._bucket.nlMap[text] != null)
      return { param: "_bucket", nl: text, value: entryDb(domain._bucket.nlMap[text]) };
    var nd0 = _induceNDae(text);
    if (nd0 && _domainAcceptsNDae(domain))
      return { param: "_bucket", nl: text, value: nd0 };
    var k;
    for (k in domain) {
      if (!domain.hasOwnProperty(k)) continue;
      if (k.charAt(0) === "_") continue;
      var spec = domain[k] || {};
      var map = spec.nlMap;
      var nk, dbv, bound;
      var en = spec.enum;
      if (en && typeof en.length === "number") {
        for (var ei = 0; ei < en.length; ei++) {
          if (_boundHas(text, en[ei], en[ei], false))
            return { param: k, value: en[ei] };
        }
      }
      if (map && typeof map === "object") {
        for (nk in map) {
          if (!map.hasOwnProperty(nk)) continue;
          dbv = entryDb(map[nk]);
          if (_boundHas(text, nk, dbv, false) ||
              (dbv != null && typeof dbv !== "object" && _boundHas(text, dbv, dbv, false))) {
            bound = _finestValue(domain, k, nk, dbv != null ? dbv : map[nk]);
            return { param: k, nl: String(nk), value: bound };
          }
        }
      }
    }
    if (domain._bucket && domain._bucket.nlMap) {
      var bm = domain._bucket.nlMap;
      for (nk in bm) {
        if (!bm.hasOwnProperty(nk)) continue;
        if (_boundHas(text, nk, null, true))
          return { param: "_bucket", nl: String(nk), value: entryDb(bm[nk]) };
      }
    }
    var bestAlias = "";
    var bestPk = "";
    var bestMembers = null;
    _eachGroup(domain, function (gpk, alias, gentry) {
      if (!_boundHas(text, alias, null, true)) return;
      if (_isCandDb(domain, gpk, alias)) {
        if (String(alias).length >= String(bestAlias).length) {
          bestAlias = alias;
          bestPk = gpk;
          bestMembers = [alias];
        }
        return;
      }
      var mem = _filterGroupMembers(domain, gpk, gentry.members);
      if (!mem.length) return;
      if (String(alias).length >= String(bestAlias).length) {
        bestAlias = alias;
        bestPk = gpk;
        bestMembers = mem;
      }
    });
    if (bestMembers) {
      if (bestMembers.length === 1 && String(bestMembers[0]) === bestAlias &&
          _isCandDb(domain, bestPk, bestAlias))
        return { param: bestPk, nl: bestAlias, value: bestAlias };
      return { param: bestPk, nl: bestAlias, value: bestMembers, group: true };
    }
    return null;
  }

  var HEAL_COOLDOWN_MS = 600000;
  var NEGATIVE_TTL_MS = 86400000;

  function _healCooldownMs() {
    try {
      var env = testWoo.env && testWoo.env.getEnv ? testWoo.env.getEnv() : null;
      var t = env && env.triage;
      if (t && t.healCooldownMs != null) {
        var n = Number(t.healCooldownMs);
        if (!isNaN(n) && n >= 0) return n;
      }
    } catch (eC) { /* default */ }
    return HEAL_COOLDOWN_MS;
  }

  function _negativeTtlMs() {
    try {
      var env = testWoo.env && testWoo.env.getEnv ? testWoo.env.getEnv() : null;
      var t = env && env.triage;
      if (t && t.negativeTtlMs != null) {
        var n = Number(t.negativeTtlMs);
        if (!isNaN(n) && n >= 0) return n;
      }
    } catch (eT) { /* default */ }
    return NEGATIVE_TTL_MS;
  }

  function conceptOf(domainRaw) {
    var domain = normalizeParamDomain(domainRaw);
    var src = domain && domain._source;
    return src && src.concept ? String(src.concept) : "";
  }

  function _domainKind(domain) {
    var src = domain && domain._source;
    var t = src ? String(src.tier || src.kind || "").toLowerCase() : "";
    if (t === "enum" || t === "categorical") return "categorical";
    if (t === "range") return "range";
    if (t === "boolean") return "boolean";
    if (domain && domain._bucket) return "range";
    return "categorical";
  }

  function kindCompatible(slotKind, domainRaw) {
    var sk = String(slotKind || "other").toLowerCase();
    var dk = _domainKind(normalizeParamDomain(domainRaw));
    if (!sk || sk === "other") return true;
    return sk === dk;
  }

  function _dbKey(db) {
    if (db != null && typeof db === "object") {
      try { return JSON.stringify(db); } catch (eJ) { return String(db); }
    }
    return String(db);
  }

  function _enList(v) {
    if (_isEnPair(v) && _isArray(v.en)) return v.en;
    return null;
  }

  function _enHit(entry, lit) {
    var ens = _enList(entry);
    var n = _norm(lit);
    if (!ens || !n || n.length < 2) return false;
    var i, e, toks, ti, tok;
    toks = n.split(/[^a-z0-9]+/);
    for (i = 0; i < ens.length; i++) {
      e = _norm(ens[i]);
      if (!e || e.length < 2) continue;
      if (n === e) return true;
      for (ti = 0; ti < toks.length; ti++) {
        tok = toks[ti];
        if (!tok || tok.length < 2) continue;
        if (/^\d{1,2}$/.test(tok)) continue;
        if (tok === e) return true;
      }
    }
    return false;
  }

  function _walkNlMaps(domain, fn) {
    var k, spec, map, nk;
    for (k in domain) {
      if (!domain.hasOwnProperty(k)) continue;
      if (k.charAt(0) === "_") continue;
      spec = domain[k] || {};
      map = spec.nlMap;
      if (!map || typeof map !== "object") continue;
      for (nk in map) {
        if (!map.hasOwnProperty(nk)) continue;
        fn(k, String(nk), map[nk]);
      }
    }
    if (domain._bucket && domain._bucket.nlMap) {
      map = domain._bucket.nlMap;
      for (nk in map) {
        if (!map.hasOwnProperty(nk)) continue;
        fn("_bucket", String(nk), map[nk]);
      }
    }
    _eachGroup(domain, function (gpk, alias, gentry) {
      fn(gpk, alias, { db: gentry.members, en: gentry.en });
    });
  }

  function matchEnPivotSlot(domainRaw, slot) {
    var domain = normalizeParamDomain(domainRaw);
    var empty = { layer: null, param: "", nl: "", value: null, ambiguous: false, hits: [] };
    if (!domain || !slot) return empty;
    var surface = String(slot.surface || slot.text || "");
    var enLit = String(slot.en_literal || "");
    var concept = String(slot.concept || "");
    var kind = String(slot.kind || "");
    var m1 = surface ? domainMatchSlot(domain, surface) : null;
    if (m1)
      return {
        layer: m1.group ? "M2G" : "M1", param: m1.param, nl: m1.nl || "",
        value: m1.value, ambiguous: false, group: !!m1.group, hits: [m1]
      };
    if (_domainAcceptsNDae(domain)) {
      var ndE = _induceNDae(enLit);
      if (ndE)
        return {
          layer: "M1", param: "_bucket", nl: surface || enLit,
          value: ndE, ambiguous: false, group: false,
          hits: [{ param: "_bucket", nl: surface || enLit, value: ndE }]
        };
    }
    var hits = [];
    var seen = {};
    _walkNlMaps(domain, function (param, nl, entry) {
      var db = entryDb(entry);
      var isG = _isArray(db);
      var dbHint = isG ? "" : db;
      var koOk = surface && (_boundHas(surface, nl, dbHint, isG) ||
        (!isG && db != null && typeof db !== "object" &&
          _boundHas(surface, String(db), db, false)));
      var enOk = !!(enLit && _enHit(entry, enLit));
      if (surface && !koOk && enOk && _aliasPrefixConflict(surface, nl, dbHint, isG))
        enOk = false;
      if (!koOk && !enOk) return;
      var key = param + "|" + _dbKey(db);
      if (seen[key]) return;
      seen[key] = 1;
      hits.push({ param: param, nl: nl, value: db });
    });
    if (hits.length === 1) {
      var gHit = _isArray(hits[0].value);
      return {
        layer: gHit ? "M2G" : "M2", param: hits[0].param, nl: hits[0].nl,
        value: hits[0].value, ambiguous: false, group: gHit, hits: hits
      };
    }
    if (hits.length > 1)
      return {
        layer: "M2", param: "", nl: "", value: null,
        ambiguous: true, hits: hits
      };
    var locked = conceptOf(domain);
    if (concept && locked && concept === locked && kindCompatible(kind, domain))
      return {
        layer: "M3", param: "", nl: "", value: null,
        ambiguous: false, hits: [], concept: locked, kindOk: true
      };
    return empty;
  }

  function isNegative(domainRaw, key, nowMs) {
    var domain = normalizeParamDomain(domainRaw);
    var neg = domain && domain._negative;
    if (!neg || typeof neg !== "object") return false;
    var k = String(key || "");
    if (!k || neg[k] == null) return false;
    var ts = Number(neg[k]);
    if (isNaN(ts)) return false;
    var now = nowMs != null ? Number(nowMs) : new Date().getTime();
    return (now - ts) < _negativeTtlMs();
  }

  function markNegative(domainRaw, key, nowMs) {
    var domain = normalizeParamDomain(domainRaw);
    var k = String(key || "");
    if (!k) return domain;
    if (!domain._negative || typeof domain._negative !== "object") domain._negative = {};
    domain._negative[k] = nowMs != null ? Number(nowMs) : new Date().getTime();
    return domain;
  }

  function inHealCooldown(domainRaw, nowMs) {
    var domain = normalizeParamDomain(domainRaw);
    var src = domain && domain._source;
    if (!src || src.healAt == null) return false;
    var ts = Number(src.healAt);
    if (isNaN(ts)) return false;
    var now = nowMs != null ? Number(nowMs) : new Date().getTime();
    return (now - ts) < _healCooldownMs();
  }

  function stampHeal(domainRaw, nowMs) {
    var domain = normalizeParamDomain(domainRaw);
    if (!domain._source || typeof domain._source !== "object") domain._source = {};
    domain._source.healAt = nowMs != null ? Number(nowMs) : new Date().getTime();
    return domain;
  }

  function _isSingleAxisCached(card, domain) {
    if (!domain || !domain._source) return false;
    var axes = _tagAxes(card && card.tags);
    return axes.length === 1;
  }

  // 서가 identity = 축 + _source + 단일 tags. 값 미등재는 heal 대상이지 신규 frag가 아님.
  // 축 힌트 없는 슬롯은 키워드 AND 또는 도메인 값 매칭만(타축 삼킴 방지).
  function libraryHitPredicate(card, slot, domainRaw) {
    if (!card) return false;
    var slotObj = (slot && typeof slot === "object") ? slot :
      { text: String(slot || ""), searchKeywords: [] };
    var slotText = String(slotObj.text || "");
    var domain = normalizeParamDomain(domainRaw != null ? domainRaw : card.param_domain);
    if (MATCH_PROFILE.libraryRequiresSource && (!domain || !domain._source))
      return false;
    if (!axesCompatible(card, slotObj)) return false;
    var need = (slotObj.searchKeywords && slotObj.searchKeywords.length) ?
      slotObj.searchKeywords : slotText.split(/[^0-9a-zA-Z가-힣]+/);
    var blob = _coverBlob(card);
    var req = 0;
    var hit = 0;
    var ti;
    for (ti = 0; ti < need.length; ti++) {
      var t = String(need[ti] || "").toLowerCase().replace(/\s+/g, "");
      if (t.length < 2) continue;
      req++;
      if (blob.indexOf(t) >= 0) hit++;
    }
    if (req > 0 && hit === req) return true;
    var hints = axisFromSlot(slotObj);
    if (!hints.length) return !!domainMatchSlot(domain, slotText);
    if (!_isSingleAxisCached(card, domain)) return false;
    return true;
  }

  function sampleBindSql(sqlText, domainRaw) {
    var domain = normalizeParamDomain(domainRaw);
    var unbound = [];
    var sql = promoteEqPlaceholderToIn(sqlText);
    var out = String(sql || "").replace(/\{\{(\w+)\}\}/g, function (_m, key) {
      var spec = domain[key] || {};
      var map = spec.nlMap;
      var nk, nv, bk, b;
      if (map && typeof map === "object") {
        for (nk in map) {
          if (!map.hasOwnProperty(nk)) continue;
          nv = entryDb(map[nk]);
          if (_isArray(nv) && nv.length) return _sqlLitJoin(nv);
          if (nv != null && typeof nv !== "object") return _sqlLit(nv);
        }
      }
      if (spec.enum && _isArray(spec.enum) && spec.enum.length)
        return _sqlLitJoin(spec.enum[0]);
      if (domain._bucket && domain._bucket.nlMap) {
        for (bk in domain._bucket.nlMap) {
          if (!domain._bucket.nlMap.hasOwnProperty(bk)) continue;
          b = entryDb(domain._bucket.nlMap[bk]);
          if (b && b[key] != null) {
            if (_isArray(b[key])) return _sqlLitJoin(b[key]);
            if (typeof b[key] !== "object") return _sqlLit(b[key]);
          }
        }
      }
      if (key === "ageMin") return "20";
      if (key === "ageMax") return "30";
      var typ = String(spec.type || "").toLowerCase();
      if (typ === "int" || typ === "integer" || typ === "long" || typ === "number" ||
          typ === "byte" || typ === "short" || typ === "float" || typ === "double")
        return "0";
      unbound.push(key);
      return "'__sample__'";
    });
    if (unbound.length)
      logCode(ERROR_CODES.BIND_TYPE, "fallback __sample__ keys=" + unbound.join(","));
    return out;
  }

  // Compiler bindPlanParams 와 동일 해석 — haystack에서 nlMap/_bucket → params
  function resolveNlParams(domainRaw, haystack, needKeys) {
    var domain = normalizeParamDomain(domainRaw);
    var hay = String(haystack || "");
    var need = needKeys || null;
    var params = {};
    var pk;

    if (domain._bucket && domain._bucket.nlMap) {
      var bm = domain._bucket.nlMap;
      var bestB = "";
      var bestBv = null;
      for (var bk in bm) {
        if (!bm.hasOwnProperty(bk)) continue;
        if (!_boundHas(hay, bk, null, true)) continue;
        if (String(bk).length >= String(bestB).length) {
          bestB = String(bk);
        bestBv = entryDb(bm[bk]);
        }
      }
      if (bestBv && typeof bestBv === "object") {
        for (pk in bestBv) {
          if (!bestBv.hasOwnProperty(pk)) continue;
          if (need && !need[pk]) continue;
          params[pk] = bestBv[pk];
        }
      }
    }

    for (pk in domain) {
      if (!domain.hasOwnProperty(pk)) continue;
      if (pk.charAt(0) === "_") continue;
      if (need && !need[pk]) continue;
      if (params[pk] != null && params[pk] !== "") continue;
      var spec = domain[pk] || {};
      var ev, evi;
      if (spec.enum && _isArray(spec.enum)) {
        for (evi = 0; evi < spec.enum.length; evi++) {
          ev = spec.enum[evi];
          if (_boundHas(hay, ev, ev, false)) {
            params[pk] = ev;
            break;
          }
        }
      }
      if (params[pk] != null && params[pk] !== "") continue;
      var map = spec.nlMap;
      if (!map || typeof map !== "object") continue;
      var bestK = "";
      var bestV = null;
      for (var nk in map) {
        if (!map.hasOwnProperty(nk)) continue;
        if (!_boundHas(hay, nk, entryDb(map[nk]), false) &&
            !_boundHas(hay, entryDb(map[nk]), entryDb(map[nk]), false)) continue;
        if (String(nk).length >= String(bestK).length) {
          bestK = String(nk);
          bestV = _finestValue(domain, pk, nk, entryDb(map[nk]));
        }
      }
      if (bestV != null && typeof bestV !== "object")
        params[pk] = bestV;
    }
    var gBest = {};
    _eachGroup(domain, function (gpk, alias, gentry) {
      if (need && !need[gpk]) return;
      if (params[gpk] != null && params[gpk] !== "") return;
      if (!_boundHas(hay, alias, null, true)) return;
      if (_isCandDb(domain, gpk, alias)) {
        if (!gBest[gpk] || String(alias).length >= String(gBest[gpk].alias).length)
          gBest[gpk] = { alias: alias, members: [alias] };
        return;
      }
      var mem = _filterGroupMembers(domain, gpk, gentry.members);
      if (!mem.length) return;
      if (!gBest[gpk] || String(alias).length >= String(gBest[gpk].alias).length)
        gBest[gpk] = { alias: alias, members: mem };
    });
    for (pk in gBest) {
      if (!gBest.hasOwnProperty(pk)) continue;
      if (gBest[pk].members.length === 1 &&
          String(gBest[pk].members[0]) === gBest[pk].alias &&
          _isCandDb(domain, pk, gBest[pk].alias))
        params[pk] = gBest[pk].alias;
      else
        params[pk] = gBest[pk].members.slice(0);
    }
    return params;
  }

  function _numericVals(params) {
    var out = [];
    if (!params || typeof params !== "object") return out;
    var k;
    for (k in params) {
      if (!params.hasOwnProperty(k)) continue;
      if (String(k).charAt(0) === "_") continue;
      var v = params[k];
      if (v != null && typeof v === "object") continue;
      var n = Number(v);
      if (isFinite(n) && String(v) !== "" && String(v) !== "true" && String(v) !== "false")
        out.push(n);
    }
    return out;
  }

  // params가 _range/enum/type과 맞는지. 컬럼명·연령대 규칙 하드코딩 없음.
  function validateBind(domainRaw, params) {
    var domain = normalizeParamDomain(domainRaw);
    if (!params || typeof params !== "object")
      return { ok: false, reason: "no params" };
    var nums = _numericVals(params);
    if (domain._range && nums.length) {
      var mn = nums[0];
      var mx = nums[0];
      var ni;
      for (ni = 1; ni < nums.length; ni++) {
        if (nums[ni] < mn) mn = nums[ni];
        if (nums[ni] > mx) mx = nums[ni];
      }
      if (domain._range.min != null && mx < Number(domain._range.min))
        return { ok: false, reason: "out_of_range" };
      if (domain._range.max != null && mn > Number(domain._range.max))
        return { ok: false, reason: "out_of_range" };
    }
    var pk;
    for (pk in params) {
      if (!params.hasOwnProperty(pk)) continue;
      if (String(pk).charAt(0) === "_") continue;
      var spec = domain[pk];
      if (!spec || !spec.enum || !_isArray(spec.enum) || !spec.enum.length) continue;
      var val = params[pk];
      var vals;
      if (_isArray(val)) {
        if (!val.length) return { ok: false, reason: "empty_array", param: pk };
        vals = val;
      } else if (val != null && typeof val === "object") {
        continue;
      } else {
        vals = [val];
      }
      var vi;
      for (vi = 0; vi < vals.length; vi++) {
        var one = vals[vi];
        if (one != null && typeof one === "object")
          return { ok: false, reason: "not_in_enum", param: pk };
        var found = false;
        var ei;
        for (ei = 0; ei < spec.enum.length; ei++) {
          if (String(spec.enum[ei]) === String(one)) { found = true; break; }
        }
        if (!found) return { ok: false, reason: "not_in_enum", param: pk };
      }
    }
    return { ok: true };
  }

  // 슬롯 별칭을 nlMap/_bucket에 추가(이미 있으면 유지). 2+ 키는 _bucket, 1키는 해당 param.
  function attachAlias(domainRaw, alias, params) {
    var domain = normalizeParamDomain(domainRaw);
    var a = _trim(alias);
    if (!a || !params || typeof params !== "object") return domain;
    if (a.length > 12 || a.indexOf(" ") >= 0) return domain;
    var sqlKeys = [];
    var pk;
    for (pk in params) {
      if (!params.hasOwnProperty(pk)) continue;
      if (String(pk).charAt(0) === "_") continue;
      if (params[pk] == null || typeof params[pk] === "object") continue;
      sqlKeys.push(pk);
    }
    if (sqlKeys.length >= 2) {
      if (!domain._bucket || typeof domain._bucket !== "object")
        domain._bucket = { nlMap: {} };
      if (!domain._bucket.nlMap || typeof domain._bucket.nlMap !== "object")
        domain._bucket.nlMap = {};
      if (domain._bucket.nlMap[a] == null) {
        var bucket = {};
        var bi;
        for (bi = 0; bi < sqlKeys.length; bi++)
          bucket[sqlKeys[bi]] = params[sqlKeys[bi]];
        domain._bucket.nlMap[a] = bucket;
      }
      return domain;
    }
    if (sqlKeys.length === 1) {
      var p1 = sqlKeys[0];
      if (!domain[p1] || typeof domain[p1] !== "object")
        domain[p1] = { required: true, type: "string" };
      if (!domain[p1].nlMap || typeof domain[p1].nlMap !== "object")
        domain[p1].nlMap = {};
      if (domain[p1].nlMap[a] == null)
        domain[p1].nlMap[a] = params[p1];
    }
    return domain;
  }

  function mergeParamDomainJson(existingJson, incomingJson) {
    var base = normalizeParamDomain(existingJson);
    var inc = normalizeParamDomain(incomingJson);
    var changed = false;
    var k, nk, specB, specI, mapB, mapI;
    for (k in inc) {
      if (!inc.hasOwnProperty(k)) continue;
      specI = inc[k] || {};
      if (k === "_range" && specI && typeof specI === "object") {
        if (!base._range || typeof base._range !== "object") {
          base._range = { min: specI.min, max: specI.max };
          changed = true;
          continue;
        }
        if (specI.min != null &&
            (base._range.min == null || Number(specI.min) < Number(base._range.min))) {
          base._range.min = specI.min;
          changed = true;
        }
        if (specI.max != null &&
            (base._range.max == null || Number(specI.max) > Number(base._range.max))) {
          base._range.max = specI.max;
          changed = true;
        }
        continue;
      }
      if (k === "_group") {
        if (_mergeGroupBlock(base, specI)) changed = true;
        continue;
      }
      if (!base[k]) {
        base[k] = specI;
        changed = true;
        continue;
      }
      specB = base[k] || {};
      mapI = specI && specI.nlMap;
      if (mapI && typeof mapI === "object") {
        if (!specB.nlMap || typeof specB.nlMap !== "object") {
          specB.nlMap = {};
          changed = true;
        }
        mapB = specB.nlMap;
        for (nk in mapI) {
          if (!mapI.hasOwnProperty(nk)) continue;
          if (mapB[nk] == null) {
            mapB[nk] = mapI[nk];
            changed = true;
          }
        }
      }
      if (specI && specI.enum && _isArray(specI.enum)) {
        if (!specB.enum || !_isArray(specB.enum)) {
          specB.enum = [];
          changed = true;
        }
        var ei, ej, ev, found;
        for (ei = 0; ei < specI.enum.length; ei++) {
          ev = specI.enum[ei];
          found = false;
          for (ej = 0; ej < specB.enum.length; ej++) {
            if (String(specB.enum[ej]) === String(ev)) { found = true; break; }
          }
          if (!found) {
            specB.enum.push(ev);
            changed = true;
          }
        }
      }
      if (specI && specI.type && !specB.type) {
        specB.type = specI.type;
        changed = true;
      }
      base[k] = specB;
    }
    if (inc._source && typeof inc._source === "object") {
      var prevSrc = base._source && typeof base._source === "object" ? base._source : {};
      base._source = inc._source;
      if (prevSrc.concept) base._source.concept = prevSrc.concept;
      if (prevSrc.conceptAliases) base._source.conceptAliases = prevSrc.conceptAliases;
      if (prevSrc.enRefreshedAt) base._source.enRefreshedAt = prevSrc.enRefreshedAt;
      if (prevSrc.enModel) base._source.enModel = prevSrc.enModel;
      if (prevSrc.healAt != null && base._source.healAt == null)
        base._source.healAt = prevSrc.healAt;
      changed = true;
    }
    if (inc._negative && typeof inc._negative === "object") {
      if (!base._negative || typeof base._negative !== "object") base._negative = {};
      var nkNeg;
      for (nkNeg in inc._negative) {
        if (!inc._negative.hasOwnProperty(nkNeg)) continue;
        if (base._negative[nkNeg] == null) {
          base._negative[nkNeg] = inc._negative[nkNeg];
          changed = true;
        }
      }
    }
    return { changed: changed, json: JSON.stringify(base), domain: base };
  }

  function scoreCard(meta, tokens, hintCat) {
    var weights = MATCH_PROFILE.scoreWeights;
    var fields = [];
    var fk;
    for (fk in weights) {
      if (!weights.hasOwnProperty(fk)) continue;
      var blob = _norm(_fieldBlob(meta, fk));
      fields.push({ blob: blob, w: weights[fk] });
    }
    var score = 0;
    var hits = 0;
    for (var i = 0; i < tokens.length; i++) {
      var t = _norm(tokens[i]);
      var hit = false;
      if (!t) continue;
      for (var j = 0; j < fields.length; j++) {
        if (fields[j].blob.indexOf(t) >= 0) {
          score += fields[j].w / Math.sqrt(Math.max(fields[j].blob.length, 1) / 50);
          hit = true;
        }
      }
      if (hit) hits++;
    }
    if (!hits) return 0;
    if (hintCat && _norm(meta.category) === _norm(hintCat))
      score += MATCH_PROFILE.categoryHintBonus;
    return score;
  }

  return {
    errorCodes: ERROR_CODES,
    logCode: logCode,
    matchProfile: matchProfile,
    likeFieldExprs: likeFieldExprs,
    scoreWeights: scoreWeights,
    coverFieldNames: coverFieldNames,
    axisFromSlot: axisFromSlot,
    axisFromCard: axisFromCard,
    axesCompatible: axesCompatible,
    stemToken: stemToken,
    isNoiseToken: isNoiseToken,
    isNoiseResidue: isNoiseResidue,
    collectLexicon: collectLexicon,
    splitByLexicon: splitByLexicon,
    mergeLexiconSlots: mergeLexiconSlots,
    buildIndexFields: buildIndexFields,
    keywordsFromSlot: keywordsFromSlot,
    normalizeParamDomain: normalizeParamDomain,
    domainMatchSlot: domainMatchSlot,
    matchEnPivotSlot: matchEnPivotSlot,
    conceptOf: conceptOf,
    kindCompatible: kindCompatible,
    isNegative: isNegative,
    markNegative: markNegative,
    inHealCooldown: inHealCooldown,
    stampHeal: stampHeal,
    validateBind: validateBind,
    attachAlias: attachAlias,
    mergeParamDomainJson: mergeParamDomainJson,
    coversSlot: coversSlot,
    libraryHitPredicate: libraryHitPredicate,
    sampleBindSql: sampleBindSql,
    promoteEqPlaceholderToIn: promoteEqPlaceholderToIn,
    resolveNlParams: resolveNlParams,
    upsertGroup: upsertGroup,
    entryDb: entryDb,
    scoreCard: scoreCard
  };
})();
testWoo.fragContract.__v = "175";
