/*
 * testWooSmoke.js (배포 직후 스모크 점검 · WF JS 액티비티용)
 * ==========================================================
 * checkRhinoSyntax.js 는 구문 오류만 잡고 Adobe API 시그니처 오용은 잡지 못한다.
 * (예: Schema 객체에 없는 toXMLString 호출 → 문법 정상 + 런타임 전멸)
 * 이 스크립트를 배포 절차 마지막에 1회 실행해 그 사각지대를 덮는다.
 *
 * [Main Functions]
 * ===========
 * - 1. 라이브러리 전역 정의 확인 (testWoo.* 10개)
 * - 2. probe.preflight() → 'sql' named right 확인
 * - 3. sqlSelect 반환 XML 구조 logInfo (파싱 가정 검증용)
 * - 4. describe_schema 속성 배열 비어있지 않은지 (N-2 회귀 검출)
 * - 5. search_columns 1건 이상 매칭
 * - 6. 큐 더미 1건 insert → getIfExists 조회 → 삭제 (N-1 회귀 검출)
 * - 7. PASS/FAIL 요약 출력, 실패 1건 이상이면 logError
 *
 * [Dependencies]
 * =========
 * - loadLibrary("woo:testWoo*.js") 전량
 * - sqlSelect / sqlGetInt ('sql' named right 필요)
 * - xtk.session#Write / xtk.session#GetNewIds, xtk.queryDef
 * - ACC Rhino: var / for 만 사용 (화살표함수·let·const·템플릿리터럴 금지)
 * 주의: 고객 실데이터를 출력하지 않는다. 6번 더미 레코드는 finally 에서 반드시 삭제.
 */
loadLibrary("woo:testWooCommon.js");
loadLibrary("woo:testWooEnv.js");
loadLibrary("woo:testWooConfig.js");
loadLibrary("woo:testWooProbe.js");
loadLibrary("woo:testWooFragments.js");
loadLibrary("woo:testWooCompiler.js");
loadLibrary("woo:testWooGates.js");
loadLibrary("woo:testWooLifecycle.js");
loadLibrary("woo:testWooRepository.js");
loadLibrary("woo:testWooEmbedding.js");
loadLibrary("woo:testWooDedup.js");
loadLibrary("woo:testWooToolkit.js");
loadLibrary("woo:testWooLlm.js");
loadLibrary("woo:testWooFeasibility.js");
loadLibrary("woo:testWooFoundry.js");

var TW_SMOKE_RESULTS = [];

function twPass(step, note) {
  TW_SMOKE_RESULTS.push({ step: step, ok: true, note: String(note || "") });
  logInfo("[smoke] PASS " + step + (note ? " — " + note : ""));
}

function twFail(step, note) {
  TW_SMOKE_RESULTS.push({ step: step, ok: false, note: String(note || "") });
  logWarning("[smoke] FAIL " + step + " — " + String(note || ""));
}

// 1. 라이브러리 전역 정의 확인
function twStepGlobals() {
  var names = ["probe", "toolkit", "llm", "fragments", "lifecycle", "dedup",
    "gates", "feasibility", "foundry", "compiler", "repo", "cfg", "env", "embedding"];
  var missing = [];
  for (var i = 0; i < names.length; i++) {
    if (typeof testWoo === "undefined" || !testWoo[names[i]]) missing.push(names[i]);
  }
  if (missing.length) {
    twFail("1.globals", "undefined: testWoo." + missing.join(", testWoo."));
    return false;
  }
  twPass("1.globals", names.length + " modules defined");
  return true;
}

// 2. 'sql' named right 프리플라이트
function twStepPreflight() {
  var r = testWoo.probe.preflight();
  if (!r || r.ok !== true) {
    twFail("2.preflight", (r ? (r.code + " " + r.message) : "no result"));
    return false;
  }
  twPass("2.preflight", "sql right ok");
  return true;
}

// 3. sqlSelect 반환 XML 구조 출력 (파싱 가정이 실제와 맞는지 육안 확인용)
function twStepSqlSelectShape() {
  try {
    var t = sqlSelect("row,@x:string", "SELECT 1 AS x");
    logInfo("[smoke] sqlSelect shape: " + String(t.toXMLString()));
    var got = "";
    for each (var r in t.row) got = String(r.@x);
    if (got !== "1") {
      twFail("3.sqlSelect", "expected @x=1 via xml.row, got '" + got + "'");
      return false;
    }
    twPass("3.sqlSelect", "xml.row/@x parsing confirmed");
    return true;
  } catch (e) {
    twFail("3.sqlSelect", String(e.message || e));
    return false;
  }
}

