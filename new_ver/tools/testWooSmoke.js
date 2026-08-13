/*
 * testWooSmoke.js (배포 직후 스모크 점검 · WF JS 액티비티용)
 * ==========================================================
 * checkRhinoSyntax.js 는 구문 오류만 잡고 Adobe API 시그니처 오용은 잡지 못한다.
 * (예: Schema 객체에 없는 toXMLString 호출 → 문법 정상 + 런타임 전멸)
 * 이 스크립트를 배포 절차 마지막에 1회 실행해 그 사각지대를 덮는다.
 *
 * [Main Functions]
 * ===========
 * - 1. 라이브러리 전역 정의 확인 (testWoo.* · fragContract 포함)
 * - 1b. FragContract — 축 identity·validateBind·렉시콘 분할(인천에/z요금제)
 * - 1c. normalizeAtomicSlots — 고객 잔여 제거 · 지역 최장일치 · 요금제 phrase
 * - 2. probe.preflight() → 'sql' named right + dbms/dialectVerified 기록
 * - 3. sqlSelect 반환 XML 구조 logInfo (파싱 가정 검증용)
 * - 4. describe_schema 속성 배열 비어있지 않은지 (N-2 회귀 검출)
 * - 4b. describe_schema 가 물리 컬럼명(sqlColumn)을 노출하는지 (논리명 유출 회귀)
 *      4·4b 대상은 TW_SMOKE_DESCRIBE_ID — 허용 namespace(woo)를 벗어나면 툴이 거부한다
 * - 4c. probe_values 가 논리명을 물리명으로 해석해 실제 SQL 을 실행하는지
 * - 5. search_columns 1건 이상 매칭
 * - 5c. list_schemas 허용 namespace 전수 조회 (Triage 프롬프트에 주입되는 목록 검증)
 * - 5b. 방언별 limitSelect 생성 SQL 문자열 검증 (M-1 회귀, 실행 없음)
 * - 6b. 무매치 id 조회 → 예외 아닌 null (getIfExists 규약)
 * - 6a. 큐 더미 1건 insert → _getQueue/getQueueStatus 조회 → 삭제 (N-1 회귀 검출)
 * - 7. llm.pass0 실호출 — 슬롯 1건 이상 + max_tokens 절단 없음 (billable)
 * - 8. llm.embedding 실호출 — 벡터 길이 > 0 (billable · embedEnabled=false면 SKIP)
 * - 9. foundry.generate — dryRunSlot: library_cache_hit(#169) 또는 gate.pass (billable)
 * - 9c. foundry.budget — 단계 예산(캐시 미스만 차감) · limit 변형으로 버짓 소진 검증
 * - 10. PASS/FAIL/SKIP 요약 출력, 실패 1건 이상이면 logError
 *
 * logError 는 WF 스크립트 실행을 즉시 중단시킨다(문서화된 동작). 그래서 개별 스텝 실패는
 * twFail(logWarning)로만 남기고, 전체 판정 logError 는 요약 맨 끝에서 한 번만 호출한다.
 *
 * 7·8·9 는 실제 과금이 발생한다. 그럼에도 필수인 이유: 1~6 은 전부 DB/스키마 계열이라
 * LLM 파라미터 결함(#80 tools 충돌 · #83 사고토큰 · #84 반복 루프)과 생성 단계
 * 결함(#89 fragment JSON missing)이 항상 사용자 입력·배치 시점에 처음 발현됐다.
 * 부득이한 경우에만 TW_SMOKE_SKIP_LLM=true 로 건너뛴다. 9c 는 항상 실행한다.
 *
 * [Dependencies]
 * =========
 * - loadLibrary("woo:testWoo*.js") 전량 · FragContract 선행 (#172)
 * - sqlSelect / sqlGetInt ('sql' named right 필요)
 * - xtk.session#Write / xtk.session#GetNewIds, xtk.queryDef
 * - ACC Rhino: var / for 만 사용 (화살표함수·let·const·템플릿리터럴 금지)
 * 주의: 고객 실데이터를 출력하지 않는다. 6a 더미 레코드는 finally 에서 반드시 삭제.
 */
