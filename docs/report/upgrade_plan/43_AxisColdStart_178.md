# #178 — Axis Cold-Start (Feasibility Verdict 분리)

> **상태:** `[ ]` DEFERRED — **파도3 이후.** 선행: 파도1·파도2 종료 + **회귀조사(A) 결론** 확정.  
> **전제 (첫 줄):** 본 차수는 「전라도가 안 되는 원인」이 **아니다.** log **#257** (2026-08-13) HUMAN PASS · log **#315** rescue 구현 존재 → 이번 FAIL(#318)은 **회귀/환경** 조사 대상. #178은 **별개의 구조 개선**(장기).

---

## 1. 문제 정의 (1개)

Foundry/feasibility **triage verdict**가 다음을 **한 게이트**에 묶는다.

| 증명 종류 | 의미 | 현재 |
|---|---|---|
| **축 증명** | `describe_schema` + `probe_values`로 컬럼·enum 존재 | triage evidence에 쌓임 |
| **값 증명** | 슬롯 literal(예: «전라도»)이 DISTINCT에 있음 | `feasible` / `no_value` 판정 |

슬롯 literal이 없으면 **`no_value` → `canProceed: false`** (`testWooFeasibility.js:636`, `testWooFoundry.js:1760-1778`) → **`generateFragmentForSlot` 미실행** → 축 카드(`woo__table__axis`) INSERT 불가.

**#178 핵심:** verdict에 **`axis_proven`**(축만 증명)을 분리하고, 값 미일치는 **generatePlan M2G/M2C**(#175) 또는 별도 group tier로 넘긴다. Foundry는 **축 skeleton mint**와 **값 feasible**을 다른 분기로 처리.

---

## 2. 근거 (외부 · 실재 확인)

| 출처 | 요지 | 상태 |
|---|---|---|
| [arXiv 2606.31041](https://arxiv.org/html/2606.31041) (SMQ) | LLM → 중간 표현 → **결정론적 컴파일**. raw schema 직접 SQL 금지 | 유지 |
| [Wren MDL / generate-mdl](https://docs.getwren.ai/oss/concepts/what_is_mdl) | DB inspect → **semantic scaffold** 후 NL→SQL | 유지 |
| [Oracle OCI NL2SQL semantic enrichment](https://blogs.oracle.com/cloud-infrastructure/enterprise-nl2sql-with-semantic-enrichments) | offline semantic store + online schema linking 분리 | 유지 |

### PRD codemap (DEFERRED) — log 근거

- Log **Index 최대 #318**. 「#3808」 참조 **없음** (삭제).
- Log **Body** `4. 2026-07-31` (Index 아님): 「codemap raw(자동 적재) / group(수기)」 확정 · `ai_codemap` 스키마 설계.
- `new_ver/schema/testWooAiCodemap.xml` **미구현** · AGENTS.md·`01_개발가이드` **DEFERRED** 명시.
- #178과의 관계: codemap **group** tier는 상위어 alias; **축 cold-start**는 Foundry verdict 분리가 선행. codemap 부활은 #178 **후속** 후보.

### repo 내부 (grep 확인)

| 심볼 | 파일:라인 | 역할 |
|---|---|---|
| `resolveDomain` | `testWooToolkit.js:1009` | describe+probe → `param_domain._source` (+ enum) |
| `checkSourceFreshness` | `testWooToolkit.js:1295` | ttl / schemaFingerprint → stale·orphaned |
| `_markFragmentLifecycle` | `testWooFoundry.js:1033` | stale→deprecated, orphaned→revoked, `active=false` |
| `_rescueAxisCard` | `testWooLlm.js:344` | **기존** `pack.cards`에서 axesCompatible 카드만 선택 — **축 mint 아님** |

---

## 3. 채택 보류 (삭제 아님 · 사유)

### 3-a. generatePlan 내 sync axis discovery

**사유:** `probe_values`는 `COUNT(DISTINCT)` 스캔(`testWooToolkit.js` classify/probe 경로). 운영 대형 컬럼에서 Studio **동기 블로킹**. Foundry **비동기 큐** 설계(`testWooEnv.js` foundry.enabled)와 정면 충돌.

### 3-b. `testWooAxisCatalog.js` 신규 모듈

**사유:** Stage A 검색 소스가 fragment library + catalog **2개** → `pipeline-contracts.md`·#172 계약 변경. `41` §1 「다시 만들지 말 것」 범위 침범. verdict 분리만으로도 Foundry 경로 내 축 mint 가능.

---

## 4. #178 범위 (구현 시 · DEFERRED)

1. `testWooFeasibility.applyDemotionRules` / `triage`: `axis_proven` verdict 추가.
2. `testWooFoundry.processQueueItem`: `axis_proven` → `mintAxisSkeleton` (sql_text IN 템플릿 + `_source`) → **generatePlan 재시도** 또는 큐 complete 후 사용자 재입력.
3. `testWooLlm._rescueAxisCard`: 문서화 — **library 전제** 유지 vs mint 연동은 별 결정.
4. HUMAN: 빈 region 서가 + «전라도» + «서울» regression.

---

## 5. 회귀조사(A)와의 경계

| 항목 | A (지금) | #178 (나중) |
|---|---|---|
| `rescue` 미발동 | **pack.cards에 region 축 없음** → rescue 설계 한계 (#315 smoke는 **픽스처 카드** 전제) | axis_proven mint로 서가 공백 완화 |
| log #316 | **_negKey 수정과 rescue 동일 커밋** `3fb0811` — rescue 무력화 가설 **기각** | — |
| log #257 PASS | 당시 **region 축 카드 존재** (UNION 전남/전북) | 환경 재구성 후 카드 미복구 |

---

## 6. 다음 키

**회귀조사(A) 결론 대기** → (b) 카드 전제 확인 시 **명령문 B**(서울 bootstrap HUMAN) 또는 (c) 카드 소실 원인 환경 조치 → 파도1 닫기 → 파도2.
