# 02 · 베이스라인 · Studio 진입 [완료]

> **상태:** `[x]` 실 반영 완료 (구 0차·1차 흡수)  
> **후속:** SQL-First `21` R2~R3이 셸·캐시를 이어받음. 본 문서는 **당시 구현 사실**만 기록한다.

---

## 1. 범위

| 흡수 | 원 문서 | 구현 |
|---|---|---|
| 0차 | 베이스라인 안정화 | `[x]` |
| 1차 | 진입점과 셸 | `[x]` |

**미반영(삭제):** 0·1차의 미완 DoD 체크리스트·Agent 실행 프롬프트·롤백 절차 장문.

---

## 2. 구현 요약

### 2-A. ACC 회귀 방지 (0차)

- WF 확장 폼 `testWooExtendWorkflow.xml`: Reload/Apply **colspan** 정합 (#141)
- Studio JSSP: **`v=`** 캐시 리트머스 · no-cache 헤더
- 클라이언트: **Rhino/IE-safe** — `fetch`·`Promise`·`flex`/`grid`/`vh`/`var(--)` 금지 (#133/#134/#135)
- 폼 스크립트: `FormatDate`/`GetDate` 금지 (#137)
- **#133/#135/#137/#141 되돌리기 금지** (가드레일 유지)

### 2-B. Studio 진입 (1차)

| 항목 | 결과 |
|---|---|
| Tools → Test Woo AI Studio | `[x]` PoC-0 **PASS** — `view`/`viewType` 유지 + `rights` |
| WF Targeting embed (`embed=1`) | `[x]` urlViewer 경로 **유지** (8차 embed 폐기는 **미실시**) |
| 셸 골격 | `[x]` 정보바 + 좌(AI) + 우(목록) table 레이아웃 |
| navtree | `[x]` `woo:testWooAiNav` · Explorer Fragments/SQL History |

PoC-0 FAIL 분기(`testWooAiStudioLauncher` + `form=` command)는 **미사용** — PASS 경로만 반영.

---

## 3. 핵심 자산

| 경로 | 역할 |
|---|---|
| `new_ver/input_form/testWooExtendWorkflow.xml` | WF 캔버스 embed · Apply/Bind |
| `new_ver/jssp/testWooAiStudio.jssp` | Studio 마크업 · `v=` |
| `new_ver/jssp/testWooAiStudioJs.jssp` | 클라이언트 (JSSP 동기) |
| `new_ver/html/testWooAiStudio.js` | html 동기본 |
| `new_ver/navtree/testWooAiNavtree.xml` | Tools command · Explorer nodeModel |

---

## 4. HUMAN·log

- 0차: embed 흰화면 없음 · `v=` 가시 · colspan (#141)
- 1차: Tools 메뉴 · 3분할 셸 · embed 회귀
- PoC-0: 2026-08-11 PASS (`05`/`06` 실측 → 본 통합본에서 절차 삭제)

---

## 5. 회귀 금지

- Studio URL **`v=`** 누락 = stale 클라이언트
- 금지 API/CSS 재유입 시 0차 FAIL과 동일 취급
- embed 경로 삭제·8차 역패치는 **별도 차수** — 본 완료 범위 아님
