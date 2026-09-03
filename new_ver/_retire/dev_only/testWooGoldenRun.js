/*
 * testWooGoldenRun.js — WKF_testWooGolden 붙여넣기용
 */
loadLibrary("woo:testWooConfig.js");
loadLibrary("woo:testWooFragContract.js");
loadLibrary("woo:testWooFragments.js");
loadLibrary("woo:testWooEnPivot.js");
loadLibrary("woo:testWooLlm.js");
loadLibrary("woo:testWooCompiler.js");
loadLibrary("woo:testWooGates.js");

var q = xtk.queryDef.create(
  <queryDef schema="woo:testWooAiGolden" operation="select" lineCount="500">
    <select>
      <node expr="@id"/><node expr="@nl_text"/><node expr="@expected_fragments"/>
      <node expr="@expected_count_min"/><node expr="@expected_count_max"/>
    </select>
  </queryDef>);
var res = q.ExecuteQuery();
var pass = 0;
var fail = 0;
var now = formatDate(new Date(), "%4Y/%2M/%2D %02H:%02N:%02S");

for each (var g in res.testWooAiGolden) {
  var gid = Number(g.@id);
  var nl = String(g.@nl_text);
  var result = "fail";
  try {
    var plan = testWoo.llm.generatePlan(nl);
    if (plan.unmatched && plan.unmatched.length) throw new Error("unmatched");
    var compiled = testWoo.compiler.compile(plan);
    var expected = [];
    try { expected = JSON.parse(String(g.@expected_fragments || "[]")); } catch (eJ) {}
    var usedNames = {};
    var inc = plan.include || [];
    for (var i = 0; i < inc.length; i++) {
      var any = inc[i].any || [];
      for (var j = 0; j < any.length; j++) usedNames[any[j].fragment] = true;
    }
    var match = true;
    for (var k = 0; k < expected.length; k++) {
      if (!usedNames[expected[k]]) { match = false; break; }
    }
    if (!match) throw new Error("fragment set mismatch");
    result = "pass";
    pass++;
  } catch (e) {
    fail++;
    logWarning("[testWooGoldenRun] id=" + gid + " " + e.message);
  }
  var upd = <testWooAiGolden xtkschema="woo:testWooAiGolden" _operation="update"/>;
  upd.@id = gid;
  upd.@last_result = result;
  upd.@last_run_at = now;
  xtk.session.Write(upd);
}
logInfo("[testWooGoldenRun] done pass=" + pass + " fail=" + fail);
