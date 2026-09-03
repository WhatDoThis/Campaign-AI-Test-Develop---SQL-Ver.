# new_ver → ACC 배포 분류 (Tools Studio 기준)

> **전제 (2026-09-01 확정)**  
> - AI Studio 진입 = **상단 Tools** (`woo:testWooAiNav` → Test Woo AI Studio)  
> - **WF 캔버스 Property 옆 embed** = **미사용** → STG 미배포 · 콘솔 orphan 삭제  
> - §3 스파게티 정리 = **1·2 휴먼 확인 후** 별도 진행

---

## 1. 진입 경로별 — 무엇이 필요한가

```
[사용] Tools → Test Woo AI Studio
         └── /woo/testWooAiStudio.jssp  (embed=0, Shell SQL-First)
         └── testWooAiStudioContext.jssp (Program/Campaign/WKF)
         └── Register 시 testWooWorkflowUi.commitInject (JS, SOAP 아님)

[미사용] WF Properties → AI Studio 탭 (urlViewer embed)
         └── testWooExtendWorkflow + testWooAiWorkflowUi SOAP
         └── xtk:workflow 버튼/리다이렉트 패치
         → new_ver/_retire/wf_canvas_embed/
```

| 기능 | Tools 경로 | WF embed 경로 |
|---|---|---|
| NL → SQL 생성 | ✅ Generate/Studio | ❌ |
| Program/Campaign/WKF 선택 | ✅ StudioContext | ❌ |
| SQL Register + WKF 주입 | ✅ Register + **workflowUi.js** | ❌ (SOAP Bind) |
| 캔버스에서 iframe Studio | ❌ | ~~PoC~~ |

**주의:** `testWooWorkflowUi.js`는 **유지** — Register가 `commitInject`로 WKF에 SQL 반영.  
SOAP(`ShellProbe/Pick/Bind`)만 embed 전용 → 추후 §3에서 JS 분리 가능.

---

## 2. ACC STG에 **반드시** 올릴 것

### 2-A. 핵심 파이프라인

| 구분 | 파일 |
|---|---|
| **JSSP** | `Generate`, `Validate`, `Register`, `Studio`, `StudioJs`, `StudioContext` |
| **JS** | `Env`, `Common`, `Config`, `FragContract`, `Fragments`, `EnPivot`, `Llm`, `Toolkit`, `Feasibility`, `Foundry`, `Dedup`, `Compiler`, `Gates`, `Repository`, `Lifecycle`, `Embedding`, `Probe`, `StudioContext`, `WorkflowClone`, **`WorkflowUi`**, `Match`(Option OFF 가능) |
| **Schema** | `testWooAiFragment`, `testWooAiSql`, `testWooAiRequestQueue`, `testWooAiGapLog`, `testWooAiWkfLock`, `testWooProgramExt`, `testWooFolderExt` |
| **Form** | Fragment·Sql·RequestQueue 입력폼, `testWooExtendFolder`, `testWooNmsProgramAiFolderPatch` |
| **Navtree** | `testWooAiNavtree.xml` (Tools Studio command) |
| **WF** | `testWooFoundryBatch.js` (+ Foundry WKF 설정) |

### 2-B. 운영 UI (Foundry 쓰면)

| JSSP | 용도 |
|---|---|
| `testWooAiQueueStatus.jssp` | 큐 상태 |
| `testWooAiFragmentReview.jssp` | 승인 |
| `testWooAiFragmentAdmin.jssp` | fragment 관리 |
| `testWooAiMatch.jssp` | Match (Option ON 시만) |

**Gap Admin UI:** 미사용 → `_retire/unused_jssp/testWooAiGapAdmin.jssp` (스키마 `testWooAiGapLog`는 Foundry 기록용 **유지**)

---

## 3. ACC에 **올리지 않음** (repo `_retire/`)

### 3-A. WF canvas embed — `_retire/wf_canvas_embed/`

