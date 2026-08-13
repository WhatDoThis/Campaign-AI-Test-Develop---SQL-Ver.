/*
 * testWooFoundryDryRun.js — 생성 경로 1회 드라이런 (큐·WF 배치 불필요)
 * ================================================================
 * F-5 계측기. Start → JavaScript code → 본문 → End
 * 부작용 없음(publish/embedding/dedup/큐 Write 안 함). billable.
 */
loadLibrary("woo:testWooConfig.js");
loadLibrary("woo:testWooProbe.js");
loadLibrary("woo:testWooLifecycle.js");
loadLibrary("woo:testWooEmbedding.js");
loadLibrary("woo:testWooFragContract.js");
loadLibrary("woo:testWooDedup.js");
loadLibrary("woo:testWooToolkit.js");
loadLibrary("woo:testWooFeasibility.js");
loadLibrary("woo:testWooEnPivot.js");
loadLibrary("woo:testWooLlm.js");
loadLibrary("woo:testWooGates.js");
loadLibrary("woo:testWooFragments.js");
loadLibrary("woo:testWooCompiler.js");
loadLibrary("woo:testWooRepository.js");
loadLibrary("woo:testWooFoundry.js");

var SLOT = "서울에 사는 고객";
var r = testWoo.foundry.dryRunSlot(SLOT);
logInfo("[testWooFoundryDryRun] ok=" + r.ok +
  " reason=" + String(r.reason || "") +
  " attempts=" + String(r.attempts) +
  " tokensUsed=" + String(r.tokensUsed) +
  (r.fragDoc ? " name=" + String(r.fragDoc.name) : "") +
  (r.shapeError ? " shapeError=" + r.shapeError : "") +
  (r.gateFailCodes && r.gateFailCodes.length ?
    " gateFail=" + r.gateFailCodes.join("|") : ""));
if (r.rawContentPreview)
  logInfo("[testWooFoundryDryRun] rawPreview=" + r.rawContentPreview);
if (r.triage)
  logInfo("[testWooFoundryDryRun] triage=" + String(r.triage.verdict) +
    "/" + String(r.triage.confidence) + " canProceed=" + String(r.triage.canProceed));
