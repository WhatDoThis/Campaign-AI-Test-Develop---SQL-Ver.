# 05 · 조건 · SQL 등록 · WKF 주입 [완료]

> **상태:** `[x]` 실 반영 완료 (구 5차·6차 흡수)  
> **여정:** SQL-First ST0~ST6 (`19`/`21` R6)이 본 구현을 **실행 정본**으로 이어받음.

---

## 1. 범위

| 흡수 | 원 문서 | 구현 |
|---|---|---|
| 5차 | 조건매칭·SQL 목록 | `[x]` (Match Option **OFF** 유지) |
| 6차 | SQL 주입·등록 | `[x]` |

**미반영(삭제):**  
- 5차 **95% 텍스트 유사도** · 임베딩 매칭 · `alert`/`confirm`  
- 5차 경로 A/B intent create/reuse (#147 **폐기** — SQL 목록 분기로 대체)  
- 6차 **J-9-5-2** 이미 열린 WKF 창 실시간 sync (**의도적 비구현**)  
- 폴더 전체 WKF 스캔 목록 (UI-3-5 위반 경로)

---

## 2. 구현 요약

### 2-A. Generate · Validate · Register (5차 FLOW-5-6)

- NL → `testWooAiGenerate.jssp` → plan → compile → gates
- `testWooAiValidate.jssp` · `testWooAiRegister.jssp`
- `woo:testWooAiSql`: `workflow_name` · `compile_hash` · `used_fragments` · `sql_query`

### 2-B. Match · dedup (5차 · #152 이후)

| mode | 동작 | 운영 |
|---|---|---|
| dedup | fragment 집합 **Jaccard ≥ 0.9** · exact hash 우선 | `[x]` repo |
| discover | value containment · intersection≥1 · Top-N | `[x]` repo |
| Option ON | `testWooAiMatchEnabled` | **OFF** (#152 오탐 · 운영자 승인 전 금지) |

- 동일 SQL: `sqlContentHash`/`compileHash` 정규화 후 **Register skip** + div 안내 (J-9-3-4)
- SQL 목록: **매칭/선택 WKF 기준** — 폴더 전체 WKF query 금지

### 2-C. WKF 주입 (6차 INJ-8-2)

`testWooWorkflowUi.js` · SOAP **ShellBind**:

| 항목 | 구현 |
|---|---|
| 출처 | registered `testWooAiSql.@sql_query` **서버 load만** (클라이언트 임의 SQL 금지) |
| Write | customActivity **script 본문** + `<ai-sql-id>` |
| 덮어쓰기 | **2단계 클릭** (`confirm` 금지) |
| Preflight | soft-lock · ShellProbe · 백업 스냅샷 |
| Open 게이트 | Register 성공 후에만 WKF 열기 enable |
| J-9-5-2 | **미구현** — 「열린 창 닫고 등록」UI 문구만 |

고객사 원안: 편집기에서 SQL **본문 가시** + ai-sql-id 병행 (2026-08-11 승인).

---

## 3. 핵심 자산

| 경로 | 역할 |
|---|---|
| `new_ver/js/testWooMatch.js` | dedup · discover |
| `new_ver/jssp/testWooAiMatch.jssp` | Match API |
| `new_ver/jssp/testWooAiRegister.jssp` | 등록 · hash skip |
| `new_ver/js/testWooRepository.js` | hash lookup · saveAiSql |
| `new_ver/js/testWooWorkflowUi.js` | ShellProbe · ShellBind · ShellPick |
| `new_ver/schema/testWooAiWorkflowUi.xml` | SOAP methods |
| `new_ver/workflow/testWooSampleCustomActivityContract.xml` | 액티비티 xpath 계약 |

---

## 4. HUMAN·log

- 5차: Jaccard 필드 · Register dedup · Match OFF 확정 (#152/#154)
- 6차/R6 (#322): 주입 후 WKF 재오픈 → 편집기 SQL 본문 + ai-sql-id
- SQL-First ST6: Register+Inject+Lock **한 트랜잭션**으로 **개조** (`20`)

---

## 5. 회귀 금지

- Match Option **AI가 ON 금지**
- `0.95` / 임베딩 cosine / LLM 유사도 판정 금지
- Spawn · J-9-5-2 폴링/강제 refresh 시도 금지
- 미등록·게이트 미통과 SQL inject 금지
