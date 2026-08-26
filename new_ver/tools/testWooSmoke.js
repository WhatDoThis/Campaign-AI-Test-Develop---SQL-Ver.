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
 * - 1b. FragContract — 축 identity·validateBind·렉시콘·다축 분할·`_group`·남는 명사 미삼킴·promptHints
 * - 1h. Compiler exclude-only — FROM universe + EXCEPT (NOT IN 금지, 픽스처 테이블)
 * - 1c. normalizeAtomicSlots — EnPivot 슬롯 통과 · KO 축 분할 없음
 * - 1d. parseFragmentJson — JSON 2개 → 첫 채택 + extraSlots (V0, 비과금)
 * - 1e. EnPivot — M1 슬롯 · 빈 glue drop · en_literal은 M2용 유지 · 캐시 시드 · concept 불변
 * - 1f. domain EN pair — {db,en} 바인딩은 db · enrich 이미-en이면 0콜 (비과금)
 * - 1g. M1/M2/M3 매칭 · ambiguous · _negative TTL · heal 쿨다운 (비과금)
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
loadLibrary("woo:testWooEnPivot.js");
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
  var names = ["fragContract", "probe", "toolkit", "enPivot", "llm", "fragments", "lifecycle", "dedup",
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
    var axes = fc.axisFromSlot({
      text: "joined within 1 year",
      concept: "join_date",
      hintedCategory: "signup"
    });
    var hasJoin = false;
    for (var ai = 0; ai < axes.length; ai++) {
      if (axes[ai] === "joindate") hasJoin = true;
    }
    if (!hasJoin) {
      twFail("1b.fragContract", "axisFromSlot miss joindate for join_date/signup");
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
    if (fc.axesCompatible({ tags: "age", name: "woo__customer__age" },
        { text: "x", concept: "gender" })) {
      twFail("1b.fragContract", "axesCompatible must reject gender→age");
      return false;
    }
    var nlParams = fc.resolveNlParams(domain, "가입한지 1년 이내인 고객", { joinDaysWithin: 1 });
    if (!nlParams || Number(nlParams.joinDaysWithin) !== 365) {
      twFail("1b.fragContract", "resolveNlParams joinDaysWithin!=365");
      return false;
    }
    if (!fc.induceMonthRange) {
      twFail("1b.fragContract", "induceMonthRange missing");
      return false;
    }
    var mr = fc.induceMonthRange("1\uC6D4~6\uC6D4 \uC0AC\uC774\uC5D0 \uAC00\uC785\uD55C");
    if (!mr || mr.monthMin !== 1 || mr.monthMax !== 6) {
      twFail("1b.fragContract", "induceMonthRange 1~6 fail");
      return false;
    }
    if (!fc.monthRangeNeedsClarify) {
      twFail("1b.fragContract", "monthRangeNeedsClarify missing");
      return false;
    }
    if (!fc.monthRangeNeedsClarify({ text: "1\uC6D4~6\uC6D4", kind: "range" }, {
      name: "woo__customer__joindate",
      param_domain: domain
    })) {
      twFail("1b.fragContract", "monthRangeNeedsClarify relative joindate");
      return false;
    }
    if (fc.buildPromptHints) {
      var mrHints = fc.buildPromptHints({
        slots: [{
          slotId: "mr0",
          surface: "1\uC6D4~6\uC6D4 \uC0AC\uC774\uC5D0 \uAC00\uC785\uD55C",
          kind: "range",
          domain: domain
        }],
        clarifyRound: 0
      });
      if (!mrHints || !mrHints.length || !mrHints[0].options || mrHints[0].options.length < 2) {
        twFail("1b.fragContract", "buildPromptHints month-range year chips");
        return false;
      }
      var cy = new Date().getFullYear();
      var hasCy = false;
      var hoi;
      for (hoi = 0; hoi < mrHints[0].options.length; hoi++) {
        if (String(mrHints[0].options[hoi].label || "").indexOf(String(cy)) >= 0) {
          hasCy = true;
          break;
        }
      }
      if (!hasCy) {
        twFail("1b.fragContract", "month-range hints must include current year");
        return false;
      }
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
    var ageToks = fc.keywordsFromSlot({ text: "10대", concept: "age_group", kind: "range" });
    var hasAgeTok = false;
    for (var aki = 0; aki < ageToks.length; aki++) {
      if (String(ageToks[aki]).toLowerCase() === "age") hasAgeTok = true;
    }
    if (!hasAgeTok) {
      twFail("1b.fragContract", "keywordsFromSlot age_group must include axis token age");
      return false;
    }
    if (!fc.libraryHitPredicate(ageCard, {
      text: "10대", concept: "age_group", kind: "range", searchKeywords: ["10대"]
    }, ageDomain)) {
      twFail("1b.fragContract", "same-axis age frag must hit for unseen alias");
      return false;
    }
    if (fc.libraryHitPredicate(ageCard, { text: "x", concept: "gender", searchKeywords: ["x"] }, ageDomain)) {
      twFail("1b.fragContract", "age frag must not hit gender slot");
      return false;
    }
    var consentDomain = {
      consent: { required: true, type: "byte", enum: [0, 1], nlMap: { "동의": 1 } },
      _source: { schema: "woo:testWooSampleApp", xpath: "@push_consent", concept: "push_consent" }
    };
    var consentCard = {
      name: "woo__app__push_consent", tags: "consent", label: "Push Consent",
      synonyms: "푸시,push,마케팅,marketing",
      sample_questions: ["푸시 및 마케팅 수신동의"],
      param_domain: consentDomain, description: "", category: "foundry"
    };
    if (fc.axesCompatible(consentCard, {
      text: "마케팅 수신동의하지 않고",
      concept: "marketing_consent",
      en_literal: "did not consent to marketing communications"
    })) {
      twFail("1b.fragContract", "push frag must not axes-match marketing_consent slot");
      return false;
    }
    if (!fc.axesCompatible(consentCard, {
      text: "푸시 수신동의한",
      concept: "push_consent",
      en_literal: "consented to push notifications"
    })) {
      twFail("1b.fragContract", "push frag must axes-match push_consent slot");
      return false;
    }
    var mktDomain = {
      marketing_consent: { required: true, type: "byte", enum: [0, 1] },
      _source: { schema: "woo:testWooSampleCustomer", xpath: "@marketing_consent",
        concept: "marketing_consent" }
    };
    var mktCard = {
      name: "woo__customer__marketing_consent", tags: "consent",
      param_domain: mktDomain, description: "", category: "foundry"
    };
    if (!fc.axesCompatible(mktCard, {
      text: "마케팅 수신동의하지 않고", concept: "marketing_consent"
    })) {
      twFail("1b.fragContract", "marketing frag must axes-match marketing_consent slot");
      return false;
    }
    if (fc.axesCompatible(mktCard, {
      text: "푸시 수신동의한", concept: "push_consent"
    })) {
      twFail("1b.fragContract", "marketing frag must not axes-match push_consent slot");
      return false;
    }
    if (fc.libraryHitPredicate(consentCard, {
      text: "푸시 및 마케팅 수신동의", searchKeywords: ["푸시", "마케팅"]
    }, consentDomain)) {
      twFail("1b.fragContract", "push frag must not swallow leftover specifier");
      return false;
    }
    if (!fc.libraryHitPredicate(consentCard, {
      text: "푸시 수신동의", searchKeywords: ["푸시"]
    }, consentDomain)) {
      twFail("1b.fragContract", "push frag must hit push-only slot");
      return false;
    }
    if (!fc.slotCoverParts) {
      twFail("1b.fragContract", "slotCoverParts missing");
      return false;
    }
    var coverP = fc.slotCoverParts(consentCard, {
      text: "푸시 및 마케팅 수신동의",
      en_literal: "push and marketing consent",
      searchKeywords: ["푸시", "마케팅"]
    }, consentDomain);
    var leftJ = (coverP.leftover && coverP.leftover.join(",")) || "";
    if (leftJ.toLowerCase().indexOf("market") < 0 && leftJ.indexOf("마케팅") < 0) {
      twFail("1b.fragContract", "slotCoverParts leftover must keep marketing, got: " +
        leftJ);
      return false;
    }
    if (!fc.splitCoordSlots) {
      twFail("1b.fragContract", "splitCoordSlots missing");
      return false;
    }
    var splitC = fc.splitCoordSlots([{
      text: "푸시 및 마케팅 동의한 사람",
      en_literal: "consented to push and marketing",
      kind: "boolean"
    }]);
    if (!splitC || splitC.length !== 2) {
      twFail("1b.fragContract", "splitCoordSlots expected 2, got " +
        (splitC ? splitC.length : 0));
      return false;
    }
    var ageOnly = fc.slotCoverParts(ageCard, {
      text: "10대 고객",
      en_literal: "teenage customers"
    }, ageDomain);
    if (ageOnly.leftover && ageOnly.leftover.length) {
      twFail("1b.fragContract", "10대 leftover must be empty, got: " +
        ageOnly.leftover.join(","));
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
    if (!fc.collectLexicon || !fc.splitByLexicon || !fc.mergeLexiconSlots) {
      twFail("1b.fragContract", "collectLexicon/splitByLexicon/mergeLexiconSlots missing");
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
    var mergedUp = fc.mergeLexiconSlots(
      [{ text: "인천", resolvedName: "woo__customer__region" }],
      [{ text: "인천", concept: "residential_region", en_literal: "Incheon", kind: "categorical" }]
    );
    if (!mergedUp || mergedUp.length !== 1 ||
        String(mergedUp[0].en_literal) !== "Incheon" ||
        String(mergedUp[0].concept) !== "residential_region") {
      twFail("1b.fragContract", "mergeLexiconSlots must copy EnPivot en_literal/concept");
      return false;
    }
    var mergedLong = fc.mergeLexiconSlots(
      [{ text: "인천", resolvedName: "woo__customer__region" },
       { text: "10대", resolvedName: "woo__customer__age" }],
      [{ text: "인천 거주 10대 고객", concept: "age_group" }]
    );
    var hasIncheon = false;
    var hasAge = false;
    var mi;
    for (mi = 0; mi < (mergedLong || []).length; mi++) {
      if (String(mergedLong[mi].text) === "인천") hasIncheon = true;
      if (String(mergedLong[mi].text) === "10대") hasAge = true;
    }
    if (!hasIncheon || !hasAge) {
      twFail("1b.fragContract", "long LLM span must not swallow lexicon 인천/10대");
      return false;
    }
    if (!fc.splitCompoundSlots) {
      twFail("1b.fragContract", "splitCompoundSlots missing");
      return false;
    }
    var unpaidCard = {
      name: "woo__bill__unpaid", tags: "unpaid", label: "미납",
      synonyms: "마케팅 동의한,July leftover",
      sample_questions: ["푸시 및 마케팅"],
      param_domain: {
        unpaid: { required: true, type: "byte", enum: ["0", "1"] },
        _source: { schema: "woo:testWooSampleBill", xpath: "@unpaid" }
      }
    };
    var idLex = fc.collectLexicon([unpaidCard, regionCard, ageCard], { identityOnly: true });
    var synHit = false;
    var ili;
    for (ili = 0; ili < idLex.length; ili++) {
      if (String(idLex[ili].key).indexOf("마케팅") >= 0) synHit = true;
    }
    if (synHit) {
      twFail("1b.fragContract", "identityOnly lexicon must omit polluted synonyms");
      return false;
    }
    var compound = fc.splitCompoundSlots([
      { text: "7월 미납자", concept: "unpaid_month", en_literal: "July unpaid person", kind: "categorical" }
    ], idLex);
    var hasMonth = false;
    var hasUnpaid = false;
    var ci2;
    for (ci2 = 0; ci2 < (compound || []).length; ci2++) {
      if (String(compound[ci2].text) === "7월") hasMonth = true;
      if (String(compound[ci2].text).indexOf("미납") === 0) hasUnpaid = true;
    }
    if (!compound || compound.length < 2 || !hasMonth || !hasUnpaid) {
      twFail("1b.fragContract", "compound 7월+미납 must split, got " +
        (compound ? compound.length : 0));
      return false;
    }
    var twoAxis = fc.splitCompoundSlots([
      { text: "인천 10대", kind: "categorical" }
    ], idLex);
    var hasReg = false;
    var hasAge2 = false;
    for (ci2 = 0; ci2 < (twoAxis || []).length; ci2++) {
      if (String(twoAxis[ci2].text) === "인천") hasReg = true;
      if (String(twoAxis[ci2].text) === "10대") hasAge2 = true;
    }
    if (!hasReg || !hasAge2) {
      twFail("1b.fragContract", "compound region+age must split");
      return false;
    }
    var keepRange = fc.splitCompoundSlots([
      { text: "10대~30대", kind: "range" }
    ], idLex);
    if (!keepRange || keepRange.length !== 1 || String(keepRange[0].text) !== "10대~30대") {
      twFail("1b.fragContract", "range slot must stay 1");
      return false;
    }
    var pushOnly = fc.splitCompoundSlots([
      { text: "푸시 동의한", concept: "push_consent", en_literal: "consented to push" }
    ], idLex);
    if (!pushOnly || pushOnly.length !== 1 || String(pushOnly[0].text) !== "푸시 동의한") {
      twFail("1b.fragContract", "single-axis slot must not split on synonym pollution");
      return false;
    }
    var pushCard = {
      name: "woo__app__push", tags: "consent", label: "Push Consent",
      synonyms: "",
      param_domain: {
        push: {
          required: true, type: "byte",
          nlMap: { "push": "1", "consented": "1" },
          enum: ["0", "1"]
        },
        _source: { schema: "woo:testWooSampleApp", xpath: "@push_consent" }
      }
    };
    var idLexPush = fc.collectLexicon([pushCard], { identityOnly: true });
    var pushEn = fc.splitCompoundSlots([
      { text: "푸시 동의한", en_literal: "consented to push", concept: "push_consent" }
    ], idLexPush);
    if (!pushEn || pushEn.length !== 1 || String(pushEn[0].text) !== "푸시 동의한") {
      twFail("1b.fragContract", "EN catalog hit must not split a single KO slot");
      return false;
    }
    if (!fc.yearMonthHits || !fc.domainMatchSlot) {
      twFail("1b.fragContract", "yearMonthHits/domainMatchSlot missing");
      return false;
    }
    var ymHit = fc.domainMatchSlot({
      bill_month: { type: "string", enum: ["2026-07"] }
    }, "7월");
    if (!ymHit || String(ymHit.value) !== "2026-07") {
      twFail("1b.fragContract", "N월 must bind YYYY-MM enum, got " +
        (ymHit ? String(ymHit.value) : "null"));
      return false;
    }
    var ymMany = fc.yearMonthHits("7월", ["2025-07", "2026-07", "2026-08"]);
    if (!ymMany || ymMany.length !== 2) {
      twFail("1b.fragContract", "N월 must pick all matching YYYY-MM");
      return false;
    }
    if (fc.yearMonthHits("10대", ["2026-07"]).length) {
      twFail("1b.fragContract", "N대 must not be treated as N월");
      return false;
    }
    if (!fc.buildPromptHints || !fc.applyNlPatch) {
      twFail("1b.fragContract", "buildPromptHints/applyNlPatch missing");
      return false;
    }
    var hYm = fc.buildPromptHints({
      slots: [{
        slotId: "sYm",
        surface: "3월",
        domain: { bill_month: { type: "string", enum: ["2024-03", "2025-03", "2025-04"] } },
        tier: "enum"
      }]
    });
    if (!hYm || !hYm.length || !hYm[0].options || hYm[0].options.length < 3) {
      twFail("1b.fragContract", "month 2+ hits must emit union+members");
      return false;
    }
    if (hYm[0].options[0].union !== true ||
        String(hYm[0].options[1].value) !== "2025-03" ||
        String(hYm[0].options[2].value) !== "2024-03") {
      twFail("1b.fragContract", "time values must sort desc after union");
      return false;
    }
    var hOne = fc.buildPromptHints({
      slots: [{
        slotId: "sOne",
        surface: "3월",
        domain: { bill_month: { type: "string", enum: ["2025-03"] } },
        tier: "enum"
      }]
    });
    if (hOne && hOne.length) {
      twFail("1b.fragContract", "single closed hit must not emit chips");
      return false;
    }
    var firms = ["열린서점", "열린약국", "열린카페"];
    var hAud = fc.buildPromptHints({
      slots: [{
        slotId: "sFirm",
        surface: "열린",
        domain: { shop: { type: "string", enum: firms } },
        tier: "enum"
      }],
      auditDates: {
        "열린서점": { modified: "2025-01" },
        "열린약국": { modified: "2026-02" },
        "열린카페": { modified: "2026-03" }
      }
    });
    if (!hAud || !hAud.length || hAud.auditSqlCount !== 0) {
      twFail("1b.fragContract", "injected auditDates must not run SELECT");
      return false;
    }
    if (!hAud[0].options[0].union ||
        String(hAud[0].options[1].value) !== "열린카페" ||
        String(hAud[0].options[2].value) !== "열린약국" ||
        String(hAud[0].options[3].value) !== "열린서점") {
      twFail("1b.fragContract", "union first then modified desc");
      return false;
    }
    var hProbe = fc.buildPromptHints({
      slots: [{
        slotId: "sFirm2",
        surface: "열린",
        domain: { shop: { type: "string", enum: firms } },
        tier: "enum"
      }]
    });
    if (!hProbe || !hProbe.length || !hProbe[0].options[0].union ||
        String(hProbe[0].options[1].value) !== "열린서점") {
      twFail("1b.fragContract", "no audit cols must keep enum order after union");
      return false;
    }
    var hHigh = fc.buildPromptHints({
      slots: [{
        slotId: "sNote",
        surface: "메모",
        domain: { note: { type: "string", enum: ["a", "ab"] } },
        tier: "highCard"
      }]
    });
    if (hHigh && hHigh.length) {
      twFail("1b.fragContract", "highCard must emit no chips");
      return false;
    }
    var patched = fc.applyNlPatch("열린 기업 고객", "열린", "열린카페");
    if (patched !== "열린카페 기업 고객") {
      twFail("1b.fragContract", "applyNlPatch must replace first surface only");
      return false;
    }
    if (fc.applyNlPatch("열린카페 기업 고객", "열린", "열린카페") !== "열린카페 기업 고객") {
      twFail("1b.fragContract", "applyNlPatch no-op when patch already present");
      return false;
    }
    var patchedMr = fc.applyNlPatch(
      "1\uC6D4~6\uC6D4 \uC0AC\uC774\uC5D0 \uAC00\uC785\uD55C \uACE0\uAC1D",
      "1~6\uC6D4",
      "2025\uB144 1\uC6D4~6\uC6D4");
    if (patchedMr !== "2025\uB144 1\uC6D4~6\uC6D4 \uC0AC\uC774\uC5D0 \uAC00\uC785\uD55C \uACE0\uAC1D") {
      twFail("1b.fragContract", "applyNlPatch month-range replace: " + patchedMr);
      return false;
    }
    var mrSpan = fc.induceMonthRange("1\uC6D4~6\uC6D4 \uC0AC\uC774\uC5D0 \uAC00\uC785\uD55C");
    if (!mrSpan || !mrSpan.span || mrSpan.span !== "1\uC6D4~6\uC6D4") {
      twFail("1b.fragContract", "induceMonthRange span");
      return false;
    }
    if (!fc.induceYearMonthSpan || !fc.yearMonthSpanCatalogGap || !fc.nlBindsYearMonthSpan ||
        !fc.healYearMonthSpanDomain) {
      twFail("1b.fragContract", "yearMonthSpan helpers missing");
      return false;
    }
    var yms = fc.induceYearMonthSpan("2026\uB144 1\uC6D4~6\uC6D4 \uC0AC\uC774\uC5D0 \uAC00\uC785\uD55C");
    if (!yms || yms.year !== 2026 || yms.monthMin !== 1 || yms.monthMax !== 6) {
      twFail("1b.fragContract", "induceYearMonthSpan 2026 1~6");
      return false;
    }
    var ymsCompact = fc.induceYearMonthSpan("2023 1~6\uC6D4 \uAC00\uC785\uC790");
    if (!ymsCompact || ymsCompact.year !== 2023 || ymsCompact.monthMin !== 1 ||
        ymsCompact.monthMax !== 6) {
      twFail("1b.fragContract", "induceYearMonthSpan compact 2023 1~6");
      return false;
    }
    if (!fc.looksLikeYearMonthSpan || !fc.looksLikeYearMonthSpan("2023 1~6\uC6D4")) {
      twFail("1b.fragContract", "looksLikeYearMonthSpan compact");
      return false;
    }
    var ymsEn = fc.induceYearMonthSpan("2023 January~June joiners");
    if (!ymsEn || ymsEn.year !== 2023 || ymsEn.monthMin !== 1 || ymsEn.monthMax !== 6) {
      twFail("1b.fragContract", "induceYearMonthSpan EN January~June");
      return false;
    }
    if (!fc.yearMonthSpanCatalogGap(domain, "2026\uB144 1\uC6D4~6\uC6D4 \uC0AC\uC774\uC5D0 \uAC00\uC785\uD55C")) {
      twFail("1b.fragContract", "relative joindate must span catalog gap");
      return false;
    }
    var spanDom = {
      joinYear: { required: true, type: "int" },
      joinMonthFrom: { required: true, type: "byte" },
      joinMonthTo: { required: true, type: "byte" },
      _range: { year: "joinYear", monthFrom: "joinMonthFrom", monthTo: "joinMonthTo", bucket: "_bucket" },
      _source: { schema: "woo:testWooSampleCustomer", xpath: "@created_date" }
    };
    if (fc.yearMonthSpanCatalogGap(spanDom, "2026\uB144 1\uC6D4~6\uC6D4 \uC0AC\uC774\uC5D0 \uAC00\uC785\uD55C")) {
      twFail("1b.fragContract", "span domain must not be catalog gap");
      return false;
    }
    if (!fc.nlBindsYearMonthSpan([{ name: "woo__customer__joindate", param_domain: spanDom }],
        "2026\uB144 1\uC6D4~6\uC6D4 \uC0AC\uC774\uC5D0 \uAC00\uC785\uD55C")) {
      twFail("1b.fragContract", "nlBindsYearMonthSpan span domain");
      return false;
    }
    var healDom = {
      _bucket: {
        nlMap: {
          "2026\uB144 1\uC6D4~6\uC6D4": {
            joinYear: 2026,
            joinMonthFrom: 1,
            joinMonthTo: 6
          }
        }
      },
      joinYear: { required: true, type: "int" },
      joinMonthFrom: { required: true, type: "byte" },
      joinMonthTo: { required: true, type: "byte" },
      _range: {
        year: "joinYear",
        monthFrom: "joinMonthFrom",
        monthTo: "joinMonthTo",
        bucket: "_bucket"
      }
    };
    var dmHeal = fc.domainMatchSlot(healDom,
      "2026\uB144 1\uC6D4~6\uC6D4 \uC0AC\uC774\uC5D0 \uAC00\uC785\uD55C");
    if (!dmHeal || !dmHeal.value || Number(dmHeal.value.joinYear) !== 2026) {
      twFail("1b.fragContract", "domainMatchSlot nlMap bucket span partial");
      return false;
    }
    if (!fc.domainMatchSlot(healDom, "2026\uB144 1\uC6D4~6\uC6D4")) {
      twFail("1b.fragContract", "_boundHas substring nlMap key in span text");
      return false;
    }
    if (!fc.spanRangeSqlText) {
      twFail("1b.fragContract", "spanRangeSqlText missing");
      return false;
    }
    var relSql = "SELECT DISTINCT sCustomer_id FROM testWooSampleCustomer " +
      "WHERE tsCreated_date >= AddDays(GetDate(), -{{joinDaysWithin}})";
    var absSql = fc.spanRangeSqlText(relSql, spanDom,
      { joinYear: 2026, joinMonthFrom: 1, joinMonthTo: 6 },
      "sCustomer_id", "2026\uB144 1\uC6D4~6\uC6D4 \uC0AC\uC774\uC5D0 \uAC00\uC785\uD55C");
    if (!absSql || absSql.indexOf("'2026-01-01'") < 0 || absSql.indexOf("'2026-07-01'") < 0) {
      twFail("1b.fragContract", "spanRangeSqlText absolute rewrite: " + String(absSql));
      return false;
    }
    var bucketOnlyDom = {
      joinDaysWithin: { required: true, type: "int" },
      _bucket: {
        nlMap: {
          "2026\uB144 1\uC6D4~6\uC6D4": {
            joinYear: 2026,
            joinMonthFrom: 1,
            joinMonthTo: 6
          }
        }
      },
      _source: { schema: "woo:testWooSampleCustomer", xpath: "@created_date" }
    };
    var absBucket = fc.spanRangeSqlText(relSql, bucketOnlyDom, {},
      "sCustomer_id", "2026\uB144 1\uC6D4~6\uC6D4 \uC0AC\uC774\uC5D0 \uAC00\uC785\uD55C");
    if (!absBucket || absBucket.indexOf("'2026-07-01'") < 0) {
      twFail("1b.fragContract", "spanRangeSqlText bucket-only domain: " + String(absBucket));
      return false;
    }
    var absNlOnly = fc.spanRangeSqlText(relSql, { joinDaysWithin: { type: "int" } }, {},
      "sCustomer_id", "2026\uB144 1\uC6D4~6\uC6D4 \uC0AC\uC774\uC5D0 \uAC00\uC785\uD55C \uACE0\uAC1D");
    if (!absNlOnly || absNlOnly.indexOf("'2026-01-01'") < 0) {
      twFail("1b.fragContract", "spanRangeSqlText NL induce only: " + String(absNlOnly));
      return false;
    }
    var absCompact = fc.spanRangeSqlText(relSql, { joinDaysWithin: { type: "int" } }, {},
      "sCustomer_id", "2023 1~6\uC6D4 \uAC00\uC785\uC790");
    if (!absCompact || absCompact.indexOf("'2023-01-01'") < 0 ||
        absCompact.indexOf("'2023-07-01'") < 0) {
      twFail("1b.fragContract", "spanRangeSqlText compact 2023 1~6: " + String(absCompact));
      return false;
    }
    var incheonToks = fc.keywordsFromSlot({ text: "인천에 사는", concept: "region" });
    var hasRegion = false;
    var ki;
    for (ki = 0; ki < incheonToks.length; ki++) {
      if (String(incheonToks[ki]).toLowerCase() === "region") hasRegion = true;
    }
    if (!hasRegion) {
      twFail("1b.fragContract", "keywordsFromSlot region concept must include axis token, got " +
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
    var spanMerge = fc.mergeParamDomainJson(
      { _range: { min: 2023, max: 2026 } },
      { _range: { year: "joinYear", monthFrom: "joinMonthFrom", monthTo: "joinMonthTo", bucket: "_bucket" } }
    );
    var sm = spanMerge && spanMerge.domain && spanMerge.domain._range;
    if (!spanMerge || !spanMerge.changed || !sm || sm.year !== "joinYear" ||
        Number(sm.min) !== 2023 || Number(sm.max) !== 2026) {
      twFail("1b.fragContract", "mergeParamDomainJson must keep min/max and add span meta");
      return false;
    }
    var joindateLike = {
      joinDaysWithin: { required: true, type: "int" },
      _bucket: {
        nlMap: {
          "<relative>": { joinDaysWithin: 1095 },
          "2026\uB144 1\uC6D4~6\uC6D4": {
            joinDateFrom: "2026-01-01",
            joinDateTo: "2026-07-01"
          }
        }
      },
      _range: { min: 2023, max: 2026 },
      _source: {
        schema: "woo:testWooSampleCustomer",
        xpath: "@created_date",
        tier: "range",
        evidence: "type=datetime is numeric/temporal"
      }
    };
    var nl2023 = "2023\uB144 1\uC6D4~6\uC6D4 \uC0AC\uC774\uC5D0 \uAC00\uC785\uD55C \uACE0\uAC1D";
    if (!fc.yearMonthSpanCatalogGap(joindateLike, nl2023)) {
      twFail("1b.fragContract", "joindate-like domain must be span catalog gap for 2023");
      return false;
    }
    var healed2023 = fc.healYearMonthSpanDomain(joindateLike, nl2023);
    if (!healed2023 || !healed2023.changed ||
        !fc.domainMatchSlot(healed2023.domain, nl2023)) {
      twFail("1b.fragContract", "healYearMonthSpanDomain must bind 2023 yms");
      return false;
    }
    if (!fc.nlBindsYearMonthSpan(
        [{ name: "woo__customer__joindate", param_domain: healed2023.domain }], nl2023)) {
      twFail("1b.fragContract", "nlBindsYearMonthSpan after heal 2023");
      return false;
    }
    var joindateCard = {
      name: "woo__customer__joindate",
      tags: "joindate",
      param_domain: joindateLike
    };
    var spanSlot = {
      text: "2023 1~6\uC6D4 \uAC00\uC785\uC790",
      concept: "join_date",
      en_literal: "2023 January~June joiners"
    };
    if (fc.libraryHitPredicate(joindateCard, spanSlot, joindateLike)) {
      twFail("1b.fragContract", "libraryHitPredicate must reject span yms unbound");
      return false;
    }
    if (!fc.libraryHitPredicate(joindateCard, spanSlot, healed2023.domain)) {
      twFail("1b.fragContract", "libraryHitPredicate must hit after span heal");
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
    var gDom = {
      region: {
        required: true, type: "string",
        nlMap: { "서울": { db: "서울", en: ["Seoul"] } },
        enum: ["서울", "NorthA", "NorthB"]
      },
      _group: {
        region: {
          "북부권": {
            members: ["NorthA", "NorthB", "Gone"],
            src: "llm", verified: false, en: ["northern belt"]
          }
        }
      }
    };
    var gCard = {
      name: "woo__customer__region", tags: "region", label: "지역",
      synonyms: "", sample_questions: [], param_domain: gDom, description: ""
    };
    var gLex = fc.collectLexicon([gCard]);
    var gHasAlias = false;
    var gli;
    for (gli = 0; gli < gLex.length; gli++) {
      if (String(gLex[gli].key) === "북부권") gHasAlias = true;
    }
    if (!gHasAlias) {
      twFail("1b.fragContract", "collectLexicon must include _group alias");
      return false;
    }
    var gIdx = fc.buildIndexFields({ slotText: "거주", param_domain: gDom, name: "woo__customer__region" });
    if (!gIdx || String(gIdx.synonyms).indexOf("북부권") < 0) {
      twFail("1b.fragContract", "buildIndexFields must include _group alias, got: " +
        (gIdx && gIdx.synonyms));
      return false;
    }
    var gHit = fc.domainMatchSlot(gDom, "북부권 거주");
    if (!gHit || gHit.group !== true ||
        Object.prototype.toString.call(gHit.value) !== "[object Array]" ||
        gHit.value.length !== 2) {
      twFail("1b.fragContract", "domainMatchSlot _group must bind candidate members only");
      return false;
    }
    if (String(gHit.value[0]) !== "NorthA" || String(gHit.value[1]) !== "NorthB") {
      twFail("1b.fragContract", "domainMatchSlot filtered members wrong: " +
        String(gHit.value));
      return false;
    }
    var gSeoul = fc.domainMatchSlot(gDom, "서울 사는");
    if (!gSeoul || String(gSeoul.value) !== "서울" || gSeoul.group) {
      twFail("1b.fragContract", "nlMap scalar must win over _group");
      return false;
    }
    var gParams = fc.resolveNlParams(gDom, "북부권 사는 고객", { region: 1 });
    if (!gParams ||
        Object.prototype.toString.call(gParams.region) !== "[object Array]" ||
        gParams.region.length !== 2) {
      twFail("1b.fragContract", "resolveNlParams _group must return members[]");
      return false;
    }
    var gScalar = fc.resolveNlParams(gDom, "서울 사는 고객", { region: 1 });
    if (!gScalar || String(gScalar.region) !== "서울") {
      twFail("1b.fragContract", "resolveNlParams scalar 서울 must stay scalar");
      return false;
    }
    var resDom = {
      region: {
        required: true, type: "string",
        enum: ["전남", "전북", "서울"],
        nlMap: { "서울": { db: "서울", en: ["Seoul"] } }
      },
      _source: {
        schema: "woo:testWooSampleCustomer", xpath: "@region",
        concept: "residential_region", tier: "enum"
      }
    };
    if (!fc.conceptsAxisMatch("region", "residential_region", "categorical")) {
      twFail("1b.fragContract", "conceptsAxisMatch region/residential_region");
      return false;
    }
    var m3Axis = fc.matchEnPivotSlot(resDom, {
      text: "전라도", surface: "전라도", concept: "region",
      en_literal: "Jeolla-do", kind: "categorical"
    });
    if (!m3Axis || String(m3Axis.layer) !== "M3") {
      twFail("1b.fragContract", "M3 axis concept region/residential_region got " +
        (m3Axis && m3Axis.layer));
      return false;
    }
    var liveDom = {
      plan_code: {
        required: true, type: "string",
        enum: ["학생요금", "Z요금"],
        nlMap: { "학생요금": { db: "STUDENT", en: ["student"] } }
      }
    };
    var liveP = fc.resolveNlParams(liveDom, "학생요금 사용하는 고객", { plan_code: 1 });
    if (!liveP || String(liveP.plan_code) !== "학생요금") {
      twFail("1b.fragContract", "live enum must win over stale nlMap db STUDENT");
      return false;
    }
    var codeDom = {
      plan_code: {
        required: true, type: "string",
        enum: ["STUDENT", "Z_PLAN"],
        nlMap: { "학생요금": { db: "STUDENT", en: ["student"] } }
      }
    };
    var codeP = fc.resolveNlParams(codeDom, "학생요금 사용하는 고객", { plan_code: 1 });
    if (!codeP || String(codeP.plan_code) !== "STUDENT") {
      twFail("1b.fragContract", "nlMap db in live enum must stay STUDENT");
      return false;
    }
    var aliasDom = {
      planCode: {
        required: true, type: "string",
        nlMap: { "학생요금": { db: "STUDENT", en: ["student"] } }
      },
      plan_code: {
        required: true, type: "string",
        enum: ["학생요금", "Z요금"]
      }
    };
    var aliasP = fc.resolveNlParams(aliasDom, "학생요금 사용하는 고객", { planCode: 1 });
    if (!aliasP || String(aliasP.planCode) !== "학생요금") {
      twFail("1b.fragContract", "planCode must snap to plan_code live enum");
      return false;
    }
    if (!fc.groupHintForParams) {
      twFail("1b.fragContract", "groupHintForParams missing");
      return false;
    }
    var hintG = fc.groupHintForParams(gDom, { region: ["NorthA", "NorthB"] });
    if (!hintG || String(hintG.alias) !== "북부권" || hintG.verified) {
      twFail("1b.fragContract", "groupHintForParams must return unverified 북부권");
      return false;
    }
    var hintMiss = fc.groupHintForParams(gDom, { region: "서울" });
    if (hintMiss) {
      twFail("1b.fragContract", "groupHintForParams must miss scalar 서울");
      return false;
    }
    var gMerged = fc.mergeParamDomainJson(gDom, JSON.stringify({
      region: { nlMap: { "서울": { db: "서울", en: ["Seoul"] } } },
      _group: { region: { "북부권": { members: ["NorthA"], src: "llm", verified: false } } }
    }));
    var gKeep = gMerged && gMerged.domain && gMerged.domain.region &&
      gMerged.domain.region.nlMap && gMerged.domain.region.nlMap["서울"];
    if (!gKeep) {
      twFail("1b.fragContract", "merge must not delete nlMap keys");
      return false;
    }
    var gVb = fc.validateBind(gDom, { region: ["NorthA", "NorthB"] });
    if (!gVb || !gVb.ok) {
      twFail("1b.fragContract", "validateBind group members in enum should pass");
      return false;
    }
    if (!fc.upsertGroup) {
      twFail("1b.fragContract", "upsertGroup missing");
      return false;
    }
    var upDom = fc.upsertGroup({
      region: {
        required: true, type: "string",
        nlMap: { "서울": { db: "서울", en: ["Seoul"] } },
        enum: ["서울", "NorthA", "NorthB"]
      }
    }, "region", "서부권", ["NorthA", "Gone", "NorthB"], {
      src: "llm", verified: false, en: ["western belt"]
    });
    var upHit = fc.domainMatchSlot(upDom, "서부권");
    if (!upHit || upHit.group !== true ||
        Object.prototype.toString.call(upHit.value) !== "[object Array]" ||
        upHit.value.length !== 2) {
      twFail("1b.fragContract", "upsertGroup must filter to candidate members");
      return false;
    }
    if (String(upHit.value[0]) !== "NorthA" || String(upHit.value[1]) !== "NorthB") {
      twFail("1b.fragContract", "upsertGroup members wrong: " + String(upHit.value));
      return false;
    }
    if (!upDom.region || !upDom.region.nlMap || !upDom.region.nlMap["서울"]) {
      twFail("1b.fragContract", "upsertGroup must keep nlMap keys");
      return false;
    }
    var m2g = fc.matchEnPivotSlot(upDom, { text: "서부권", surface: "서부권" });
    if (!m2g || String(m2g.layer) !== "M2G" || m2g.group !== true) {
      twFail("1b.fragContract", "matchEnPivotSlot _group must be M2G, got " +
        (m2g && m2g.layer));
      return false;
    }
    var longAlias = "abcdefghijklmnopqrstuvwxyz";
    var upLong = fc.upsertGroup(upDom, "region", longAlias, ["NorthA"], { src: "llm" });
    if (upLong && upLong._group && upLong._group.region &&
        upLong._group.region[longAlias]) {
      twFail("1b.fragContract", "upsertGroup must reject alias longer than 24");
      return false;
    }
    var pDom = {
      region: {
        required: true, type: "string",
        nlMap: {
          "서울": { db: "서울", en: ["Seoul"] },
          "교촌": { db: "NorthA", en: ["Bridge"] }
        },
        enum: ["서울", "NorthA", "NorthB"]
      },
      _group: {
        region: {
          "서부권": { members: ["NorthA", "NorthB"], src: "llm", verified: false }
        }
      }
    };
    var pMiss = fc.domainMatchSlot(pDom, "교촌도");
    if (pMiss && String(pMiss.nl) === "교촌") {
      twFail("1b.fragContract", "prefix alias must not match longer token");
      return false;
    }
    var pSeoul = fc.domainMatchSlot(pDom, "서울은");
    if (!pSeoul || String(pSeoul.value) !== "서울") {
      twFail("1b.fragContract", "josa tail on exact db alias must still match");
      return false;
    }
    var pGrp = fc.domainMatchSlot(pDom, "서부권에");
    if (!pGrp || pGrp.group !== true) {
      twFail("1b.fragContract", "group alias with 1-char tail must match");
      return false;
    }
    var pRes = fc.resolveNlParams(pDom, "교촌도 사는", { region: 1 });
    if (pRes && String(pRes.region) === "NorthA") {
      twFail("1b.fragContract", "resolveNlParams must not bind prefix token");
      return false;
    }
    var pCard = {
      name: "woo__customer__region", tags: "region", label: "지역",
      synonyms: "", sample_questions: [], param_domain: pDom, description: ""
    };
    var pLex = fc.collectLexicon([pCard]);
    var pSplit = fc.splitByLexicon("교촌도 사는 고객", pLex);
    var pHasShort = false;
    var psi;
    for (psi = 0; psi < (pSplit || []).length; psi++) {
      if (String(pSplit[psi].text) === "교촌") pHasShort = true;
    }
    if (pHasShort) {
      twFail("1b.fragContract", "splitByLexicon must not carve short key from longer token");
      return false;
    }
    var rollHit = fc.domainMatchSlot({
      region: {
        nlMap: { "교촌": { db: "NorthA", en: ["Bridge"] } },
        enum: ["서울", "NorthA", "NorthB"]
      }
    }, "교촌");
    if (!rollHit || String(rollHit.value) !== "NorthA") {
      twFail("1b.fragContract", "missing child must roll up to stored parent");
      return false;
    }
    var fineHit = fc.domainMatchSlot({
      region: {
        nlMap: { "교촌": { db: "NorthA", en: ["Bridge"] } },
        enum: ["서울", "NorthA", "NorthB", "교촌"]
      }
    }, "교촌");
    if (!fineHit || String(fineHit.value) !== "교촌") {
      twFail("1b.fragContract", "child in enum must win over stored parent");
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

function twStepExcludeUniverse() {
  if (!testWoo.compiler || !testWoo.compiler.compile) {
    twFail("1h.excludeUniverse", "compiler.compile missing");
    return false;
  }
  var prevGet = testWoo.fragments && testWoo.fragments.getByName;
  try {
    if (!testWoo.fragments) testWoo.fragments = {};
    testWoo.fragments.getByName = function (n) {
      if (String(n) !== "woo__customer__region") return null;
      return {
        name: "woo__customer__region",
        status: "active",
        is_current: true,
        key_column: "sCustomer_id",
        sql_text: "SELECT DISTINCT sCustomer_id FROM TwSmokeCust WHERE sRegion IN ({{region}})",
        param_domain: { region: { required: true, type: "string" } },
        label: "region"
      };
    };
    var plan = {
      grainKey: "sCustomer_id",
      include: [],
      exclude: [{
        fragment: "woo__customer__region",
        label: "region",
        params: { region: "NorthA" }
      }]
    };
    var out = testWoo.compiler.compile(plan);
    var sql = String((out && out.sql) || "");
    if (sql.indexOf("TwSmokeCust") < 0) {
      twFail("1h.excludeUniverse", "universe table missing: " + sql);
      return false;
    }
    if (!/\bEXCEPT\b|\bMINUS\b/i.test(sql)) {
      twFail("1h.excludeUniverse", "EXCEPT/MINUS missing: " + sql);
      return false;
    }
    if (/\bNOT\s+IN\b/i.test(sql)) {
      twFail("1h.excludeUniverse", "NOT IN forbidden: " + sql);
      return false;
    }
    if (sql.indexOf("NorthA") < 0) {
      twFail("1h.excludeUniverse", "exclude bind missing: " + sql);
      return false;
    }
    twPass("1h.excludeUniverse", "exclude-only → universe EXCEPT");
    return true;
  } catch (e) {
    twFail("1h.excludeUniverse", String(e.message || e));
    return false;
  } finally {
    if (testWoo.fragments) testWoo.fragments.getByName = prevGet;
  }
}

// 1c. normalizeAtomicSlots — EnPivot 슬롯 통과. KO 축 분할·청중명사 사전 없음.
function twStepNormalizeSlots() {
  if (!testWoo.llm || !testWoo.llm.normalizeAtomicSlots) {
    twFail("1c.normalizeSlots", "normalizeAtomicSlots missing");
    return false;
  }
  try {
    var n = testWoo.llm.normalizeAtomicSlots([
      { text: "경기도", concept: "region", en_literal: "Gyeonggi", kind: "categorical" },
      { text: "학생요금제", concept: "plan", en_literal: "student plan", kind: "categorical" }
    ]);
    if (!n || n.length !== 2) {
      twFail("1c.normalizeSlots", "expected 2 EnPivot slots, got " +
        (n ? n.length : 0));
      return false;
    }
    if (String(n[0].concept) !== "region" || String(n[1].concept) !== "plan") {
      twFail("1c.normalizeSlots", "concept not preserved: " +
        String(n[0].concept) + "|" + String(n[1].concept));
      return false;
    }
    var pass = testWoo.llm.normalizeAtomicSlots([
      { text: "경기도에 사는 학생요금제 사용하는 고객" }
    ]);
    if (!pass || pass.length !== 1) {
      twFail("1c.normalizeSlots", "KO compound must pass through as 1 slot, got " +
        (pass ? pass.length : 0));
      return false;
    }
    var empty = testWoo.llm.normalizeAtomicSlots([{ text: "   " }]);
    if (empty && empty.length) {
      twFail("1c.normalizeSlots", "blank text must drop, got " + empty.length);
      return false;
    }
    twPass("1c.normalizeSlots", "EnPivot slots preserved, no KO split");
    return true;
  } catch (e) {
    twFail("1c.normalizeSlots", String(e.message || e));
    return false;
  }
}

// 1d. #174-1 V0 — JSON 2개 강제 주입. LLM/DB 불필요.
function twStepParseMultiJson() {
  if (!testWoo.foundry || !testWoo.foundry.parseFragmentJson) {
    twFail("1d.parseMultiJson", "parseFragmentJson missing");
    return false;
  }
  try {
    var raw =
      '{"name":"woo__customer__age","label":"연령","keyColumn":"sCustomer_id",' +
      '"sqlText":"SELECT DISTINCT sCustomer_id FROM t WHERE iAge>=1"}\n' +
      '{"name":"woo__customer__gender","label":"성별","keyColumn":"sCustomer_id",' +
      '"sqlText":"SELECT DISTINCT sCustomer_id FROM t WHERE sGender=\'M\'"}';
    var r = testWoo.foundry.parseFragmentJson(raw, null, "남성");
    if (!r || !r.picked || String(r.picked.name) !== "woo__customer__age") {
      twFail("1d.parseMultiJson", "must adopt first JSON age, got " +
        (r && r.picked ? r.picked.name : "null"));
      return false;
    }
    if (!r.extraDropped) {
      twFail("1d.parseMultiJson", "extraDropped must be true");
      return false;
    }
    if (!r.extraSlots || r.extraSlots.length !== 1) {
      twFail("1d.parseMultiJson", "extraSlots length want 1 got " +
        (r.extraSlots ? r.extraSlots.length : 0));
      return false;
    }
    var ex = r.extraSlots[0];
    var exAxis = String(ex.hintedCategory || "") + " " + String(ex.text || "");
    if (exAxis.toLowerCase().indexOf("gender") < 0) {
      twFail("1d.parseMultiJson", "dropped axis must be gender, got " + exAxis);
      return false;
    }
    twPass("1d.parseMultiJson", "first=age extra=gender extra_fragment_dropped");
    return true;
  } catch (e) {
    twFail("1d.parseMultiJson", "must not throw: " + String(e.message || e));
    return false;
  }
}

// 1e. #174-2/#174-5 — M1은 카탈로그 값⊂NL. 잔여 조사/청중명사로 covered 강제 금지.
function twStepEnPivot() {
  var ep = testWoo.enPivot;
  if (!ep || !ep.extractSlots || !ep.scanM1 || !ep.applyConceptLock ||
      !ep.putNlCache) {
    twFail("1e.enPivot", "testWoo.enPivot API missing");
    return false;
  }
  try {
    ep.clearNlCache();
    var cards = [
      {
        name: "woo__t__region",
        tags: "region",
        param_domain: {
          _source: {
            schema: "woo:t", xpath: "@sRegion",
            concept: "residential_region", tier: "enum"
          },
          sRegion: { type: "string", nlMap: { "서울": "서울" } }
        }
      },
      {
        name: "woo__t__age",
        tags: "age",
        param_domain: {
          _source: {
            schema: "woo:t", xpath: "@iAge",
            concept: "age_group", tier: "range"
          },
          _bucket: { nlMap: { "10대": { ageMin: 10, ageMax: 20 } } }
        }
      }
    ];
    var nl = "서울에 사는 10대 고객";
    var m1 = ep.scanM1(nl, cards);
    if (!m1 || !m1.slots || m1.slots.length < 2) {
      twFail("1e.enPivot", "M1 slots want >=2 got " +
        (m1 && m1.slots ? m1.slots.length : 0));
      return false;
    }
    var surf = "";
    var mi;
    for (mi = 0; mi < m1.slots.length; mi++)
      surf += String(m1.slots[mi].surface || m1.slots[mi].text || "") + "|";
    if (surf.indexOf("서울") < 0 || surf.indexOf("10대") < 0) {
      twFail("1e.enPivot", "M1 match must still see 서울+10대, surfaces=" + surf);
      return false;
    }
    var glue = ep.toPipelineSlots([
      { surface: "사는", concept: null, kind: "other", en_literal: "" },
      { surface: "사는", concept: null, kind: "categorical", en_literal: "" }
    ]);
    if (glue && glue.length) {
      twFail("1e.enPivot", "glue span must drop, got " + glue.length);
      return false;
    }
    var m2keep = ep.toPipelineSlots([
      { surface: "인천", concept: null, kind: "categorical", en_literal: "Incheon" }
    ]);
    if (!m2keep || m2keep.length !== 1) {
      twFail("1e.enPivot", "en_literal slot must stay for M2, got " +
        (m2keep ? m2keep.length : 0));
      return false;
    }
    var seeded = {
      en: "Teenage customers living in Seoul",
      slots: [
        { surface: "서울", concept: "residential_region", en_literal: "Seoul",
          kind: "categorical", polarity: "include" },
        { surface: "10대", concept: "age_group", en_literal: "teenagers",
          kind: "range", polarity: "include" }
      ],
      meta: { llmCalls: 0, skipReason: "cache", retryInput: false }
    };
    ep.putNlCache(nl, seeded);
    var r2 = ep.extractSlots(nl, cards);
    if (!r2 || !r2.meta || String(r2.meta.skipReason) !== "cache" ||
        Number(r2.meta.llmCalls) !== 0) {
      twFail("1e.enPivot", "seeded cache must hit, got " +
        JSON.stringify(r2 && r2.meta));
      return false;
    }
    var locked = ep.applyConceptLock(
      [{ surface: "서울", concept: "city_name", is_new: true }],
      cards
    );
    if (!locked || !locked[0] || String(locked[0].concept) !== "residential_region") {
      twFail("1e.enPivot", "concept lock must keep residential_region, got " +
        (locked && locked[0] ? locked[0].concept : "null"));
      return false;
    }
    if (!locked[0].conceptAliases || locked[0].conceptAliases.join(",") !== "city_name") {
      twFail("1e.enPivot", "alias city_name missing, got " +
        JSON.stringify(locked[0].conceptAliases));
      return false;
    }
    var pipe = ep.toPipelineSlots(seeded.slots);
    if (!pipe || !pipe.length || String(pipe[0].text || "") === "") {
      twFail("1e.enPivot", "toPipelineSlots must keep surface as text");
      return false;
    }
    var open = ep.scanM1("판교요금제 쓰는 고객", cards);
    if (!open || open.covered) {
      twFail("1e.enPivot", "unknown value must not be M1-covered");
      return false;
    }
      twPass("1e.enPivot", "M1 slots + glue drop + en_literal keep + cache seed + concept lock");
    return true;
  } catch (e) {
    twFail("1e.enPivot", "must not throw: " + String(e.message || e));
    return false;
  }
}

// 1f. #174-3 — {db,en} 바인딩은 db. 이미 en 있으면 enrich 0콜. LLM 없음.
function twStepDomainEn() {
  var fc = testWoo.fragContract;
  var ep = testWoo.enPivot;
  if (!fc || !fc.entryDb || !ep || !ep.enrichDomainEn) {
    twFail("1f.domainEn", "entryDb/enrichDomainEn missing");
    return false;
  }
  try {
    var wrapped = {
      _source: { schema: "woo:t", xpath: "@sRegion", concept: "residential_region" },
      sRegion: {
        type: "string",
        nlMap: { "서울": { db: "서울", en: ["Seoul"] } }
      }
    };
    if (String(fc.entryDb(wrapped.sRegion.nlMap["서울"])) !== "서울") {
      twFail("1f.domainEn", "entryDb must return db");
      return false;
    }
    var hit = fc.domainMatchSlot(wrapped, "서울");
    if (!hit || String(hit.value) !== "서울") {
      twFail("1f.domainEn", "domainMatchSlot must bind db, got " +
        (hit ? JSON.stringify(hit.value) : "null"));
      return false;
    }
    var params = fc.resolveNlParams(wrapped, "서울사는", { sRegion: 1 });
    if (!params || String(params.sRegion) !== "서울") {
      twFail("1f.domainEn", "resolveNlParams must use db, got " +
        JSON.stringify(params));
      return false;
    }
    var sql = fc.sampleBindSql("SELECT {{sRegion}} AS v", wrapped);
    if (String(sql).indexOf("서울") < 0) {
      twFail("1f.domainEn", "sampleBindSql must substitute db, got " + sql);
      return false;
    }
    var enr = ep.enrichDomainEn(wrapped);
    if (!enr || Number(enr.llmCalls) !== 0 || enr.skipped !== "fresh") {
      twFail("1f.domainEn", "already-en must skip LLM, got " +
        JSON.stringify(enr && { llm: enr.llmCalls, skip: enr.skipped }));
      return false;
    }
    var merged = fc.mergeParamDomainJson(
      { _source: { concept: "residential_region", conceptAliases: [] } },
      { _source: { schema: "woo:t", xpath: "@sRegion" }, sRegion: { nlMap: { "부산": "부산" } } }
    );
    if (!merged || !merged.domain || !merged.domain._source ||
        String(merged.domain._source.concept) !== "residential_region") {
      twFail("1f.domainEn", "merge must keep locked concept");
      return false;
    }
    twPass("1f.domainEn", "{db,en} bind=db · enrich skip · concept lock");
    return true;
  } catch (e) {
    twFail("1f.domainEn", "must not throw: " + String(e.message || e));
    return false;
  }
}

// 1g. #174-4 — M1/M2/M3 · ambiguous · _negative TTL · heal 쿨다운. LLM 없음.
function twStepEnMatch() {
  var fc = testWoo.fragContract;
  if (!fc || !fc.matchEnPivotSlot) {
    twFail("1g.enMatch", "matchEnPivotSlot missing");
    return false;
  }
  try {
    var domain = {
      _source: {
        schema: "woo:t", xpath: "@sRegion",
        concept: "residential_region", tier: "enum"
      },
      sRegion: {
        type: "string",
        nlMap: {
          "서울": { db: "서울", en: ["Seoul"] },
          "인천": { db: "인천", en: ["Incheon"] }
        }
      }
    };
    var m1 = fc.matchEnPivotSlot(domain, { text: "서울", surface: "서울" });
    if (!m1 || m1.layer !== "M1" || String(m1.value) !== "서울") {
      twFail("1g.enMatch", "M1 Seoul failed " + JSON.stringify(m1));
      return false;
    }
    var m2 = fc.matchEnPivotSlot(domain, {
      text: "셔율", surface: "셔율", en_literal: "Seoul",
      concept: "residential_region", kind: "categorical"
    });
    if (!m2 || m2.layer !== "M2" || String(m2.value) !== "서울") {
      twFail("1g.enMatch", "M2 Seoul via en failed " + JSON.stringify(m2));
      return false;
    }
    var m3 = fc.matchEnPivotSlot(domain, {
      text: "판교요금제", surface: "판교요금제", en_literal: "Pangyo plan",
      concept: "residential_region", kind: "categorical"
    });
    if (!m3 || m3.layer !== "M3") {
      twFail("1g.enMatch", "M3 concept miss-value failed " + JSON.stringify(m3));
      return false;
    }
    var ambDom = {
      _source: { concept: "plan_name", tier: "enum" },
      plan: {
        nlMap: {
          "Y": { db: "Y_PLAN", en: ["plan", "youth"] },
          "Z": { db: "Z_PLAN", en: ["plan", "zip"] }
        }
      }
    };
    var amb = fc.matchEnPivotSlot(ambDom, {
      text: "요금제", en_literal: "plan",
      concept: "plan_name", kind: "categorical"
    });
    if (!amb || !amb.ambiguous) {
      twFail("1g.enMatch", "M2 ambiguous expected, got " + JSON.stringify(amb));
      return false;
    }
    var ageDom = {
      _source: { concept: "customer_age", tier: "range" },
      ageMin: { type: "int", enum: [10, 20, 30, 40] },
      ageMax: { type: "int", enum: [20, 30, 40, 50] },
      _bucket: {
        nlMap: {
          "10대": { db: { ageMin: 10, ageMax: 20 }, en: ["teens", "10s"] },
          "20대": { db: { ageMin: 20, ageMax: 30 }, en: ["twenties", "20s"] }
        }
      }
    };
    var nDae = fc.matchEnPivotSlot(ageDom, {
      text: "30대", surface: "30대", en_literal: "in their 30s",
      concept: "customer_age", kind: "range"
    });
    if (!nDae || nDae.ambiguous || !nDae.value ||
        Number(nDae.value.ageMin) !== 30 || Number(nDae.value.ageMax) !== 40) {
      twFail("1g.enMatch", "N대 30~40 expected, got " + JSON.stringify(nDae));
      return false;
    }
    var nSpan = fc.matchEnPivotSlot(ageDom, {
      text: "10대~30대", surface: "10대~30대", en_literal: "teens to 30s",
      concept: "customer_age", kind: "range"
    });
    if (!nSpan || !nSpan.value ||
        Number(nSpan.value.ageMin) !== 10 || Number(nSpan.value.ageMax) !== 40) {
      twFail("1g.enMatch", "10대~30대 must bind 10~40, got " + JSON.stringify(nSpan));
      return false;
    }
    var nRes = fc.resolveNlParams(ageDom, "10대~30대 고객", { ageMin: 1, ageMax: 1 });
    if (!nRes || Number(nRes.ageMin) !== 10 || Number(nRes.ageMax) !== 40) {
      twFail("1g.enMatch", "resolveNlParams 10대~30대 must be 10~40, got " +
        JSON.stringify(nRes));
      return false;
    }
    var now = new Date().getTime();
    var marked = fc.markNegative(domain, "판교요금제", now);
    if (!fc.isNegative(marked, "판교요금제", now)) {
      twFail("1g.enMatch", "isNegative must be true within TTL");
      return false;
    }
    if (fc.isNegative(marked, "판교요금제", now + 90000000)) {
      twFail("1g.enMatch", "isNegative must expire after TTL");
      return false;
    }
    var stamped = fc.stampHeal(domain, now);
    if (!fc.inHealCooldown(stamped, now + 1000)) {
      twFail("1g.enMatch", "heal cooldown should hold");
      return false;
    }
    if (fc.inHealCooldown(stamped, now + 700000)) {
      twFail("1g.enMatch", "heal cooldown should expire after 10min");
      return false;
    }
    var kindMiss = fc.matchEnPivotSlot(domain, {
      text: "x", en_literal: "nope",
      concept: "residential_region", kind: "range"
    });
    if (kindMiss && kindMiss.layer === "M3") {
      twFail("1g.enMatch", "kind mismatch must not be M3");
      return false;
    }
    twPass("1g.enMatch", "M1/M2/M3 · ambiguous · _negative TTL · heal cooldown");
    return true;
  } catch (e) {
    twFail("1g.enMatch", "must not throw: " + String(e.message || e));
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
  twStepExcludeUniverse();
  twStepNormalizeSlots();
  twStepParseMultiJson();
  twStepEnPivot();
  twStepDomainEn();
  twStepEnMatch();
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
