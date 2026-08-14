# #175 — 값 확장 (Group Expansion)

> **상태:** `[~]` G1/G2/G4/G5/G6 PASS · 4단계 [x]흡수 · G3 미실시 · 다음=5단계 verified UI  
> 선행: `#174-4` M1~M3 · `#174` V6 repo+HUMAN 교차(복사 배포)  
> AI가 HUMAN을 PASS로 자체 처리하지 않음.

원문: 2026-08-13 관리자 아이디어(채팅). 0단계 D1~D4는 같은 날 코드 조사.

---

## 0. 왜

`전라도`는 `sRegion` enum에 없다. 지금은 Foundry/Pass1이 **같은 region frag를 두 번** 묶어 `UNION 전남/전북`을 만든다. 칩이 `전라도 거주` 두 장으로 보이고, `=` 템플릿에 배열을 넣으면 SQL이 깨진다.

목표: 상위어 1슬롯 → 도메인 멤버 N개 → **한 frag** `IN (…)` / exclude는 기존 EXCEPT.

---

## 1. 제약 (위반 시 코드 되돌림)

- ES5 + Rhino. 외부 번역/사전 API 금지.
- 지역명·요금제명 **코드 하드코딩 금지** (스모크 픽스처만 허용).
- LLM 멤버는 **CANDIDATES 부분집합**만. 밖 값 생성 금지.
- 바인딩은 항상 `db`. `en_literal`을 WHERE에 쓰지 않음.
- 스키마 XML 변경 금지. `_group`은 `param_domain` JSON만.
- 기존 `nlMap` 키 삭제 금지.
- G5는 `NOT IN`으로 컴파일러를 바꾸지 않음. exclude = **EXCEPT** (현행 CNF).

### 정책 (G4 개정 · 2026-08-14)

닫힌 후보에만 바인딩. 자식이 **후보에 없으면** 상위 1개로 편입. **있으면** 자식만. 0개·2개 이상·불확실은 거절.

