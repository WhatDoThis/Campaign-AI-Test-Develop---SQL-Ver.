/*
 * testWooFeasibility.js (실현가능성 Triage · server-side)
 * =======================================================
 * Foundry SQL 생성 전 슬롯별 feasible 여부 판정. 증거 없으면 ambiguous 강등.
 *
 * [Main Functions]
 * ===========
 * - triage(slot, cfg, nlContext)
 * - applyDemotionRules / normalizeVerdict
 *
 * [Dependencies]
 * =========
 * - testWoo.toolkit, testWoo.llm, testWoo.cfg
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

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  function _triageSystemPrompt() {
    return [
      "You are a feasibility triage agent for LG U+ Adobe Campaign audience SQL.",
      "Decide if ONE condition slot can be expressed with available DB schemas/values.",
      "Use tools (list_schemas, describe_schema, search_columns, probe_values) for evidence.",
      "Never invent SQL. Never substitute a similar column silently — put substitutes in alternatives only.",
      "If value existence is uncertain, call probe_values before claiming no_value.",
      "OUTPUT JSON ONLY on final turn:",
      '{"slotId":"...","verdict":"feasible|no_column|no_value|out_of_domain|not_sql|ambiguous",',
      '"confidence":"high|medium|low","narrative":"Korean explanation",',
      '"evidence":{"schemasScanned":[],"columnsConsidered":[],"valueProbes":[]},',
      '"alternatives":[{"type":"column|value|rephrase","label":"...","detail":"...","schemaId":"","columnName":""}],',
      '"clarifyQuestion":"..."}',
      "Few-shot balance: treat missing schema concepts as no_column; missing values need probe_values."
    ].join("\n");
  }

  function runTriageLoop(cfg, slotText, slotId, nlContext) {
    testWoo.toolkit.resetBudget();
    var userBlock = "<user_request>" + String(slotText || "") + "</user_request>\nNL:\n" +
      String(nlContext || "");
    var messages = [
      { role: "system", content: _triageSystemPrompt() },
      { role: "user", content: userBlock }
    ];
    var specs = testWoo.toolkit.specs();
    var maxTok = (testWoo.env && testWoo.env.getEnv) ?
      testWoo.env.getEnv().llm.triageMaxTokens : 4096;

    for (var t = 0; t < 4; t++) {
      var body = {
        model: cfg.llm.model,
        messages: messages,
        tools: specs,
        tool_choice: "auto",
        parallel_tool_calls: false,
        max_tokens: maxTok,
        reasoning: { enabled: false },
        temperature: 0,
        response_format: { type: "json_object" }
      };
      var wrap = testWoo.llm.postChat(cfg, body);
      if (!wrap || !wrap.choices || !wrap.choices.length)
        throw new Error("[testWoo.feasibility] empty LLM response");
      var ch = wrap.choices[0];
      var msg = ch.message || {};
      messages.push(msg);

      if (ch.finish_reason === "tool_calls" && msg.tool_calls && msg.tool_calls.length) {
        for (var i = 0; i < msg.tool_calls.length; i++) {
          var tc = msg.tool_calls[i];
          var fn = tc.function || {};
          var args = {};
          try { args = JSON.parse(String(fn.arguments || "{}")); } catch (eA) {}
          var out = testWoo.toolkit.invoke(fn.name, args);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(out)
          });
        }
        continue;
      }

      var content = String(msg.content || "");
      var start = content.indexOf("{");
      var end = content.lastIndexOf("}");
      if (start < 0 || end <= start)
        throw new Error("[testWoo.feasibility] triage JSON missing");
      return JSON.parse(content.substring(start, end + 1));
    }
    throw new Error("[testWoo.feasibility] triage tool loop exceeded");
  }

  function applyDemotionRules(raw, toolCallCount) {
    var out = raw || {};
    var verdict = _trim(out.verdict || "ambiguous");
    if (!VERDICTS[verdict]) verdict = "ambiguous";
    var confidence = _trim(out.confidence || "low");
    if (confidence !== "high" && confidence !== "medium" && confidence !== "low") confidence = "low";

    var evidence = out.evidence || {};
    if (!evidence.schemasScanned) evidence.schemasScanned = [];
    if (!evidence.columnsConsidered) evidence.columnsConsidered = [];
    if (!evidence.valueProbes) evidence.valueProbes = [];
    evidence.toolCalls = toolCallCount != null ? toolCallCount : (evidence.toolCalls || 0);

    var narrative = String(out.narrative || "");
    var demoted = false;

    if (verdict === "no_value" && (!evidence.valueProbes || !evidence.valueProbes.length)) {
      verdict = "ambiguous";
      demoted = true;
    }
    if (verdict === "no_column" &&
        (!evidence.columnsConsidered || !evidence.columnsConsidered.length) &&
        evidence.toolCalls < 1) {
      verdict = "ambiguous";
      demoted = true;
    }
    if (verdict === "feasible" && evidence.toolCalls === 0) {
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

    var raw = runTriageLoop(cfg, slotText, slotId, nlContext);
    raw.slotId = raw.slotId || slotId;
    var toolLog = testWoo.toolkit.getEvidenceLog ? testWoo.toolkit.getEvidenceLog() : [];
    var toolCalls = toolLog.length;
    var result = applyDemotionRules(raw, toolCalls);
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
