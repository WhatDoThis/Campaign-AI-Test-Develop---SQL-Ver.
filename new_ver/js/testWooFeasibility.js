/*
 * testWooFeasibility.js (슬롯 실현가능성 Triage)
 * ==================================================
 * litmus 동기 __v=167 (libraryLookup — index identity 축-only M3 허용).
 * Foundry SQL 생성 전 슬롯별 feasible 여부 판정.
 * #169: Triage 진입 전 Stage A 라이브러리 조회(서가 우선). 미스만 스키마 탐색.
 * 축·커버·도메인 매칭은 testWoo.fragContract.libraryHitPredicate에 위임.
 *
 * [Main Functions]
 * ===========
 * - triage — slot+cfg → {verdict, confidence, evidence, canProceed}
 * - libraryLookup — Stage A+_source 유효 frag 조회(툴 0)
 * - axesCompatible — fragContract.axesCompatible 위임
 * - applyDemotionRules — LLM raw + toolLog → 강등·교정
 * - meetsConfidence — verdict·confidence 임계 충족 여부
 *
 * [Dependencies]
 * =========
 * - testWoo.fragContract — matchEnPivotSlot·libraryHitPredicate·domainMatch (#172)
 * - testWoo.toolkit — specs/invoke/markPhase/getEvidenceLogSince·invoke 캐시
 * - testWoo.fragments — searchBySlot·getByName (#169 서가)
 * - testWoo.llm.postChat — tool calling 루프
 * - testWoo.cfg.getConfig — triage.maxTurns·minConfidence
 *
 * [Invariants]
 * =========
 * - 라이브러리 히트 시 search_columns/describe/probe 호출 금지
 * - 컬럼 확인·값 미probe 시 "확인 못 함→불가" 금지 → probe 1회 강제 후 재판정
 * - reuse/서가 게이트 = fragContract.libraryHitPredicate (Foundry와 동일)
 */
