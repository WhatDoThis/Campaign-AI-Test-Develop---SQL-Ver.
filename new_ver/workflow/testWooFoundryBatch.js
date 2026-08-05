/*
 * testWooFoundryBatch.js — WKF_testWooFoundry (5분 주기) 붙여넣기용
 * Start → JavaScript code → 본문 → End
 */
loadLibrary("woo:testWooConfig.js");
loadLibrary("woo:testWooProbe.js");
loadLibrary("woo:testWooLifecycle.js");
loadLibrary("woo:testWooEmbedding.js");
loadLibrary("woo:testWooDedup.js");
loadLibrary("woo:testWooToolkit.js");
loadLibrary("woo:testWooFeasibility.js");
loadLibrary("woo:testWooLlm.js");
loadLibrary("woo:testWooGates.js");
loadLibrary("woo:testWooFragments.js");
loadLibrary("woo:testWooCompiler.js");
loadLibrary("woo:testWooRepository.js");
loadLibrary("woo:testWooFoundry.js");

var cfg = testWoo.cfg.getConfig();
if (!cfg.foundry.enabled) {
  logInfo("[testWooFoundryBatch] foundry disabled — skip");
} else {
  var result = testWoo.foundry.processBatch();
  logInfo("[testWooFoundryBatch] processed=" + result.processed);
}
