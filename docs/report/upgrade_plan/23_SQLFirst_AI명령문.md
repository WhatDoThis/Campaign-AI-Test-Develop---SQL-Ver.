# SQL-First · AI 명령문 정본 (#145R~#151R · #174)

> Chat에서 `@docs/report/upgrade_plan/00_INDEX.md` + 라우팅 키만 말해도 되지만,  
> **세부 구현 지시**는 아래 블록을 해당 Chat에 그대로 붙인다.  
> `new_ver/` 변경은 feat 브랜치 · 문서 커밋과 혼합 금지.

| 키 | 명령 | 상태 |
|---|---|---|
| PoC-S | #145R | [x] 문서 완료 · S8 HUMAN만 [ ] |
| (문서) | #146R | [x] 19/20/21/27/INDEX/추적표 |
| R0 | 전환준비 | [x] 문서 · S8 회신만 [ ] |
| **P0** | #152 | [x] repo·배포 · HUMAN 확인[ ] |
| PoC-V | #153 | [x] `24_[완료]_PoC-V_값인식매칭.md` |
| **#154** | 값매칭 | [x] repo+배포 · C1~C6=`26_…` HUMAN[ ] · Option[ ] |
| **#155** | 임베딩 | [x] OFF+영속화 코드 · true는 스모크+승인[ ] |
| **다음 (추출)** | **#174** 0단계 조사 | `37_…` · 코드 금지 |
| **#170 / #168-B / #172** | 재개 | #174 닫을 때까지 `[ ]` |
| **다음 (셸)** | R5 배포 HUMAN 후 **R6** | 추출 우회 금지 |
| R1 | #147R | **[S] 단독 스킵 → #154 흡수** (Match OFF 중 R1 금지) |
| R2 | #148R | [x] repo v=156 · S8 HUMAN confirm [ ] |
| R3 | #149R | [x] repo v=157 · 배포/Tools입력 [`H`] |
| R4 | #149R 셸 | [x] repo v=160 · HUMAN SQL목록 |
| R5 | 매핑 | [~] repo v=162 · 배포[`H`] |
| R6 | #150R | [ ] · 추출 우회 금지 |
| R7/R8 | #151R | [ ] Chat 분리 |

상태 정본: `01_진행판.md`

---

## #145R — PoC-S · SQL-First 타당성 (읽기 전용)

산출물: `18_[완료]_PoC-S_SQLFirst타당성.md` — **작성 완료**. 재실행 시 코드 변경 금지·사실 갱신만.

---

## #146R — 로드맵 재설계 (문서 전용)

산출물: `19`/`20`/`21`/`27` · SUPERSEDED · 추적표 열 — **작성 완료**.

---

## #147R — R1 · 매칭 승격

