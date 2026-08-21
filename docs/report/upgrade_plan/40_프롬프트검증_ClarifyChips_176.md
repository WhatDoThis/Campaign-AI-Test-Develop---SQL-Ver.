# #176 — 프롬프트 검증 · Clarify Chips (P0)

> **상태:** `[~]` C1~C3 repo v=185 · **C4 HUMAN** · 전체 순서는 `41_완성로드맵.md` 파도 1  
> 선행: 없음. #308 N월 자동바인드와 **병행**. 1값이면 칩 없이 확정, 2값 이상·다른 축 모호만 칩.  
> AI가 HUMAN을 PASS로 자체 처리하지 않음. **이 문서만 읽고 구현.** LangGraph/LangChain 도입 금지.

원문: 2026-08-21 운영자. 실측 `7월` → Foundry `ambiguous` + 「특정 연도 / 매년」. 선택지가 슬롯 카드 안에만 있고, 눌러도 **입력창을 통째 덮어씀**.

---

## 0. 한 줄

모호하면 SQL을 멈추고, **질문창 위 버튼 ≤5개**로 보강한다. 부분 일치면 **합집합 칩 + 멤버**. 멤버 순서는 그 값이 들어 있는 행의 **수정일 → 생성일 → 없음**. 칩 클릭 = NL 보강 후 같은 Generate를 이어 돌린다.

---

## 1. 왜 (제품)

| 지금 | 있어야 할 것 |
|---|---|
| LLM이 연도 vs 매년을 물어 멈춤 | 닫힌 도메인이면 **값 버튼**. 연도 철학 질문 금지 |
| `alternatives`가 슬롯 카드 아래 | **NL 입력창 바로 위** |
| 칩 클릭 → `$("nl").value = detail` **치환** | **보강**(애매한 토큰만 구체 값으로) |
| 값 목록 순서 불명 | 시계 2개: **값 자체**(연월) 또는 **그 값 행의 수정/생성일**. 부분일치면 합집합 칩 먼저 |

SQL은 여전히 compiler. 칩은 plan을 직접 고치지 않는다.

---

## 2. 레퍼런스 → ACC에서 하는 일

LangGraph/LangChain은 ACC Rhino·JSSP에 올릴 수 없다. **패턴만** 가져온다.

