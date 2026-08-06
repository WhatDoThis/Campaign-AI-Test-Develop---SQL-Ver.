/*
 * testWooFeasibility.js (실현가능성 Triage · server-side)
 * =======================================================
 * Foundry SQL 생성 전 슬롯별 feasible 여부 판정. 증거 없으면 ambiguous 강등.
 *
 * 강등 근거는 LLM 자기신고(evidence)가 아니라 toolkit 실호출 로그(toolLog)만 신뢰한다.
 *
 * 툴 루프는 triage.maxTurns 턴이며 마지막 턴은 tool_choice:"none" + 최종 지시로
 * 판정 JSON 을 강제한다. 강제 턴이 없으면 모델이 턴 전부를 툴 호출로 소진해
 * "tool loop exceeded" 로 끝난다. 허용 namespace 는 toolkit.env() 로 프롬프트에
 * 명시한다 — 알려주지 않으면 미허용 ns 를 찍어보며 턴을 낭비한다.
 *
 * [Main Functions]
 * ===========
 * - triage(slot, cfg, nlContext)
 * - applyDemotionRules(raw, toolLog) / meetsConfidence
 *
 * [Dependencies]
 * =========
 * - testWoo.toolkit(env/specs/invoke/markPhase/getEvidenceLogSince), testWoo.llm, testWoo.cfg
 * - testWoo.env(llm.triageMaxTokens), cfg.triage.maxTurns
 * - loadLibrary("woo:testWooFeasibility.js")
 */
