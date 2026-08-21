# PoC-V · 값 인식 매칭 타당성 조사 (#153)

> **AGENT_MODE · 조사 전용**. `new_ver/` 코드 변경 없음.  
> 일자: 2026-08-12 · 선행: #152 차단 완료  
> 사고: `22_매칭오탐_사고기록.md`

---

## 결론 (단정)

| # | 항목 | 판정 |
|---|---|---|
| (a) | plan에서 값 추출 가능 여부 | **가능** (`params` 객체) |
| (b) | 기존 등록 SQL에서 값 복원 가능 여부 | **조건부 가능** — `plan_json`+비어 있지 않은 `params`만. `used_fragments`만으로는 **불가**. 값 없는 레거시 = **값 매칭 불가** |
| (c) | `@param_domain` 기반 값 정규화(서울/서울시…) | **불가** (exact enum만 · code↔label 맵 없음) |
| (d) | 범위형 조건 비교 방식 | **집합 교집합 불가** — 현행은 exact 키. #154는 범위 포함 후보 **제외** 권고 |
| (e) | 레거시 데이터 처리 방침 | **매칭 제외**(값 없으면 목록 비노출). 재색인은 선택. 건수=**HUMAN_CONSOLE 대기** |

→ #154 착수 게이트: (a)=가능 → **착수 가능**. (c)=불가 한계를 화면·문서에 명시.

---

## V1. plan JSON 필드 · 값 위치

### [질문]
슬롯/fragment 원소 필드. 사용자 지정 값은 어디에?

### [확인된 사실]
**Pass1/client plan 루트:** `grainKey`, `include[]`, `exclude[]`, `unmatched[]`  
**원소 (`include[].any[]` / `exclude[]`):**
- `fragment` (논리명)
- `label` (표시)
- `params` (**값** — object. 스칼라 또는 배열)

계약에 없음: 원소의 `name`/`value`/`key_column`/`operator`.

### [근거]
- `new_ver/js/testWooLlm.js:161` OUTPUT 계약
- `new_ver/jssp/testWooAiGenerate.jssp:35-40` clientPlan
- 샘플 (`docs/main/PRD.md:192-203`):
```json
{ "fragment": "age_band", "params": { "min": 10, "max": 29 } }
```

### [미확인]
운영 DB `plan_json` 전수 스키마 확장 키.

---

## V2. used_fragments vs plan_json

### [질문]
값 저장·복원 경로.

### [확인된 사실]
- `used_fragments` = `{name, version, fragmentId}` **만** — 값 없음  
  (`testWooAiSql.xml:39`, `testWooCompiler.js:271-279`)
- 값은 `@plan_json`에 보존. `listAiSqlForMatch`가 `@plan_json` 로드  
  (`testWooRepository.js:360-382`)
- discover는 `plan_json` 파싱 후에만 value 집합 구성 (`testWooMatch.js:461-483`)

| 레코드 | 값 매칭 |
|---|---|
| `used_fragments`만 | **불가** |
| `plan_json` + params 있음 | **가능** |
| `plan_json` 공란/`params:{}` | **값 매칭 불가** (레거시) |

### [근거]
위 라인 + Register `plan_json: JSON.stringify(p.plan)` (`testWooAiRegister.jssp:75-80`).

---

## V3. @param_domain

### [질문]
허용값·코드 매핑·표기 변형 정규화.

### [확인된 사실]
구조(키별): `required`, `type`, `enum[]`(문자열 exact), `min`/`max`.  
Gates: `String(enum[i]) === String(val)` exact (`testWooGates.js:136-142`).  
code↔label / 동의어 접기: **런타임 없음**.  
Match `_normValue`: trim + toLowerCase만 (`testWooMatch.js:113-127`).

→ “서울/서울시/서울특별시” **정규화 불가**. 불일치 처리 + 한계 고지(#154).

### [근거]
`testWooAiFragment.xml:62`, Foundry `testWooFoundry.js:635-643`, 가드레일 도메인 하드코딩 금지.

---

## V4. @key_column

### [질문]
의미 · 동일 name 다른 컬럼.

### [확인된 사실]
- grain 물리 컬럼. plan `grainKey`와 불일치 시 컴파일 실패  
- 여러 fragment가 **같은** `key_column`을 공유하는 것은 정상  
- 동일 `name`의 버전 간 `key_column` 변경 가능 여부(운영 DB): **미확인**

Match의 `MATCH_KEY="name"`은 fragment **name**이지 `key_column`이 아님 (`testWooMatch.js:28`).

---

## V5. 값 자료형

| 형 | 표현 | 집합 비교 |
|---|---|---|
| 스칼라 | string/number → SQL literal | exact `key:value` |
| 다중(IN) | array → 정렬 join 후 키 | exact 집합 문자열 |
| 범위 | `min`/`max` 두 스칼라 | exact `min:…\|max:…` — **구간 겹침 연산 없음** |
| 불리언 | 1/0 | exact |
| 날짜 | 리터럴 문자열 | exact (상대시점 미사용) |

→ 범위형: #154에서 **후보 제외**(오탐보다 누락이 안전).

### [근거]
`testWooCompiler.js:193-219`, `testWooMatch.js:113-177`, PRD age_band 샘플.

---

## V6. sqlContentHash

### [질문]
값 포함? 100% 동일 판정 대체?

### [확인된 사실]
`sqlContentHash` = `_djb2(normalizeSql(compiledSql))` — **치환 후 SQL**이므로 리터럴 값 포함.  
Register 동일 WKF 중복 스킵에 사용. 스키마에 `sql_hash` 컬럼 없음(계산).

| 용도 | 판정 |
|---|---|
| 동일 정규화 SQL = “동일” 배지 | **가능** |
| fragment 집합 containment 대체 | **불가** |

### [근거]
`testWooLifecycle.js:36-42`, `:295-297`, `testWooAiRegister.jssp:47`.

---

## V7. 레거시 건수 (HUMAN_CONSOLE)

임의 추정 금지. 콘솔 절차:

1. `woo:testWooAiSql` · `@status='registered'` 전량(또는 export)
2. 컬럼: `@id`, `@workflow_name`, `@used_fragments`, `@plan_json`, `@creation_date`
3. 분류  
   - A: `plan_json` 공란/비JSON  
   - B: plan은 있으나 모든 원소 `params` 공란/`{}`  
   - C: 값 있는 params ≥1  
4. 보고: `|registered|`, `|A|`, `|B|`, `|C|`, 레거시=`|A|+|B|`

→ **HUMAN_CONSOLE 대기**

---

## 부록 · 서울/인천 오탐과 valueKey

discover는 이미 `name=`+정규화 params 복합키를 쓴다 (`testWooMatch.js:144-177`).  
`params:{}`이면 키가 `fragmentName=`으로 **붕괴** → 값 구분 실패.  
값이 채워진 `region:서울` vs `region:인천`은 키가 달라야 정상.  
#152 재현은 name-only 경로·params 공란 붕괴·단정형 UI가 결합된 P0로 기록됨.

---

## #154 입력 권고 (구현 지시 아님)

1. 복합키 = `fragmentName + "=" + normalizedValue` (params 기준)
2. 정규화: domain enum exact · 없으면 trim/lower만 · 표기 변형=불일치
3. 범위 포함 후보 제외
4. CONFLICT(값 불일치) 1건이라도 목록 제외
5. “포함” 문구 폐기 · 조건별 대조표
6. 레거시(값 없음) 비노출
7. Option ON은 C1~C6 + 사용자 승인 후에만