loadLibrary("woo:testWooCommon.js");
loadLibrary("woo:testWooEnv.js");
loadLibrary("woo:testWooConfig.js");
loadLibrary("woo:testWooProbe.js");
loadLibrary("woo:testWooFragContract.js");
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
// 7·8(LLM 실호출)만 건너뛰는 비상 플래그. 기본 false — 켜면 배포 완료로 볼 수 없다.
var TW_SMOKE_SKIP_LLM = false;

// 4·4b 대상 스키마. env foundry.namespaces 가 woo 로 한정돼 nms:recipient 는 툴에서 거부된다.
// 시드 의존이 없는(=항상 배포되는) 코어 스키마를 쓴다 — 샘플 테이블은 미배포일 수 있다.
var TW_SMOKE_DESCRIBE_ID = "woo:testWooAiFragment";
// 5 검색 키워드. 위 코어 스키마의 속성이라 시드 여부와 무관하게 1건 이상 매칭된다.
var TW_SMOKE_SEARCH_KEYWORD = "category";
// 9.foundry.generate 기본 슬롯 — 샘플 테이블 sRegion 에 서울 값이 있어야 한다.
var TW_SMOKE_SLOT_TEXT = "서울에 사는 고객";

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
  var names = ["fragContract", "probe", "toolkit", "llm", "fragments", "lifecycle", "dedup",
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

// 1b. FragContract 계약 — 축·바인딩·색인 (DB/LLM 불필요)
function twStepFragContract() {
  var fc = testWoo.fragContract;
  if (!fc) {
    twFail("1b.fragContract", "testWoo.fragContract missing");
    return false;
  }
  try {
    var axes = fc.axisFromSlot({ text: "가입한지 1년 이내인 고객" });
    var hasJoin = false;
    for (var ai = 0; ai < axes.length; ai++) {
      if (axes[ai] === "joindate") hasJoin = true;
    }
    if (!hasJoin) {
      twFail("1b.fragContract", "axisFromSlot miss joindate for 가입 1년 이내");
      return false;
    }
    var domain = {
      joinDaysWithin: { required: true, type: "int" },
      _bucket: { nlMap: { "1년 이내": { joinDaysWithin: 365 } } },
      _source: { schema: "woo:testWooSampleCustomer", xpath: "@created_date" }
    };
    var bound = fc.sampleBindSql(
      "SELECT DISTINCT sCustomer_id FROM t WHERE tsCreated_date >= AddDays(GetDate(), -{{joinDaysWithin}})",
      domain);
    if (bound.indexOf("{{") >= 0 || bound.indexOf("__sample__") >= 0) {
      twFail("1b.fragContract", "sampleBindSql left placeholder: " + bound);
      return false;
    }
    if (bound.indexOf("-365") < 0 && bound.indexOf("365") < 0) {
      twFail("1b.fragContract", "sampleBindSql expected 365, got: " + bound);
      return false;
    }
    var intBound = fc.sampleBindSql("SELECT 1 WHERE x = {{n}}", { n: { type: "int" } });
    if (intBound.indexOf("'__sample__'") >= 0) {
      twFail("1b.fragContract", "int sample must be 0 not __sample__: " + intBound);
      return false;
    }
    var idx = fc.buildIndexFields({
      slotText: "가입한지 1년 이내",
      param_domain: domain,
      name: "woo__customer__joindate",
      tags: "joindate"
    });
    if (!idx.synonyms || idx.synonyms.indexOf("1년") < 0) {
      twFail("1b.fragContract", "buildIndexFields must include bucket key, got: " + idx.synonyms);
      return false;
    }
    var card = {
      name: "woo__customer__joindate",
      tags: "joindate",
      label: "가입일",
      synonyms: idx.synonyms,
      sample_questions: idx.sample_questions,
      param_domain: domain,
      description: "",
      category: "foundry"
    };
    if (!fc.libraryHitPredicate(card, { text: "가입한지 1년 이내", searchKeywords: ["가입", "1년"] }, domain)) {
      twFail("1b.fragContract", "libraryHitPredicate should hit joindate card");
      return false;
    }
    if (fc.axesCompatible({ tags: "age", name: "woo__customer__age" }, "남성")) {
      twFail("1b.fragContract", "axesCompatible must reject gender→age");
      return false;
    }
    var nlParams = fc.resolveNlParams(domain, "가입한지 1년 이내인 고객", { joinDaysWithin: 1 });
    if (!nlParams || Number(nlParams.joinDaysWithin) !== 365) {
      twFail("1b.fragContract", "resolveNlParams joinDaysWithin!=365");
      return false;
    }
    var ageDomain = {
      ageMin: { required: true, type: "int" },
      ageMax: { required: true, type: "int" },
      _bucket: { nlMap: { "20대": { ageMin: 20, ageMax: 30 }, "30대": { ageMin: 30, ageMax: 40 } } },
      _source: { schema: "woo:testWooSampleCustomer", xpath: "@age" },
      _range: { min: 0, max: 69 }
    };
    var ageCard = {
      name: "woo__customer__age", tags: "age", label: "연령",
      synonyms: "20대,30대", sample_questions: ["20대"],
      param_domain: ageDomain, description: "", category: "foundry"
    };
    var ageToks = fc.keywordsFromSlot({ text: "10대" });
    var hasAgeTok = false;
    for (var aki = 0; aki < ageToks.length; aki++) {
      if (String(ageToks[aki]).toLowerCase() === "age") hasAgeTok = true;
    }
    if (!hasAgeTok) {
      twFail("1b.fragContract", "keywordsFromSlot 10대 must include axis token age");
      return false;
    }
    if (!fc.libraryHitPredicate(ageCard, { text: "10대", searchKeywords: ["10대"] }, ageDomain)) {
      twFail("1b.fragContract", "same-axis age frag must hit for unseen alias");
      return false;
    }
    if (fc.libraryHitPredicate(ageCard, { text: "여성", searchKeywords: ["여성"] }, ageDomain)) {
      twFail("1b.fragContract", "age frag must not hit gender slot");
      return false;
    }
    var regionCard = {
      name: "woo__customer__region", tags: "region", label: "지역",
      synonyms: "", sample_questions: [],
      param_domain: {
        region: {
          required: true, type: "string",
          nlMap: { "경기도": "경기", "인천": "인천", "서울": "서울" },
          enum: ["경기", "인천", "서울"]
        },
        _source: { schema: "woo:testWooSampleCustomer", xpath: "@region" }
      },
      description: "", category: "foundry"
    };
    var planCard = {
      name: "woo__subscription__plan", tags: "plan", label: "요금제",
      synonyms: "", sample_questions: [],
      param_domain: {
        planCode: { required: true, type: "string" },
        _bucket: { nlMap: { "Z요금제": { planCode: "Z_PLAN" }, "학생요금제": { planCode: "STUDENT" } } },
        _source: { schema: "woo:testWooSampleSubscription", xpath: "@plan_code" }
      },
      description: "", category: "foundry"
    };
    if (!fc.collectLexicon || !fc.splitByLexicon) {
      twFail("1b.fragContract", "collectLexicon/splitByLexicon missing");
      return false;
    }
    var lex = fc.collectLexicon([regionCard, planCard, ageCard]);
    var split = fc.splitByLexicon("인천에 사는 20대 z요금제 쓰는 고객", lex);
    if (!split || split.length !== 3) {
      twFail("1b.fragContract", "lexicon split expected 3, got " +
        (split ? split.length : 0));
      return false;
    }
    var joined = "";
    var spi;
    for (spi = 0; spi < split.length; spi++)
      joined += String(split[spi].text) + ":" + String(split[spi].resolvedName) + "|";
    if (joined.indexOf("인천") < 0 || joined.indexOf("region") < 0) {
      twFail("1b.fragContract", "lexicon miss 인천/region: " + joined);
      return false;
    }
    if (joined.indexOf("20대") < 0 || joined.indexOf("age") < 0) {
      twFail("1b.fragContract", "lexicon miss 20대/age: " + joined);
      return false;
    }
    if (joined.toLowerCase().indexOf("z요금제") < 0 || joined.indexOf("plan") < 0) {
      twFail("1b.fragContract", "lexicon miss z요금제/plan: " + joined);
      return false;
    }
    var incheonToks = fc.keywordsFromSlot({ text: "인천에 사는" });
    var hasIncheon = false;
    var ki;
    for (ki = 0; ki < incheonToks.length; ki++) {
      if (String(incheonToks[ki]) === "인천") hasIncheon = true;
    }
    if (!hasIncheon) {
      twFail("1b.fragContract", "keywordsFromSlot 인천에 must stem to 인천, got " +
        incheonToks.join(","));
      return false;
    }
    var merged = fc.mergeParamDomainJson(ageDomain, JSON.stringify({
      _bucket: { nlMap: { "10대": { ageMin: 10, ageMax: 20 } } }
    }));
    if (!merged || !merged.changed) {
      twFail("1b.fragContract", "mergeParamDomainJson should add missing alias");
      return false;
    }
    var wide = fc.mergeParamDomainJson(
      { _range: { min: 20, max: 40 } },
      { _range: { min: 0, max: 69 } }
    );
    var wr = wide && wide.domain && wide.domain._range;
    if (!wide || !wide.changed || !wr || Number(wr.min) !== 0 || Number(wr.max) !== 69) {
      twFail("1b.fragContract", "mergeParamDomainJson must widen _range");
      return false;
    }
    var attached = fc.attachAlias(ageDomain, "10대", { ageMin: 10, ageMax: 20 });
    var dm = fc.domainMatchSlot(attached, "10대");
    if (!dm || !dm.value || Number(dm.value.ageMin) !== 10) {
      twFail("1b.fragContract", "attachAlias should add 10대 bucket");
      return false;
    }
    var bad = fc.validateBind(ageDomain, { ageMin: 80, ageMax: 90 });
    if (bad && bad.ok) {
      twFail("1b.fragContract", "validateBind must reject out_of_range");
      return false;
    }
    var okB = fc.validateBind(ageDomain, { ageMin: 10, ageMax: 20 });
    if (!okB || !okB.ok) {
      twFail("1b.fragContract", "validateBind 10/20 within _range should pass");
      return false;
    }
    var codes = fc.errorCodes;
    if (!codes || !codes.AXIS_MISMATCH || !codes.BIND_TYPE) {
      twFail("1b.fragContract", "errorCodes incomplete");
      return false;
    }
    twPass("1b.fragContract", "axis/bind/lexicon/libraryHit/resolveNl ok");
    return true;
  } catch (e) {
    twFail("1b.fragContract", String(e.message || e));
    return false;
  }
}

// 1c. Pass0 원자 분할 — 청중명사(고객)는 축이 아님. LLM/DB 불필요.
function twStepNormalizeSlots() {
  if (!testWoo.llm || !testWoo.llm.normalizeAtomicSlots) {
    twFail("1c.normalizeSlots", "normalizeAtomicSlots missing");
    return false;
  }
  try {
    var n = testWoo.llm.normalizeAtomicSlots([
      { text: "경기도에 사는 학생요금제 사용하는 고객" },
      { text: "고객" }
    ]);
    if (!n || n.length !== 2) {
      twFail("1c.normalizeSlots", "expected 2 slots (region+plan), got " +
        (n ? n.length : 0));
      return false;
    }
    var texts = String(n[0].text) + "|" + String(n[1].text);
    if (texts.indexOf("고객") >= 0) {
      twFail("1c.normalizeSlots", "audience noun leaked: " + texts);
      return false;
    }
    if (texts.indexOf("경기도") < 0 && texts.indexOf("경기") < 0) {
      twFail("1c.normalizeSlots", "region missing: " + texts);
      return false;
    }
    if (texts.indexOf("학생요금제") < 0 && texts.indexOf("요금제") < 0) {
      twFail("1c.normalizeSlots", "plan missing: " + texts);
      return false;
    }
    var onlyCust = testWoo.llm.normalizeAtomicSlots([{ text: "고객" }]);
    if (onlyCust && onlyCust.length) {
      twFail("1c.normalizeSlots", "고객-only must drop, got " + onlyCust.length);
      return false;
    }
    var one = testWoo.llm.normalizeAtomicSlots([
      { text: "학생요금제 사용하는 고객" }
    ]);
    if (!one || one.length !== 1 || String(one[0].text).indexOf("학생요금제") < 0) {
      twFail("1c.normalizeSlots", "single-axis must keep plan phrase, got " +
        (one && one[0] ? one[0].text : "empty"));
      return false;
    }
    twPass("1c.normalizeSlots", "region+plan kept, 고객 dropped");
    return true;
  } catch (e) {
    twFail("1c.normalizeSlots", String(e.message || e));
    return false;
  }
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
  var res = testWoo.toolkit.invoke("describe_schema", { id: TW_SMOKE_DESCRIBE_ID });
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
// sqlColumn 을 함께 줘야 한다. 우리 스키마는 sqlname 을 선언하지 않지만 ACC 가 배포 시
// 타입 접두사로 생성하므로(name → sName) name 과 다른 컬럼이 반드시 1개 이상 존재한다.
function twStepSqlColumnExposed() {
  var res = testWoo.toolkit.invoke("describe_schema", { id: TW_SMOKE_DESCRIBE_ID });
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
  var res = testWoo.toolkit.invoke("search_columns", { keyword: TW_SMOKE_SEARCH_KEYWORD });
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
    twFail("5.search_columns", "0 matches for '" + TW_SMOKE_SEARCH_KEYWORD + "'");
    return false;
  }
  if (res.skippedNamespaces && res.skippedNamespaces.length) {
    twFail("5.search_columns", "조회하지 못한 namespace: " +
      res.skippedNamespaces.join(",") + " — 허용 목록/스키마 배포 확인");
    return false;
  }
  twPass("5.search_columns", "matches=" + res.matches.length +
    " scanned=" + String(res.scanned) + " partialScan=" + String(res.partialScan));
  return true;
}

// 5c. list_schemas — 허용 namespace 전수 조회 (비과금)
// WF 저널에 ok=false 로만 남던 실패를 배포 시점에 사유까지 드러낸다. 허용 namespace 는
// Triage 프롬프트에 그대로 주입되므로 여기서 깨지면 슬롯 판정이 근거 없이 흔들린다.
function twStepListSchemas() {
  var ns = [];
  try {
    ns = testWoo.toolkit.env().allowedNamespaces || [];
  } catch (eE) {
    twFail("5c.list_schemas", "toolkit.env() 실패: " + String(eE.message || eE));
    return false;
  }
  if (!ns.length) {
    twFail("5c.list_schemas", "허용 namespace 0건 — env foundry.namespaces 확인");
    return false;
  }
  logInfo("[smoke] allowedNamespaces=" + ns.join(",") + " (env foundry.namespaces)");

  var bad = [];
  var counts = [];
  for (var i = 0; i < ns.length; i++) {
    var res = testWoo.toolkit.invoke("list_schemas", { namespace: ns[i] });
    if (!res || res.error || !res.schemas) {
      bad.push(ns[i] + " → " + (res ? String(res.error) : "no result"));
      continue;
    }
    counts.push(ns[i] + "=" + res.schemas.length + "건");
  }
  if (bad.length) {
    twFail("5c.list_schemas", bad.join(" | "));
    return false;
  }
  twPass("5c.list_schemas", counts.join(" · "));
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
        // logError 는 WF 스크립트를 즉시 중단시켜 이후 스텝과 요약 출력까지 막는다.
        // 실패는 FAIL 로 남기고 판정은 마지막 요약에서 한 번에 낸다.
        twFail("6a.queue.cleanup", "수동 삭제 필요: queue id=" + qid +
          " (" + String(eDel.message || eDel) + ")");
      }
    }
  }
}

