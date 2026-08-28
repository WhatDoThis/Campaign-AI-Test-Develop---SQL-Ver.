# 04 · Fragment 자동승인 [완료]

> **상태:** `[x]` 실 반영 완료 (구 4차 흡수 · 구 7차 Dedup **전용 node 미구현**)  
> **Studio UI:** 4차 범위에서 **미변경** 원칙 유지.

---

## 1. 범위

| 흡수 | 원 문서 | 구현 |
|---|---|---|
| 4차 | Fragment 자동승인 | `[x]` |
| 7차 | 중복 Fragment 관리 | **부분** — Foundry dedup + Fragments 목록만 (`[x]` dedup 판정 필드) |

**미반영(삭제):**  
- 7차 **Dedup 전용 navtree nodeModel** · 신규 JSSP 관리 화면  
- 승인 대기 큐 `awaiting_approval` 강제 전이(일반 슬롯)  
- near dedup **자동 병합 Write** · exact merge 자동 삭제

---

## 2. 구현 요약

### 2-A. 자동 active (FRAG-7-2)

- Foundry 게이트 통과 → publish **`status=active`** · **`active=true`**
- 킬스위치: Option 기반 `isAutoApprove()` — OFF 시 `verified` 경로 잔존
- near dedup: **승인 큐에 쌓지 않음** — dedup_verdict로 기록

### 2-B. dedup (스키마·Foundry)

`woo:testWooAiFragment` 필드 (Foundry·Repository 사용):

| 필드 | 용도 |
|---|---|
| `dedup_verdict` | near/exact/new 판정 |
| `dedup_match_id` | 상대 fragment id |
| `dedup_diff_count` | 대칭차 |
| `content_hash` / `key_column`+`scope_key` | L0/L1 후보 축소 |

Explorer: **`[WOO] Fragments`** nodeModel 목록 — status=active 기본.  
**별도 `[WOO] Fragments Dedup` 노드는 없음** (7차 UI 스펙 미구현).

### 2-C. navtree

- Fragments list: 4차 이후 주석 — `verified AND active=0` 승인대기 필터 **폐기**
- Request Queue · SQL History nodeModel **유지** (R8 정리 대상은 별도)

---

## 3. 핵심 자산

| 경로 | 역할 |
|---|---|
| `new_ver/js/testWooFoundry.js` | publish active · dedup · queue done |
| `new_ver/js/testWooLifecycle.js` | normalize · publish/revoke |
| `new_ver/js/testWooRepository.js` | fragment CRUD · approve 축소 |
| `new_ver/js/testWooFragments.js` | Stage A — **active** fragment만 |
| `new_ver/schema/testWooAiFragment.xml` | dedup_* · status |
| `new_ver/jssp/testWooAiFragmentReview.jssp` | 큐/리뷰 (최소) |
| `new_ver/navtree/testWooAiNavtree.xml` | Fragments list |

---

## 4. HUMAN·log

- 4차: 신규 Foundry frag `@status=active` · 재Generate compile OK
- SQL-First: Foundry 원자 헌법 **유지** · #174 계층에서 **개조** (`20` 판정)

---

## 5. 회귀 금지

- 게이트/feasibility 제거 후 전부 저장 금지
- Studio JSSP/html **4차 범위 UI diff** 금지(별도 UX 차수에서만)
- verified-only Stage A 회귀 금지
