# 03 · Program · Campaign · WKF 생성 [완료]

> **상태:** `[x]` 실 반영 완료 (구 2차·3a PoC·3차 흡수)  
> **정본 계층:** `Program(@isAiFolder)` → `Campaign(nms:operation)` → `Workflow(xtk:workflow)`

---

## 1. 범위

| 흡수 | 원 문서 | 구현 |
|---|---|---|
| 2차 | 상태머신·AI 폴더 | `[x]` (SQL-First로 여정 반전·입력 게이트 폐기) |
| 3a | PoC 절차·RESULT·Campaign·Template | `[x]` 결론만 (일회 스크립트·미머지) |
| 3차 | WKF 라이프사이클 | `[x]` |

**미반영(삭제):**  
- 2차 「폴더 선택 전 NL 비활성」(SQL-First ST0 즉시 입력으로 **폐기**)  
- PoC-1 `xtk://open` 성공 경로 · PoC-3 `@lockedBy` DB 확장  
- 3차 `@lockedBy` on `xtk:workflow` · Spawn/Start 호출  
- bare `Write` 캠페인(PoC-C 껍데기) — T2 템플릿 API로 **대체**

---

## 2. 선행 실측 (3a → 코드 반영)

| PoC | 판정 | 코드 반영 |
|---|---|---|
| PoC-0 | PASS | navtree `view` 유지 |
| PoC-1 | FAIL | WKF 열기 = 정보바·「콘솔에서 여세요」 (Studio `xtk://open` **미사용**) |
| PoC-2 | PASS | Write 클론 가능 → **T3b로 대체** |
| PoC-3 | 스킵 | **soft-lock** `woo:testWooAiWkfLock` (코어 workflow 미확장) |
| PoC-T2 | PASS | `CreateOperationFromModelId(10002)` + `program-id` Write |
| PoC-T3a | FAIL | **사용 안 함** |
| PoC-T3b | PASS | `CreateInstanceFromModel("xtk:workflow", 17234, diff)` |

### 템플릿·Option (운영 확정)

| 용도 | internalName | id | Option |
|---|---|---|---|
| 새 캠페인 | `opEmptyTemplate_LLM` | 10002 | `testWooAiCampaignTemplateId` |
| WKF 추가 | `wfEmptyTemplate_CUSTOM` | 17234 | `testWooAiWkfTemplateId` |
| WKF 표시명 | — | — | `testWooAiWkfTemplateName` |
| 캠페인당 WKF 상한 | Max **15** (ACC 20) | — | `testWooAiWkfMaxPerCampaign` |

---

## 3. 구현 요약

### 3-A. 스키마·폴더

- `@isAiFolder` on folder/program — **prefix `AI_Folder*` 매칭 금지**
- Program 목록 → Campaign 목록 → WKF 목록 (단일 `#twListPane` 상태 전환)
- navtree **nodeModel로 Program 폴더 추가 금지** (Studio 내부 목록만)

### 3-B. `testWooWorkflowClone.js`

| API | 동작 |
|---|---|
| `listCampaignsByProgram` | Program 하위 Campaign |
| `createCampaign` | T2: CreateOperationFromModelId + program-id |
| `listWkfsByCampaign` / `listWkfsByProgram` | WKF 목록 · 개수 |
| `createWkfFromTemplate` | T3b: CreateInstanceFromModel |
| `acquireLock` / `releaseLock` / `getLock` | `woo:testWooAiWkfLock` soft-lock |
| `getMaxWkfPerCampaign` | 15 도달 시 생성 차단 |

**절대 금지:** `xtk:workflow#Spawn` · 생성 직후 Start/Execute

### 3-C. 잠금·열기

- 타 유저 점유 WKF: 선택/생성 차단 + 안내
- WKF 열기: PoC-1 FAIL 폴백 (PK/name 표시 · 콘솔 안내)

---

## 4. 핵심 자산

| 경로 | 역할 |
|---|---|
| `new_ver/js/testWooWorkflowClone.js` | 생성·목록·잠금 |
| `new_ver/js/testWooStudioContext.js` | Studio context queryDef |
| `new_ver/jssp/testWooAiStudioContext.jssp` | list/create API |
| `new_ver/schema/testWooAiWkfLock.xml` | soft-lock |
| `new_ver/schema/testWooFolderExt.xml` / `testWooProgramExt.xml` | `@isAiFolder` |
| `old_ver/workflow/tamplate.xml` | repo 원본 참고 (**파일명 오타 유지**) |

---

## 5. HUMAN·log

- v=144~146: Program→Campaign→WKF · Max15 · Spawn 없음 · soft-lock
- SQL-First R3~R5: ST0~ST5 목록·생성 경로 **유지·개조** (`20` 자산판정표)

---

## 6. 회귀 금지

- Program id를 `operation-id`에 넣는 **구 v=142 오해 구현** 재발 금지
- `CreateWorkflowFromModelId` (T3a) 재도입 금지
- Spawn·코어 `@lockedBy` 확장 금지
