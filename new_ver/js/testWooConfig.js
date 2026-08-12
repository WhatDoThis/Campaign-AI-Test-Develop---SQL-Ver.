/*
 * testWooConfig.js (런타임 설정 병합)
 * ==================================================
 * litmus 동기 __v=159 (#160 배포정합).
 * XtkOption 시크릿 3개와 testWooEnv 상수를 합쳐 파이프라인 cfg 객체 반환.
 * LLM·Foundry·Match 모듈이 공통으로 getConfig() 호출.
 * #168-A: triage.domainProbeRowLimit·domainTtlDays 패스스루(snapshotCap=valueProbeLimitMax).
 *
 * [Main Functions]
 * ===========
 * - getConfig — Env + Option 병합 cfg 객체 반환
 *
 * [Dependencies]
 * =========
 * - loadLibrary("woo:testWooEnv.js") — 헤더 직후 선로드
 * - XtkOption — testWooAiLlmApiKey/Model/Endpoint
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
        valueProbeCardinalityCap: E.triage.valueProbeCardinalityCap,
        domainProbeRowLimit: E.triage.domainProbeRowLimit,
        domainTtlDays: E.triage.domainTtlDays
      },
      toolkit: E.toolkit,
      guard: G
    };
  }

  return { getConfig: getConfig };
})();
testWoo.cfg.__v = "159";
