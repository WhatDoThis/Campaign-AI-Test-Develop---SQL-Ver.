# STG 스키마 정리 (2026-09-01)

> repo `new_ver/schema/` · ACC 실데이터·코드 사용처 전수 조사 결과.  
> sample mart는 `schema/sample/` · Golden·WorkflowUi SOAP는 `_retire/`.

## ACC STG 등록 세트

| 파일 | namespace | 비고 |
|---|---|---|
| `testWooAiFragment.xml` | `woo:testWooAiFragment` | 39컬럼 |
| `testWooAiSql.xml` | `woo:testWooAiSql` | 22컬럼 |
| `testWooAiRequestQueue.xml` | `woo:testWooAiRequestQueue` | 17컬럼 (`cost_estimate` 없음) |
| `testWooAiGapLog.xml` | `woo:testWooAiGapLog` | 9컬럼 · UI 없음 |
| `testWooAiWkfLock.xml` | `woo:testWooAiWkfLock` | 4컬럼 |
| `testWooFolderExt.xml` | `woo:folder` | `isAiFolder` |
| `testWooProgramExt.xml` | `woo:program` | `isAiFolder` (폼용) |

## ACC Delete

| 객체 | 이유 |
|---|---|
| `woo:testWooAiGolden` | 회귀 WF 전용 → `_retire/dev_only/` |
| `woo:testWooAiWorkflowUi` | embed SOAP retire |
| `testWooAiGapAdmin.jssp` | UI retire |

## Fragment — 제거된 컬럼/enum

`supersedes_id`, `merged_into_id`, `certified_by`, `certified_at`, enum `certified`

## Fragment — KEEP (비어 있어도 정상)

| 컬럼 | 이유 |
|---|---|
| `scope_key` | recipient grain |
| `emb_*` | `embedEnabled=false` |
| `revoked_*` | active 행 |
| `source_request_id=0` | 구데이터·reuse |

## Sql — DELETE 없음

전 컬럼 Register·inject·Match·Studio 사용.  
`target_count=0`, `excluded_slots` 빈 값 = partial-exec 미사용 경로.

## Request Queue — 제거

`cost_estimate`, enum `awaiting_clarification`

## Request Queue — KEEP (빈 값 정상)

`clarify_answers`, `partial_preview`, `err_id`(성공 건), `workflow_name`(Tools-only)

## 배포 순서

```
schema Save → Update database structure
input_form (Fragment/Sql/Queue/ExtendFolder)
navtree
```

입력폼·navtree: `new_ver/input_form/`, `new_ver/navtree/` — XML 주석 없음.

## ACC orphan DB 컬럼

스키마에서 뺀 컬럼은 SQL 테이블에 남을 수 있음. Explorer·파이프라인 무영향.