// 7. llm.pass0 실호출 (billable) — LLM 파라미터 결함을 사용자 입력 전에 검출한다.
// finish_reason="length" 는 토큰 부족이 아니라 반복 루프 회귀 신호이므로 즉시 FAIL.
function twStepLlmPass0() {
  if (TW_SMOKE_SKIP_LLM === true) {
    twSkip("7.llm.pass0 (billable)", "TW_SMOKE_SKIP_LLM=true — LLM 스텝 생략 시 배포 완료 아님");
    return true;
  }
  try {
    var slots = testWoo.llm.decomposeSlots("서울에 사는 고객");
    if (!slots || !slots.length) {
      twFail("7.llm.pass0 (billable)", "slots 0건 — Pass0 파싱 결함");
      return false;
    }
    twPass("7.llm.pass0 (billable)", "slots=" + slots.length +
      " first='" + String(slots[0].text) + "'");
    return true;
  } catch (e) {
    var msg = String(e.message || e);
    if (msg.indexOf("max_tokens") >= 0) {
      twFail("7.llm.pass0 (billable)", "max_tokens 절단 — 반복 루프 회귀 의심 " +
        "(response_format 재도입 여부 확인): " + msg);
      return false;
    }
    twFail("7.llm.pass0 (billable)", msg);
    return false;
  }
}