// 4. describe_schema — 속성이 실제로 채워지는지 (N-2 회귀 검출)
function twStepDescribeSchema() {
  var res = testWoo.toolkit.invoke("describe_schema", { id: "nms:recipient" });
  if (!res || res.error) {
    twFail("4.describe_schema", res ? String(res.error) : "no result");
    return false;
  }
  if (!res.columns || !res.columns.length) {
    twFail("4.describe_schema", "columns empty — N-2 재발 의심 (Schema.toDocument 경로 확인)");
    return false;
  }
  twPass("4.describe_schema", "columns=" + res.columns.length);
  return true;
}

// 5. search_columns — 1건 이상 매칭
function twStepSearchColumns() {
  var res = testWoo.toolkit.invoke("search_columns", { keyword: "email" });
  if (!res || res.error) {
    twFail("5.search_columns", res ? String(res.error) : "no result");
    return false;
  }
  if (res.schemaLoadFailed === true) {
    twFail("5.search_columns", "schemaLoadFailed — 스키마 로드 전멸 (loadFailed=" +
      String(res.loadFailed) + ")");
    return false;
  }
  if (!res.matches || !res.matches.length) {
    twFail("5.search_columns", "0 matches for 'email'");
    return false;
  }
  twPass("5.search_columns", "matches=" + res.matches.length +
    " scanned=" + String(res.scanned) + " partialScan=" + String(res.partialScan));
  return true;
}

// 6. 큐 더미 1건 왕복 (getIfExists 파싱 회귀 검출)
function twStepQueueRoundTrip() {
  var qid = 0;
  try {
    qid = testWoo.repo.enqueueRequest({
      nl_text: "[smoke] getIfExists round trip",
      slots_json: "[]",
      missing_slots_json: "[]",
      created_by: "smoke",
      workflow_id: 0
    });
    if (!qid) {
      twFail("6.queue", "enqueueRequest returned no id");
      return false;
    }
    var st = testWoo.repo.getQueueStatus(qid);
    if (!st) {
      twFail("6.queue", "getQueueStatus returned null — getIfExists 파싱 회귀(N-1)");
      return false;
    }
    if (Number(st.queueId) !== Number(qid)) {
      twFail("6.queue", "id mismatch: wrote " + qid + " read " + String(st.queueId));
      return false;
    }
    if (String(st.status) !== "queued") {
      twFail("6.queue", "status mismatch: expected queued got '" + String(st.status) + "'");
      return false;
    }
    twPass("6.queue", "round trip id=" + qid);
    return true;
  } catch (e) {
    twFail("6.queue", String(e.message || e));
    return false;
  } finally {
    if (qid) {
      try {
        xtk.session.Write(
          <testWooAiRequestQueue xtkschema="woo:testWooAiRequestQueue"
                                 _operation="delete" id={qid}/>);
        logInfo("[smoke] cleanup: queue id=" + qid + " deleted");
      } catch (eDel) {
        logError("[smoke] cleanup FAILED — 수동 삭제 필요: queue id=" + qid +
          " (" + String(eDel.message || eDel) + ")");
      }
    }
  }
}

// 7. 요약
function twSummary() {
  var failed = 0;
  var lines = [];
  for (var i = 0; i < TW_SMOKE_RESULTS.length; i++) {
    var r = TW_SMOKE_RESULTS[i];
    if (!r.ok) failed++;
    lines.push((r.ok ? "PASS " : "FAIL ") + r.step);
  }
  logInfo("[smoke] ===== summary (" + (TW_SMOKE_RESULTS.length - failed) + "/" +
    TW_SMOKE_RESULTS.length + " passed) =====");
  logInfo("[smoke] " + lines.join(" | "));
  if (failed > 0)
    logError("[smoke] " + failed + " step(s) FAILED — 배포를 완료로 간주하지 말 것");
  else
    logInfo("[smoke] all steps passed");
}

if (twStepGlobals()) {
  twStepPreflight();
  twStepSqlSelectShape();
  twStepDescribeSchema();
  twStepSearchColumns();
  twStepQueueRoundTrip();
}
twSummary();
