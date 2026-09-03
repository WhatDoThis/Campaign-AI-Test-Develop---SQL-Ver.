/*
 * testWooConfig.js (런타임 설정 병합)
 * ==================================================
 * litmus 동기 __v=165 (#455 embedEnabled·embedModel 제거).
 * LLM·Foundry·Toolkit·WorkflowClone·WorkflowUi 공통 getConfig() 진입.
 *
 * [Main Functions]
 * ===========
 * - getConfig — Env + Option 병합 cfg 객체 반환
 * - getStr — XtkOption 문자열 읽기(단일 게이트)
 *
 * [Dependencies]
 * =========
 * - loadLibrary("woo:testWooEnv.js") — 헤더 직후 선로드
 * - XtkOption — Env.options.keys 레지스트리
 *
 * [Invariants]
 * ===========
 * - cfg.options — ACC Option에서 읽은 **런타임 값**(템플릿 id 정본)
 * - cfg.nms — Env 계약 internalName + fallback id (Option과 혼동 금지)
 * - cfg.settings.resolution — 병합 우선순위 문자열 (진단·문서용)
 */
try { loadLibrary("woo:testWooEnv.js"); } catch (eEnvLoad) {
  logWarning("[testWoo.cfg] testWooEnv.js preload failed: " + eEnvLoad.message);
}

var testWoo = testWoo || {};
testWoo.cfg = (function () {
  "use strict";

  function _env() {
    if (testWoo.env && testWoo.env.getEnv) return testWoo.env.getEnv();
    throw new Error("[testWoo.cfg] testWooEnv.js not loaded");
  }

  function _keys() {
    var E = _env();
    return E.options && E.options.keys ? E.options.keys : {};
  }

  function _nmsEnv() {
    var E = _env();
    return E.nms || {};
  }

  function _martEnv() {
    var E = _env();
    return E.mart || {};
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

  function _parseIntOpt(key) {
    var id = 0;
    var raw = getStr(key);
    if (raw !== "") id = parseInt(raw, 10);
    if (isNaN(id) || id <= 0) return 0;
    return id;
  }

  function _parseAutoApprove(raw) {
    var s = String(raw || "").replace(/^\s+|\s+$/g, "").toLowerCase();
    if (s === "0" || s === "false" || s === "off" || s === "no") return false;
    return true;
  }

  function _grainKeys(mart) {
    var g = mart.grainKeyCandidates;
    if (!g || !g.length) return [];
    var out = [];
    var i;
    for (i = 0; i < g.length; i++) {
      if (g[i]) out.push(String(g[i]));
    }
    return out;
  }

  function getConfig() {
    var E = _env();
    var G = E.guard;
    var L = E.llm;
    var K = _keys();
    var N = _nmsEnv();
    var M = _martEnv();
    var popSql = String(M.populationCountSql || "");

    return {
      llm: {
        apiKey: getStr(K.llmApiKey),
        model: getStr(K.llmModel),
        endpoint: getStr(K.llmEndpoint),
        provider: String(L.provider || "openrouter").toLowerCase(),
        useProxy: !!L.useProxy,
        pass0Examples: String(L.pass0Examples || ""),
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
        populationCountSql: popSql
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
      guard: G,
      probe: E.probe,
      match: {
        jaccardThreshold: (E.match && E.match.jaccardThreshold != null)
          ? E.match.jaccardThreshold : 0.9,
        sqlLimit: (E.match && E.match.sqlLimit != null) ? E.match.sqlLimit : 500,
        discoverTopN: (E.match && E.match.discoverTopN != null) ? E.match.discoverTopN : 10
      },
      ui: {
        titleMax: (E.ui && E.ui.titleMax != null) ? E.ui.titleMax : 200,
        listLimit: (E.ui && E.ui.listLimit != null) ? E.ui.listLimit : 200,
        listLimitMax: (E.ui && E.ui.listLimitMax != null) ? E.ui.listLimitMax : 500
      },
      debug: {
        enabled: !!(E.debug && E.debug.enabled)
      },
      nms: {
        campaignTemplateName: String(N.campaignTemplateName || ""),
        campaignTemplateId: Number(N.campaignTemplateId) || 0,
        wkfTemplateName: String(N.wkfTemplateName || ""),
        wkfTemplateId: Number(N.wkfTemplateId) || 0,
        wkfMaxPerCampaign: Number(N.wkfMaxPerCampaign) || 15,
        wkfMaxHardCap: Number(N.wkfMaxHardCap) || 20,
        aiActivityName: String(N.aiActivityName || "aiStudioSql")
      },
      mart: {
        grainKeyCandidates: _grainKeys(M),
        populationCountSql: popSql,
        foundryExampleSchema: String(M.foundryExampleSchema || ""),
        foundryExampleSqlTable: String(M.foundryExampleSqlTable || ""),
        sampleTablePrefix: String(M.sampleTablePrefix || "testWooSample")
      },
      options: {
        campaignTemplateId: _parseIntOpt(K.campaignTemplateId),
        wkfTemplateId: _parseIntOpt(K.wkfTemplateId),
        wkfTemplateName: getStr(K.wkfTemplateName),
        wkfMaxPerCampaign: getStr(K.wkfMaxPerCampaign),
        autoApprove: _parseAutoApprove(getStr(K.autoApprove)),
        injectBackupKey: String(K.injectBackup || "testWooAiInjectBackup"),
        matchEnabledRaw: getStr(K.matchEnabled)
      },
      settings: {
        guideDoc: "docs/report/16_ACC_Option_설정가이드.md",
        resolution: {
          templateId:
            "Option id -> internalName verify(Env contract) -> DB lookup -> Env fallback id",
          wkfTemplateName: "Option wkfTemplateName -> Env nms.wkfTemplateName",
          wkfMaxPerCampaign: "Option wkfMaxPerCampaign -> Env nms.wkfMaxPerCampaign",
          llm: "Option apiKey/model/endpoint only (no Env fallback)"
        },
        optionIsPrimary: {
          campaignTemplateId: true,
          wkfTemplateId: true,
          wkfTemplateName: true,
          wkfMaxPerCampaign: true,
          llmApiKey: true,
          llmModel: true,
          llmEndpoint: true,
          autoApprove: true,
          matchEnabled: true
        }
      }
    };
  }

  return { getConfig: getConfig, getStr: getStr };
})();
testWoo.cfg.__v = "165";