```
[#147R — R1 · 매칭 승격 (탐색 주경로화)]
선행: #146R 완료.
대상: new_ver/js/testWooMatch.js , new_ver/jssp/testWooAiMatch.jssp

설계 근거 (문서에 인용)
  Jaccard 는 교집합 크기 측정에 편향되어 큰 집합이 penalize 된다.
  대안은 containment = |Q∩X| / |Q| (Q = 사용자 입력 조건 집합).
  http://www.vldb.org/pvldb/vol9/p1185-zhu.pdf
  https://ekzhu.com/datasketch/lshensemble.html
  용어는 학계 표준어 containment 로 통일한다(coverage 등 조어 금지).

작업 1 — 지표 추가 (기존 jaccard 함수 유지 · 삭제 및 수정 금지)
  containment(setQ, setX) 신규 추가.
  반환에 intersectionCount / queryCount / candidateCount 포함.
  ES5 집합 연산만 사용. 임베딩 · 벡터 · MinHash · 외부 라이브러리 금지
  (500건 규모에서 근사 색인은 불필요하며 정확 계산으로 충분).

작업 2 — 모드 분리
  matchByPlan(plan, campaignId, opts) 에 opts.mode 추가.
  mode="dedup" (기본값 · 미지정 시 현행과 100% 동일 동작 보장)
    Jaccard >= JACCARD_THRESHOLD(0.9) 유지. 임계·정렬·응답 필드 변경 금지.
  mode="discover" (SQL-First 목록의 주경로)
    전 후보 containment 계산.
    정렬: containment 내림차순 → jaccard 내림차순 → name 오름차순.
    DISCOVER_TOP_N = 10 상수 선언 후 상위 10건만 반환.
    비율 기반 하한 임계값을 두지 말 것.
    유일한 컷오프는 intersectionCount >= 1.
    사유: containment 임계는 집합 크기 분포에 종속되어 고정 상수로 정당화 불가하며,
          목록이 메인 화면이 되는 구조에서 높은 임계는 상시 0건을 유발한다.
  ※ "유사도 95% 이상만 노출"은 채택하지 않는다. 대신 100% 동일(정규화 SQL 해시 일치)
     항목에만 "동일" 배지를 부여해 사용자가 구분하게 한다.
  ※ 현행 #147 코드의 containment==1.0 · Top-20 은 정본과 불일치(D-2) — 본 차수에서 교정.

작업 3 — 값 인식 (#145R/PoC-M 에서 값 필드 존재 확인됨: plan.params)
  MATCH_KEY 유지한 채 복합키 집합 병행 생성: name + "=" + 정규화 value.
  discover 응답에 nameContainment / valueContainment 동시 제공.
  dedup 모드의 키 구성은 절대 변경 금지.

작업 4 — 엔드포인트
  testWooAiMatch.jssp 가 payload 의 mode 를 통과. 미지정 시 "dedup".
  requireRight("testWooAiSqlGenerate") 현행 유지.
  discover 응답: items[].containment, items[].jaccard, items[].intersectionCount,
  items[].queryCount, items[].candidateCount, items[].nl_request, items[].isIdentical,
  기존 enrichment(program/campaign/workflow/locked/locked_by) 유지.

금지
  JACCARD_THRESHOLD 0.9 변경 금지. 텍스트 LIKE 검색·임베딩 도입 금지.
  Spawn · alert/confirm · fetch/Promise/classList/forEach · flex/grid/vh 금지.
  #133/#135/#137/#141 회귀 금지. FormatDate 금지.

DoD
  mode 미지정 결과가 변경 전과 동일(회귀 0).
  Q 3개 / X 11개 / 교집합 3 → containment 1.0 · jaccard 약 0.27 · discover 최상단.
  Q 11개 / X 3개 / 교집합 3 → containment 약 0.27 · 하위 랭크.
  교집합 0 → 목록 제외. 후보 12건 → 정확히 10건 반환.
```

---

## #148R — R2 · 캐시 계층

```
[#148R — R2 · 캐시 계층 (미반영 SQL 보관)]
선행: #147R 완료 + #145R S8/S9 결론 확보.
      S8 이 HUMAN_CONSOLE 대기 상태면 구현하지 말고 사용자에게 확인 요청 후 중단.

원칙
  미반영 SQL 은 woo:testWooAiSql 에 기록하지 않는다.
  기록 시점은 오직 반영(ST6) 성공 순간이다.

작업 1 — 저장처 결정 (조사 결과에 따름 · 추측 구현 금지)
  1순위: sessionStorage (S8 에서 가용 확인된 경우).
         urlViewer 리로드 후에도 동일 세션에서 유지되어 캐시 유실을 막는다.
  2순위: JS 전역 객체 (sessionStorage 불가 시).
         이 경우 리로드로 캐시가 소실됨을 12_PoC-S 와 13_여정정본 에 한계로 명시하고,
         화면에 "새로고침 시 임시 SQL 이 사라질 수 있음" 안내를 상시 노출한다.
  키 네임스페이스는 twStudioCache 로 고정하고 스키마 버전 필드를 포함한다.

작업 2 — 캐시 레코드 구조
  { cacheId, createdAt, nl_request, plan, sql, usedFragments, sqlHash, status:"draft" }
  cacheId 는 클라이언트 생성 임시 식별자이며 DB id 와 혼동되지 않게 접두어를 붙인다.

작업 3 — 생명주기 구현
  브레드크럼 이동 · 뒤로가기: 캐시 유지. 목록 재렌더 시 캐시 항목을 상단에 병합 표시.
  초기화: 캐시 전체 삭제 후 ST0 복귀.
  창/콘솔 종료: 별도 처리 없이 휘발(sessionStorage 특성 또는 전역변수 소멸).
  반영 성공: 해당 cacheId 항목 삭제.

작업 4 — 목록 병합 규칙
  캐시 항목은 "미반영(임시)" 배지와 함께 서버 매칭 결과 위에 표시.
  캐시 항목은 매칭 코퍼스가 아니므로 containment 수치를 계산·표시하지 않는다.

작업 5 — 큐 잔여물 정책
  #145R S7 결과가 "잔여물 발생"이면 정리 정책을 13_여정정본 에 문서화한다.
  구현이 필요하면 R8 로 미루고 이번 차수에서는 문서화만 한다.

금지
  미반영 SQL 을 DB 에 insert 하는 어떤 경로도 만들지 말 것.
  localStorage 사용 금지(휘발 요구와 충돌).
  ES6 문법 · JSON 미지원 환경 가정 없이 JSON 사용 전 가용성 확인.
```