| 파일 | ACC 조치 |
|---|---|
| `input_form/testWooExtendWorkflow.xml` | 콘솔 **Delete** |
| `schema/testWooAiWorkflowUi.xml` | 콘솔 **Delete** |
| `workflow/testWooXtkWorkflowButtonPatch.xml` | xtk:workflow **패치 되돌리기** |
| `workflow/testWooXtkWorkflowRedirectPatch.xml` | 동일 |

### 3-B. 제작·검증 전용 — `_retire/dev_only/`

| 항목 | 용도 |
|---|---|
| `sql_validate_wkf/` | WF JS 수동 검증 스크립트 |
| `workflow_backup/` | xtk:workflow 패치 전 export |
| `original/` | 폼 참고 백업 |
| `testWooFoundryDryRun.js` | billable 1회 검증 |
| `testWooGoldenRun.js` | Golden 회귀 |
| `testWooSampleSeed.js` / `Seed2.js` | 샘플 mart 시드 WF |
| `testWooAiGolden` schema+form | Golden 기록 |
| `testWooSmoke_tools/` | 스모크 (ACC WF에 붙여 1회 실행 — ZIP 제외) |

### 3-C. Git만 · 배포 ZIP 제외 (active tree)

| 경로 | 비고 |
|---|---|
| `html/testWooAiStudio.js` | **원본** — 배포는 `StudioJs.jssp` |
| `_retire/` 전체 | |
| `old_ver/` (repo 루트) | v0.1 프로토타입 |

### 3-D. PoC 샘플 mart (테스트 서버 유지 · repo `schema/sample/`)

| Schema/Form | STG |
|---|---|
| `schema/sample/testWooSampleCustomer` 등 5종 | △ **테스트 ACC 유지** · 실 mart 전환 시 대체 후 retire |
| `input_form/testWooSample*.xml` | △ 동일 |

### 3-E. DEFERRED (repo 보관 · STG 금지)

| | |
|---|---|
| `testWooAiCodemap` | 명시 요청 전 미배포 |

---

## 4. ACC 콘솔 orphan 삭제 체크 (테스트 env)

배포 분류와 별도로, **예전에 만들어 둔** 객체:

- [ ] `testWooAiAuthDebug.jssp`
- [ ] `testWooAiLogon.jssp`
- [ ] `testWooAiCatalog.jssp` / `Count.jssp`
- [ ] `testWooAiCodemapSync.jssp`
- [ ] `testWooAiGapAdmin.jssp` (Gap Admin UI retire)
- [ ] JS `testWooWorkflowIo.js` / `testWooCodemap.js`
- [ ] §3-A WF embed 4종

---

## 5. STG ZIP 최소 세트 (Tools-only)

```
schema/     Fragment, Sql, RequestQueue, GapLog, WkfLock, ProgramExt, FolderExt [, sample/*]
input_form/ Fragment, Sql, RequestQueue, ExtendFolder, NmsProgramAiFolderPatch
js/         21 files (§2-A, WorkflowUi 포함 · SOAP 제거는 §3 이후)
jssp/       Generate, Validate, Register, Studio×2, StudioContext [, Queue/Review/Admin]
navtree/    testWooAiNavtree.xml
workflow/   testWooFoundryBatch.js
```

**제외:** `_retire/**`, `html/**`, `old_ver/**`

---

## 6. §3 스파게티 (예정 — 지금은 보류)

휴먼 확인 후, **§2에 남은 파일만** 대상:

| 후보 | 내용 |
|---|---|
| `testWooWorkflowUi.js` | SOAP Shell* 제거 · commitInject만 유지 |
| `testWooAiStudio.jssp` | embed CSS/分기 제거 (Tools-only 단일 레이아웃) |
| `testWooAiStudio.js` | `EMBED`/`workflowName` URL 분기 단순화 |
| Match/Foundry admin | Option·rights 정책에 맞게 축소 |

---

## 7. 관련 문서

- `docs/main/(공용)STG_패키징_정리.md` — ZIP·배포 순서
- `docs/main/(공용)조건_테이블_컬럼_쉬운설명.md` — fragment 개념
- `new_ver/_retire/README.md` — retire 폴더 안내

*갱신: log #387*