// 8. llm.embedding 실호출 (billable) — chat 과 엔드포인트 경로가 달라
// urlPermission 적용 범위가 다를 수 있다. 미지원·권한 오류는 SKIP 이 아니라 FAIL.
function twStepLlmEmbedding() {
  if (TW_SMOKE_SKIP_LLM === true) {
    twSkip("8.llm.embedding (billable)", "TW_SMOKE_SKIP_LLM=true");
    return true;
  }
  try {
    // getConfig 까지 try 안에서 — 여기서 예외가 나가면 요약(9)이 출력되지 않는다.
    var cfg = testWoo.cfg.getConfig();
    if (!cfg.llm.embedEnabled) {
      twSkip("8.llm.embedding", "env llm.embedEnabled=false — dedup L2 미사용 상태");
      return true;
    }
    var res = testWoo.llm.postEmbedding(cfg, ["테스트"]);
    var vec = (res && res.data && res.data[0]) ? res.data[0].embedding : null;
    if (!vec || !vec.length) {
      twFail("8.llm.embedding (billable)", "비어 있는 벡터 — model=" +
        String(cfg.llm.embedModel));
      return false;
    }
    twPass("8.llm.embedding (billable)", "dim=" + vec.length +
      " model=" + String(cfg.llm.embedModel));
    return true;
  } catch (e) {
    twFail("8.llm.embedding (billable)", "실패 — 임베딩 호스트 urlPermission 과 embedModel 을 " +
      "확인할 것. dedup L2 없이 운용하려면 env llm.embedEnabled=false: " + String(e.message || e));
    return false;
  }
}

