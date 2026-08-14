# #168-B — Generate 값 바인딩 (param_domain → plan.params)

> **상태: `[x]` 닫힘** (2026-08-14). #174-4가 params←`db` · unresolved 시 SQL 금지 · `en_literal` WHERE 금지를 흡수. 재구현 없음.  
> frag SQL은 `{{param}}` 템플릿. 컴파일 직전에 NL+`param_domain`으로 **결정적** 치환.  
> Pass1 LLM params만 믿지 않는다.

---

## 증상 (실측)

`Generate: [testWoo.compiler] fragment contract: unresolved {{param}} token name=woo__customer__age`

| 원인 | 내용 |
|---|---|
| A | `fragmentSqlContract`→`g1Syntax`가 템플릿 `{{` 자체를 거절 |
| B | Pass1이 `ageMin`/`ageMax`를 안 채움 · `_bucket.nlMap["20대"]` 미사용 |

gender frag 생성·triage feasible는 정상. **마지막 컴파일 단** 실패.

---

## 수정

| 모듈 | 내용 |
|---|---|
| Gates | 템플릿 검사 시 `allowParamPlaceholders`. 필수 param = sql_text의 `{{}}`만 |
| Compiler | `bindPlanParams` — NL/슬롯 vs nlMap·`_bucket` → `item.params` · `compile` 진입 시 호출 |
| Llm Pass1 | params 채우기 지시 + selectPlan 후 bindPlanParams |
| Dedup | sampleBind 잔여 `{{` 강제 치환(가짜 near 방지) |

---

## HUMAN

동일 NL 재생성 → SQL에 `iAge >= 20 AND iAge < 30`, `sGender = 'M'` 등 리터럴.  
`unresolved {{param}}` 없음.

## #174에서 닫을 것

| 항목 | 담당 |
|---|---|
| params ← M1/M2 히트의 `db` 값만 | #174-4 |
| `unresolved` 시 SQL 생성 금지 · Studio surface 표시 | #174-4 · V5 |
| 번역 `en_literal`을 WHERE에 직접 삽입 | **금지** |
