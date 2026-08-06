/*
 * testWooEnv.js (내장 튜닝·가드레일 상수 · server-side)
 * =====================================================
 * Git 버전관리 대상. 배포 후 값 변경 시 JS 라이브러리만 재등록하면 된다.
 * XtkOption은 시크릿 3개만: testWooAiLlmApiKey / Model / Endpoint
 *
 * [Main Functions]
 * ===========
 * - getEnv — ENV 상수 객체 반환 (런타임 변경 없음)
 *
 * [Dependencies]
 * =========
 * - loadLibrary("woo:testWooEnv.js") — testWooConfig.js보다 먼저
 */
var testWoo = testWoo || {};
testWoo.env = (function () {
  "use strict";

  var ENV = {

    /* ------------------------------------------------------------------
     * security — Studio JSSP API IP 게이트 (선택)
     * allowedCidr: 쉼표 구분 접두. 비우면 검사 안 함.
     *   권장: 내부망만 쓸 때 "10." 또는 "192.168." 등
     *   logon()이 127.0.0.1로 존을 우회하므로 API 보완용
     * ------------------------------------------------------------------ */
    security: {
      allowedCidr: ""
    },

    /* ------------------------------------------------------------------
     * guard — Stage A 검색·Pass0 슬롯 상한 (queryDef 페이지네이션)
     * ------------------------------------------------------------------ */
    guard: {
      // queryDef lineCount. 권장 5000, 가드 1~5000
      QUERY_PAGE_SIZE: 5000,
      QUERY_PAGE_SIZE_MAX: 5000,
      // Stage A 후보 fragment 상위 N. 권장 30, 가드 1~50
      STAGE_A_TOP_N: 30,
      STAGE_A_TOP_N_MAX: 50,
      // Pass0 최대 슬롯 수. 권장 40, 가드 1~40
      MAX_SLOTS: 40,
      // Stage A 최대 페이지 수. 권장 20, 가드 1~50
      MAX_SEARCH_PAGES: 20,
      // searchKeywords 토큰 길이 상한. 권장 32
      MAX_TOKEN_LEN: 32,
      // 슬롯당 searchKeywords 개수. 권장 8, 가드 1~20
      MAX_TOKENS: 8
    },

    /* ------------------------------------------------------------------
     * llm — 프로바이더·프록시·Pass0 힌트·토큰 상한 (비밀 제외)
     * provider: "openrouter" | "anthropic" (롤백)
     * useProxy: true면 HttpClientRequest.execute(true)
     * pass0Examples: Pass0 system에 붙는 도메인 키워드 예시 (비우면 생략)
     * pass0MaxTokens / pass1MaxTokens: 단계별 출력 상한.
     *   Pass0 는 슬롯 JSON 수십~수백 토큰이면 충분하다. 8192 로 두면 Gemini 간헐
     *   반복 루프가 그 상한까지 채워 과금·지연이 커진다 → Pass0 기본 2048.
     *   Pass1 은 후보 카드 전량 → 8192 유지. fragment 가 쌓이면 pass1 만 올린다.
     * repetitionGuardEnabled / frequencyPenalty: 반복 루프 억제.
     *   true + 0 초과일 때만 body에 frequency_penalty를 넣는다. 가드 0~1, 권장 0.3
     *   (0.1 은 json_object 제거 후에도 Gemini 간헐 반복을 못 막는 실측이 있었다)
     *   temperature는 0 유지(결정성 우선) — 0이 오히려 반복을 유도할 때가 있어 penalty로만 처리
     * ------------------------------------------------------------------ */
    llm: {
      provider: "openrouter",
      useProxy: false,
      pass0Examples: "",
      embedModel: "openai/text-embedding-3-small",
      embedEnabled: true,
      pass0MaxTokens: 2048,
      pass1MaxTokens: 8192,
      triageMaxTokens: 4096,
      foundryMaxTokens: 16384,
      repetitionGuardEnabled: true,
      frequencyPenalty: 0.3
    },

    /* ------------------------------------------------------------------
     * foundry — Fragment Foundry 비동기 생성
     * enabled: true = 미매칭 슬롯을 큐에 적재하고 WKF_testWooFoundry 배치가 생성한다.
     *   false면 큐 대신 기존 unmatched 오류 UI (LLM 과금 없음)
     * maxTurns: tool calling 루프 최대 턴. 권장 6, 가드 1~12
     * batchSize: WKF 한 번에 queued 처리 건수. 권장 3, 가드 1~10
     * maxNewFragments: 요청당 신규 INSERT 상한. 초과 시 needs_human_design
     * namespaces: toolkit(list_schemas/describe_schema/probe_values/search_columns) 허용 ns.
     *   테스트 범위는 woo 하나다. nms 를 열면 LLM 이 표준 스키마 50건을 훑다가 턴을 소진하고
     *   nms:common 같은 기술 스키마로 오답을 낸다(실측). cus 는 이 인스턴스에 0건이다.
     *   운영에서 nms:recipient 대상 fragment 가 필요해지면 그때 넓히고, 스모크 4·4b 의
     *   대상 스키마도 함께 표준 스키마로 되돌린다.
     * tokenBudget / dailyBudget: 비용 가드 (현재 Foundry에서 부분 미적용)
     * gateRetries: fragment 게이트 실패 시 LLM 자가수정 재시도. 권장 2
     * staleProcessingMinutes: processing 정체 레코드를 queued 로 되돌리는 기준(분).
     *   권장 30. WF 실행이 비정상 종료된 큐를 배치 시작 시 1회 복구
     * ------------------------------------------------------------------ */
    foundry: {
      enabled: true,
      maxTurns: 6,
      batchSize: 3,
      maxNewFragments: 3,
      namespaces: "woo",
      tokenBudget: 60000,
      dailyBudget: 500000,
      gateRetries: 2,
      staleProcessingMinutes: 30
    },

    /* ------------------------------------------------------------------
     * triage — SQL 생성 전 실현가능성 판정 (03 스펙)
     * enabled: false면 Foundry가 triage 없이 바로 SQL 생성
     * maxTurns: 슬롯당 tool calling 턴 상한. 권장 6, 가드 2~12
     *   마지막 턴은 tool_choice:"none" 으로 판정 JSON 을 강제한다(턴 소진 실패 방지).
     *   턴이 모자라면 판정 대신 "tool loop exceeded" 가 나므로 근거 조사량에 맞춘다.
     * minConfidence: "high"|"medium"|"low" — medium 미만이면 SQL 생성 금지
     * clarifyMaxRounds: ambiguous 재질의 상한 (슬롯당). 권장 2
     * partialExecutionAllowed: partially_infeasible 시 미리보기 SQL 허용
     * valueProbeLimit: probe_values DISTINCT 기본 limit. 권장 50, max 200
     * valueProbeCardinalityCap: COUNT(DISTINCT) 초과 시 값 목록 생략. 권장 10000
     * ------------------------------------------------------------------ */
    triage: {
      enabled: true,
      maxTurns: 6,
      minConfidence: "medium",
      clarifyMaxRounds: 2,
      partialExecutionAllowed: true,
      valueProbeLimit: 50,
      valueProbeLimitMax: 200,
      valueProbeCardinalityCap: 10000
    },

    /* ------------------------------------------------------------------
     * dedup — L3 near 판정: 대칭차집합 / 모집단 비율 상한
     * nearThreshold: 권장 0.01 (1%). 가드 0.001~0.05
     * ------------------------------------------------------------------ */
    dedup: {
      nearThreshold: 0.01
    },

    /* ------------------------------------------------------------------
     * toolkit — LLM tool calling 요청당 호출 상한 (OWASP LLM06)
     * totalCallBudget: 요청 전체. triage+generate 합산 상한. 권장 40
     * triageCallBudget / generateCallBudget: 단계별 상한 (setPhaseBudget).
     *   산출: triage ≈ maxTurns(6) × ~2콜, generate ≈ maxTurns(6) × attempts(3)
     * ------------------------------------------------------------------ */
    toolkit: {
      totalCallBudget: 40,
      triageCallBudget: 12,
      generateCallBudget: 24,
      probeSqlBudget: 8,
      probeValuesBudget: 6,
      searchColumnsBudget: 8
    },

    /* ------------------------------------------------------------------
     * probe — sqlSelect 프로브 타임아웃·샘플
     * timeoutMs: 권장 30000. 가드 5000~60000
     * sampleLimit: probe_sql 샘플 행. 권장 20, max 100
     * ------------------------------------------------------------------ */
    probe: {
      timeoutMs: 30000,
      sampleLimit: 20
    },

    /* ------------------------------------------------------------------
     * populationCountSql — 전체 모집단 COUNT SQL. 두 곳에서 분모로 쓰인다.
     *   1) G-C 게이트: fragment 결과가 모집단의 95% 이상이면 실패(필터 효과 없음)
     *   2) dedup near 판정: symmetricDiff / 모집단 비율
     * 비우면 두 검사 모두 생략된다(G-C 는 결과 0건만 검사, dedup 은 near+사람 위임).
     * 예: SELECT COUNT(*) FROM testWooSampleCustomer
     * 물리 컬럼명은 ACC 버전·DBMS 마다 다르므로 COUNT(DISTINCT col) 대신 COUNT(*) 권장.
     * ------------------------------------------------------------------ */
    populationCountSql: ""
  };

  // 1. ENV 상수 반환
  function getEnv() {
    return ENV;
  }

  return { getEnv: getEnv, ENV: ENV };
})();