---

## #149R — R3/R4 · 상태머신 · 셸

한 Chat에 R3만, 다음 Chat에 R4. 전문은 사용자 원문 `#149R` 블록과 동일 — `15` R3/R4 절 참고.

핵심: ST0~ST6 · 입력 즉시 활성 · 단일 목록 패널 · SQL 카드 · 브레드크럼 · litmus v= · embed 회귀.

---

## #150R — R6 · 커밋 트랜잭션

전문은 사용자 원문 `#150R`과 동일.  
S6 결론(확정): 동일 SQL 다중 WKF = **신규 행**. soft-fail로 반영 금지.

---

## #151R — R7/R8 · 상대시점 · 정리

한 Chat에 R7, 다음 R8. 전문은 사용자 원문 `#151R`과 동일.  
relative/absolute 용어만. Duplicate* 미확인 시 createWkfFromTemplate 폴백.

---

## #174 — EN-Pivot Canonical Layer (트랙 A · 최우선)

정본: `37_ENPivot_CanonicalLayer_174.md`. 아래 블록을 해당 Chat에 그대로 붙인다.  
**지금 Chat은 0단계만.** 1단계 이후는 0단계 보고 HUMAN 승인 후.

```
[#174] EN-Pivot Canonical Layer — 번역 기반 param 추출/매칭 전면 전환

■ 배경
표층 한국어 문자열이 유일한 매칭 좌표계라서 조사/어미 사전(JOSA_TAIL,
NOISE_WORD, stemToken, isNoiseResidue)이 무한 증식 중이다. 조사·어미
조합은 유한하지 않으므로 손코딩은 구조적으로 실패한다.
동시에 DB 값은 영어(STUDENT, Y_PLAN)인데 입력은 한국어라, nlMap은
이미 사실상 한→영 번역표다. 이를 LLM 번역으로 대체·자동화한다.

운영 요구:
(R1) 스키마·속성이 사전에 정해지지 않음 → 특정 컬럼명/값 하드코딩 전면 금지
(R2) frag 생성 이후 새 데이터가 추가됨 → 도메인 자가치유 필요
(R3) 해결 못 한 슬롯이 조용히 사라지면 안 됨 → 명시적 abstain 필요

■ 0단계 (조사만. 코드 수정 금지)
D1. testWooFragContract.js 전문에서 다음을 파일:함수:라인으로 보고
    - JOSA_TAIL / NOISE_WORD / stemToken / isNoiseResidue 정의 위치와 참조처
    - 한국어 값 리터럴(지역명·성별 등) 또는 컬럼명이 코드에 박힌 곳 전부
D2. testWoo.llm 이 structured output(tool calling / JSON schema 강제)을
    지원하는가? 지원하면 호출 시그니처, 미지원이면 "미지원"만 기재.
D3. frag 생성 응답에 최상위 JSON 이 2개 이상일 때 _fragDocFromLlm 이
    어떻게 동작하는지 실제 코드 경로로 설명 (추정 금지).
D4. param_domain heal 의 현재 트리거 조건과 갱신 범위.
D5. 위 5개 보고 전에는 어떤 파일도 수정하지 말 것.

■ 1단계 (출력 계약 고정) — D2/D3 결과 반영
- fragment 생성은 슬롯 1개당 JSON 1개. 산문/표/경고문 금지를 프롬프트 명시.
- 응답의 최상위 JSON 객체를 열거하여 2개 이상이면 파싱 실패로 죽이지 말고
  첫 번째 채택 + extra_fragment_dropped 로그 + 나머지 축은 미처리 슬롯으로 반환.
- structured output 지원 시 스키마 강제 경로 우선.

■ 2단계 (EN Pivot 추출) — 신규 testWooEnPivot.js
translateAndExtract(nlText, candidateCards) → 단일 LLM 호출, 출력 고정 스키마:
{ en: "<전체 영역 영문 번역>",
  slots: [{ surface, concept, en_literal, kind, polarity }] }
- concept 은 영어 snake_case canonical (예: residential_region, age_group, gender).
  후보 카드에 concept 이 있으면 그중에서 고르고, 없으면 신규 제안 + is_new:true.
- en_literal 은 값의 영문 표현. 원문 값은 surface 에 보존.
- 해당 없으면 slots 에서 빼지 말고 concept:null + reason 으로 명시 (R3).
- temperature 0. 실패 시 예외로 배치를 죽이지 말고 slots:[] + 로그.

■ 3단계 (도메인 EN 사전화) — param_domain 확장, 스키마 변경 금지
컬럼당 1회, distinct/enum 값 전체를 한 번에 번역해 아래 형태로 저장:
  "<원문키>": { "db": <실제 DB 값>, "en": ["<별칭1>","<별칭2>"] }
- en 은 배열(복수 별칭 허용). fare/plan 류 모호성은 둘 다 넣어 해소.
- range tier 는 값 대신 버킷 라벨을 번역 (10대→["teenager","teens","10s"]).
- _source 에 concept, enRefreshedAt, enModel 기록.
- 기존 nlMap 키는 삭제하지 말고 병존(하위호환).

■ 4단계 (매칭 + 자가치유 + abstain)
매칭 순서(위에서 걸리면 종료):
  M1 원문 literal ⊂ NL           (기존 domainMatchSlot, 최우선·무료)
  M2 en_literal 이 param_domain.en 배열과 일치/포함
  M3 concept 일치 + kind 호환    (값은 미해결로 남김)
치유(R2): M1~M3 전부 실패 시
  → 해당 컬럼 1개만 probe_values 재실행 (컬럼 단위 쿨다운 기본 10분)
  → 새 값 발견 시 param_domain merge + EN 번역 추가 후 즉시 재매칭
  → 그래도 없으면 _negative[값] = timestamp 기록 (TTL 기본 1일, 만료 후 재시도)
abstain(R3): unresolved[] 로 반환. reason 은 아래 3종만.
  concept_not_found / value_not_in_domain / ambiguous
Studio 는 unresolved 를 원문 surface 와 함께 표시. 임의 보정·삭제 금지.

■ 5단계 (한국어 사전 제거)
2~4단계가 V1~V5 통과한 뒤에만 JOSA_TAIL / NOISE_WORD / stemToken /
isNoiseResidue 및 지역명·성별 하드코딩을 제거한다. 먼저 지우지 말 것.

■ 제약
- 수정 허용: new_ver/js/testWooFoundry.js, testWooFragContract.js,
  testWooFragments.js, 신규 new_ver/js/testWooEnPivot.js
  (testWooLlm.js 는 0단계 보고에 명시 후 HUMAN 승인)
- ES5 + Rhino (화살표함수/let/const/템플릿리터럴/map/forEach 금지)
- 외부 번역 API 금지. 기존 연결된 LLM만 사용.
- 스키마 XML 변경 금지. param_domain JSON 안에서만 확장.
- 컬럼명/스키마명/한국어 값 하드코딩 금지 (grep 0건이어야 함 · 5단계 후)
- 번역 결과를 DB 바인딩에 직접 쓰지 말 것. 바인딩은 항상 db 필드의 원본 값.

■ 검증
V1 "서울에 사는 10대 고객" / "서울에 거주하는 10대들" / "서울 10대 사람" /
   "서울사는 10대 회원" / "서울살이하는 10대"
   → 5건 모두 동일한 slots(region=서울, age_group=10대) 추출. 신규 frag 0건.
V2 "서울에 사는 Z요금제 쓰는 20대 남성 고객"
   → frag 4개(region/plan/age/gender) Active, JSON parse error 0건, unresolved 0.
V3 V2 재실행 → 신규 0, library hit 4, LLM 번역 호출 0(캐시 히트).
V4 DB에 신규 지역값 1건 삽입 후 그 값으로 요청
   → probe_values 1회 재실행 → param_domain 자동 merge → SQL 생성 성공.
V5 존재하지 않는 값("판교요금제") → unresolved 1건,
   reason=value_not_in_domain, _negative 기록, SQL 생성 안 함.
V6 grep: 한국어 값 리터럴/컬럼명 하드코딩 0건. (5단계 후)
V7 비용 실측은 부록. 게이트 아님. 생략 가능.

■ 산출물
0단계 보고(D1~D5) → 승인 후 diff 요약 → V1~V6 결과표 → docs/log.md 추가.

보고는 결론 3줄 우선. 근거 표는 그 아래로.
확인 못 한 것은 '확인 불가' 라고만 쓰고 추정으로 채우지 마라.
```