| 출처 | 패턴 | 이 프로젝트 |
|---|---|---|
| [LangGraph interrupt](https://docs.langchain.com/oss/python/langgraph/interrupts) | 그래프 정지 → payload(질문+선택) → `Command(resume=값)`으로 재개 | 정지 = Generate/Foundry가 SQL 없이 `promptHints` 반환. 재개 = **같은 generatePlan을 보강 NL로 재호출**. 체크포인터 = Studio `state.nl` + 직전 응답. 프로세스 재개 없음 |
| [LangGraph HITL Get Input](https://langchain-ai.github.io/langgraph/concepts/human-in-the-loop/) | 모델이 컨텍스트를 더 요구 | LLM은 `ambiguous`만. **선택지 문장은 LLM이 만들지 않음** |
| [Cortex Analyst REST](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst/rest-api) | 모호하면 `sql` 대신 `suggestions[]`. 클릭 = 그 문장으로 재질의 | 동일. 다만 Cortex는 **새 질문 통째**. 우리는 **원문 보강** |
| [Cortex suggested questions](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst/suggested-questions-feature) | 제안 3~5개. VQR 있으면 검증된 질의만 | 상한 **5**. 값은 **probe/enum**. 없는 연도 제안 금지 |
| [Adobe Campaign enumerations](https://experienceleague.adobe.com/en/docs/campaign-classic/using/getting-started/administration-basics/managing-enumerations) | 닫힌 목록으로만 정규화 | 칩 value = 도메인 `db`만 |
| 이미 있는 코드 | `triage.alternatives` · `clarifyQuestion` · 큐 `@clarify_answers` · `clarifyMaxRounds` | 계약 확장. 신규 스키마 최소화 |
| 이미 있는 UI | `renderSlotResults` alt-chip (`testWooAiStudio.js` ~715) | **잘못됨(치환)**. #176이 정본. 카드 칩은 숨기거나 보강과 동일 함수 |

Queryfy/SQLMate “애매하면 되묻기”(39 상용화 갭)와 같다.

---

## 3. 제약 (위반 시 코드 되돌림)

- LangGraph, LangChain, fetch/Promise, ES6, flex/grid, `alert` 금지.
- LLM이 선택지 연도·값을 **창작** 금지. `probe_values` / `param_domain.enum` / nlMap db / `yearMonthHits`만.
- 칩이 `plan_json` / SQL을 직접 쓰지 않음. 클릭은 NL 보강 + Generate 재호출만.
- 값마다 `sqlSelect` 단건 금지. 감사시각은 **슬롯당 GROUP BY 1회**.
- Match Option ON 하지 않음.
- 도메인 few-shot을 EnPivot에 넣지 않음.

---

## 4. 계약

칩은 **컬럼 종류를 하드코딩하지 않는다.** `classifyField` tier(`enum|distinct|range|highCard|link|unknown`) + 이미 있는 도메인 스냅샷만 본다. 7월은 예시일 뿐, `year_month` 전용 분기를 만들지 않는다.

### 4-0. 운영자가 매번 알고리즘을 줄 필요 없는 규칙 4개

삼성·7월·전라도는 **예시**. 구현은 이 4줄만 따른다.

| # | 규칙 |
|---|---|
| 1 | NL 토큰이 닫힌 도메인에서 **2개 이상** 맞으면(부분·별칭·그룹) 칩. 1개면 바인드. 0개·highCard면 칩 없음 |
| 2 | 맞으면 **합집합 칩을 맨 앞** (`삼성 전체` = 그 히트 IN, #175와 동일). 그다음 멤버 |
| 3 | 멤버 정렬 시계: **(가)** 값이 날짜/연월이면 값 내림 **(나)** 아니면 그 값이 붙은 행의 `수정일 MAX` → 없으면 `생성일 MAX` → 둘 다 없으면 probe/enum 순. 회사명 전용 아님 |
| 4 | 칩 1개 고르면 surface를 `patch`로 바꾸고 **같은 Generate를 이어서** 돌린다. 다음 슬롯이 모호하면 칩, 전부 매핑되면 SQL |

`retryInput` · `highCard` · `link` · 도메인 0개 → 칩 없음.

종 B(컬럼 2개) · 종 C(버킷만)는 위 1~4의 특수 경우. 컬럼 칩은 값 목록이 아니라 컬럼 라벨.

### 4-1. 서버 → 클라 `promptHints`

Generate 실패·Foundry 슬롯 판정·unresolved 공통. **화면 전체 칩 수 ≤ 5** (슬롯이 여러 개여도 합산. 앞 슬롯 우선).

한 라운드에 **슬롯 1개**만 칩 (문장 앞쪽 미해결부터). 화면 ≤5 = 합집합 1 + 멤버 ≤4.

```
promptHints: [
  {
    slotId: "s1",
    surface: "삼성",
    kind: "value" | "column" | "bucket",
    tier: "enum" | "distinct" | "range" | "boolean",
    options: [
      { label: "삼성 전체", patch: "삼성 전체", value: ["삼성전자","삼성전기","삼성물산"], union: true },
      { label: "삼성물산", patch: "삼성물산", value: "삼성물산" }
    ]
  }
]
```

- `union:true` → compiler는 #175처럼 `IN (members)`. `_group`을 카탈로그에 저장하지 않음 (이번 요청만).
- 후보 1개면 칩 없이 바인드.
- `year_month` 같은 도메인 고유 `reason` 금지.

### 4-2. 후보 · 두 시계 · SQL 1회

후보 집합은 기존 스냅샷(enum / probe / `_group` / 연월 히트). **부분 문자열·별칭**으로 걸러 2개 이상이면 칩.

**시계 A — 값이 시간:** YYYY-MM·날짜면 그 문자열 내림. 행 감사시각 불필요. (`7월` → 2026-07, 2025-07)

**시계 B — 값은 범주, 행에 감사시각:** 같은 스키마에서 type=datetime 속성을 찾는다. 이름에 `modified`/`lastModified` 있으면 1순위, `created`면 2순위, 없으면 3순위(정렬 스킵).  
슬롯당 `sqlSelect` **한 번**:

`SELECT <값컬럼>, MAX(<수정>), MAX(<생성>) FROM <표> WHERE <값컬럼> IN (…) GROUP BY <값컬럼>`

값마다 SELECT 금지. 감사 컬럼이 없으면 probe/enum 순.

**합집합 칩:** 히트가 2개 이상이면 맨 앞. 라벨 = `{surface} 전체`. patch = `{surface} 전체`. value = 히트 db 배열. #175 `IN`과 같다. `전라도`는 이미 `_group`이 있으면 그걸 합집합으로 쓰면 됨.

예시(스키마·값은 가정, 코드에 삼성 금지):

| 값 | 수정일 |
|---|---|
| 삼성전자 | 2025-01 |
| 삼성전기 | 2026-02 |
| 삼성물산 | 2026-03 |

NL `삼성 기업 고객` → 칩 `삼성 전체` · `삼성물산` · `삼성전기` · `삼성전자`.  
`삼성물산` → `삼성물산 기업 고객`. `삼성 전체` → `삼성 전체 기업 고객`.

### 4-3. NL 보강 + 이어 생성

1. `orig`의 `surface` 첫 등장만 `patch`로. 없으면 끝에 붙임. 이미 있으면 no-op.
2. 보강한 NL로 **Generate를 즉시 재호출** (첫 질의만 사용자가 [생성]).
3. 다음 미해결 슬롯이 있으면 칩. 전부 매핑되면 SQL. `clarifyMaxRounds` 초과 시 칩 중단.

### 4-4. 언제 칩을 띄우나 (요약)

| 조건 | 칩 |
|---|---|
| 닫힌 후보 **1개** | 없음. 그 값으로 바인드 |
| 닫힌 후보 **2개 이상** | 합집합 1 + 멤버(시계 정렬) · 합 ≤5 |
| 후보 > snapshotCap / highCard | 없음 |
| 컬럼 후보 2개 이상 | 컬럼 라벨 ≤5 |
| `retryInput` · 컬럼 0개 | 없음 |

`clarifyMaxRounds`(Env, 기본 2) 넘기면 칩 숨기고 문구만.

---

## 5. 단계

| ID | 내용 | 파일 | DoD |
|---|---|---|---|
| C0 | 조사. 본 문서 | — | `[x]` 이 파일 |
| C1 | `buildPromptHints` · 규칙 1~4 · 슬롯당 감사 GROUP BY 1회 | `testWooFragContract.js` | `[x]` 스모크: (1) 월+두 연월 → 값 내림 (2) 부분일치 3값 + 수정일 → 전체·최신·… 순. 값당 SELECT 0 (3) 감사컬럼 없음 → 합집합+enum순 (4) highCard → 빈 배열. 전용 함수 없음 |
| C2 | unresolved / Foundry에 `promptHints`. union은 요청 단위 IN | Generate.jssp · Foundry · QueueStatus | `[x]` JSON 배열. 감사 SQL은 슬롯당 1회 |
| C3 | `#nlHints` NL 위. 클릭=보강+Generate 재호출 | Studio.jssp + StudioJs + html 미러 | `[x]` v=185. 카드 치환 칩 제거 |
| C4 | HUMAN | — | 월 1건 + 부분일치 범주 1건(합집합 칩) |

스키마 신규 없음. `@clarify_answers`는 선택(로그용). 없어도 C1~C3 가능.

---

## 6. UI (클릭)

```
[ 삼성 전체 ] [ 삼성물산 ] [ 삼성전기 ] [ 삼성전자 ]   ← 합집합 먼저, 그다음 수정일
[ 삼성 기업 고객                                        ]
[생성]   ← 첫 질의만. 칩 클릭 후엔 자동 재생성
```

- 노란 부트와 겹치지 않음.
- embed/IE: `span` + 클릭. flex 금지. 기존 `.alt-chip` 스타일 재사용 가능.
- 힌트 없으면 `#nlHints` 비움.

---

## 7. HUMAN 테스트 (구현 후)

```
테스트
A. 연월: 연이 여러 개인 월. 칩=연월 내림. 클릭 → SQL에 그 YYYY-MM.
B. 부분일치 범주: 접두가 값 3개. 칩 첫칸=`{토큰} 전체`, 나머지=수정일 내림(없으면 생성일, 둘 다 없으면 임의 고정순).
   `전체` 클릭 → NL에 `{토큰} 전체` · SQL IN 3값. 한 회사 클릭 → 그 이름만.
C. 칩 클릭 후 다음 모호가 있으면 칩이 바뀜. 없으면 SQL. 합 ≤5.
회신: PASS/FAIL + 보강 전후 NL + SQL. A·B 둘 다.
```

닫힌 후보가 1개면 칩 없음(#308과 동일). highCard 문장에 칩이 뜨면 FAIL.

---

## 8. 하지 말 것

- LangGraph 서버 신설, Python 에이전트, 브라우저 LLM.
- 칩으로 Foundry 큐를 resume(체크포인트 재개). 항상 **새 generate**.
- 「매년 7월」 LIKE 옵션을 기본 제공. 운영자가 원문 수정할 때만.
- `year_month` / 삼성 / 지역 / 요금제 **전용** 함수·예시 하드코딩.
- 값마다 SELECT. 감사시각은 슬롯당 GROUP BY 1회만.
- 다음 키와 파일 섞기(#175-5, R6).
