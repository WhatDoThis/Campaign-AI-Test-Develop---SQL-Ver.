# 14 · 미구현 · DEFERRED · 로드맵

> **상태:** `[D]` / 선택 / **금지**  
> **흡수:** 구 `09` D · `41` §2 · `42` S-1 잔여 · `43` #178

명시 요청 또는 운영자 지정 **키 1개**만 착수. 신규 키 임의 추가 금지 (G6).

---

## A. DEFERRED (명시 요청 전 구현 금지)

| ID | 키 | 내용 | 가이드 근거 |
|---|---|---|---|
| #178 | Axis cold-start | feasibility **axis_proven** vs 값 feasible 분리 | `43` 전문 |
| CODemap | testWooAiCodemap | AGENTS deferred | log #318 |
| QUEUE-TTL | Foundry 큐 자동 삭제 | R8 운영절차만 | PoC-S S7 |

### #178 한 줄

Foundry triage가 축 증명·값 증명을 한 게이트에 묶음 → «전라도» FAIL은 **#175 M2G**와 별개 구조 이슈. codemap group은 #178 **후속** 후보.

---

## B. 선택 (여유 시)

| ID | 키 | 내용 |
|---|---|---|
| R8-S1 | Studio 잔재 | FOUC · `#hint` 중복 · diag v drift (`42` grep) |
| 8차 | embed 폐기 | `testWooExtendWorkflow` — **미실시** embed 유지 |
| 9차 | `_폐기` 콘솔 정리 | 미사용 asset — **미실시** |

---

## C. 금지 (`41` §2 — 하지 말 것)

| ID | 내용 |
|---|---|
| P6 | Funnel COUNT · Validate count API |
| G3 | #175 enum 삭제 실험 |
| R7-REL | compiler AddDays relative SQL |
| P2/P4/P5 | 해석 LLM 추가콜 · plan 칩 멀티턴 · 좋아요 |
| WF-INJECT-DEL | R8 Inject/Open/embed 폼 **지금** 삭제 |
| LLM-SQL | LLM free-form SQL |

---

## D. 보류 설계 (#43 채택 보류)

- generatePlan **동기** axis discovery (대형 DISTINCT 블로킹)
- `testWooAxisCatalog.js` 신규 (Stage A 이원화)

---

## E. 사용법

운영자가 `#178` vs `42` S-1 중 **1개** 지정 → 해당 섹션만 Chat에 첨부.
