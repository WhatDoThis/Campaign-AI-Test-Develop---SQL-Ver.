# 06 · PoC 조사 결론 (코드 반영분) [완료]

> **상태:** `[x]` 조사 완료 · 결론이 **repo에 반영된 항목만** 기록  
> **흡수:** `17` PoC-M · `18` PoC-S · `24` PoC-V (조사 전용 원본 삭제)

조사 시점 코드 변경 없음. 아래는 **이후 구현으로 확정·반영된 사실**만 남긴다.

---

## 1. plan · Generate · Register

| 사실 | 반영 |
|---|---|
| plan 원소 = `fragment` + `label` + **`params`** (값) | `[x]` Match discover · Register `plan_json` |
| Generate 필수 = `nl_request`만 (서버) | `[x]` SQL-First ST0 |
| **`plan_only`** — compile/gates/큐 스킵 | `[x]` `testWooAiGenerate.jssp` · discover |
| SQL DB 기록 = **Register 시점만** (`saveAiSql`) | `[x]` Generate는 JSON만 |
| `@workflow_name` nullable · wf별 hash dedup | `[x]` Register · orphan SQL |

---

## 2. Match (dedup / discover)

| 사실 | 반영 |
|---|---|
| dedup = fragment **name** 집합 · Jaccard ≥ 0.9 | `[x]` `testWooMatch.js` mode=dedup |
| discover = `plan_json` 파싱 · **valueContainment** | `[x]` #154 · intersection≥1 · Top-10 |
| 코퍼스 = `status=registered` · 최신 500건 | `[x]` `listAiSqlForMatch` |
| `used_fragments`만으로는 **값 매칭 불가** | `[x]` plan_json 필수 |
| `@param_domain` 동의어(서울/서울시) 정규화 **없음** | `[x]` exact only · UI 단정 금지 |
| 범위형(min/max) discover **제외** | `[x]` 오탐 방지 |
| Option `testWooAiMatchEnabled` | **OFF** (#152) |

---

## 3. SQL-First 여정 (#145R → R0~R8)

| 사실 | 반영 |
|---|---|
| Shell: SQL 먼저 → Program → Campaign → WKF | `[x]` `19`/`21` · ST0~ST6 |
| intent create/reuse (#147) | **폐기** — SQL 목록 분기 |
| 미반영 SQL = 클라이언트 캐시 (`twStudioCache`) | `[x]` R2 · probe backend |
| 반영 시점 strict lock | `[x]` R6 Register |
| 상대시점(AddDays/GetDate) | **미사용** — params→리터럴 |

---

## 4. WKF 생성 API

| API | 반영 |
|---|---|
| `CreateInstanceFromModel` (17234) | `[x]` `createWkfFromTemplate` |
| `CreateOperationFromModelId` (10002) | `[x]` `createCampaign` |
| `xtk.session.Duplicate*` | **미사용** — PoC 미실측 |
| Spawn | **금지** |

---

## 5. 근거 log

#145 PoC-M · #145R PoC-S · #153 PoC-V · #146/#147 · #154 · SQL-First R2~R6

---

## 6. 회귀 금지

- name-only Match ON · 95% 유사도 · 임베딩 매칭
- Generate가 Register 없이 DB Write
- Duplicate* 도입 without HUMAN PoC
