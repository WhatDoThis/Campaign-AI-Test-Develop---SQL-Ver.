# #169 — Library-First (서가 우선)

> Active/`_source` frag가 있으면 **스키마 툴 0회**.  
> Triage가 서가를 안 읽고 `search_columns`만 태우던 실패를 막는다.  
> #168-A 스냅샷(도메인 수집)은 전제 · #168-B·#170은 범위 밖.

---

## 0. 0단계 결론 (실측)

| 항 | 결과 |
|---|---|
| 0-1 | `testWooFeasibility`에 Stage A 없음(과거). 라이브러리 히트는 Foundry `_tryLibraryCacheHit`만. |
| 0-2 | `woo__customer__region` / `woo__subscription__plan` — `_source`·nlMap·enum 완비(인천·Y요금제). 실패 원인≠도메인 공백. |
| 0-3 | `probe_values`는 논리/물리 컬럼 모두 수용. `ok:true`만으로 값 존재를 단정 금지 → `resultCount`. |

---

## 1. 변경 요약

| 모듈 | 내용 |
|---|---|
| `testWooFeasibility` | `libraryLookup` → Triage 진입 전 호출. 히트 시 `feasible`/`high`/`evidence.source=library`/툴 0. 미스만 LLM+toolkit. 컬럼 확인·값 미probe 시 `probe_values` 1회 강제 → 없으면 `value_not_found`+후보. |
| `testWooToolkit` | 요청 단위 `invoke` 캐시(동일 args 예산 미차감). evidence에 `resultCount`/`cacheHit`/`elapsedMs`. |
| `testWooFoundry` | `_tryLibraryCacheHit` → `feasibility.libraryLookup` 공유. stale 갱신·lifecycle 유지. triage `libraryHit`도 generate 스킵. |

---

## 2. Invariants

- 라이브러리 히트 시 `search_columns` / `describe_schema` / `probe_*` 호출 금지
- 컬럼명·enum 하드코딩 금지(스키마 메타·frag `_source`만)
- `ok:true` ≠ found — `resultCount`/`valueProbes`로 판정
- 2회차(V1): 동일 축·값 변형 NL → **신규 frag 0** · **스키마 툴 0**
- **#169-P0:** 단일축+`_source`만으로 히트 금지. 키워드 AND 커버 **또는** `param_domain` 값(nlMap/bucket)이 슬롯 텍스트에 있을 때만 히트 (타축 삼킴 차단)

---

## 3. 배포

순서: **Feasibility → Toolkit → Foundry** (Env/Config 변경 없음).

---

## 4. HUMAN 검증

| ID | 절차 | 합격 |
|---|---|---|
| V1 | 1회차에서 region/plan frag 존재 후, 같은 축 값 바꾼 NL 2회차 큐 | evidence: 스키마 툴 0 · created 0 · `library_cache_hit` |
| V2 | 서가에 없는 슬롯 | triage 경로로 탐색·(필요 시) 생성 |
| V3 | 동일 `probe_values` args 2회(요청 내) | 2회째 `cacheHit` · 예산 미증가 |
| V4 | 컬럼은 있는데 값 없음 | `value_not_found` + alternatives top-10 (확인 못 함→불가 금지) |

---

## 5. 비범위

- #168-B Generate `value_not_found` 바인딩
- #170 Pass0 슬롯 분할
- `plan.include empty` partial preview (증상)