// 9. foundry.generate 드라이런 (billable) — 큐·WF 없이 Foundry 진입을 검증한다.
// #169: 서가에 축 frag가 있으면 library_cache_hit 이 정상(생성 0·툴 0). 그때도 PASS.
// 서가 미스일 때만 gate.pass 생성 경로를 요구한다.
function twStepFoundryGenerate() {
  if (TW_SMOKE_SKIP_LLM === true) {
    twSkip("9.foundry.generate (billable)",
      "TW_SMOKE_SKIP_LLM=true — LLM 스텝 생략 시 배포 완료 아님");
    return true;
  }
  try {
    var r = testWoo.foundry.dryRunSlot(TW_SMOKE_SLOT_TEXT, { forceGenerate: true });
    if (r && r.ok && r.reason === "library_cache_hit") {
      twPass("9.foundry.generate (billable)",
        "library_cache_hit id=" + String(r.fragmentId || "") +
        " (#169 서가 우선 — 생성 스킵 정상)");
      return true;
    }
    if (r && r.triage && r.triage.canProceed === false)
      logWarning("[smoke] 9.foundry.generate triage blocked (forced generate) verdict=" +
        String(r.triage.verdict) + "/" + String(r.triage.confidence) +
        " — " + String(r.triage.narrative || "").substring(0, 160));
    if (!r || !r.fragDoc || !r.gate || r.gate.pass !== true) {
      var detail = "";
      if (r && r.shapeError) detail = "shapeError=" + r.shapeError;
      else if (r && r.gateFailCodes && r.gateFailCodes.length)
        detail = "gateFail=" + r.gateFailCodes.join("|");
      else if (r && r.reason) detail = "reason=" + r.reason;
      else detail = "no result";
      if (r && r.rawContentPreview)
        logWarning("[smoke] 9.foundry.generate rawPreview=" + r.rawContentPreview);
      twFail("9.foundry.generate (billable)", detail +
        " attempts=" + String(r ? r.attempts : 0));
      return false;
    }
    twPass("9.foundry.generate (billable)",
      "name=" + String(r.fragDoc.name) +
      " attempts=" + String(r.attempts) +
      " tokens=" + String(r.tokensUsed) +
      (r.triage && r.triage.canProceed === false ? " (triage forced)" : ""));
    return true;
  } catch (e) {
    twFail("9.foundry.generate (billable)", String(e.message || e));
    return false;
  }
}