var testWoo = testWoo || {};
testWoo.feasibility = (function () {
  "use strict";

  var VERDICTS = {
    feasible: true,
    no_column: true,
    no_value: true,
    value_not_found: true,
    out_of_domain: true,
    not_sql: true,
    ambiguous: true
  };

  var CONF_RANK = { high: 3, medium: 2, low: 1 };

  var TURNS_MIN = 2;
  var TURNS_MAX = 12;
  var TURNS_DEFAULT = 6;
  var FINAL_TURN_NUDGE = "FINAL TURN — no more tool calls are allowed. " +
    "Output the verdict JSON now, using only the evidence already gathered. " +
    "If you never called describe_schema, you MUST NOT answer no_column — use ambiguous. " +
    "If the evidence is insufficient, answer verdict=\"ambiguous\" with the reason.";

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  function _maxTurns(cfg) {
    var n = (cfg && cfg.triage && cfg.triage.maxTurns != null) ?
      Number(cfg.triage.maxTurns) : TURNS_DEFAULT;
    if (isNaN(n) || n < TURNS_MIN) n = TURNS_MIN;
    if (n > TURNS_MAX) n = TURNS_MAX;
    return n;
  }

  function _envBlock() {
    if (!testWoo.toolkit || !testWoo.toolkit.env) return "";
    try {
      var e = testWoo.toolkit.env();
      return "ENV: dbms=" + String(e.dbmsType || "?") +
        " allowedNamespaces=" + (e.allowedNamespaces || []).join(",") +
        " grainKeyCandidates=" + (e.grainKeyCandidates || []).join(",") +
        "\nOnly the namespaces listed above exist for you. Do not call tools with other namespaces.";
    } catch (eE) {
      return "";
    }
  }

  var NO_COLUMN_WITHOUT_DESCRIBE_NUDGE =
    "You claimed no_column (or have only searched literal values) without describe_schema. " +
    "REQUIRED next steps: (1) search_columns for concept synonyms such as region, city — " +
    "NOT the city/value itself; (2) list_schemas on allowed namespaces; " +
    "(3) describe_schema on customer/sample tables; (4) probe_values for the literal value. " +
    "Then output the verdict JSON.";

  function _triageSystemPrompt() {
    return [
      "You are a feasibility triage agent for LG U+ Adobe Campaign audience SQL.",
      "Decide if ONE condition slot can be expressed with available DB schemas/values.",
      "Use tools (list_schemas, describe_schema, search_columns, probe_values) for evidence.",
      "Fragment library was already checked before you ran — if you are called, library missed.",
      _envBlock(),
      "search_columns matches column NAMES/LABELS and schema name/label — never data values. " +
        "Searching a city name like Seoul returns 0 matches even when a region column exists.",
      "If list_schemas or search_columns points to a schema whose name/label fits the slot, " +
        "you MUST describe_schema that id before verdict. Do not stop at 'schema might exist'.",
      "Location/city slots: search keywords region, area, city first. " +
        "Then list_schemas → describe_schema → probe_values for the literal value. " +
        "Do NOT conclude no_column from value-keyword searches alone.",
      "Budget: few turns. At most two value-keyword searches, then switch to " +
        "concept synonyms + describe_schema/probe_values.",
      "Never invent SQL. Never substitute a similar column silently — put substitutes in alternatives only.",
      "If value existence is uncertain, call probe_values before claiming no_value.",
      "Do NOT say 'could not confirm value' without calling probe_values.",
      "no_column with high confidence REQUIRES describe_schema evidence. " +
        "Without it, answer ambiguous (not no_column).",
      "describe_schema reports a logical 'name' and a physical 'sqlColumn'. Report the " +
        "physical sqlColumn in evidence and alternatives so downstream SQL is valid; " +
        "an empty sqlColumn means the field is not SQL-queryable.",
      "OUTPUT JSON ONLY on final turn:",
      '{"slotId":"...","verdict":"feasible|no_column|no_value|out_of_domain|not_sql|ambiguous",',
      '"confidence":"high|medium|low","narrative":"Korean explanation",',
      '"evidence":{"schemasScanned":[],"columnsConsidered":[],"valueProbes":[]},',
      '"alternatives":[{"type":"column|value|rephrase","label":"...","detail":"...","schemaId":"","columnName":""}],',
      '"clarifyQuestion":"..."}',
      "Few-shot balance: treat missing schema concepts as no_column only after describe_schema; " +
        "missing values need probe_values."
    ].join("\n");
  }

  function _parseDomain(raw) {
    if (testWoo.fragContract && testWoo.fragContract.normalizeParamDomain) {
      var d = testWoo.fragContract.normalizeParamDomain(raw);
      if (!d) return null;
      var empty = true;
      for (var k in d) { if (d.hasOwnProperty(k)) { empty = false; break; } }
      if (empty && (raw == null || raw === "")) return null;
      return d;
    }
    if (raw == null) return null;
    if (typeof raw === "object") return raw;
    try { return JSON.parse(String(raw)); } catch (e) { return null; }
  }

  function axesCompatible(card, slotText) {
    if (testWoo.fragContract && testWoo.fragContract.axesCompatible)
      return testWoo.fragContract.axesCompatible(card, slotText);
    return true;
  }

  function _domainMatchSlot(domain, slotText) {
    if (testWoo.fragContract && testWoo.fragContract.domainMatchSlot)
      return testWoo.fragContract.domainMatchSlot(domain, slotText);
    return null;
  }

  function _matchToLibMatched(m) {
    if (!m || !m.layer || m.ambiguous) return null;
    return {
      param: m.param || "",
      nl: m.nl || "",
      value: m.value,
      layer: m.layer,
      group: !!m.group
    };
  }

  function _enPivotDomainMatch(domain, slotObj) {
    if (testWoo.fragContract && testWoo.fragContract.matchEnPivotSlot) {
      return _matchToLibMatched(
        testWoo.fragContract.matchEnPivotSlot(domain, slotObj));
    }
    return _domainMatchSlot(domain, String(slotObj.text || ""));
  }

  function _collectLibraryCandidates(slotObj, statuses) {
    var cands = [];
    var seen = {};
    function add(card) {
      if (!card || !card.name || seen[card.name]) return;
      seen[card.name] = 1;
      cands.push(card);
    }
    try {
      var fromSearch = testWoo.fragments.searchBySlot(slotObj, 8, statuses) || [];
      var si;
      for (si = 0; si < fromSearch.length; si++) add(fromSearch[si]);
    } catch (eS) { /* catalog scan below */ }

    var fc = testWoo.fragContract;
    if (!fc || !testWoo.fragments || !testWoo.fragments.listLexiconCards) return cands;

    var cards = [];
    try { cards = testWoo.fragments.listLexiconCards(statuses) || []; }
    catch (eL) { return cands; }

    var ci, card, m, srcConcept;
    for (ci = 0; ci < cards.length; ci++) {
      card = cards[ci];
      if (!card) continue;
      if (slotObj.resolvedName && String(card.name) === String(slotObj.resolvedName)) {
        add(card);
        continue;
      }
      if (fc.conceptOf && slotObj.concept) {
        srcConcept = fc.conceptOf(card.param_domain);
        if (srcConcept && (String(slotObj.concept) === srcConcept ||
            (fc.conceptsAxisMatch &&
              fc.conceptsAxisMatch(slotObj.concept, srcConcept, slotObj.kind))) &&
            fc.axesCompatible && fc.axesCompatible(card, slotObj)) {
          add(card);
          continue;
        }
      }
      if (fc.matchEnPivotSlot) {
        m = fc.matchEnPivotSlot(card.param_domain, slotObj, card);
        if (m && m.layer && !m.ambiguous && fc.axesCompatible &&
            fc.axesCompatible(card, slotObj)) {
          add(card);
          continue;
        }
      }
      if (fc.domainMatchSlot && fc.domainMatchSlot(card.param_domain, slotObj.text) &&
          fc.axesCompatible && fc.axesCompatible(card, slotObj))
        add(card);
    }
    return cands;
  }

  function _triageUserBlock(slotObj, nlContext) {
    var text = String((slotObj && slotObj.text) || slotObj || "");
    var block = "<user_request>" + text + "</user_request>";
    var en = _trim(slotObj && slotObj.en_literal);
    if (en) block += "\n<en_literal>" + en + "</en_literal>";
    var concept = _trim(slotObj && slotObj.concept);
    if (concept) block += "\n<concept>" + concept + "</concept>";
    if (nlContext) block += "\n<nl_context>" + String(nlContext) + "</nl_context>";
    return block;
  }

  function _libraryCoverOk(card, slotObj, domain, slotText) {
    if (testWoo.fragContract && testWoo.fragContract.libraryHitPredicate)
      return testWoo.fragContract.libraryHitPredicate(card, slotObj, domain);
    return axesCompatible(card, slotText);
  }

  function _valueInText(slotText, values) {
    var text = String(slotText || "");
    var list = values || [];
    if (testWoo.fragContract && testWoo.fragContract.yearMonthHits) {
      var ym = testWoo.fragContract.yearMonthHits(text, list) || [];
      if (ym.length) return ym[0];
    }
    for (var i = 0; i < list.length; i++) {
      var v = String(list[i]);
      if (v && text.indexOf(v) >= 0) return v;
    }
    return "";
  }

  function _probeValueList(probes) {
    var out = [];
    var seen = {};
    var i, p, arr, j, v;
    for (i = 0; i < (probes || []).length; i++) {
      p = probes[i] || {};
      arr = p.distinctValues || p.candidatesTop10 || [];
      if (p.matchedValue) arr = [p.matchedValue].concat(arr);
      for (j = 0; j < arr.length; j++) {
        v = String(arr[j] == null ? "" : arr[j]);
        if (!v || seen[v]) continue;
        seen[v] = 1;
        out.push(v);
      }
    }
    return out;
  }

  function _promoteNWolYearMonth(result, slotText) {
    if (!result || result.canProceed) return result;
    var v = String(result.verdict || "");
    if (v !== "ambiguous" && v !== "value_not_found") return result;
    if (!testWoo.fragContract || !testWoo.fragContract.yearMonthHits) return result;
    var vals = _probeValueList(result.evidence && result.evidence.valueProbes);
    var hits = testWoo.fragContract.yearMonthHits(slotText, vals) || [];
    if (!hits.length) return result;
    result.verdict = "feasible";
    result.confidence = "high";
    result.narrative = "N월 → 도메인 YYYY-MM " + hits.join(",");
    result.boundValues = hits;
    result.canProceed = true;
    result.clarifyQuestion = "";
    result.alternatives = [];
    try {
      if (typeof twDbg === "function")
        twDbg("triage.nwol", String(slotText) + " → " + hits.join(","));
    } catch (eD) { /* skip */ }
    return result;
  }

  // #169: Stage A + _source 유효 → 스키마 툴 0회
  // orphaned는 스킵, stale는 후보를 더 본 뒤 없으면 Foundry 갱신용으로 반환
  function libraryLookup(slot, opts) {
    opts = opts || {};
    if (!testWoo.fragments || !testWoo.fragments.searchBySlot)
      return { ok: false, reason: "fragments unavailable" };
    var slotObj = typeof slot === "string" ?
      { id: "s?", text: slot } : (slot || { id: "s?", text: "" });
    var slotText = String(slotObj.text || "");
    var statuses = opts.statuses;
    if (!statuses || !statuses.length) statuses = ["active", "verified"];
    var cands = [];
    try {
      cands = _collectLibraryCandidates(slotObj, statuses) || [];
    } catch (eS) {
      return { ok: false, reason: String(eS.message || eS) };
    }
    var firstStale = null;
    for (var i = 0; i < cands.length; i++) {
      var card = cands[i];
      var full = null;
      try {
        full = testWoo.fragments.getByName(card.name);
      } catch (eG) {
        full = null;
      }
      if (!full || !full.id) continue;
      var domain = _parseDomain(full.param_domain != null ? full.param_domain : card.param_domain);
      if (!domain || !domain._source) continue;
      if (!_libraryCoverOk(card, slotObj, domain, slotText)) continue;

      var fresh = { status: "ok" };
      if (testWoo.toolkit && testWoo.toolkit.checkSourceFreshness) {
        try {
          fresh = testWoo.toolkit.checkSourceFreshness(domain._source);
        } catch (eF) {
          fresh = { status: "stale", reason: String(eF.message || eF) };
        }
      }
      if (fresh.status === "orphaned") continue;
      if (fresh.status === "stale") {
        if (!firstStale) {
          firstStale = {
            ok: false,
            reason: fresh.reason || "stale",
            freshness: "stale",
            fragmentId: Number(full.id),
            name: String(full.name || ""),
            domain: domain
          };
        }
        continue;
      }
      // ok / ttl_expired: M1/M2/M2G는 값 매칭. M3(축만)은 libraryHitPredicate(자기 색인) 통과 시만 서가 hit.
      var matched = _enPivotDomainMatch(domain, slotObj);
      var predOk = testWoo.fragContract && testWoo.fragContract.libraryHitPredicate &&
        testWoo.fragContract.libraryHitPredicate(card, slotObj, domain);
      if (predOk && (!matched || !matched.layer || matched.layer === "M3")) {
        if (!matched || !matched.layer) {
          matched = {
            layer: "M3", param: "", nl: slotText, value: null,
            ambiguous: false, hits: []
          };
        }
        return {
          ok: true,
          fragmentId: Number(full.id),
          name: String(full.name || ""),
          domain: domain,
          matched: matched,
          matchLayer: matched.layer,
          freshness: fresh.status,
          resolvedBy: "library_cache_hit"
        };
      }
      if (!matched || !matched.layer || matched.layer === "M3") continue;
      return {
        ok: true,
        fragmentId: Number(full.id),
        name: String(full.name || ""),
        domain: domain,
        matched: matched,
        matchLayer: matched ? matched.layer : "",
        freshness: fresh.status,
        resolvedBy: "library_cache_hit"
      };
    }
    if (firstStale) return firstStale;
    return { ok: false, reason: "no library hit" };
  }

  function _libraryFeasibleResult(slotId, slotText, lib) {
    var probes = [];
    if (lib.matched) {
      probes.push({
        source: "library",
        frag: lib.name,
        matched: true,
        value: lib.matched.value,
        nl: lib.matched.nl || ""
      });
    } else {
      probes.push({
        source: "library",
        frag: lib.name,
        matched: true,
        note: "axis cache hit (_source); value map present on frag"
      });
    }
    return {
      slotId: slotId,
      slotText: slotText,
      verdict: "feasible",
      confidence: "high",
      narrative: "라이브러리 frag 재사용: " + lib.name +
        " (서가 히트 — 스키마 탐색 툴 0회)",
      evidence: {
        source: "library",
        fragmentId: lib.fragmentId,
        fragmentName: lib.name,
        schemasScanned: [],
        columnsConsidered: [],
        valueProbes: probes,
        toolCalls: 0
      },
      alternatives: [],
      clarifyQuestion: "",
      fragmentId: lib.fragmentId,
      resolvedBy: "library_cache_hit",
      canProceed: true,
      skipped: false,
      libraryHit: true
    };
  }

  function runTriageLoop(cfg, slotObj, slotId, nlContext) {
    var userBlock = _triageUserBlock(slotObj, nlContext);
    var messages = [
      { role: "system", content: _triageSystemPrompt() },
      { role: "user", content: userBlock }
    ];
    var specs = testWoo.toolkit.specs();
    var maxTok = (testWoo.env && testWoo.env.getEnv) ?
      testWoo.env.getEnv().llm.triageMaxTokens : 4096;

    var turns = _maxTurns(cfg);
    for (var t = 0; t < turns; t++) {
      var lastTurn = (t === turns - 1);
      if (lastTurn) messages.push({ role: "user", content: FINAL_TURN_NUDGE });

      var body = {
        model: cfg.llm.model,
        messages: messages,
        tools: specs,
        tool_choice: lastTurn ? "none" : "auto",
        max_tokens: maxTok,
        reasoning: testWoo.llm.reasoningOff(),
        temperature: 0
      };
      if (!lastTurn) body.parallel_tool_calls = false;
      var wrap = testWoo.llm.postChat(cfg, body);
      if (!wrap || !wrap.choices || !wrap.choices.length)
        throw new Error("[testWoo.feasibility] empty LLM response");
      var ch = wrap.choices[0];
      var msg = ch.message || {};
      messages.push(msg);

      if (!lastTurn && msg.tool_calls && msg.tool_calls.length) {
        for (var i = 0; i < msg.tool_calls.length; i++) {
          var tc = msg.tool_calls[i];
          var fn = tc.function || {};
          var args = {};
          try {
            args = JSON.parse(String(fn.arguments || "{}"));
          } catch (eA) {
            logWarning("[testWoo.feasibility] tool args parse failed tool=" +
              String(fn.name) + " / " + String(eA.message || eA));
          }
          var out = testWoo.toolkit.invoke(fn.name, args);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(out)
          });
        }
        continue;
      }

      if (ch.finish_reason === "length")
        throw new Error("[testWoo.feasibility] triage 응답이 max_tokens(" + maxTok +
          ")에서 절단됨 — triageMaxTokens 상향 또는 반복 루프 확인 (turn " + (t + 1) + ")");

      var content = String(msg.content || "");
      var start = content.indexOf("{");
      var end = content.lastIndexOf("}");
      if (start < 0 || end <= start)
        throw new Error("[testWoo.feasibility] triage JSON missing (turn " + (t + 1) +
          "/" + turns + ", finish_reason=" + String(ch.finish_reason) +
          ", contentLen=" + content.length + ")");

      var parsed;
      try {
        parsed = JSON.parse(content.substring(start, end + 1));
      } catch (eP) {
        throw new Error("[testWoo.feasibility] triage JSON parse error: " +
          String(eP.message || eP));
      }

      var v = _trim(parsed.verdict || "");
      if (v === "no_column" && !lastTurn) {
        var evLog = testWoo.toolkit.getEvidenceLog ?
          testWoo.toolkit.getEvidenceLog() : [];
        if (!_hasToolCall(evLog, "describe_schema")) {
          logInfo("[testWoo.feasibility] no_column without describe_schema — nudge turn=" +
            (t + 1));
          messages.push({ role: "user", content: NO_COLUMN_WITHOUT_DESCRIBE_NUDGE });
          continue;
        }
      }
      return parsed;
    }
    throw new Error("[testWoo.feasibility] triage tool loop exceeded (turns=" + turns + ")");
  }

  function _hasToolCall(log, name) {
    var list = log || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].tool) === name) return true;
    }
    return false;
  }

  function _hasPartialScan(log) {
    var list = log || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].partialScan === true) return true;
    }
    return false;
  }

  function _hasSchemaLoadFailed(log) {
    var list = log || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].schemaLoadFailed === true) return true;
    }
    return false;
  }

  function _selfReportCount(evidence) {
    var n = evidence && evidence.toolCalls != null ? Number(evidence.toolCalls) : -1;
    return isNaN(n) ? -1 : n;
  }

  function applyDemotionRules(raw, toolLog) {
    var out = raw || {};
    var log = toolLog || [];
    var verdict = _trim(out.verdict || "ambiguous");
    if (!VERDICTS[verdict]) verdict = "ambiguous";
    var confidence = _trim(out.confidence || "low");
    if (confidence !== "high" && confidence !== "medium" && confidence !== "low") confidence = "low";

    var evidence = out.evidence || {};
    if (!evidence.schemasScanned) evidence.schemasScanned = [];
    if (!evidence.columnsConsidered) evidence.columnsConsidered = [];
    if (!evidence.valueProbes) evidence.valueProbes = [];

    var claimed = _selfReportCount(evidence);
    evidence.toolCalls = log.length;
    evidence.selfReportMismatch = (claimed >= 0 && claimed !== log.length);

    var narrative = String(out.narrative || "");
    var demoted = false;

    if (verdict === "no_value" && !_hasToolCall(log, "probe_values")) {
      verdict = "ambiguous";
      demoted = true;
    }
    if (verdict === "value_not_found" && !_hasToolCall(log, "probe_values")) {
      verdict = "ambiguous";
      demoted = true;
    }
    if (verdict === "no_column" && !_hasToolCall(log, "search_columns")) {
      verdict = "ambiguous";
      demoted = true;
    }
    if (verdict === "no_column" && !_hasToolCall(log, "describe_schema")) {
      verdict = "ambiguous";
      evidence.noDescribeBeforeNoColumn = true;
      demoted = true;
    }
    if (verdict === "no_column" && _hasSchemaLoadFailed(log)) {
      verdict = "ambiguous";
      evidence.schemaLoadFailed = true;
      demoted = true;
    }
    if (verdict === "feasible" && log.length === 0 && evidence.source !== "library") {
      verdict = "ambiguous";
      demoted = true;
    }
    if (verdict === "feasible" && confidence === "low") {
      verdict = "ambiguous";
      demoted = true;
    }

    if (demoted) {
      confidence = "low";
      if (narrative.indexOf("근거 부족") < 0)
        narrative = narrative + " (근거 부족으로 확정되지 않음)";
    }

    if (verdict === "no_column" && confidence === "high" && _hasPartialScan(log)) {
      confidence = "medium";
      evidence.partialScan = true;
      narrative = narrative + " (스키마 전수 조사 아님)";
    }

    if (evidence.selfReportMismatch) {
      narrative = narrative + " (LLM 자기신고 툴 호수 " + claimed +
        "회 ≠ 실제 " + log.length + "회)";
    }

    return {
      slotId: out.slotId || "",
      verdict: verdict,
      confidence: confidence,
      narrative: narrative,
      evidence: evidence,
      alternatives: out.alternatives || [],
      clarifyQuestion: out.clarifyQuestion || ""
    };
  }

  function meetsConfidence(cfg, confidence) {
    var min = cfg.triage && cfg.triage.minConfidence ? cfg.triage.minConfidence : "medium";
    var need = CONF_RANK[min] || 2;
    var have = CONF_RANK[confidence] || 1;
    return have >= need;
  }

  // #169 2-2: 컬럼은 있는데 probe 없이 불가 → probe 1회 강제 후 재판정
  function _forceProbeAndRejudge(result, slotText, cfg) {
    if (!result || result.canProceed) return result;
    if (!testWoo.toolkit || !testWoo.toolkit.invoke) return result;
    var ev = result.evidence || {};
    var cols = ev.columnsConsidered || [];
    if (!cols.length) return result;
    var probes = ev.valueProbes || [];
    if (probes.length) return result;

    var col = cols[0] || {};
    var schemaId = String(col.schemaId || "");
    var columnName = String(col.columnName || col.sqlColumn || "");
    if (!schemaId || !columnName) return result;

    logInfo("[testWoo.feasibility] force probe_values schema=" + schemaId +
      " column=" + columnName);
    var pv = testWoo.toolkit.invoke("probe_values", {
      schemaId: schemaId,
      columnName: columnName,
      limit: 200
    });
    if (!pv || pv.error || pv.ok === false) {
      result.narrative = String(result.narrative || "") +
        " (강제 probe_values 실패)";
      return result;
    }
    var vals = pv.values || [];
    var top = [];
    for (var ti = 0; ti < vals.length && ti < 10; ti++) top.push(vals[ti]);
    var hit = _valueInText(slotText, vals);
    ev.valueProbes = [{
      source: "forced_probe",
      schemaId: schemaId,
      columnName: columnName,
      sqlColumn: pv.sqlColumn || col.sqlColumn || "",
      found: !!hit,
      matchedValue: hit || "",
      distinctCount: pv.distinctCount != null ? pv.distinctCount : vals.length,
      candidatesTop10: top
    }];
    result.evidence = ev;
    if (hit) {
      result.verdict = "feasible";
      result.confidence = "high";
      result.narrative = "컬럼 확인 후 강제 probe_values: 슬롯 값 '" + hit + "' 존재";
      result.canProceed = meetsConfidence(cfg, result.confidence);
      return result;
    }
    result.verdict = "value_not_found";
    result.confidence = "high";
    result.narrative = "컬럼은 있으나 슬롯 값이 distinct 목록에 없음";
    result.alternatives = [];
    for (var ai = 0; ai < top.length; ai++) {
      result.alternatives.push({
        type: "value",
        label: String(top[ai]),
        detail: "existing distinct value",
        schemaId: schemaId,
        columnName: columnName
      });
    }
    result.canProceed = false;
    return result;
  }

  function triage(slot, cfg, nlContext) {
    if (!cfg) cfg = testWoo.cfg.getConfig();
    var slotText = typeof slot === "string" ? slot : (slot.text || String(slot));
    var slotId = typeof slot === "object" && slot.id ? slot.id : "s?";
    var slotObj = typeof slot === "object" && slot ? slot : { id: slotId, text: slotText };

    if (!cfg.triage || !cfg.triage.enabled) {
      return {
        slotId: slotId,
        slotText: slotText,
        verdict: "feasible",
        confidence: "medium",
        narrative: "Triage disabled — proceed to SQL generation.",
        evidence: { schemasScanned: [], columnsConsidered: [], valueProbes: [], toolCalls: 0 },
        alternatives: [],
        clarifyQuestion: "",
        skipped: true,
        canProceed: true
      };
    }

    // #169 ①②: 서가 먼저 — 히트 시 스키마 툴 0회
    var lib = libraryLookup(slotObj, {
      statuses: ["active", "verified"]
    });
    if (lib.ok) {
      logInfo("[testWoo.feasibility] library hit name=" + lib.name +
        " id=" + lib.fragmentId + " slot=" + slotId);
      return _libraryFeasibleResult(slotId, slotText, lib);
    }
    if (lib.freshness === "stale" || lib.freshness === "orphaned") {
      logWarning("[testWoo.feasibility] library frag " + lib.freshness +
        " name=" + String(lib.name || "") + " — fall through to schema triage");
    }

    if (testWoo.toolkit.setPhaseBudget) testWoo.toolkit.setPhaseBudget("triage");
    var phaseStart = testWoo.toolkit.markPhase ?
      testWoo.toolkit.markPhase("triage:" + slotId) : 0;
    var raw = runTriageLoop(cfg, slotObj, slotId, nlContext || slotText);
    raw.slotId = raw.slotId || slotId;
    var toolLog = testWoo.toolkit.getEvidenceLogSince ?
      testWoo.toolkit.getEvidenceLogSince(phaseStart) : [];
    var result = applyDemotionRules(raw, toolLog);
    result.slotText = slotText;
    result.evidenceLog = toolLog;
    result.canProceed = result.verdict === "feasible" && meetsConfidence(cfg, result.confidence);

    // #169 2-2: 값 미수집 데드락 해소
    if (!result.canProceed)
      result = _forceProbeAndRejudge(result, slotText, cfg);
    if (!result.canProceed)
      result = _promoteNWolYearMonth(result, slotText);

    return result;
  }

  return {
    triage: triage,
    libraryLookup: libraryLookup,
    axesCompatible: axesCompatible,
    applyDemotionRules: applyDemotionRules,
    meetsConfidence: meetsConfidence
  };
})();
testWoo.feasibility.__v = "167";