근거(검색):
- Adobe Campaign **Closed enum + Alias cleansing** — 입력은 기존 enum 값으로만 정규화. 새 값 생성 금지. ([Manage enumerations](https://experienceleague.adobe.com/en/docs/campaign-classic/using/getting-started/administration-basics/managing-enumerations))
- Kimball **finest/atomic grain** — 데이터가 있는 가장 구체적 레벨에 묶고, 그 레벨이 없으면 상위(rollup)만. ([Keep to the Grain](https://www.kimballgroup.com/2007/07/keep-to-the-grain-in-dimensional-modeling/))

코드에 전라도/판교/경기 사전 없음. LLM이 CANDIDATES 안에서만 부모를 고름.

---

## 2. 0단계 결과 (코드 수정 없음 · 완료)

| ID | 결과 |
|---|---|
| D1 | `ambiguous:true` → `_resolveEnPivotSlot` 461–475 `unresolved`. `_healSlotValue` 400은 ambiguous 거부. `_matchCard`/`_attachLexiconCandidates`는 `hit.layer`만 봐 **ambiguous도 카드 히트**(1단계 전 수정 후보). Studio 751 문구. smoke 1g. |
| D2 | 라이브 `sql_text`는 저장소에 없음. Foundry 예시는 `sRegion = {{region}}`. 컴파일러 배열은 쉼표 join만 (`testWooCompiler.js` 256–260). `=` + 배열 = 깨진 SQL. |
| D3 | `sampleBindSql` 814–850 스칼라. `resolveNlParams` 899–900 객체 스킵. `validateBind` **947** 배열 skip. |
| D4 | `_enHit` 662–672 양방향 부분문자열. log.md에 `_enHit` 오탐 기록 없음. |

실측(HUMAN, #175 전): `전라도 사는 남성` → UNION 전남/전북 ∩ M. 게이트 PASS. 칩 라벨 중복.

---

## 3. 단계

### 1단계 — categorical `IN({{param}})` 통일 ([x] HUMAN G6)

값 1개도 `IN`. 라이브 `=` 는 컴파일 시 승격. Foundry 신규는 IN.  
HUMAN 2026-08-13: 서울 IN('서울')∩IN('M') · 인천 IN∩age 범위 · Z_PLAN IN('Z_PLAN'). age는 `>=`/`<` 유지.

### 2단계 — `param_domain._group` ([x] 읽기 · HUMAN G6 재확인 2026-08-14)

형상: `_group.<param>.<alias> = { members[], src:llm|human, verified, en[] }`.  
`collectLexicon` / `domainMatchSlot` / `buildIndexFields` / `resolveNlParams` / `mergeParamDomainJson`가 읽음.  
멤버는 **현재 enum/nlMap 후보 교집합**만 바인딩(Gone 값은 탈락). nlMap 키 삭제 금지.  
라이브 `_group` 쓰기는 3단계.

### 3단계 — M2G(캐시) → M2C(LLM) ([x] G1/G2/G4/G6)

판정 `members ⊆ CANDIDATES` 재검증. 실패 `_negative` + `ambiguous_group`(Pass1 UNION 금지). heal 쿨다운은 M2C에 재사용하지 않음(같은 축 다른 별칭 차단 방지). 삽입점: `_resolveEnPivotSlot` M2 ambiguous / M3 miss / 후보-only empty.

HUMAN 2026-08-14: `전라도 거주` 칩 1장 `IN ('전남','전북')` ∩ `IN ('M')`. 재입력 화면 동일. 서울 IN 유지.  
G4 정책(2026-08-14 개정): Adobe Alias cleansing + 차원 finest-grain.  
자식이 **현재 후보에 없으면** 상위 후보 1개로 편입(칩 `판교 → 경기`는 이 경우 PASS).  
자식이 **후보에 있으면** 그 값만(저장된 상위 무시). 토큰 경계는 유지. 지명 사전 하드코딩 없음.

HUMAN 2026-08-14 G4: `판교도` → `(판교 → 경기)` · `IN ('경기')`. G1/G6 SQL 재확인 PASS.  
칩 제목 `거주 지역 조건 (전남)`은 첫 멤버 표시. params/SQL은 `전남,전북` — 5단계 라벨 후보.

### 4단계 — `_enHit` 단어경계 토큰 ([x] G4에 흡수)

부분문자열 오탐 축소. `_enHit` exact/토큰만. HUMAN G4 재확인으로 잔여 닫음.

G5: exclude-only는 include를 비운다. 컴파일러가 exclude `sql_text`의 FROM으로 grain universe를 만들고 `EXCEPT` 1회. `NOT IN` 금지. 신규 universe fragment 없음.  
HUMAN 2026-08-14: `전체 대상` EXCEPT `IN ('서울')`. 게이트 3통과. 칩 EXCEPT만.

### 5단계 — Studio `verified:false` 확인 UI

승인 시 `src:"human"`, `verified:true`.

---

## 4. 검증

| ID | 합격 | HUMAN |
|---|---|---|
| G1 | `전라도에 사는 남성 고객` → region `IN ('전북','전남')` + gender frag 별도. 칩 1장(전라도) 또는 멤버가 보이게 | **PASS** 2026-08-14 재확인 `IN ('전남','전북')` ∩ `IN ('M')`. 칩 제목 `(전남)` · params 전남,전북 |
| G2 | 동일 문장 재입력 **groupExpand 0** (M2G 캐시). Pass1은 유지 | **PASS** 화면/SQL G1과 동일. 저널 원문은 없음 |
| G3 | 전남 없으면 members `['전북']` + 부분커버 경고 | 미실시. 당일 `판교→경기`는 이 항목이 아님 |
| G4 | 자식∉후보 → 상위 1개 편입. 자식∈후보 → 자식만. 토큰 경계 유지 | **PASS** 2026-08-14 `판교도` → `IN ('경기')` · 칩 `(판교 → 경기)` |
| G5 | `서울 빼고` → EXCEPT (NOT IN 강제 아님) | **PASS** 2026-08-14 universe EXCEPT `IN ('서울')`. NOT IN 없음 |
| G6 | 서울 / Z_PLAN 단일값 회귀 | **PASS** 2026-08-13 · 2026-08-14 재확인 `IN ('서울')` ∩ `IN ('M')` |
| G7 | grep 지역/요금제 리터럴 하드코딩 0 | repo 0건 |

---

## 5. 1단계 착수 전 검수 (디버그 예방)

1. 기존 `woo__customer__region` sql_text가 `=`이면 IN으로 안 바꾸면 배열 바인딩 시 SQL 문법 실패.
2. gender `sGender = {{gender}}`도 categorical. 1개 IN도 동작해야 함 (`IN ('F')`).
3. `validateBind` 947 배열 skip을 풀지 않으면 IN 멤버 검증이 비어 있음.
4. `_matchCard` ambiguous=성공은 M2C 전에 고치지 않으면 잘못된 카드로 heal.
5. 전라도를 코드/프롬프트에 쓰지 말 것. 후보는 probe enum만.

---

## 6. Chat 한 줄

```
차수: #175 5단계 verified UI
가이드: docs/report/upgrade_plan/38_값확장_GroupExpansion_175.md
선행: 배포 추가 없음 (177/162 유지). G5 PASS
모드: 구현 · `_group` verified:false 확인 · 승인 시 src=human
금지: 전라도/전북/판교 하드코딩 · Match Option ON · R6 · 컴파일러 NOT IN
```
