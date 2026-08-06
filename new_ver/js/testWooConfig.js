/*
 * testWooConfig.js (런타임 옵션 3개 + Env 병합 · server-side)
 * ============================================================
 * XtkOption 필수: testWooAiLlmApiKey, testWooAiLlmModel, testWooAiLlmEndpoint 만.
 * 그 외 튜닝·보안·프로바이더: testWooEnv.js
 *
 * [Main Functions]
 * ===========
 * - getConfig
 *
 * [Dependencies]
 * =========
 * - loadLibrary("woo:testWooEnv.js") 먼저
 */
try { loadLibrary("woo:testWooEnv.js"); } catch (eEnvLoad) {
  logWarning("[testWoo.cfg] testWooEnv.js preload failed: " + eEnvLoad.message);
}

var testWoo = testWoo || {};
testWoo.cfg = (function () {
  "use strict";

  var OPT = {
    apiKey: "testWooAiLlmApiKey",
    model: "testWooAiLlmModel",
    endpoint: "testWooAiLlmEndpoint"
  };

  function _env() {
    if (testWoo.env && testWoo.env.getEnv) return testWoo.env.getEnv();
    throw new Error("[testWoo.cfg] testWooEnv.js not loaded");
  }

  function getStr(key) {
    try {
      var v = getOption(key);
      return v == null || v === "" ? "" : String(v);
    } catch (e) {
      logWarning("[testWoo.cfg.getStr] option '" + key + "' failed: " + e.message);
      return "";
    }
  }

  function getConfig() {
    var E = _env();
    var G = E.guard;
    var L = E.llm;
    return {
      llm: {
        apiKey: getStr(OPT.apiKey),
        model: getStr(OPT.model),
        endpoint: getStr(OPT.endpoint),
        provider: String(L.provider || "openrouter").toLowerCase(),
        useProxy: !!L.useProxy,
        pass0Examples: String(L.pass0Examples || ""),
        embedModel: L.embedModel,
        embedEnabled: !!L.embedEnabled
      },
      security: {
        allowedCidr: String(E.security && E.security.allowedCidr ? E.security.allowedCidr : "")
      },
      search: {
        stageATopN: G.STAGE_A_TOP_N,
        queryPageSize: G.QUERY_PAGE_SIZE,
        maxSlots: G.MAX_SLOTS,
        maxSearchPages: G.MAX_SEARCH_PAGES,
        maxTokens: G.MAX_TOKENS
      },
      foundry: {
        enabled: E.foundry.enabled,
        maxTurns: E.foundry.maxTurns,
        batchSize: E.foundry.batchSize,
        maxNewFragments: E.foundry.maxNewFragments,
        namespaces: E.foundry.namespaces,
        tokenBudget: E.foundry.tokenBudget,
        dailyBudget: E.foundry.dailyBudget,
        gateRetries: E.foundry.gateRetries,
        staleProcessingMinutes: E.foundry.staleProcessingMinutes,
        dedupNearThreshold: E.dedup.nearThreshold,
        populationCountSql: E.populationCountSql
      },
      triage: {
        enabled: E.triage.enabled,
        maxTurns: E.triage.maxTurns,
        minConfidence: E.triage.minConfidence,
        clarifyMaxRounds: E.triage.clarifyMaxRounds,
        partialExecutionAllowed: E.triage.partialExecutionAllowed,
        valueProbeLimit: E.triage.valueProbeLimit,
        valueProbeLimitMax: E.triage.valueProbeLimitMax,
        valueProbeCardinalityCap: E.triage.valueProbeCardinalityCap
      },
      toolkit: E.toolkit,
      guard: G
    };
  }

  return { getConfig: getConfig };
})();
