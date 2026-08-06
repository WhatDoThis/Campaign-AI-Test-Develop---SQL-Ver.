/*
 * testWooSmoke.js (배포 직후 스모크 점검 · WF JS 액티비티용)
 * ==========================================================
 * checkRhinoSyntax.js 는 구문 오류만 잡고 Adobe API 시그니처 오용은 잡지 못한다.
 * (예: Schema 객체에 없는 toXMLString 호출 → 문법 정상 + 런타임 전멸)
 * 이 스크립트를 배포 절차 마지막에 1회 실행해 그 사각지대를 덮는다.
 *
 * [Main Functions]
 * ===========
 * - 1. 라이브러리 전역 정의 확인 (testWoo.* 14개 · 전역 부재와 모듈 누락을 구분)
 * - 2. probe.preflight() → 'sql' named right + dbms/dialectVerified 기록
 * - 3. sqlSelect 반환 XML 구조 logInfo (파싱 가정 검증용)
 * - 4. describe_schema 속성 배열 비어있지 않은지 (N-2 회귀 검출)
 * - 4b. describe_schema 가 물리 컬럼명(sqlColumn)을 노출하는지 (논리명 유출 회귀)
 * - 4c. probe_values 가 논리명을 물리명으로 해석해 실제 SQL 을 실행하는지
 * - 5. search_columns 1건 이상 매칭
 * - 5b. 방언별 limitSelect 생성 SQL 문자열 검증 (M-1 회귀, 실행 없음)
 * - 6b. 무매치 id 조회 → 예외 아닌 null (getIfExists 규약)
 * - 6a. 큐 더미 1건 insert → _getQueue/getQueueStatus 조회 → 삭제 (N-1 회귀 검출)
 * - 7. PASS/FAIL 요약 출력, 실패 1건 이상이면 logError
 *
 * [Dependencies]
 * =========
 * - loadLibrary("woo:testWoo*.js") 전량
 * - sqlSelect / sqlGetInt ('sql' named right 필요)
 * - xtk.session#Write / xtk.session#GetNewIds, xtk.queryDef
 * - ACC Rhino: var / for 만 사용 (화살표함수·let·const·템플릿리터럴 금지)
 * 주의: 고객 실데이터를 출력하지 않는다. 6a 더미 레코드는 finally 에서 반드시 삭제.
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
// preflight 가 돌려준 접속 DBMS — 어떤 DB에서 나온 결과인지 요약에 남긴다.
var TW_SMOKE_DBMS = "(unknown)";

function twPass(step, note) {
  TW_SMOKE_RESULTS.push({ step: step, ok: true, note: String(note || "") });
  logInfo("[smoke] PASS " + step + (note ? " — " + note : ""));
}

function twFail(step, note) {
  TW_SMOKE_RESULTS.push({ step: step, ok: false, note: String(note || "") });
  logWarning("[smoke] FAIL " + step + " — " + String(note || ""));
}

// 전제 조건 미충족(예: 샘플 스키마 미배포)은 실패가 아니지만 PASS 로 세지도 않는다.
function twSkip(step, note) {
  TW_SMOKE_RESULTS.push({ step: step, ok: true, skipped: true, note: String(note || "") });
  logWarning("[smoke] SKIP " + step + " — " + String(note || ""));
}

// 1. 라이브러리 전역 정의 확인
// 전역 부재와 개별 모듈 누락을 다른 메시지로 구분한다 — 전자를 14개 나열로 묻으면
// "loadLibrary 실패" 라는 진짜 원인이 가려진다.
function twStepGlobals() {
  if (typeof testWoo === "undefined" || !testWoo) {
    twFail("1.globals", "testWoo 전역 자체가 없음 — loadLibrary 실패. " +
      "JS 라이브러리 배포 여부와 woo: 네임스페이스를 먼저 확인할 것");
    return false;
  }
  var names = ["probe", "toolkit", "llm", "fragments", "lifecycle", "dedup",
    "gates", "feasibility", "foundry", "compiler", "repo", "cfg", "env", "embedding"];
  var missing = [];
  for (var i = 0; i < names.length; i++) {
    if (!testWoo[names[i]]) missing.push(names[i]);
  }
  if (missing.length) {
    twFail("1.globals", missing.length + "/" + names.length +
      " modules undefined: testWoo." + missing.join(", testWoo."));
    return false;
  }
  twPass("1.globals", names.length + " modules defined");
  return true;
}

// 2. 'sql' named right 프리플라이트
function twStepPreflight() {
  var r = testWoo.probe.preflight();
  if (r && r.dbms != null) {
    TW_SMOKE_DBMS = String(r.dbms || "(empty)") +
      (r.dialectVerified ? " (dialect verified)" : " (dialect NOT verified — PG 외 방언은 문자열 정합만)");
  }
  if (!r || r.ok !== true) {
    twFail("2.preflight", (r ? (r.code + " " + r.message) : "no result"));
    return false;
  }
  twPass("2.preflight", "sql right ok · dbms=" + TW_SMOKE_DBMS);
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

// 4b. describe_schema 가 물리 컬럼명(@sqlname)을 노출하는지 — 실행 없이 스키마만 읽는다.
// 논리명을 원시 SQL 에 넣으면 'column does not exist' 로 실패하므로 도구는 반드시
// sqlColumn 을 함께 줘야 한다. 표준 스키마는 Adobe 가 sqlname 을 명시하므로
// (email → sEmail) name 과 다른 컬럼이 반드시 1개 이상 존재한다.
function twStepSqlColumnExposed() {
  var res = testWoo.toolkit.invoke("describe_schema", { id: "nms:recipient" });
  if (!res || res.error || !res.columns || !res.columns.length) {
    twFail("4b.sqlColumn", (res && res.error) ? String(res.error) : "columns empty");
    return false;
  }
  var withSql = 0;
  var differing = "";
  for (var i = 0; i < res.columns.length; i++) {
    var c = res.columns[i];
    if (c.sqlColumn == null) {
      twFail("4b.sqlColumn", "sqlColumn 필드 자체가 없음 — describe_schema 회귀");
      return false;
    }
    if (String(c.sqlColumn) === "") continue;
    withSql++;
    if (!differing && String(c.sqlColumn) !== String(c.name))
      differing = String(c.name) + "→" + String(c.sqlColumn);
  }
  if (!withSql) {
    twFail("4b.sqlColumn", "sqlColumn 이 전부 빈 값 — @sqlname 파싱 실패");
    return false;
  }
  if (!differing) {
    twFail("4b.sqlColumn",
      "물리명이 논리명과 전부 동일 — @sqlname 대신 @name 으로 폴백한 의심");
    return false;
  }
  twPass("4b.sqlColumn", withSql + "/" + res.columns.length +
    " columns have sqlColumn · 예: " + differing);
  return true;
}

// 4c. probe_values 가 논리명을 물리명으로 해석해 실제 SQL 을 실행하는지 (실행 검증).
// 표준 스키마는 COUNT(DISTINCT) 비용이 커서 쓰지 않고, 100행 샘플 테이블로만 검증한다.
// 샘플 스키마 미배포 환경에서는 SKIP — 값은 로그로 출력하지 않고 건수만 남긴다.
function twStepProbeValuesResolve() {
  var SID = "woo:testWooSampleCustomer";
  var LOGICAL = "region";
  var d = testWoo.toolkit.invoke("describe_schema", { id: SID });
  if (!d || d.error || !d.columns || !d.columns.length) {
    twSkip("4c.probe_values", SID + " 미배포 — 샘플 스키마 배포 후 재실행 권장");
    return true;
  }
  var expect = "";
  for (var i = 0; i < d.columns.length; i++) {
    if (String(d.columns[i].name) === LOGICAL) expect = String(d.columns[i].sqlColumn);
  }
  if (!expect) {
    twSkip("4c.probe_values", SID + " 에 SQL 매핑된 '" + LOGICAL + "' 속성이 없음");
    return true;
  }

  var res = testWoo.toolkit.invoke("probe_values",
    { schemaId: SID, columnName: LOGICAL, limit: 10 });
  if (!res || res.ok !== true) {
    twFail("4c.probe_values", "논리명 '" + LOGICAL +
      "' 조회 실패 — 물리명 해석 결함 의심: " + (res ? String(res.error) : "no result"));
    return false;
  }
  if (String(res.sqlColumn) !== expect) {
    twFail("4c.probe_values", "sqlColumn 불일치: describe=" + expect +
      " probe=" + String(res.sqlColumn));
    return false;
  }
  twPass("4c.probe_values", LOGICAL + " → " + expect +
    " 해석 · distinct=" + String(res.distinctCount) +
    " sampled=" + String(res.values ? res.values.length : 0));
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

// 5b. 방언별 limitSelect 생성 SQL 검증 (실행 없이 문자열만)
// MSSQL 은 DISTINCT 가 TOP 앞이어야 하고, 파생 테이블 안에는 ORDER BY 를 만들면 안 된다.
function twStepDialectSql() {
  var cases = [
    {
      dbms: "mssql",
      expect: "SELECT DISTINCT TOP 50 col AS tw_val FROM tbl " +
        "WHERE col IS NOT NULL ORDER BY 1"
    },
    {
      dbms: "oracle",
      expect: "SELECT DISTINCT col AS tw_val FROM tbl " +
        "WHERE col IS NOT NULL ORDER BY 1 FETCH FIRST 50 ROWS ONLY"
    },
    {
      dbms: "postgresql",
      expect: "SELECT DISTINCT col AS tw_val FROM tbl " +
        "WHERE col IS NOT NULL ORDER BY 1 LIMIT 50"
    }
  ];
  var bad = 0;
  for (var i = 0; i < cases.length; i++) {
    var d = testWoo.probe.dialectFor(cases[i].dbms);
    var got = d.limitSelect("col AS tw_val", "tbl", "col IS NOT NULL", 50,
      { distinct: true });
    logInfo("[smoke] dialect " + cases[i].dbms + ": " + got);
    if (got !== cases[i].expect) {
      bad++;
      logWarning("[smoke]   expected: " + cases[i].expect);
    }
  }
  // 파생 테이블 래핑은 ORDER BY 가 없어야 한다 (MSSQL 거부)
  var wrap = testWoo.probe.dialectFor("mssql").limitSelect(
    "*", "(SELECT 1 AS a) tw_lim", "", 10, { orderBy: null });
  logInfo("[smoke] dialect mssql derived-wrap: " + wrap);
  if (wrap.indexOf("ORDER BY") >= 0) {
    bad++;
    logWarning("[smoke]   파생 테이블 래핑에 ORDER BY 가 생성됨 (orderBy:null 무시)");
  }

  if (bad > 0) {
    twFail("5b.dialect", bad + " case(s) mismatched — 위 logWarning 참조");
    return false;
  }
  twPass("5b.dialect", "mssql/oracle/pg + derived-wrap 생성 SQL 일치");
  return true;
}

// 6b. 무매치 조회 — getIfExists 는 빈 엘리먼트를 주므로 예외가 아니라 null 이어야 한다.
// 부작용이 없으므로 더미 생성 전에 먼저 수행한다.
function twStepQueueMiss() {
  try {
    var none = testWoo.foundry.peekQueue(-1);
    if (none !== null) {
      twFail("6b.queue.miss", "expected null for id=-1, got " + JSON.stringify(none));
      return false;
    }
    var none2 = testWoo.repo.getQueueStatus(-1);
    if (none2 !== null) {
      twFail("6b.queue.miss", "repo.getQueueStatus(-1) expected null, got non-null");
      return false;
    }
    twPass("6b.queue.miss", "id=-1 → null (no exception) on both paths");
    return true;
  } catch (e) {
    twFail("6b.queue.miss", "무매치 조회가 예외를 던짐 — getIfExists 파싱 회귀(N-1): " +
      String(e.message || e));
    return false;
  }
}

// 6a. 큐 더미 1건 왕복 (getIfExists 파싱 회귀 검출)
// foundry.peekQueue = Foundry 핵심 경로 _getQueue, repo.getQueueStatus = Studio 조회 경로.
// 둘 다 operation="getIfExists" 이므로 두 경로를 모두 검증한다.
function twStepQueueRoundTrip() {
  var qid = 0;
  try {
    qid = testWoo.repo.enqueueRequest({
      nl_text: "[smoke] getIfExists round trip",
      slots_json: "[]",
      missing_slots_json: "[]",
      created_by: "smoke",
      workflow_name: ""
    });
    if (!qid) {
      twFail("6a.queue.write-read", "enqueueRequest returned no id");
      return false;
    }

    var row = testWoo.foundry.peekQueue(qid);
    if (!row) {
      twFail("6a.queue.write-read",
        "foundry.peekQueue(_getQueue) returned null — getIfExists 파싱 회귀(N-1)");
      return false;
    }
    if (Number(row.id) !== Number(qid)) {
      twFail("6a.queue.write-read", "_getQueue id mismatch: wrote " + qid +
        " read " + String(row.id));
      return false;
    }
    if (String(row.status) !== "queued") {
      twFail("6a.queue.write-read", "_getQueue status mismatch: expected queued got '" +
        String(row.status) + "'");
      return false;
    }

    var st = testWoo.repo.getQueueStatus(qid);
    if (!st) {
      twFail("6a.queue.write-read",
        "repo.getQueueStatus returned null — getIfExists 파싱 회귀(N-1)");
      return false;
    }
    if (Number(st.queueId) !== Number(qid)) {
      twFail("6a.queue.write-read", "getQueueStatus id mismatch: wrote " + qid +
        " read " + String(st.queueId));
      return false;
    }
    if (String(st.status) !== "queued") {
      twFail("6a.queue.write-read", "getQueueStatus status mismatch: expected queued got '" +
        String(st.status) + "'");
      return false;
    }

    twPass("6a.queue.write-read", "id=" + qid + " · @id/status 일치 (_getQueue + getQueueStatus)");
    return true;
  } catch (e) {
    twFail("6a.queue.write-read", String(e.message || e));
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
  var skipped = 0;
  var lines = [];
  for (var i = 0; i < TW_SMOKE_RESULTS.length; i++) {
    var r = TW_SMOKE_RESULTS[i];
    if (!r.ok) failed++;
    else if (r.skipped) skipped++;
    lines.push((r.ok ? (r.skipped ? "SKIP " : "PASS ") : "FAIL ") + r.step);
  }
  var passed = TW_SMOKE_RESULTS.length - failed - skipped;
  logInfo("[smoke] ===== summary (" + passed + "/" + TW_SMOKE_RESULTS.length +
    " passed" + (skipped > 0 ? ", " + skipped + " skipped" : "") + ") =====");
  logInfo("[smoke] dbms=" + TW_SMOKE_DBMS);
  logInfo("[smoke] " + lines.join(" | "));
  if (failed > 0)
    logError("[smoke] " + failed + " step(s) FAILED — 배포를 완료로 간주하지 말 것");
  else if (skipped > 0)
    logInfo("[smoke] executed steps all passed — " + skipped +
      " step(s) skipped (전제 조건 미충족, 위 SKIP 사유 확인)");
  else
    logInfo("[smoke] all steps passed");
}

if (twStepGlobals()) {
  twStepPreflight();
  twStepSqlSelectShape();
  twStepDescribeSchema();
  twStepSqlColumnExposed();
  twStepProbeValuesResolve();
  twStepSearchColumns();
  twStepDialectSql();
  twStepQueueMiss();
  twStepQueueRoundTrip();
}
twSummary();
