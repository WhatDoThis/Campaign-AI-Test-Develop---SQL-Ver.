# #172 — FragContract 공유 계약

> Foundry / Fragments / Feasibility / Dedup / Compiler가 복제하던  
> **슬롯↔색인↔매칭↔바인딩** 규칙을 `testWoo.fragContract` 한곳으로 수렴한다.  
> Cube/MetricFlow급 시맨틱 레이어는 비채택(ACC Rhino).

---

## 1. 왜

조건 축이 늘 때마다 Stage A 미스 · library 삼킴 · Dedup `__sample__` · unbound `{{param}}`가  
**연쇄**로 터진 것은 LLM 프롬프트 문제가 아니라 **계약 복제**다.

| 구멍 | 증상 |
|---|---|
| Match 필드 불일치 | Stage A 히트 ≠ Feasibility cover |
| 축 어휘 3개 | Pass0 category ≠ tags ≠ regex |
| sampleBind 복제 | Dedup peer에 `param_domain` 누락 |
| `_source` 비대칭 | 서가 히트만 provenance 요구 |

---

## 2. 모듈

`new_ver/js/testWooFragContract.js` → `testWoo.fragContract` (`__v=163`)

| API | 용도 |
|---|---|
| `axisFromSlot` / `axisFromCard` / `axesCompatible` | 축 정합 |
| `buildIndexFields` | publish synonyms·sample_questions |
| `matchProfile` / `scoreCard` / `keywordsFromSlot` | Stage A |
| `validateBind` / `attachAlias` / `mergeParamDomainJson` | 스키마 근거 검증·별칭 보완·도메인 merge |
| `coversSlot` / `libraryHitPredicate` | 재사용 = 서가 게이트(축 identity. 값 미등재≠신규 frag) |
| `normalizeParamDomain` / `domainMatchSlot` / `resolveNlParams` | 도메인 |
| `sampleBindSql` | Foundry gate + Dedup L3 **유일** |
| `logCode` / `errorCodes` | `FRAG_CONTRACT:<code>` |

---

## 3. 배포 순서

1. **testWooFragContract.js**
2. Fragments → Llm → Foundry → Compiler
3. loadLibrary 선행: Batch / DryRun / Smoke / Generate / Register / StudioContext

---

## 4. 신규 축 체크리스트

축을 추가할 때 **FragContract(+ Foundry SQL 템플릿)** 만 손댄다.

1. `axisFromSlot` regex / alias (`_axisAliasMatch`)에 축 키 추가
2. Foundry가 `{{param}}` + `param_domain`(+`_bucket`/`nlMap`)·`_source` 생성
3. `buildIndexFields`가 nlMap·bucket 키를 synonyms에 넣는지 확인(자동)
4. `sampleBindSql` type(int→0) 동작 확인
5. Smoke: Stage A hit → library 2회차 툴0 → compile bind

Stage A / Dedup / Feasibility에 **축별 패치 금지**.

---

## 5. HUMAN 검증

| ID | 절차 | 합격 |
|---|---|---|
| V1 | 가입일 NL 1회차 생성 후 2회차 | library hit · Stage A hit · 신규 frag 0 |
| V1b | 같은 tags/name 축 frag, nlMap에 없는 값 | Foundry 큐 없음 · 기존 frag 재사용 · param_domain에 별칭 merge · SQL 바인딩 |
| V2 | Dedup L3 | peer·후보 모두 typed sampleBind (consent int≠`__sample__`) |
| V3 | 실패 로그 | `FRAG_CONTRACT:` 코드 1줄로 단계 식별 |

---

## 6. 비범위

- MetricFlow/Cube 이식
- Foundry 큐/WF 라이프사이클 재설계
- Pass0 프롬프트만으로 계약 대체
