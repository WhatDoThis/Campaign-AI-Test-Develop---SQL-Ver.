/*
 * testWooLlm.js (LLM Pass0·Pass1 파이프라인)
 * ==================================================
 * litmus 동기 __v=178 (N대 heal-miss를 여러항목으로 안 씀).
 * EnPivot(전체 문장 1콜, 캐시만 스킵) 후 Pass1. 추출 실패 시 재입력(Pass0 우회 금지).
 * 최종 SQL은 쓰지 않음. 동기 HttpClientRequest만 사용.
 *
 * [Main Functions]
 * ===========
 * - decomposeSlots — Pass0 NL→slots JSON(EnPivot 없을 때 폴백)
 * - normalizeAtomicSlots — EnPivot 슬롯 통과(중복·빈 텍스트만 제거)
 * - selectPlan — Pass1 후보→CNF plan JSON
 * - generatePlan — EnPivot→M1/M2/M2G/M2C/M3 매칭→Pass1. retryInput·unresolved 시 SQL 없음
 * - chat — 동기 chat/completions (EnPivot translateAndExtract)
 * - parseJson — LLM 봉투→JSON 객체
 * - postChat — chat/completions 호출·오류 메타 부착
 * - postEmbedding — embeddings 호출·오류 메타 부착
 * - explainDedupDiff — dedup near 차이 설명(판정 무관)
 * - reasoningOff — reasoning 비활성 body 조각
 *
 * [Dependencies]
 * =========
 * - testWoo.cfg.getConfig — apiKey·model·endpoint·provider
 * - testWoo.enPivot.extractSlots·toPipelineSlots — 전체 NL 번역 (load 선행)
 * - testWoo.fragments.searchSlots·listLexiconCards·healDomain·saveParamDomain
 * - testWoo.fragContract.matchEnPivotSlot·upsertGroup·validateBind — M1/M2G/M2/M2C/M3 · 바인딩
 * - HttpClientRequest + MemoryBuffer — serverConf urlPermission 필요
 * - Foundry `_normalizeSlots` — normalizeAtomicSlots 재사용
 *
 * [Invariants]
 * =========
 * - response_format json_object 미사용 — 프롬프트+_parseJson으로 JSON 강제
 * - HttpClientRequest.wait 금지 · Rhino map/forEach/filter 금지
 * - #170: 슬롯 1개 = 조건 축 1개. 쪼개기는 EnPivot extract
 * - 같은 tags/name 축 frag가 있으면 unmatched→Foundry 신규 생성 금지. 값은 heal. 별칭은 슬롯 원문만(NL 전체 금지)
 * - unresolved(value_not_in_domain|ambiguous|ambiguous_group) → Foundry 큐 금지
 * - #175-3: 상위어는 M2G/M2C 한 frag. 닫힌 후보에만 편입. 자식이 후보에 있으면 그 값을 씀. Pass1 UNION 분할 금지
 * - #175 G5: exclude만 있으면 include=[] 허용. 컴파일러가 grain universe + EXCEPT. polarity=exclude는 exclude[]로
 * - concept 없는 잔여(en_literal만 있는 glue 포함)는 unmatched/Foundry 금지. M2 히트만 조건으로 유지
 * - normalizeAtomicSlots는 KO 지역/성별/N대 regex로 재분할하지 않음
 * - Rhino strict: function 선언은 함수 본문 최상위만. for/if 안 금지
 */