var testWoo = testWoo || {};
testWoo.feasibility = (function () {
  "use strict";

  var VERDICTS = {
    feasible: true,
    no_column: true,
    no_value: true,
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

  // 허용 namespace 를 프롬프트에 넣지 않으면 모델이 nms/cus 를 찍어보다 턴을 소진한다
  // (툴 설명의 "e.g. nms, cus, woo" 는 예시일 뿐 실제 허용 집합이 아니다).
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

  function _triageSystemPrompt() {
    return [
      "You are a feasibility triage agent for LG U+ Adobe Campaign audience SQL.",
      "Decide if ONE condition slot can be expressed with available DB schemas/values.",
      "Use tools (list_schemas, describe_schema, search_columns, probe_values) for evidence.",
      _envBlock(),
      "search_columns matches column NAMES/LABELS only — never data values. " +
        "For a literal value (e.g. a city name) find the candidate column first, " +
        "then call probe_values on it.",
      "Budget: few turns. Do not repeat a search with synonyms more than twice; " +
        "move to describe_schema/probe_values instead.",
      "Never invent SQL. Never substitute a similar column silently — put substitutes in alternatives only.",
      "If value existence is uncertain, call probe_values before claiming no_value.",
      "describe_schema reports a logical 'name' and a physical 'sqlColumn'. Report the " +
        "physical sqlColumn in evidence and alternatives so downstream SQL is valid; " +
        "an empty sqlColumn means the field is not SQL-queryable.",
      "OUTPUT JSON ONLY on final turn:",
      '{"slotId":"...","verdict":"feasible|no_column|no_value|out_of_domain|not_sql|ambiguous",',
      '"confidence":"high|medium|low","narrative":"Korean explanation",',
      '"evidence":{"schemasScanned":[],"columnsConsidered":[],"valueProbes":[]},',
      '"alternatives":[{"type":"column|value|rephrase","label":"...","detail":"...","schemaId":"","columnName":""}],',
      '"clarifyQuestion":"..."}',
      "Few-shot balance: treat missing schema concepts as no_column; missing values need probe_values."
    ].join("\n");
  }

  // 예산 초기화는 요청 단위(foundry.processQueueItem)에서만. 여기서는 구분자만 삽입한다.
  function runTriageLoop(cfg, slotText, slotId, nlContext) {
    var userBlock = "<user_request>" + String(slotText || "") + "</user_request>\nNL:\n" +
      String(nlContext || "");
    var messages = [
      { role: "system", content: _triageSystemPrompt() },
      { role: "user", content: userBlock }
    ];
    var specs = testWoo.toolkit.specs();
    var maxTok = (testWoo.env && testWoo.env.getEnv) ?
      testWoo.env.getEnv().llm.triageMaxTokens : 4096;

    var turns = _maxTurns(cfg);
    for (var t = 0; t < turns; t++) {
      // 마지막 턴은 tool_choice:"none" 으로 판정 JSON 을 강제한다. 이 장치가 없으면
      // 모델이 턴 전부를 툴 호출로 소진하고 루프가 예외로 끝난다.
      var lastTurn = (t === turns - 1);
      if (lastTurn) messages.push({ role: "user", content: FINAL_TURN_NUDGE });

      // response_format 금지: tools 와 동시 전송하면 Gemini 계열이 거부한다
      // ("Function calling with a response mime type: 'application/json' is unsupported").
      // JSON 강제는 시스템 프롬프트 + 아래 content 의 {…} 추출로 대체한다.
      var body = {
        model: cfg.llm.model,
        messages: messages,
        tools: specs,
        tool_choice: lastTurn ? "none" : "auto",
        parallel_tool_calls: false,
        max_tokens: maxTok,
        reasoning: testWoo.llm.reasoningOff(),
        temperature: 0
      };
      var wrap = testWoo.llm.postChat(cfg, body);
      if (!wrap || !wrap.choices || !wrap.choices.length)
        throw new Error("[testWoo.feasibility] empty LLM response");
      var ch = wrap.choices[0];
      var msg = ch.message || {};
      messages.push(msg);

      if (!lastTurn && ch.finish_reason === "tool_calls" &&
          msg.tool_calls && msg.tool_calls.length) {
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

      // length 는 토큰 부족이 아니라 반복 루프 신호일 수 있다 → 원인을 구분해 남긴다
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
      return JSON.parse(content.substring(start, end + 1));
    }
    // 도달 불가 — 마지막 턴은 항상 반환 또는 예외로 끝난다 (방어적 잔존)
    throw new Error("[testWoo.feasibility] triage tool loop exceeded (turns=" + turns + ")");
  }

  // toolLog에 해당 이름의 실제 호출이 있는지 (LLM 자기신고 무시)
  function _hasToolCall(log, name) {
    var list = log || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].tool) === name) return true;
    }
    return false;
  }

  // 전수 조사가 아니었으면 no_column 확신도를 medium 이하로 제한
  function _hasPartialScan(log) {
    var list = log || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].partialScan === true) return true;
    }
    return false;
  }

  // 스키마를 1건도 못 읽었으면 no_column 근거 자체가 없다 (N-2 회귀 방지)
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

    // evidence.toolCalls는 LLM 값이 아니라 실제 호출 수로 덮어쓴다.
    var claimed = _selfReportCount(evidence);
    evidence.toolCalls = log.length;
    evidence.selfReportMismatch = (claimed >= 0 && claimed !== log.length);

    var narrative = String(out.narrative || "");
    var demoted = false;

    if (verdict === "no_value" && !_hasToolCall(log, "probe_values")) {
      verdict = "ambiguous";
      demoted = true;
    }
    if (verdict === "no_column" && !_hasToolCall(log, "search_columns")) {
      verdict = "ambiguous";
      demoted = true;
    }
    // 스키마 로드가 전멸했으면 "컬럼 없음"이 아니라 "확인 불가"다.
    if (verdict === "no_column" && _hasSchemaLoadFailed(log)) {
      verdict = "ambiguous";
      evidence.schemaLoadFailed = true;
      demoted = true;
    }
    if (verdict === "feasible" && log.length === 0) {
      verdict = "ambiguous";
      demoted = true;
    }
    if (verdict === "feasible" && confidence === "low") {
      verdict = "ambiguous";
      demoted = true;
    }

    if (demoted) {
      confidence = "low";
      if (narrative.indexOf("\uADDC\uAC70 \uBD80\uC871") < 0)
        narrative = narrative + " (\uADDC\uAC70 \uBD80\uC871\uC73C\uB85C \uD655\uC815\uB418\uC9C0 \uC54A\uC74C)";
    }

    if (verdict === "no_column" && confidence === "high" && _hasPartialScan(log)) {
      confidence = "medium";
      evidence.partialScan = true;
      narrative = narrative + " (\uC2A4\uD0A4\uB9C8 \uC804\uC218 \uC870\uC0AC \uC544\uB2D8)";
    }

    if (evidence.selfReportMismatch) {
      narrative = narrative + " (LLM \uC790\uAE30\uC2E0\uACE0 \uD234 \uD638\uC218 " + claimed +
        "\uD68C \u2260 \uC2E4\uC81C " + log.length + "\uD68C)";
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

  function triage(slot, cfg, nlContext) {
    if (!cfg) cfg = testWoo.cfg.getConfig();
    var slotText = typeof slot === "string" ? slot : (slot.text || String(slot));
    var slotId = typeof slot === "object" && slot.id ? slot.id : "s?";

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
        skipped: true
      };
    }

    // 이 슬롯 triage 단계에서 발생한 툴 호출만 강등 근거로 쓴다(이전 슬롯 근거 전용 차단).
    var phaseStart = testWoo.toolkit.markPhase ?
      testWoo.toolkit.markPhase("triage:" + slotId) : 0;
    var raw = runTriageLoop(cfg, slotText, slotId, nlContext);
    raw.slotId = raw.slotId || slotId;
    var toolLog = testWoo.toolkit.getEvidenceLogSince ?
      testWoo.toolkit.getEvidenceLogSince(phaseStart) : [];
    var result = applyDemotionRules(raw, toolLog);
    result.slotText = slotText;
    result.evidenceLog = toolLog;
    result.canProceed = result.verdict === "feasible" && meetsConfidence(cfg, result.confidence);
    return result;
  }

  return {
    triage: triage,
    applyDemotionRules: applyDemotionRules,
    meetsConfidence: meetsConfidence
  };
})();