// 9c. foundry.budget (비과금) — E-1: 단계 예산이 자기 상한에서 멈추고 total 여유는 남는지.
// #169: invoke 캐시 히트는 예산 미차감 → 동일 args 반복으로는 상한에 못 닿는다.
// limit 을 호출마다 바꿔 캐시 미스로 실제 차감시킨다 (list_schemas 는 limit 허용).
function twStepFoundryBudget() {
  try {
    var cfg = testWoo.cfg.getConfig();
    var triageLimit = Number(cfg.toolkit.triageCallBudget) || 12;
    var genLimit = Number(cfg.toolkit.generateCallBudget) || 24;
    var totalLimit = Number(cfg.toolkit.totalCallBudget) || 132;
    if (triageLimit + genLimit >= totalLimit) {
      twFail("9c.foundry.budget",
        "totalCallBudget(" + totalLimit + ") <= triage+generate(" +
        (triageLimit + genLimit) + ") — E-1 산식 오류");
      return false;
    }

    var nsList = [];
    try {
      nsList = testWoo.toolkit.env().allowedNamespaces || [];
    } catch (eNs) {
      twFail("9c.foundry.budget", "toolkit.env() 실패: " + String(eNs.message || eNs));
      return false;
    }
    if (!nsList.length) {
      twFail("9c.foundry.budget", "허용 namespace 0건 — env foundry.namespaces 확인");
      return false;
    }
    var ns0 = String(nsList[0]);
    // 호출마다 고유 limit → 캐시 키 분리 (1..N, 차단 시도는 N+1)
    function burnArgs(seq) {
      var lim = Number(seq);
      if (lim < 1) lim = 1;
      if (lim > 200) lim = 200;
      return { namespace: ns0, limit: lim };
    }

    testWoo.toolkit.resetRequest();
    testWoo.toolkit.setPhaseBudget("triage");
    var i, res;
    for (i = 0; i < triageLimit; i++) {
      res = testWoo.toolkit.invoke("list_schemas", burnArgs(i + 1));
      if (res && res.error) {
        twFail("9c.foundry.budget",
          "triage invoke failed early i=" + i + " / " + String(res.error));
        return false;
      }
    }
    res = testWoo.toolkit.invoke("list_schemas", burnArgs(triageLimit + 1));
    if (!res || !res.error || String(res.error).indexOf("phase triage") < 0) {
      twFail("9c.foundry.budget",
        "expected phase triage block, got " +
        String(res && res.error ? res.error : "no error"));
      return false;
    }

    testWoo.toolkit.setPhaseBudget("generate");
    for (i = 0; i < genLimit; i++) {
      // triage 와 겹치지 않게 offset
      res = testWoo.toolkit.invoke("list_schemas", burnArgs(100 + i + 1));
      if (res && res.error) {
        twFail("9c.foundry.budget",
          "generate invoke failed early i=" + i + " / " + String(res.error));
        return false;
      }
    }
    res = testWoo.toolkit.invoke("list_schemas", burnArgs(100 + genLimit + 1));
    if (!res || !res.error) {
      twFail("9c.foundry.budget", "expected generate phase block, got no error");
      return false;
    }
    var err = String(res.error);
    if (err.indexOf("phase generate") < 0) {
      twFail("9c.foundry.budget",
        "failure message must include phase name, got: " + err);
      return false;
    }
    if (err.indexOf("(total ") >= 0) {
      twFail("9c.foundry.budget",
        "totalCallBudget exhausted before phase generate — E-1 산식 오류: " + err);
      return false;
    }

    var used = triageLimit + genLimit;
    twPass("9c.foundry.budget",
      "phase generate blocked at " + genLimit +
      "; total used=" + used + "/" + totalLimit + " (margin ok · cache-busted limits)");
    return true;
  } catch (e) {
    twFail("9c.foundry.budget", String(e.message || e));
    return false;
  }
}

// 10. 요약
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
  twStepFragContract();
  twStepNormalizeSlots();
  twStepPreflight();
  twStepSqlSelectShape();
  twStepDescribeSchema();
  twStepSqlColumnExposed();
  twStepProbeValuesResolve();
  twStepSearchColumns();
  twStepListSchemas();
  twStepDialectSql();
  twStepQueueMiss();
  twStepQueueRoundTrip();
  twStepLlmPass0();
  twStepLlmEmbedding();
  twStepFoundryGenerate();
  twStepFoundryBudget();
}
twSummary();