var testWoo = testWoo || {};
testWoo.llm = (function () {
  "use strict";

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  function _requireLlmOpts(cfg) {
    var missing = [];
    if (!cfg.llm.apiKey) missing.push("API Key");
    if (!cfg.llm.model) missing.push("Model");
    if (!cfg.llm.endpoint) missing.push("Endpoint");
    if (!missing.length) return;
    logWarning("[testWoo.llm] LLM options not configured: " + missing.join(", "));
    throw new Error(
      "LLM 연결이 설정되어 있지 않습니다. " +
      "API Key 또는 Model(Endpoint) 설정을 확인해 주세요. " +
      "(누락: " + missing.join(", ") + ")"
    );
  }

  function _slotKeywords(text, maxTok) {
    var raw = String(text || "").split(/[^0-9a-zA-Z가-힣_]+/);
    var out = [];
    var seen = {};
    for (var i = 0; i < raw.length; i++) {
      var t = _trim(raw[i]);
      if (t.length < 2) continue;
      var key = t.toLowerCase();
      if (seen[key]) continue;
      seen[key] = 1;
      out.push(t);
      if (maxTok > 0 && out.length >= maxTok) break;
    }
    return out;
  }

  function _isNoiseResidue(text) {
    if (testWoo.fragContract && testWoo.fragContract.isNoiseResidue)
      return testWoo.fragContract.isNoiseResidue(text);
    return !_trim(text || "");
  }

  // EnPivot 슬롯 통과. KO 축 regex로 쪼개지 않음. 빈 텍스트만 버림.
  function _expandOneSlot(slot, maxTok) {
    var text = _trim(slot && slot.text != null ? slot.text : slot);
    if (!text) return [];
    var kws = (slot && slot.searchKeywords) ? slot.searchKeywords : [];
    return [{
      text: text,
      hintedCategory: slot && slot.hintedCategory ? String(slot.hintedCategory) : "",
      searchKeywords: kws.length ? kws : _slotKeywords(text, maxTok),
      resolvedName: slot && slot.resolvedName ? String(slot.resolvedName) : "",
      concept: slot && slot.concept ? slot.concept : null,
      en_literal: slot && slot.en_literal ? String(slot.en_literal) : "",
      kind: slot && slot.kind ? String(slot.kind) : "",
      polarity: slot && slot.polarity ? String(slot.polarity) : ""
    }];
  }

  // #170 공개 API — Pass0 이후·Foundry 큐 진입 시 동일 규칙
  function normalizeAtomicSlots(slots, opts) {
    opts = opts || {};
    var cfg = null;
    try { cfg = testWoo.cfg && testWoo.cfg.getConfig ? testWoo.cfg.getConfig() : null; }
    catch (eC) { cfg = null; }
    var maxSlots = opts.maxSlots != null ? Number(opts.maxSlots) :
      (cfg && cfg.search && cfg.search.maxSlots != null ? Number(cfg.search.maxSlots) : 40);
    var maxTok = opts.maxTokens != null ? Number(opts.maxTokens) :
      (cfg && cfg.search && cfg.search.maxTokens != null ? Number(cfg.search.maxTokens) : 5);
    if (isNaN(maxSlots) || maxSlots < 1) maxSlots = 40;
    if (isNaN(maxTok) || maxTok < 1) maxTok = 5;

    var list = slots || [];
    var expanded = [];
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      var piece = list[i];
      var parts = _expandOneSlot(piece, maxTok);
      for (var j = 0; j < parts.length; j++) {
        var p = parts[j];
        var key = String(p.text || "").toLowerCase().replace(/\s+/g, "");
        if (!key || seen[key] || _isNoiseResidue(p.text)) continue;
        seen[key] = 1;
        expanded.push({
          id: "s" + (expanded.length + 1),
          text: p.text,
          hintedCategory: p.hintedCategory || "",
          searchKeywords: p.searchKeywords || [],
          resolvedName: p.resolvedName || "",
          concept: p.concept || null,
          en_literal: p.en_literal || "",
          kind: p.kind || "",
          polarity: p.polarity || ""
        });
      }
    }
    if (expanded.length > maxSlots) {
      logWarning("[testWoo.llm.normalizeAtomicSlots] truncating " +
        expanded.length + " -> " + maxSlots);
      expanded = expanded.slice(0, maxSlots);
    }
    return expanded;
  }

  // 1. Pass 0 — NL → slots only (no fragment ids)
  function decomposeSlots(nlRequest) {
    var cfg = testWoo.cfg.getConfig();
    _requireLlmOpts(cfg);
    var systemLines = [
      "You extract targeting condition slots from marketer Korean NL.",
      "NL may be messy one sentence without '+' separators.",
      "ATOMIC SLOT RULES (#170) — mandatory:",
      "- ONE slot = ONE condition axis (region OR plan OR age OR gender OR other).",
      "- NEVER put two axes in one slot (e.g. forbidden: text=\"20s male\").",
      "- Correct: separate slots for age and gender (or region, plan).",
      "- Age bands in one request stay ONE age slot, not two age slots.",
      "- Unknown axes (e.g. homepage visit) stay their own other slot — do not drop them.",
      "- Do NOT emit slots that are only audience nouns (customer/member) with no condition.",
      "- Do NOT invent SQL or fragment ids.",
      "HARD LIMITS: at most 8 slots; each searchKeywords at most 5 short phrases;",
      "total JSON under 1200 characters. No commentary, no padding, no token repetition.",
      "For each slot, fill searchKeywords: colloquial/abbreviated/normalized forms",
      "and alternate notations for any numeric range mentioned.",
      "hintedCategory: plan|demo|consent|fatigue|signup|other " +
        "(use demo for region/age/gender; plan for tariff/plan).",
      'OUTPUT JSON ONLY: {"slots":[{"id":"s1","text":"...","hintedCategory":"plan|demo|consent|fatigue|signup|other","searchKeywords":["..."]}]}'
    ];
    if (cfg.llm.pass0Examples) {
      systemLines.splice(systemLines.length - 1, 0, "Domain keyword examples: " + cfg.llm.pass0Examples);
    }
    var system = systemLines.join("\n");
    var nl = String(nlRequest || "");
    var raw;
    var parsed;
    try {
      // Pass0 첫 호출부터 penalty — Gemini 간헐 반복이 상한(2048)을 채우는 실측 대응
      raw = _chat(cfg, system, nl, "pass0", { frequencyPenalty: 0.5 });
      parsed = _parseJson(raw, "pass0");
    } catch (e0) {
      if (!_isLengthOrRepeatError(e0)) throw e0;
      logWarning("[testWoo.llm.decomposeSlots] pass0 length/repeat — retry once " +
        "(frequency_penalty=0.8)");
      var retrySys = system +
        "\nCRITICAL: Output ONE short JSON object only. Max 6 slots. Do not repeat tokens. " +
        "Split age/gender/region/plan into separate slots.";
      raw = _chat(cfg, retrySys, nl, "pass0", { frequencyPenalty: 0.8 });
      parsed = _parseJson(raw, "pass0");
    }
    if (!parsed.slots || !_isArray(parsed.slots) || !parsed.slots.length)
      throw new Error("[testWoo.llm.decomposeSlots] slots missing");
    var maxSlots = cfg.search.maxSlots;
    var maxTok = cfg.search.maxTokens;
    // ACC Rhino: Array.map/filter 없음 — for 루프만
    var slots = [];
    for (var i = 0; i < parsed.slots.length; i++) {
      var s = parsed.slots[i];
      var kws = [];
      if (_isArray(s.searchKeywords)) {
        for (var ki = 0; ki < s.searchKeywords.length; ki++) {
          var kw = _trim(s.searchKeywords[ki] || "");
          if (kw) kws.push(kw);
        }
      }
      var text = _trim(s.text || "");
      if (!text) continue;
      slots.push({
        id: s.id || ("s" + (i + 1)),
        text: text,
        hintedCategory: String(s.hintedCategory || ""),
        searchKeywords: kws.slice(0, maxTok)
      });
    }
    // LLM이 복합 슬롯을 남겨도 EnPivot 필드만 보존(KO 재분할 없음)
    slots = normalizeAtomicSlots(slots, { maxSlots: maxSlots, maxTokens: maxTok });
    return slots;
  }

  // 2. Pass 1 — candidates → CNF plan
  function selectPlan(nlRequest, slotCandidates) {
    var cfg = testWoo.cfg.getConfig();
    _requireLlmOpts(cfg);
    var allowed = _allowedNames(slotCandidates);
    var slim = _slimCandidates(slotCandidates);
    var system = [
      "You map Adobe Campaign targeting NL to a CNF composition plan.",
      "Never write SQL. Pick fragment names ONLY from candidates provided.",
      "You MAY merge or split slots to match library boundaries.",
      "Every chosen fragment MUST appear in the union of candidate names.",
      "Plan shape is fixed CNF (no op field):",
      "- include[]: groups combined with AND (INTERSECT).",
      "- include[i].any[]: alternatives inside a group combined with OR (UNION).",
      "- exclude[]: single exclusion bag; all OR-ed then EXCEPT once at the end.",
      "If the NL is only an exclusion (no positive audience), put those fragments in exclude[] and set include to [].",
      "Do not invent a universe fragment. The compiler supplies the grain universe.",
      "Example meaning: age AND (region Seoul OR region Gyeonggi) EXCEPT opt_out",
      "→ include:[{any:[age]},{any:[regionSeoul,regionGyeonggi]}], exclude:[opt_out]",
      "Put uncovered phrases into unmatched[]. Do not invent fragments.",
      "grainKey MUST be copied verbatim from the key_column of the chosen candidates " +
        "(a physical DB column name). Do not translate or guess it — the compiler rejects " +
        "any mismatch with the fragment key_column.",
      "PARAMS: for each chosen fragment, fill params from that candidate's param_domain " +
        "(nlMap / _bucket.nlMap / _group) using the slot/NL text. Example: an age-band slot + " +
        "_bucket.nlMap entry {ageMin,ageMax} → params:{ageMin,ageMax}. " +
        "A gender slot + gender.nlMap → params:{gender:\"M\"} using the entry's db value. " +
        "If one slot maps to several domain db values, emit ONE fragment with an array param " +
        "(compiler uses IN). Do not split one slot into two any[] items. " +
        "If the candidate is the matching axis fragment (_source + same tags) pick it even when " +
        "the exact NL value is not yet a nlMap key. Fill params by analogy with existing " +
        "examples and the declared types/_range/enum. Do not put that phrase in unmatched[]. " +
        "Only keys that appear as {{param}} in that fragment's SQL.",
      "CANDIDATES_BY_SLOT:",
      JSON.stringify(slim),
      'OUTPUT JSON ONLY: {"grainKey":"<key_column of chosen fragments>","include":[{"any":[{"fragment":"<name>","label":"<ko>","params":{}}]}],"exclude":[{"fragment":"<name>","label":"<ko>","params":{}}],"unmatched":[]}'
    ].join("\n");
    var user = "NL:\n" + String(nlRequest || "");
    var raw = _chat(cfg, system, user, "pass1");
    var plan = _parseJson(raw, "pass1");
    if (!_isArray(plan.exclude)) plan.exclude = [];
    if (!_isArray(plan.include)) plan.include = [];
    _applyPolarity(plan, slotCandidates);
    _validatePlanShape(plan);
    var n = _countFragments(plan);
    if (n > cfg.search.maxSlots)
      throw new Error("[testWoo.llm.selectPlan] too many fragments: " + n);
    _rejectOutsideCandidates(plan, allowed);
    plan.nl_request = String(nlRequest || "");
    if (testWoo.compiler && testWoo.compiler.bindPlanParams)
      testWoo.compiler.bindPlanParams(plan, plan.nl_request);
    _dropBindableUnmatched(plan);
    return plan;
  }

  function _loadLexiconPack() {
    var empty = { cards: [], lex: [] };
    if (!testWoo.fragments || !testWoo.fragments.listLexiconCards) return empty;
    if (!testWoo.fragContract || !testWoo.fragContract.collectLexicon) return empty;
    var cards = [];
    try { cards = testWoo.fragments.listLexiconCards() || []; }
    catch (eL) {
      logWarning("[testWoo.llm.generatePlan] listLexiconCards failed: " +
        String(eL.message || eL));
      return empty;
    }
    return { cards: cards, lex: testWoo.fragContract.collectLexicon(cards) };
  }

  function _attachLexiconCandidates(slotCandidates, pack) {
    if (!slotCandidates || !pack || !pack.cards || !pack.cards.length) return slotCandidates;
    var fc = testWoo.fragContract;
    var si, ci, sc, card, hits, name, srcConcept, seen, hi, m;
    function addHit(c) {
      if (!c || !c.name || seen[c.name]) return;
      seen[c.name] = 1;
      hits.push(c);
    }
    for (si = 0; si < slotCandidates.length; si++) {
      sc = slotCandidates[si];
      hits = [];
      seen = {};
      if (sc.candidates) {
        for (hi = 0; hi < sc.candidates.length; hi++) addHit(sc.candidates[hi]);
      }
      name = String(sc.resolvedName || "");
      for (ci = 0; ci < pack.cards.length; ci++) {
        card = pack.cards[ci];
        if (!card) continue;
        if (name && String(card.name) === name) { addHit(card); continue; }
        if (!fc) continue;
        srcConcept = fc.conceptOf ? fc.conceptOf(card.param_domain) : "";
        if (sc.concept && srcConcept && String(sc.concept) === srcConcept &&
            fc.axesCompatible(card, sc)) {
          addHit(card);
          continue;
        }
        if (fc.matchEnPivotSlot) {
          m = fc.matchEnPivotSlot(card.param_domain, sc);
          if (m && m.layer && !m.ambiguous && fc.axesCompatible(card, sc)) {
            addHit(card);
            continue;
          }
        }
        if (fc.domainMatchSlot && fc.domainMatchSlot(card.param_domain, sc.text) &&
            fc.axesCompatible(card, sc))
          addHit(card);
      }
      if (hits.length) sc.candidates = hits;
    }
    return slotCandidates;
  }

  function _negKey(sc) {
    var t = String((sc && (sc.text || sc.surface)) || "");
    if (t) return t;
    return String((sc && sc.en_literal) || "");
  }

  function _unresolvedItem(sc, reason, extra) {
    extra = extra || {};
    return {
      surface: String((sc && (sc.text || sc.surface)) || ""),
      reason: String(reason || "concept_not_found"),
      concept: (sc && sc.concept) ? String(sc.concept) : "",
      en_literal: (sc && sc.en_literal) ? String(sc.en_literal) : "",
      fragment: extra.fragment ? String(extra.fragment) : ""
    };
  }

  function _unresolvedTexts(items) {
    var out = [];
    var i, u, r, s;
    for (i = 0; i < (items || []).length; i++) {
      u = items[i] || {};
      s = String(u.surface || "");
      r = String(u.reason || "");
      if (r === "value_not_in_domain")
        out.push("값 '" + s + "'이(가) 도메인에 없습니다");
      else if (r === "ambiguous" || r === "ambiguous_group")
        out.push("값 '" + s + "'이(가) 여러 값과 맞습니다");
      else
        out.push("조건을 해석할 축을 찾지 못했습니다: " + s);
    }
    return out;
  }

  function _saveSlotDomain(card, domain) {
    if (!card || !card.name || !testWoo.fragments) return;
    if (!testWoo.fragments.saveParamDomain && !testWoo.fragments.getByName) return;
    var row = null;
    try { row = testWoo.fragments.getByName(String(card.name)); }
    catch (eG) { return; }
    if (!row || !row.id) return;
    try {
      if (testWoo.fragments.saveParamDomain)
        testWoo.fragments.saveParamDomain(row, domain);
    } catch (eS) {
      try {
        logWarning("[testWoo.llm.saveParamDomain] " + String(eS.message || eS));
      } catch (eL) { /* non-ACC */ }
    }
  }

  function _healSlotValue(sc, card) {
    var fc = testWoo.fragContract;
    var domain = fc.normalizeParamDomain(card.param_domain);
    var key = _negKey(sc);
    var now = new Date().getTime();
    if (fc.isNegative && fc.isNegative(domain, key, now))
      return { ok: false, skip: "negative", domain: domain };
    if (fc.inHealCooldown && fc.inHealCooldown(domain, now))
      return { ok: false, skip: "cooldown", domain: domain };
    if (fc.stampHeal) domain = fc.stampHeal(domain, now);
    if (testWoo.toolkit && testWoo.toolkit.refreshDomain) {
      try {
        var rr = testWoo.toolkit.refreshDomain(domain);
        if (rr && rr.ok && rr.domain) domain = rr.domain;
      } catch (eR) { /* stale snapshot */ }
    }
    if (testWoo.enPivot && testWoo.enPivot.enrichDomainEn) {
      try {
        var enr = testWoo.enPivot.enrichDomainEn(domain);
        if (enr && enr.domain) domain = enr.domain;
      } catch (eE) { /* keep domain */ }
    }
    var hit = fc.matchEnPivotSlot ? fc.matchEnPivotSlot(domain, sc) : null;
    if (hit && (hit.layer === "M1" || hit.layer === "M2" || hit.layer === "M2G") &&
        !hit.ambiguous) {
      card.param_domain = domain;
      _saveSlotDomain(card, domain);
      return { ok: true, match: hit, domain: domain, card: card };
    }
    card.param_domain = domain;
    _saveSlotDomain(card, domain);
    return { ok: false, skip: "miss", match: hit, domain: domain };
  }

  function _collectSlotCards(sc, pack) {
    var cards = [];
    var seen = {};
    function add(c) {
      if (!c || !c.name || seen[c.name]) return;
      seen[c.name] = 1;
      cards.push(c);
    }
    var i;
    if (sc && sc.candidates) {
      for (i = 0; i < sc.candidates.length; i++) add(sc.candidates[i]);
    }
    if (pack && pack.cards) {
      for (i = 0; i < pack.cards.length; i++) add(pack.cards[i]);
    }
    return cards;
  }

  function _matchedSlot(sc, card, match) {
    var name = card ? String(card.name || "") : String(sc.resolvedName || "");
    return {
      id: sc.id,
      text: sc.text,
      hintedCategory: sc.hintedCategory || "",
      searchKeywords: sc.searchKeywords || [],
      resolvedName: name,
      concept: sc.concept || null,
      en_literal: sc.en_literal || "",
      kind: sc.kind || "",
      polarity: sc.polarity || "",
      match: match || null,
      candidates: card ? [card] : (sc.candidates || [])
    };
  }

  function _groupCandRows(domain, pk) {
    var fc = testWoo.fragContract;
    var spec = (domain && domain[pk]) || {};
    var rows = [];
    var seen = {};
    var nk, ent, dbv, en, ei;
    function add(db, enList) {
      if (db == null || typeof db === "object") return;
      var s = String(db);
      if (!s || seen[s]) return;
      seen[s] = 1;
      rows.push({ db: s, en: enList || [] });
    }
    if (spec.nlMap && typeof spec.nlMap === "object") {
      for (nk in spec.nlMap) {
        if (!spec.nlMap.hasOwnProperty(nk)) continue;
        ent = spec.nlMap[nk];
        dbv = fc && fc.entryDb ? fc.entryDb(ent) : ent;
        en = [];
        if (ent && typeof ent === "object" && !_isArray(ent) && _isArray(ent.en))
          en = ent.en;
        add(dbv, en);
      }
    }
    if (spec.enum && _isArray(spec.enum)) {
      for (ei = 0; ei < spec.enum.length; ei++) add(spec.enum[ei], []);
    }
    return rows;
  }

  function _pickGroupParam(domain, hint) {
    var h = String(hint || "");
    if (h && h.charAt(0) !== "_" && domain[h]) return h;
    var k, spec, best = "";
    for (k in domain) {
      if (!domain.hasOwnProperty(k) || String(k).charAt(0) === "_") continue;
      spec = domain[k] || {};
      if ((spec.enum && spec.enum.length) ||
          (spec.nlMap && typeof spec.nlMap === "object"))
        return k;
      if (!best) best = k;
    }
    return best;
  }

  function _tryGroupExpand(sc, card, matchHint) {
    var fc = testWoo.fragContract;
    if (!sc || !card || !fc || !fc.upsertGroup) return { ok: false, skip: "noapi" };
    var kind = String(sc.kind || "").toLowerCase();
    if (kind === "range") return { ok: false, skip: "range" };
    var domain = fc.normalizeParamDomain(card.param_domain);
    if (domain._bucket && domain._bucket.nlMap && kind !== "categorical") {
      var hasCat = false;
      var hk;
      for (hk in domain) {
        if (!domain.hasOwnProperty(hk) || String(hk).charAt(0) === "_") continue;
        var sp = domain[hk] || {};
        if ((sp.enum && sp.enum.length) || (sp.nlMap && typeof sp.nlMap === "object"))
          hasCat = true;
      }
      if (!hasCat) return { ok: false, skip: "range" };
    }
    var pk = _pickGroupParam(domain, matchHint && matchHint.param);
    if (!pk) return { ok: false, skip: "noparam" };
    var cands = _groupCandRows(domain, pk);
    if (!cands.length) return { ok: false, skip: "nocand" };
    var key = _negKey(sc);
    var now = new Date().getTime();
    if (fc.isNegative && fc.isNegative(domain, key, now))
      return { ok: false, skip: "negative" };
    var alias = String((sc && (sc.surface || sc.text)) || key || "");
    if (!alias) return { ok: false, skip: "noalias" };
    var cfg;
    try { cfg = testWoo.cfg.getConfig(); }
    catch (eC) { return { ok: false, skip: "nocfg" }; }
    var system = [
      "Map a marketer surface term to DB members.",
      "CANDIDATES.db is the only allowed set.",
      "Return JSON only: {\"members\":[\"db1\",\"db2\"]}.",
      "members MUST be a subset of CANDIDATES db values.",
      "If the term is one candidate, return that one.",
      "If several candidates share this term, return all of their db values.",
      "If the term is a finer place not in CANDIDATES, return the one parent candidate it belongs to.",
      "If two parents fit or you are unsure, return {\"members\":[]}.",
      "If it is not a group, member, or child of one candidate, return {\"members\":[]}.",
      "No SQL. No values outside CANDIDATES."
    ].join("\n");
    var user = "SURFACE:\n" + alias +
      "\nEN_LITERAL:\n" + String((sc && sc.en_literal) || "") +
      "\nCONCEPT:\n" + String((sc && sc.concept) || "") +
      "\nCANDIDATES:\n" + JSON.stringify(cands);
    var raw;
    var obj;
    try { raw = _chat(cfg, system, user, "groupExpand"); }
    catch (eChat) {
      try {
        logWarning("[testWoo.llm.groupExpand] chat failed: " +
          String(eChat.message || eChat));
      } catch (eL) { /* non-ACC */ }
      return { ok: false, skip: "llm_fail" };
    }
    try { obj = _parseJson(raw, "groupExpand"); }
    catch (eJ) { obj = null; }
    var members = (obj && _isArray(obj.members)) ? obj.members : [];
    var seenDb = {};
    var ci, mi, ei, out = [];
    var enList, mv, dbv, ml, hit;
    for (mi = 0; mi < members.length; mi++) {
      if (members[mi] != null && typeof members[mi] === "object") continue;
      mv = String(members[mi]);
      if (!mv) continue;
      ml = mv.toLowerCase();
      for (ci = 0; ci < cands.length; ci++) {
        dbv = String(cands[ci].db);
        if (!dbv || seenDb[dbv]) continue;
        hit = (dbv === mv || dbv.toLowerCase() === ml);
        if (!hit) {
          enList = cands[ci].en || [];
          for (ei = 0; ei < enList.length; ei++) {
            if (String(enList[ei] || "").toLowerCase() === ml) {
              hit = true;
              break;
            }
          }
        }
        if (hit) {
          seenDb[dbv] = 1;
          out.push(dbv);
        }
      }
    }
    for (ci = 0; ci < cands.length; ci++) {
      if (String(cands[ci].db) === alias) {
        out = [alias];
        break;
      }
    }
    if (!out.length) {
      if (fc.markNegative) domain = fc.markNegative(domain, key, now);
      card.param_domain = domain;
      _saveSlotDomain(card, domain);
      return { ok: false, skip: "miss" };
    }
    var enLit = String((sc && sc.en_literal) || "");
    domain = fc.upsertGroup(domain, pk, alias, out, {
      src: "llm", verified: false, en: enLit ? [enLit] : []
    });
    card.param_domain = domain;
    _saveSlotDomain(card, domain);
    try {
      logInfo("[testWoo.llm.groupExpand] M2C alias=" + alias +
        " n=" + out.length + " frag=" + String(card.name || ""));
    } catch (eI) { /* non-ACC */ }
    return {
      ok: true,
      card: card,
      match: {
        layer: "M2C", param: pk, nl: alias, value: out,
        ambiguous: false, group: true, hits: []
      }
    };
  }

  function _mergeParamVals(a, b) {
    var out = [];
    var seen = {};
    function pushOne(v) {
      if (v == null || v === "") return;
      if (_isArray(v)) {
        var i;
        for (i = 0; i < v.length; i++) pushOne(v[i]);
        return;
      }
      if (typeof v === "object") return;
      var s = String(v);
      if (seen[s]) return;
      seen[s] = 1;
      out.push(s);
    }
    pushOne(a);
    pushOne(b);
    if (!out.length) return a != null ? a : b;
    if (out.length === 1) return out[0];
    return out;
  }

  function _collapseSameFragmentPlan(plan) {
    if (!plan || !plan.include) return;
    var inc = plan.include;
    var out = [];
    var seen = {};
    var gi, g, any, name, prev, pk, src, keep;
    for (gi = 0; gi < inc.length; gi++) {
      g = inc[gi] || {};
      any = g.any || [];
      if (any.length === 1 && any[0] && any[0].fragment) {
        name = String(any[0].fragment);
        if (seen[name] != null) {
          keep = out[seen[name]].any[0];
          if (!keep.params || typeof keep.params !== "object") keep.params = {};
          src = any[0].params || {};
          for (pk in src) {
            if (!src.hasOwnProperty(pk)) continue;
            keep.params[pk] = _mergeParamVals(keep.params[pk], src[pk]);
          }
          continue;
        }
        seen[name] = out.length;
      }
      out.push(g);
    }
    for (gi = 0; gi < out.length; gi++) {
      any = (out[gi] && out[gi].any) || [];
      var collapsed = [];
      var byName = {};
      var ai, item;
      for (ai = 0; ai < any.length; ai++) {
        item = any[ai];
        if (!item || !item.fragment) { collapsed.push(item); continue; }
        name = String(item.fragment);
        if (byName[name] == null) {
          byName[name] = collapsed.length;
          collapsed.push(item);
          continue;
        }
        keep = collapsed[byName[name]];
        if (!keep.params || typeof keep.params !== "object") keep.params = {};
        src = item.params || {};
        for (pk in src) {
          if (!src.hasOwnProperty(pk)) continue;
          keep.params[pk] = _mergeParamVals(keep.params[pk], src[pk]);
        }
      }
      out[gi].any = collapsed;
    }
    plan.include = out;
  }

  function _resolveEnPivotSlot(sc, pack, skipPass0) {
    var fc = testWoo.fragContract;
    if (!fc || !fc.matchEnPivotSlot)
      return { kind: "empty" };
    var cards = _collectSlotCards(sc, pack);
    var m1 = [];
    var m2g = [];
    var m2 = [];
    var m2Amb = [];
    var m3 = [];
    var i, card, m;
    for (i = 0; i < cards.length; i++) {
      card = cards[i];
      m = fc.matchEnPivotSlot(card.param_domain, sc);
      if (!m || !m.layer) continue;
      if (m.layer === "M1") m1.push({ card: card, match: m });
      else if (m.layer === "M2G") m2g.push({ card: card, match: m });
      else if (m.layer === "M2" && m.ambiguous) m2Amb.push({ card: card, match: m });
      else if (m.layer === "M2") m2.push({ card: card, match: m });
      else if (m.layer === "M3") m3.push({ card: card, match: m });
    }
    if (m1.length)
      return { kind: "matched", slot: _matchedSlot(sc, m1[0].card, m1[0].match) };
    if (m2g.length)
      return { kind: "matched", slot: _matchedSlot(sc, m2g[0].card, m2g[0].match) };
    if (m2.length === 1 && !m2Amb.length)
      return { kind: "matched", slot: _matchedSlot(sc, m2[0].card, m2[0].match) };
    if (m2.length > 1 || m2Amb.length) {
      var expA = _tryGroupExpand(sc, (m2Amb[0] || m2[0]).card, (m2Amb[0] || m2[0]).match);
      if (expA && expA.ok)
        return { kind: "matched", slot: _matchedSlot(sc, expA.card, expA.match) };
      return {
        kind: "unresolved",
        item: _unresolvedItem(sc,
          (m2Amb.length) ? "ambiguous" : "value_not_in_domain", {
          fragment: (m2[0] || m2Amb[0]).card.name
        })
      };
    }
    if (m3.length) {
      var healed = _healSlotValue(sc, m3[0].card);
      if (healed && healed.ok)
        return { kind: "matched", slot: _matchedSlot(sc, m3[0].card, healed.match) };
      var exp3 = _tryGroupExpand(sc, m3[0].card, healed && healed.match);
      if (exp3 && exp3.ok)
        return { kind: "matched", slot: _matchedSlot(sc, exp3.card, exp3.match) };
      return {
        kind: "unresolved",
        item: _unresolvedItem(sc, "value_not_in_domain", {
          fragment: m3[0].card.name
        })
      };
    }
    if (skipPass0 && !sc.concept)
      return { kind: "empty" };
    return { kind: "empty" };
  }

  function _slotFragName(sc) {
    var name = String((sc && sc.resolvedName) || "");
    if (!name && sc && sc.candidates && sc.candidates[0])
      name = String(sc.candidates[0].name || "");
    return name;
  }

  function _applyPolarity(plan, matchedSlots) {
    if (!plan || !matchedSlots || !matchedSlots.length) return;
    if (!_isArray(plan.exclude)) plan.exclude = [];
    if (!_isArray(plan.include)) plan.include = [];
    var i, sc, name, found, ei, gi, aj, any, item, pk, src;
    var moveSet = {};
    for (i = 0; i < matchedSlots.length; i++) {
      sc = matchedSlots[i];
      if (String((sc && sc.polarity) || "").toLowerCase() !== "exclude") continue;
      name = _slotFragName(sc);
      if (!name) continue;
      moveSet[name] = 1;
      found = null;
      for (ei = 0; ei < plan.exclude.length; ei++) {
        if (plan.exclude[ei] && String(plan.exclude[ei].fragment) === name) {
          found = plan.exclude[ei];
          break;
        }
      }
      if (!found) {
        item = { fragment: name, label: "", params: {} };
        if (sc.candidates && sc.candidates[0] && sc.candidates[0].label)
          item.label = String(sc.candidates[0].label);
        plan.exclude.push(item);
        found = item;
      }
      for (gi = 0; gi < plan.include.length; gi++) {
        any = (plan.include[gi] && plan.include[gi].any) || [];
        for (aj = 0; aj < any.length; aj++) {
          if (!any[aj] || String(any[aj].fragment) !== name) continue;
          if (!found.label && any[aj].label) found.label = any[aj].label;
          src = any[aj].params;
          if (!src || typeof src !== "object") continue;
          if (!found.params || typeof found.params !== "object") found.params = {};
          for (pk in src) {
            if (!src.hasOwnProperty(pk)) continue;
            if (found.params[pk] == null || found.params[pk] === "")
              found.params[pk] = src[pk];
          }
        }
      }
    }
    for (ei = 0; ei < plan.exclude.length; ei++) {
      if (plan.exclude[ei] && plan.exclude[ei].fragment)
        moveSet[String(plan.exclude[ei].fragment)] = 1;
    }
    var newInc = [];
    var keep;
    for (gi = 0; gi < plan.include.length; gi++) {
      any = (plan.include[gi] && plan.include[gi].any) || [];
      keep = [];
      for (aj = 0; aj < any.length; aj++) {
        if (any[aj] && moveSet[String(any[aj].fragment)]) continue;
        keep.push(any[aj]);
      }
      if (keep.length) newInc.push({ any: keep });
    }
    plan.include = newInc;
  }

  function _applyMatchParams(plan, matchedSlots) {
    if (!plan || !matchedSlots) return;
    var byName = {};
    var i, sc, name, m;
    for (i = 0; i < matchedSlots.length; i++) {
      sc = matchedSlots[i];
      m = sc && sc.match;
      if (!m || m.value == null) continue;
      if (m.layer !== "M1" && m.layer !== "M2" && m.layer !== "M2G" && m.layer !== "M2C")
        continue;
      name = String(sc.resolvedName || "");
      if (!name && sc.candidates && sc.candidates[0])
        name = String(sc.candidates[0].name || "");
      if (name) byName[name] = m;
    }
    _walkFragments(plan, function (item) {
      if (!item || !item.fragment) return;
      m = byName[String(item.fragment)];
      if (!m) return;
      if (!item.params || typeof item.params !== "object") item.params = {};
      if (m.value != null && typeof m.value === "object" && !_isArray(m.value)) {
        var k;
        for (k in m.value) {
          if (!m.value.hasOwnProperty(k)) continue;
          if (item.params[k] == null || item.params[k] === "")
            item.params[k] = m.value[k];
        }
      } else if (m.param && m.param !== "_bucket") {
        if (_isArray(m.value) && m.value.length)
          item.params[m.param] = m.value;
        else if (item.params[m.param] == null || item.params[m.param] === "")
          item.params[m.param] = m.value;
      }
    });
  }

  // 3. full pipeline helper
  function generatePlan(nlRequest) {
    var pack = _loadLexiconPack();
    var lexSlots = [];
    if (pack.lex && pack.lex.length && testWoo.fragContract.splitByLexicon)
      lexSlots = testWoo.fragContract.splitByLexicon(nlRequest, pack.lex) || [];
    var pivot = null;
    var pivotSlots = [];
    var skipPass0 = false;
    var skipReason = "";
    if (testWoo.enPivot && testWoo.enPivot.extractSlots) {
      try { pivot = testWoo.enPivot.extractSlots(nlRequest, pack.cards || []); }
      catch (eP) {
        logWarning("[testWoo.llm.generatePlan] enPivot failed: " +
          String(eP.message || eP));
        pivot = { en: "", slots: [], meta: { skipReason: "llm_fail", retryInput: true } };
      }
    }
    if (pivot && testWoo.enPivot.toPipelineSlots)
      pivotSlots = testWoo.enPivot.toPipelineSlots(pivot.slots || []) || [];
    skipReason = pivot && pivot.meta ? String(pivot.meta.skipReason || "") : "";
    if (pivot && pivot.meta && pivot.meta.retryInput) {
      return {
        grainKey: "",
        include: [],
        exclude: [],
        retryInput: true,
        unmatched: ["조건을 해석하지 못했습니다. 문장을 다시 입력해 주세요."],
        unmatchedSlots: [],
        matchedSlots: [],
        _meta: { slots: [], slotCandidates: [], stage: "enPivot_retry",
          enPivot: skipReason, en: pivot.en || "" }
      };
    }
    if (pivotSlots.length && (skipReason === "cache" || skipReason === "llm"))
      skipPass0 = true;
    var llmSlots = [];
    if (skipPass0) {
      llmSlots = pivotSlots;
    } else if (!testWoo.enPivot) {
      try {
        llmSlots = decomposeSlots(nlRequest) || [];
      } catch (e0) {
        logWarning("[testWoo.llm.generatePlan] Pass0 failed — lexicon only: " +
          String(e0.message || e0));
        llmSlots = [];
      }
    }
    var slots = llmSlots;
    if (testWoo.fragContract && testWoo.fragContract.mergeLexiconSlots)
      slots = testWoo.fragContract.mergeLexiconSlots(lexSlots, llmSlots);
    if (!slots || !slots.length) slots = lexSlots.length ? lexSlots : llmSlots;
    slots = normalizeAtomicSlots(slots);
    if (testWoo.enPivot && testWoo.enPivot.isNonConditionSlot) {
      var keptSlots = [];
      var gi;
      for (gi = 0; gi < slots.length; gi++) {
        if (testWoo.enPivot.isNonConditionSlot(slots[gi])) continue;
        keptSlots.push(slots[gi]);
      }
      slots = keptSlots;
    }
    try {
      logInfo("[testWoo.llm.generatePlan] lexicon=" + lexSlots.length +
        " llm=" + llmSlots.length + " merged=" + slots.length +
        " enPivot=" + (skipReason || "off") +
        " skipPass0=" + (skipPass0 ? "1" : "0"));
    } catch (eLog) { /* non-ACC */ }
    var slotCandidates = testWoo.fragments.searchSlots(slots);
    slotCandidates = _attachLexiconCandidates(slotCandidates, pack);
    var empty = [];
    var emptySlots = [];
    var matchedSlots = [];
    var unresolved = [];
    for (var si = 0; si < slotCandidates.length; si++) {
      var sc = slotCandidates[si];
      var decided = _resolveEnPivotSlot(sc, pack, skipPass0);
      if (decided.kind === "matched") {
        matchedSlots.push(decided.slot);
        continue;
      }
      if (decided.kind === "unresolved") {
        unresolved.push(decided.item);
        continue;
      }
      if (decided.kind === "empty" && !sc.concept) continue;
      if (!sc.candidates || !sc.candidates.length) {
        if (_isNoiseResidue(sc.text)) continue;
        if (testWoo.enPivot && testWoo.enPivot.isNonConditionSlot &&
            testWoo.enPivot.isNonConditionSlot(sc)) continue;
        empty.push(sc.text);
        emptySlots.push({
          id: sc.id,
          text: sc.text,
          hintedCategory: sc.hintedCategory || "",
          searchKeywords: sc.searchKeywords || [],
          resolvedName: sc.resolvedName || "",
          concept: sc.concept || null,
          en_literal: sc.en_literal || ""
        });
      } else {
        var expE = _tryGroupExpand(sc, sc.candidates[0], null);
        if (expE && expE.ok) {
          matchedSlots.push(_matchedSlot(sc, expE.card, expE.match));
          continue;
        }
        if (expE && expE.skip === "range") {
          matchedSlots.push({
            id: sc.id,
            text: sc.text,
            hintedCategory: sc.hintedCategory || "",
            searchKeywords: sc.searchKeywords || [],
            resolvedName: sc.resolvedName || "",
            concept: sc.concept || null,
            en_literal: sc.en_literal || "",
            candidates: sc.candidates
          });
          continue;
        }
        unresolved.push(_unresolvedItem(sc, "value_not_in_domain", {
            fragment: String(sc.candidates[0].name || "")
          }));
      }
    }
    if (unresolved.length) {
      return {
        grainKey: "",
        include: [],
        exclude: [],
        unmatched: _unresolvedTexts(unresolved),
        unmatchedSlots: [],
        matchedSlots: matchedSlots,
        unresolved: unresolved,
        _meta: { slots: slots, slotCandidates: slotCandidates, stage: "enPivot_unresolved",
          enPivot: skipReason }
      };
    }
    if (!matchedSlots.length && !empty.length) {
      return {
        grainKey: "",
        include: [],
        exclude: [],
        unmatched: ["조건 슬롯이 없습니다"],
        unmatchedSlots: [],
        matchedSlots: [],
        _meta: { slots: slots, slotCandidates: slotCandidates, stage: "stageA_empty",
          enPivot: skipReason }
      };
    }
    if (empty.length) {
      return {
        grainKey: "",
        include: [],
        exclude: [],
        unmatched: empty,
        unmatchedSlots: emptySlots,
        matchedSlots: matchedSlots,
        _meta: { slots: slots, slotCandidates: slotCandidates, stage: "stageA_empty",
          enPivot: skipReason }
      };
    }
    var plan = selectPlan(nlRequest, matchedSlots);
    plan.matchedSlots = matchedSlots;
    plan.unmatchedSlots = [];
    plan.nl_request = String(nlRequest || "");
    plan._meta = { slots: slots, slotCandidates: slotCandidates, stage: "pass1",
      enPivot: skipReason };
    _applyMatchParams(plan, matchedSlots);
    if (testWoo.compiler && testWoo.compiler.bindPlanParams)
      testWoo.compiler.bindPlanParams(plan, plan.nl_request);
    _applyPolarity(plan, matchedSlots);
    _collapseSameFragmentPlan(plan);
    _repairMissingParams(plan);
    _healPlanDomains(plan);
    _dropBindableUnmatched(plan);
    return plan;
  }

  // 같은 축+_source frag가 plan에 있으면 값 미등재는 heal 대상 — unmatched/큐 금지.
  function _dropBindableUnmatched(plan) {
    if (!plan || !plan.unmatched || !plan.unmatched.length) return;
    if (!testWoo.fragContract || !testWoo.fragments || !testWoo.fragments.getByName) return;
    var names = [];
    _walkFragments(plan, function (item) {
      if (item && item.fragment) names.push(String(item.fragment));
    });
    if (!names.length) return;
    var kept = [];
    var i, j, phrase, f, bindable, domain;
    for (i = 0; i < plan.unmatched.length; i++) {
      phrase = String(plan.unmatched[i] || "");
      if (_isNoiseResidue(phrase)) continue;
      bindable = false;
      for (j = 0; j < names.length && !bindable; j++) {
        f = null;
        try { f = testWoo.fragments.getByName(names[j]); } catch (eG) { f = null; }
        if (!f) continue;
        domain = testWoo.fragContract.normalizeParamDomain ?
          testWoo.fragContract.normalizeParamDomain(f.param_domain) : {};
        if (domain && domain._source &&
            testWoo.fragContract.axesCompatible(f, { text: phrase }))
          bindable = true;
      }
      if (!bindable) kept.push(plan.unmatched[i]);
    }
    plan.unmatched = kept;
  }

  function _sqlNeed(sqlText) {
    var need = {};
    var re = /\{\{(\w+)\}\}/g;
    var m;
    while ((m = re.exec(String(sqlText || ""))) != null) need[m[1]] = 1;
    return need;
  }

  function _paramsIncomplete(params, need) {
    var pk;
    var p = params || {};
    for (pk in need) {
      if (!need.hasOwnProperty(pk)) continue;
      if (p[pk] == null || p[pk] === "") return true;
      if (_isArray(p[pk]) && !p[pk].length) return true;
    }
    return false;
  }

  function _slimDomainForBind(domainRaw) {
    var domain = {};
    if (testWoo.fragContract && testWoo.fragContract.normalizeParamDomain)
      domain = testWoo.fragContract.normalizeParamDomain(domainRaw);
    var out = {};
    if (domain._range) out._range = domain._range;
    var k, nk, n, spec, c;
    n = 0;
    if (domain._bucket && domain._bucket.nlMap) {
      out._bucketExamples = {};
      for (nk in domain._bucket.nlMap) {
        if (!domain._bucket.nlMap.hasOwnProperty(nk)) continue;
        if (n >= 4) break;
        out._bucketExamples[nk] = domain._bucket.nlMap[nk];
        n++;
      }
    }
    for (k in domain) {
      if (!domain.hasOwnProperty(k)) continue;
      if (String(k).charAt(0) === "_") continue;
      spec = domain[k] || {};
      var row = { type: spec.type || "string" };
      if (spec.enum && spec.enum.length) {
        row.enum = [];
        var ei;
        for (ei = 0; ei < spec.enum.length && ei < 20; ei++) row.enum.push(spec.enum[ei]);
      }
      if (spec.nlMap && typeof spec.nlMap === "object") {
        row.examples = {};
        c = 0;
        for (nk in spec.nlMap) {
          if (!spec.nlMap.hasOwnProperty(nk)) continue;
          if (c >= 4) break;
          row.examples[nk] = spec.nlMap[nk];
          c++;
        }
      }
      out[k] = row;
    }
    return out;
  }

  function _slotTextForFrag(plan, card) {
    var slots = (plan && plan._meta && plan._meta.slots) || [];
    var i;
    for (i = 0; i < slots.length; i++) {
      if (testWoo.fragContract && testWoo.fragContract.axesCompatible &&
          testWoo.fragContract.axesCompatible(card, slots[i]))
        return String(slots[i].text || "");
    }
    return "";
  }

  // Pass1이 params를 비우면, 기존 nlMap 예시를 보고 같은 축 값을 채운다(SQL 창작 금지).
  function proposeParams(slotText, domain, needKeys) {
    var cfg = testWoo.cfg.getConfig();
    var need = [];
    var pk;
    if (needKeys) {
      for (pk in needKeys) {
        if (needKeys.hasOwnProperty(pk)) need.push(pk);
      }
    }
    var system = [
      "Fill fragment params from the slot text.",
      "Use ONLY these keys: " + need.join(","),
      "Follow types, _range, enum, and analogize from existing nlMap/_bucket examples.",
      "Never write SQL or fragment names.",
      "OUTPUT JSON ONLY: {\"params\":{}}"
    ].join("\n");
    var user = "SLOT:\n" + String(slotText || "") +
      "\nDOMAIN:\n" + JSON.stringify(_slimDomainForBind(domain));
    try {
      var raw = _chat(cfg, system, user, "pass1");
      var obj = _parseJson(raw, "pass1");
      if (obj && obj.params && typeof obj.params === "object") return obj.params;
      if (obj && typeof obj === "object") return obj;
    } catch (eP) { /* leave empty */ }
    return {};
  }

  function _ensureFreshDomain(f) {
    if (!f) return {};
    if (f._twFreshDomain) return f._twFreshDomain;
    var domain = testWoo.fragContract.normalizeParamDomain(f.param_domain);
    if (testWoo.toolkit && testWoo.toolkit.refreshDomain) {
      try {
        var rr = testWoo.toolkit.refreshDomain(domain);
        if (rr && rr.ok && rr.domain) {
          domain = rr.domain;
          if (rr.json) f.param_domain = rr.json;
        }
      } catch (eR) { /* stale snapshot */ }
    }
    f._twFreshDomain = domain;
    return domain;
  }

  function _repairMissingParams(plan) {
    if (!plan || !testWoo.fragments || !testWoo.fragContract) return;
    _walkFragments(plan, function (item) {
      if (!item || !item.fragment) return;
      var f = null;
      try { f = testWoo.fragments.getByName(item.fragment); } catch (eG) { f = null; }
      if (!f) return;
      var need = _sqlNeed(f.sql_text);
      if (!_paramsIncomplete(item.params, need)) return;
      var fresh = _ensureFreshDomain(f);
      var proposed = proposeParams(_slotTextForFrag(plan, f), fresh, need);
      var chk = testWoo.fragContract.validateBind(fresh, proposed);
      if (!chk || !chk.ok) return;
      if (!item.params || typeof item.params !== "object") item.params = {};
      var pk;
      for (pk in proposed) {
        if (!proposed.hasOwnProperty(pk)) continue;
        if (!need[pk]) continue;
        if (item.params[pk] == null || item.params[pk] === "")
          item.params[pk] = proposed[pk];
      }
    });
  }

  function _healPlanDomains(plan) {
    if (!plan || !testWoo.fragments || !testWoo.fragments.healDomain) return;
    if (!testWoo.fragContract) return;
    _walkFragments(plan, function (item) {
      if (!item || !item.fragment || !item.params) return;
      var f = null;
      try { f = testWoo.fragments.getByName(item.fragment); } catch (eG) { f = null; }
      if (!f || !f.id) return;
      var need = _sqlNeed(f.sql_text);
      if (_paramsIncomplete(item.params, need)) return;
      var fresh = _ensureFreshDomain(f);
      var chk = testWoo.fragContract.validateBind(fresh, item.params);
      if (!chk || !chk.ok) return;
      var alias = _slotTextForFrag(plan, f);
      if (!alias) return;
      try {
        testWoo.fragments.healDomain(f, alias, item.params, { domain: fresh });
      } catch (eH) {
        try { logWarning("[testWoo.llm.healDomain] " + String(eH.message || eH)); } catch (eL) {}
      }
    });
  }

  var LLM_MAX_TOKENS = 8192; // reasoning 토큰이 max_tokens 에 합산되는 모델 기준 기본값
  var FREQUENCY_PENALTY_MAX = 1;
  // 단계별 출력 상한 env 키. Pass1 은 후보 카드 전량을 받아 CNF 를 만들므로 출력이 더 길다.
  var STAGE_TOKEN_KEY = {
    pass0: "pass0MaxTokens",
    pass1: "pass1MaxTokens",
    enPivot: "pass0MaxTokens"
  };

  // reasoning 을 끄는 유일한 형식. thinking 모델은 사고 토큰을 max_tokens 에 합산하므로
  // 끄지 못하면 본문 몫이 0 이 되어 finish_reason="length" + 빈 응답이 온다.
  // enabled:false 만으로는 Gemini 계열에서 thinkingBudget 이 0 으로 내려가지 않아
  // 구글 기본값(dynamic, 최대 8192)이 그대로 적용된다 → max_tokens:0 을 함께 보낸다.
  // Ref: https://openrouter.ai/blog/tutorials/gemini-25-flash-api-pricing-quickstart-provider-comparison/
  function reasoningOff() {
    return { enabled: false, max_tokens: 0 };
  }

  // 단계별 출력 상한. testWooEnv.js llm.pass0MaxTokens / pass1MaxTokens 를 따른다
  // (Triage·Foundry 와 동일하게 env 직접 참조 — cfg.llm 은 이 값을 싣지 않는다).
  function _maxTokensFor(stage) {
    var key = STAGE_TOKEN_KEY[String(stage || "pass0")] || STAGE_TOKEN_KEY.pass0;
    var v = null;
    try {
      if (testWoo.env && testWoo.env.getEnv) v = testWoo.env.getEnv().llm[key];
    } catch (eEnv) { v = null; }
    var n = Number(v);
    return (v != null && !isNaN(n) && n > 0) ? n : LLM_MAX_TOKENS;
  }

  // 반복 루프 억제. temperature:0 은 결정성을 위해 유지하되(0 이 오히려 반복을 유도할 수
  // 있으므로) frequency_penalty 로만 억제한다. 0 이면 키 자체를 body 에 넣지 않는다.
  // 미지원 모델이면 OpenRouter 가 무시하며, 거부 시 _httpError 에 원문이 남는다.
  function _frequencyPenalty() {
    var L = null;
    try {
      if (testWoo.env && testWoo.env.getEnv) L = testWoo.env.getEnv().llm;
    } catch (eEnv) { L = null; }
    if (!L || L.repetitionGuardEnabled !== true) return 0;
    var n = Number(L.frequencyPenalty);
    if (isNaN(n) || n <= 0) return 0;
    return n > FREQUENCY_PENALTY_MAX ? FREQUENCY_PENALTY_MAX : n;
  }

  var _PROVIDERS = {
    anthropic: {
      headers: function (apiKey) {
        return { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
      },
      body: function (model, system, user, maxTokens) {
        return {
          model: model,
          max_tokens: maxTokens,
          temperature: 0,
          system: system,
          messages: [{ role: "user", content: user }]
        };
      }
    },
    openrouter: {
      headers: function (apiKey) {
        return { "Authorization": "Bearer " + apiKey };
      },
      body: function (model, system, user, maxTokens, opts) {
        opts = opts || {};
        var body = {
          model: model,
          max_tokens: maxTokens != null ? maxTokens : LLM_MAX_TOKENS,
          temperature: 0,
          messages: opts.messages || [
            { role: "system", content: system },
            { role: "user", content: user }
          ]
        };
        if (opts.reasoning != null) body.reasoning = opts.reasoning;
        else body.reasoning = reasoningOff();
        var fp = (opts.frequencyPenalty != null) ?
          Number(opts.frequencyPenalty) : _frequencyPenalty();
        if (isNaN(fp) || fp < 0) fp = 0;
        if (fp > FREQUENCY_PENALTY_MAX) fp = FREQUENCY_PENALTY_MAX;
        if (fp > 0) body.frequency_penalty = fp;
        // 원칙: 본 시스템은 response_format:{type:"json_object"} 를 사용하지 않는다.
        // Gemini 계열은 structured output 강제 시 토큰 반복 루프에 빠져 max_tokens 를
        // 소진한다(#80 Triage 와 동일 조치). JSON 강제는 시스템 프롬프트의
        // "OUTPUT JSON ONLY" 지시 + _parseJson 의 {…} 추출로 대체한다.
        // Ref: https://discuss.ai.google.dev/t/gemini-2-5-flash-repeats-tokens-until-max-tokens-reached-in-structured-output/107176
        // 아래 pass-through 는 tools 와의 상호배제만 유지하기 위한 것이며 호출부는 없다.
        if (opts.responseFormat != null && !opts.tools)
          body.response_format = opts.responseFormat;
        // tools: 빈 배열도 falsy 취급. parallel_tool_calls 는 tool_choice:"none" 과 같이 내면
        // OpenRouter→Azure Anthropic 이 tool_choice.none.disable_parallel_tool_use 로 변환해
        // 400 "Extra inputs are not permitted" (Claude Sonnet 4.x via Azure).
        // Ref: https://github.com/zed-industries/zed/issues/35341
        // Ref: https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use
        if (opts.tools && opts.tools.length) {
          body.tools = opts.tools;
          var tc = opts.tool_choice != null ? opts.tool_choice : "auto";
          body.tool_choice = tc;
          if (tc !== "none") {
            body.parallel_tool_calls = opts.parallel_tool_calls === true;
          }
        }
        return body;
      }
    }
  };

  function _provider(cfg) {
    var p = _PROVIDERS[cfg.llm.provider];
    if (!p) throw new Error("[testWoo.llm] unknown provider: " + cfg.llm.provider);
    return p;
  }

  // stage = "pass0" | "pass1" — 출력 상한과 진단 메시지의 단계 표기에 쓰인다.
  // opts.frequencyPenalty 가 있으면 env 값 대신 그 값을 쓴다(Pass0 재시도용).
  function _chat(cfg, system, userContent, stage, opts) {
    opts = opts || {};
    var adapter = _provider(cfg);
    var bodyOpts = { reasoning: reasoningOff() };
    if (opts.frequencyPenalty != null) bodyOpts.frequencyPenalty = opts.frequencyPenalty;
    var body = adapter.body(cfg.llm.model, system, userContent,
      _maxTokensFor(stage), bodyOpts);
    return _postJson(cfg.llm, body, adapter.headers(cfg.llm.apiKey));
  }

  function _isLengthOrRepeatError(e) {
    var msg = String((e && e.message) || e || "");
    return msg.indexOf("max_tokens") >= 0 || msg.indexOf("반복 루프") >= 0;
  }

  /**
   * OpenRouter 가 Claude(Azure 등)로 중계할 때 parallel_tool_calls:false +
   * tool_choice:"none" 조합을 Anthropic tool_choice.none.disable_parallel_tool_use 로
   * 바꾸면 upstream 400. none 턴에서는 parallel_tool_calls 키를 제거한다.
   */
  function _sanitizeChatBody(bodyObj) {
    if (!bodyObj || typeof bodyObj !== "object") return bodyObj;
    var tools = bodyObj.tools;
    var hasTools = tools && tools.length;
    if (!hasTools) {
      try { delete bodyObj.tools; } catch (e0) {}
      try { delete bodyObj.tool_choice; } catch (e1) {}
      try { delete bodyObj.parallel_tool_calls; } catch (e2) {}
      return bodyObj;
    }
    if (bodyObj.tool_choice === "none") {
      try { delete bodyObj.parallel_tool_calls; } catch (e3) {}
    }
    return bodyObj;
  }

  function postChat(cfg, bodyObj) {
    var adapter = _provider(cfg);
    var body = _sanitizeChatBody(bodyObj);
    var raw = _postJson(cfg.llm, body, adapter.headers(cfg.llm.apiKey));
    var wrap;
    try {
      wrap = JSON.parse(String(raw));
    } catch (e) {
      throw new Error("[testWoo.llm.postChat] JSON parse failed: " + e.message);
    }
    // HTTP 200 + 본문 error 봉투도 상태코드를 실어 던진다 (throttled 분기용)
    if (wrap && wrap.error) {
      var em = wrap.error.message || wrap.error.code || "unknown";
      throw _httpError("[testWoo.llm.postChat] API error: " + em,
        _numOrNull(wrap.error.code));
    }
    return wrap;
  }

  // 임베딩 엔드포인트는 chat endpoint(옵션 testWooAiLlmEndpoint)의 호스트를 재사용한다.
  // 하드코딩하면 프로바이더 교체·프록시 환경에서 어긋나고, 호스트가 chat 과 달라지는 경우
  // serverConf.xml urlPermission 에 그 호스트를 별도로 추가해야 한다.
  var CHAT_PATH_RE = /\/chat\/completions\/?$/i;

  // #155: 패턴 불일치 시 chat URL 폴백 금지(확정 400/404). null → embed() 가 null 폴백.
  function _embedEndpoint(chatEndpoint) {
    var url = String(chatEndpoint || "");
    if (!url)
      throw new Error("[testWoo.llm.postEmbedding] endpoint empty (option testWooAiLlmEndpoint)");
    if (CHAT_PATH_RE.test(url)) return url.replace(CHAT_PATH_RE, "/embeddings");
    logWarning("[testWoo.llm._embedEndpoint] endpoint 가 /chat/completions 형태가 아니라 " +
      "임베딩 경로를 유도할 수 없습니다 — null 반환 host=" + _hostOf(url));
    return null;
  }

  function postEmbedding(cfg, inputArray) {
    if (!cfg.llm.apiKey) throw new Error("[testWoo.llm.postEmbedding] apiKey missing");
    var embedUrl = _embedEndpoint(cfg.llm.endpoint);
    if (!embedUrl) return null;
    var body = { model: cfg.llm.embedModel, input: inputArray };
    var raw = _postJson(
      { apiKey: cfg.llm.apiKey, endpoint: embedUrl, useProxy: cfg.llm.useProxy },
      body,
      { "Authorization": "Bearer " + cfg.llm.apiKey }
    );
    var wrap;
    try {
      wrap = JSON.parse(String(raw));
    } catch (e) {
      throw new Error("[testWoo.llm.postEmbedding] parse failed: " + e.message);
    }
    if (wrap && wrap.error) {
      var em = wrap.error.message || wrap.error.code || "unknown";
      throw _httpError(
        "[testWoo.llm.postEmbedding] API error: " + em,
        _numOrNull(wrap.error.code)
      );
    }
    return wrap;
  }

  // 봉투(choices/content)에서 본문만 꺼낸다. 산문을 요구하므로 JSON 을 강제하지 않고,
  // 응답이 JSON 이면 첫 문자열 값을 설명으로 쓴다. 설명은 dedup 판정에 영향이 없다.
  function _explanationText(rawResponse) {
    var text = String(rawResponse || "");
    try {
      var wrap = JSON.parse(text);
      if (wrap && wrap.choices && wrap.choices[0] && wrap.choices[0].message)
        text = String(wrap.choices[0].message.content || "");
      else if (wrap && wrap.content && wrap.content.length && wrap.content[0].text)
        text = String(wrap.content[0].text);
    } catch (eWrap) {}
    var t = _trim(text);
    if (t.indexOf("{") === 0) {
      try {
        var obj = JSON.parse(t);
        for (var k in obj) {
          if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
          if (typeof obj[k] === "string" && _trim(obj[k])) return _trim(obj[k]).substring(0, 500);
        }
      } catch (eObj) {}
    }
    return t.substring(0, 500);
  }

  function explainDedupDiff(candidate, match, diffCount) {
    var cfg = testWoo.cfg.getConfig();
    _requireLlmOpts(cfg);
    var system = "Explain in Korean (2-3 sentences) how two SQL fragments differ. Do NOT change any verdict.";
    var user = "Fragment A label: " + (candidate.label || candidate.name) +
      "\nFragment B label: " + (match.label || match.name) +
      "\nSymmetric diff count: " + diffCount +
      "\nDo not include customer PII.";
    var adapter = _provider(cfg);
    // 산문 2~3문장을 요구하면서 json_object 를 강제하면 Pass0 와 동일한 반복 루프 조건이
    // 된다(L-1). responseFormat 을 넘기지 않으므로 어댑터도 response_format 을 붙이지 않는다.
    var body = adapter.body(cfg.llm.model, system, user, 1024, {
      reasoning: reasoningOff()
    });
    var raw = _postJson(cfg.llm, body, adapter.headers(cfg.llm.apiKey));
    return _explanationText(raw);
  }

  function _errText(e) {
    if (e == null) return "unknown";
    if (typeof e === "string") return e;
    try {
      if (e.message != null && String(e.message) !== "") return String(e.message);
    } catch (ignore1) {}
    try { return String(e); } catch (ignore2) { return "unknown"; }
  }

  function _hostOf(url) {
    var s = String(url || "");
    var m = s.match(/^https?:\/\/([^\/?#]+)/i);
    return m ? m[1] : "(no-host)";
  }

  // MemoryBuffer.toString([codePage]) — codePage는 문자열 아님, 정수.
  // 공식: 기본값 MemoryBuffer.CODEPAGE_UTF8.
  // toString("utf-8") 문자열 전달 시 예외 없이 빈 문자열이 나와 HTTP 200 + empty body 오진 발생.
  function _readResponseBody(res) {
    if (!res || res.body == null) return "";
    var body = res.body;
    if (typeof body === "string") return body;

    var size = -1;
    try { size = Number(body.size); } catch (eSz) {}

    try {
      if (typeof body.isEmpty === "boolean" && body.isEmpty) return "";
    } catch (eEmpty) {}

    // 1) 기본 toString() = CODEPAGE_UTF8 (공식 기본값) — Anthropic JSON
    try {
      var s0 = body.toString();
      if (s0 != null && String(s0).length > 0) return String(s0);
    } catch (e0) {}

    // 2) 상수 정수
    try {
      if (typeof MemoryBuffer !== "undefined" && MemoryBuffer.CODEPAGE_UTF8 != null) {
        var s1 = body.toString(MemoryBuffer.CODEPAGE_UTF8);
        if (s1 != null && String(s1).length > 0) return String(s1);
      }
    } catch (e1) {}

    // 3) 응답 codePage (정수일 때만 — 한글 깨짐 위험 있어 size>0 폴백용)
    try {
      if (res.codePage != null && typeof res.codePage !== "string") {
        var s2 = body.toString(res.codePage);
        if (s2 != null && String(s2).length > 0) return String(s2);
      }
    } catch (e2) {}

    if (size > 0)
      throw new Error("response body size=" + size + " but toString yielded empty (use int CODEPAGE)");
    return "";
  }

  // 오류에 HTTP 상태코드를 실어 보낸다. 호출부는 문자열("402" 포함 여부) 대신
  // e.httpStatus / e.isRateLimited / e.isOutOfCredit 로 분기한다.
  function _httpError(message, code) {
    var err = new Error(message);
    if (code != null) {
      err.httpStatus = Number(code);
      err.isRateLimited = (Number(code) === 429);
      err.isOutOfCredit = (Number(code) === 402);
    }
    return err;
  }

  function _numOrNull(v) {
    if (v == null) return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }

  function _statusOf(e) {
    if (e == null) return null;
    try {
      if (e.httpStatus != null) return Number(e.httpStatus);
    } catch (ignore) {}
    return null;
  }

  // MemoryBuffer UTF-8 + 동기 execute만.
  // 금지: HttpClientRequest.wait — Java 브리지에서 typeof==function 이어도 호출 실패함.
  function _postJson(llm, body, headerMap) {
    var url = llm.endpoint;
    var apiKey = llm.apiKey;
    var host = _hostOf(url);
    try {
      if (!url) throw new Error("endpoint empty (option testWooAiLlmEndpoint)");
      if (!apiKey) throw new Error("apiKey empty (option testWooAiLlmApiKey)");

      var req = new HttpClientRequest(url);
      req.method = "POST";
      req.header["Content-Type"] = "application/json; charset=utf-8";
      var hm = headerMap || {};
      for (var hk in hm) {
        if (Object.prototype.hasOwnProperty.call(hm, hk)) {
          req.header[hk] = hm[hk];
        }
      }

      var buf = new MemoryBuffer();
      buf.fromString(JSON.stringify(body), "utf-8");
      req.body = buf;

      req.execute(!!llm.useProxy);

      var res = req.response;
      if (!res) throw new Error("no response after execute (host=" + host + ")");

      var code = res.code;
      var resBody = _readResponseBody(res);
      if (code < 200 || code >= 300) {
        var preview = resBody.length > 400 ? resBody.substring(0, 400) + "..." : resBody;
        throw _httpError("HTTP " + code + " host=" + host + " body=" + preview, code);
      }
      if (!resBody) throw _httpError("empty body HTTP " + code + " host=" + host, code);
      return resBody;
    } catch (e) {
      var msg = _errText(e);
      var status = _statusOf(e);
      if (msg.indexOf("urlPermission") >= 0 || msg.indexOf("JST-310026") >= 0) {
        throw _httpError(
          "[testWoo.llm._postJson] urlPermission blocked host=" + host +
          " — allow https://" + host + " in serverConf.xml urlPermission. detail=" + msg,
          status
        );
      }
      throw _httpError("[testWoo.llm._postJson] failed host=" + host + ": " + msg, status);
    }
  }

  // 응답 본문이 같은 패턴을 되풀이하다 상한에 부딪혔는지 추정한다.
  // 짧은 NL 입력에서 본문이 상한을 채우는 것은 정상 생성이 아니라 반복 루프다.
  function _looksRepetitive(text) {
    var t = String(text || "");
    if (t.length < 400) return false;
    var head = t.substring(0, 200);
    var tail = t.substring(t.length - 200);
    if (head === tail) return true;
    for (var len = 12; len <= 40; len++) {
      var unit = tail.substring(0, len);
      var hits = 0;
      var pos = 0;
      while (pos <= tail.length - len) {
        var at = tail.indexOf(unit, pos);
        if (at < 0) break;
        hits++;
        pos = at + len;
      }
      if (hits >= 3) return true;
    }
    return false;
  }

  /**
   * Pass0 length 절단 시 content 앞부분에서 {"slots":[...]} 회수.
   * 반복 루프로 꼬리만 깨진 경우 선두 JSON 이 유효한 경우가 많다.
   */
  function _salvagePass0Slots(content) {
    var text = String(content == null ? "" : content);
    var start = text.indexOf("{");
    if (start < 0) return null;
    var slice = text.substring(start);
    if (slice.length > 2500) slice = slice.substring(0, 2500);
    var end = slice.lastIndexOf("}");
    while (end > 0) {
      try {
        var obj = JSON.parse(slice.substring(0, end + 1));
        if (obj && _isArray(obj.slots) && obj.slots.length > 0) {
          if (obj.slots.length > 8) obj.slots = obj.slots.slice(0, 8);
          return obj;
        }
      } catch (eSal) {}
      end = slice.lastIndexOf("}", end - 1);
    }
    return null;
  }

  // finish_reason="length" 원인 분기 안내. reasoning 토큰이 대부분이면 상한을 올리는 게
  // 아니라 reasoning 을 꺼야 하고, reasoning=0 인데 상한을 채웠다면 반복 루프다.
  // 프롬프트에는 고객 실데이터가 섞일 수 있으므로 응답 content 만 로그에 남긴다.
  function _lengthDiag(usage, content, stage) {
    var reason = 0;
    var completion = 0;
    try {
      if (usage) {
        completion = Number(usage.completion_tokens) || 0;
        if (usage.completion_tokens_details)
          reason = Number(usage.completion_tokens_details.reasoning_tokens) || 0;
      }
    } catch (eU) {}
    var text = String(content == null ? "" : content);
    var tail = "stage=" + String(stage || "?") +
      " completion=" + completion + " reasoning=" + reason +
      " contentChars=" + text.length;
    if (text.length) {
      logWarning("[testWoo.llm] length-cut head200: " + text.substring(0, 200));
      logWarning("[testWoo.llm] length-cut tail200: " +
        text.substring(text.length > 200 ? text.length - 200 : 0));
    }
    if (reason > 0 && reason >= completion / 2) {
      return "사고(reasoning) 토큰이 출력 상한을 소진했습니다 — " + tail +
        ". max_tokens 를 올리는 대신 reasoning 을 끄십시오" +
        "(thinking 모델은 reasoning:{enabled:false} 만으로는 꺼지지 않아 max_tokens:0 이 필요).";
    }
    if (_looksRepetitive(text)) {
      return "[반복 루프 의심] 동일 패턴이 되풀이되며 출력 상한을 소진했습니다 — " + tail +
        ". Gemini 간헐 루프(json_object 없이도 발생). Pass0 는 자동 재시도·frequency_penalty 확인.";
    }
    return "출력 상한을 올리거나 후보 수를 줄이세요 — " + tail +
      ". reasoning=0 인데 completion 이 상한이면 토큰 부족이 아니라 반복 루프일 수 있습니다.";
  }

  // OpenAI 호환 봉투(choices) 우선 → Anthropic envelope 폴백
  function _parseJson(rawResponse, stage) {
    var text = String(rawResponse || "");
    var wrap = null;
    try { wrap = JSON.parse(text); } catch (eParse) { wrap = null; }

    if (wrap) {
      if (wrap.usage) {
        logInfo("[testWoo.llm] usage: " + JSON.stringify(wrap.usage));
      }

      if (wrap.error) {
        var errMsg = wrap.error.message || wrap.error.code || text.substring(0, 200);
        throw _httpError("[testWoo.llm] API error: " + errMsg, _numOrNull(wrap.error.code));
      }

      if (wrap.choices && wrap.choices.length) {
        var ch = wrap.choices[0];
        if (ch.finish_reason === "length") {
          var cutContent = ch.message ? ch.message.content : "";
          // Pass0: 잘린 본문 앞쪽에서 slots JSON 회수 시도 (반복 루프여도 선두는 유효한 경우 많음)
          if (String(stage || "") === "pass0") {
            var salvaged = _salvagePass0Slots(cutContent);
            if (salvaged) {
              logWarning(
                "[testWoo.llm] pass0 length — salvaged slots count=" +
                salvaged.slots.length + " " +
                _lengthDiag(wrap.usage, cutContent, stage)
              );
              return salvaged;
            }
          }
          throw new Error(
            "[testWoo.llm] 응답이 max_tokens에서 잘렸습니다. " +
            _lengthDiag(wrap.usage, cutContent, stage)
          );
        }
        if (ch.finish_reason === "error") {
          throw new Error(
            "[testWoo.llm] provider error: " + (ch.native_finish_reason || "")
          );
        }
        if (ch.finish_reason === "tool_calls") {
          return { __tool_calls: true, wrap: wrap, message: ch.message };
        }
        if (ch.message && ch.message.content != null) {
          text = String(ch.message.content);
          if (text === "" && ch.message.reasoning) {
            throw new Error(
              "[testWoo.llm] 응답 본문이 비어 있고 reasoning만 반환됨. " +
              "reasoning 비활성 설정을 확인하세요."
            );
          }
        }
      } else {
        if (wrap.stop_reason === "max_tokens") {
          throw new Error(
            "[testWoo.llm] LLM 응답이 max_tokens에서 잘렸습니다. " +
            "후보 수를 줄이거나 max_tokens를 올리세요."
          );
        }
        if (wrap.content && wrap.content.length) {
          var parts = [];
          for (var i = 0; i < wrap.content.length; i++) {
            if (wrap.content[i].text) parts.push(wrap.content[i].text);
          }
          if (parts.length) text = parts.join("\n");
        }
      }
    }

    var start = text.indexOf("{");
    var end = text.lastIndexOf("}");
    if (start < 0 || end < 0 || end <= start)
      throw new Error("[testWoo.llm] JSON object missing");
    try {
      return JSON.parse(text.substring(start, end + 1));
    } catch (eJson) {
      throw new Error(
        "[testWoo.llm] plan JSON parse failed: " + _errText(eJson) +
        " (max_tokens 절단 가능) preview=" +
        text.substring(start, Math.min(start + 180, end + 1))
      );
    }
  }

  function _trunc(s, n) {
    var t = String(s == null ? "" : s);
    if (t.length <= n) return t;
    return t.substring(0, n);
  }

  function _slimSamples(sq) {
    if (!_isArray(sq)) return sq;
    var out = [];
    for (var i = 0; i < sq.length && i < 2; i++) out.push(_trunc(sq[i], 120));
    return out;
  }

  function _slimCandidates(slotCandidates) {
    var out = [];
    var list = slotCandidates || [];
    for (var i = 0; i < list.length; i++) {
      var sc = list[i];
      var cands = [];
      var src = sc.candidates || [];
      for (var j = 0; j < src.length; j++) {
        var c = src[j];
        cands.push({
          name: c.name,
          label: c.label,
          category: c.category,
          description: _trunc(c.description, 200),
          params: c.params,
          param_domain: c.param_domain,
          sample_questions: _slimSamples(c.sample_questions),
          key_column: c.key_column
        });
      }
      out.push({
        id: sc.id,
        text: sc.text,
        hintedCategory: sc.hintedCategory,
        candidates: cands
      });
    }
    return out;
  }

  function _validatePlanShape(plan) {
    if (!plan) throw new Error("[testWoo.llm] plan missing");
    if (!plan.grainKey) throw new Error("[testWoo.llm] plan.grainKey missing");
    if (!_isArray(plan.unmatched)) plan.unmatched = [];
    // unmatched가 있으면 include가 있어도 완성 계획이 아님 — selectPlan은 허용하고
    // generate/gates에서 hard fail. 여기서는 형태만 검사.
    if (!_isArray(plan.exclude)) plan.exclude = [];
    if (!_isArray(plan.include)) plan.include = [];
    if (!plan.unmatched.length) {
      if (!plan.include.length && !plan.exclude.length)
        throw new Error("[testWoo.llm] plan.include empty");
      for (var i = 0; i < plan.include.length; i++) {
        var g = plan.include[i];
        if (!g || !_isArray(g.any) || !g.any.length)
          throw new Error("[testWoo.llm] include[" + i + "].any empty");
      }
    }
  }

  function _countFragments(plan) {
    var n = 0;
    for (var i = 0; i < (plan.include || []).length; i++) {
      var any = plan.include[i] && plan.include[i].any;
      if (_isArray(any)) n += any.length;
    }
    if (_isArray(plan.exclude)) n += plan.exclude.length;
    return n;
  }

  function _allowedNames(slotCandidates) {
    var set = {};
    var list = slotCandidates || [];
    for (var i = 0; i < list.length; i++) {
      var cands = list[i].candidates || [];
      for (var j = 0; j < cands.length; j++) set[cands[j].name] = true;
    }
    return set;
  }

  function _walkFragments(plan, fn) {
    var inc = plan.include || [];
    for (var i = 0; i < inc.length; i++) {
      var any = (inc[i] && inc[i].any) || [];
      for (var j = 0; j < any.length; j++) fn(any[j]);
    }
    var ex = plan.exclude || [];
    for (var k = 0; k < ex.length; k++) fn(ex[k]);
  }

  function _rejectOutsideCandidates(plan, allowed) {
    _walkFragments(plan, function (s) {
      if (!s || !s.fragment)
        throw new Error("[testWoo.llm] fragment name missing in plan");
      if (!allowed[s.fragment])
        throw new Error("[testWoo.llm] fragment outside candidates: " + s.fragment);
    });
  }

  function _isArray(x) {
    return Object.prototype.toString.call(x) === "[object Array]";
  }

  return {
    decomposeSlots: decomposeSlots,
    normalizeAtomicSlots: normalizeAtomicSlots,
    selectPlan: selectPlan,
    generatePlan: generatePlan,
    chat: _chat,
    parseJson: _parseJson,
    postChat: postChat,
    postEmbedding: postEmbedding,
    explainDedupDiff: explainDedupDiff,
    reasoningOff: reasoningOff,
    _postJson: _postJson,
    _readResponseBody: _readResponseBody
  };
})();
testWoo.llm.__v = "178";
