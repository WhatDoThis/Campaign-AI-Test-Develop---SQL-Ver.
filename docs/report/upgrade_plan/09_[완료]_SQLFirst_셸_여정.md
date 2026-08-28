# 09 · SQL-First 셸 · 여정 [완료]

> **상태:** `[x]` ST0~ST6 · R0~R8 repo + HUMAN (#322/#333)  
> **흡수:** `16` 포인터 · `19` · `21` · `20` · `27`(해소분) · `22`(Match OFF 요약)

추적표 정본: [`docs/report/11_고도화_추적표.md`](../11_고도화_추적표.md)

---

## 1. 여정 (ST0~ST6)

조건 먼저 → SQL 목록 → Program → Campaign → WKF → Register/Inject.

| 상태 | 역할 | 반영 |
|---|---|---|
| ST0 | NL 입력 · Generate | `[x]` 즉시 입력 (폴더 선행 게이트 **폐기**) |
| ST1 | 유사 SQL Top-10 · draft 병합 | `[x]` discover · twStudioCache |
| ST2 | SQL 확정 | `[x]` registered / 미반영 배지 |
| ST3~ST5 | Program → Campaign → WKF | `[x]` `testWooWorkflowClone.js` |
| ST6 | 락→ShellBind→saveAiSql→열기 | `[x]` R6 HUMAN #322 |

- intent create/reuse: **폐기** — 목록 분기만
- 분기 A: 신규 SQL → ST3~6 · 분기 B: 기존 SQL → program/campaign/wkf **점프**
- 캐시: Register 전 `testWooAiSql` **미기록** · session/memory probe (`R2`)

---

## 2. R차수 (구현 완료)

| 키 | 내용 | 상태 |
|---|---|---|
| R0 | SQL-First 전환 문서·SUPERSEDED 배너 | `[x]` |
| R1 | discover Top-10 · intersection≥1 | `[x]` (#154 흡수) |
| R2 | twStudioCache · 휘발 | `[x]` v=156 |
| R3 | ST0~ST6 상태머신 | `[x]` v=157 |
| R4 | SQL 목록 셸 · [등록] | `[x]` v=160 |
| R5 | ST3~5 API 연결 | `[x]` |
| R6 | 커밋 트랜잭션 · strict lock | `[x]` #322 |
| R7 | relative/absolute **배지** | `[x]` compiler **동결** |
| R8 | E2E · funnel dead 제거 · 큐 운영절차 | `[x]` #333 |

---

## 3. 핵심 자산 (유지·개조)

| 자산 | 판정 |
|---|---|
| `testWooWorkflowClone.js` | 유지 — ST5/ST6 |
| `testWooMatch.js` / Match.jssp | 개조 — dedup+discover · **Option OFF** |
| `testWooAiStudio*.jssp` + html/js | 개조 — ST0~6 · orphan/UX는 `08` |
| `testWooAiRegister.jssp` | 개조 — ST6 commit |
| `testWooAiGenerate.jssp` | 유지 — `plan_only` |
| `testWooExtendWorkflow.xml` embed | 유지 — 8차 폐기 **미실시** |

---

## 4. Match OFF (#152)

name-only Jaccard → 서울/인천 **오탐** · 단정형 「포함」 UI.  
#154 discover repo 완료 · **`testWooAiMatchEnabled=false` 유지** · C1~C6 → `13`.

---

## 5. 스펙 드리프트 (해소만)

| ID | 내용 |
|---|---|
| D-1 | SQL-First 여정 반전 — **정본** |
| D-2 | discover Top-10 · intersection≥1 — **R1 해소** |

---

## 6. 회귀 금지

- 캠페인 선지정 입력 게이트 복원
- intent UI 복원
- Match Option AI ON
- Register 없이 Generate DB Write
