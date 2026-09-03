# STG 패키징 · 정리 가이드

> **목적:** 테스트 ACC → STG 이전 전, **무엇을 옮기고 / 빼고 / 콘솔에서 지울지** 한 장으로 정리  
> **기준일:** 2026-09-01 · Studio **v=202**

---

## 1. 한 줄 요약

| 구분 | 원칙 |
|---|---|
| **STG에 넣을 것** | `new_ver/` 중 **아래 §3 표**만 — schema → JS → form → JSSP → WF |
| **Git에는 두되 STG ZIP 제외** | `old_ver/`, `sql_validate_wkf/`, `workflow/backup/`, `html/`(원본), `tools/`(로컬 검증) |
| **ACC 콘솔에서 삭제** | 예전에 만든 **폐기 JSSP·옛 스네이크 스키마·Logon/AuthDebug/Catalog/Count** |
| **아직 구현 안 함 (Git 보관)** | `testWooAiCodemap` — STG **미배포** |

---

## 2. STG 배포 순서 (반드시 이 순서)

```
① Named rights + Options (섹션1)
② Data schemas + Update database structure
③ Input forms + navtree
④ JavaScript codes (loadLibrary 순)
⑤ Dynamic JavaScript Pages (/woo/)
⑥ Workflow (Foundry 배치 · 샘플 시드 · 선택)
⑦ 스모크 1회 → Studio v= litmus
```

상세: `docs/report/01_개발가이드.md` 섹션 1~7 · 6-3).

---

## 3. STG 패키지에 **포함** (ACC 콘솔에 등록)

### 3-A. 스키마 (`new_ver/schema/`)

| 파일 | namespace | STG |
|---|---|---|
| `testWooAiFragment.xml` | `woo:testWooAiFragment` | ✅ 필수 |
| `testWooAiSql.xml` | `woo:testWooAiSql` | ✅ 필수 |
| `testWooAiRequestQueue.xml` | `woo:testWooAiRequestQueue` | ✅ Foundry 사용 시 필수 |
| `testWooAiGapLog.xml` | `woo:testWooAiGapLog` | ✅ Foundry 기록 (Gap Admin UI 없음) |
| `testWooAiWorkflowUi.xml` | ~~`woo:testWooAiWorkflowUi`~~ | ❌ embed SOAP — `_retire/` |
| `testWooAiWkfLock.xml` | `woo:testWooAiWkfLock` | ✅ Shell soft-lock |
| `testWooProgramExt.xml` | `woo:testWooProgramExt` | ✅ AI Program 폴더 |
| `testWooFolderExt.xml` | `woo:testWooFolderExt` | ✅ 폴더 확장 |
| `testWooSampleCustomer.xml` | `woo:testWooSampleCustomer` | △ `schema/sample/` — 테스트 ACC 유지 |
| `testWooSampleSubscription.xml` | … | △ 동일 |
| `testWooSampleBill.xml` | … | △ 동일 |
| `testWooSampleApp.xml` | … | △ 동일 |
| `testWooSampleDevice.xml` | … | △ 동일 |
| `testWooAiGolden.xml` | `woo:testWooAiGolden` | △ 회귀/Golden WF만 |

**STG 제외 (DEFERRED · repo만):**

| 파일 | 이유 |
|---|---|
| `testWooAiCodemap.xml` | AGENTS DEFERRED — 명시 요청 전 배포 금지 |

---

### 3-B. 입력 폼 (`new_ver/input_form/`)

스키마와 **name 동일**한 것만. §3-A 스키마와 1:1.

| 추가 (WF/Studio) | STG |
|---|---|
| ~~`testWooExtendWorkflow.xml`~~ | ❌ 미사용 → `_retire/wf_canvas_embed/` |
| `testWooExtendFolder.xml` | ✅ AI 폴더 |
| `testWooNmsProgramAiFolderPatch.xml` | ✅ Program `@isAiFolder` |
| `testWooAiFragment.xml` / `testWooAiSql.xml` | ✅ |
| `testWooAiRequestQueue.xml` | ✅ Foundry |
| `testWooSample*.xml` | △ PoC |

**패치 (운영 xtk:workflow — embed 미사용 시 적용 안 함):**

| 파일 | 역할 |
|---|---|
| ~~`workflow/testWooXtkWorkflowButtonPatch.xml`~~ | `_retire/wf_canvas_embed/` |
| ~~`workflow/testWooXtkWorkflowRedirectPatch.xml`~~ | `_retire/wf_canvas_embed/` |

**Studio 진입:** `navtree/testWooAiNavtree.xml` → Tools command only.

---

### 3-C. JavaScript codes (`new_ver/js/` · namespace `woo`)

**등록 순서 (Env 선행):**

| 순 | Campaign name | 파일 |
|---|---|---|
| 1 | `testWooEnv.js` | 환경·Foundry·namespace |
| 2 | `testWooCommon.js` | jsonOut·auth |
| 3 | `testWooConfig.js` | LLM 옵션 (Env 로드) |
| 4 | `testWooFragContract.js` | M1/M2/M3 계약 |
| 5 | `testWooFragments.js` | Stage A |
| 6 | `testWooEnPivot.js` | EN Pivot |
| 7 | `testWooLlm.js` | Pass0/Pass1 |
| 8 | `testWooToolkit.js` | Triage/Foundry tools |
| 9 | `testWooFeasibility.js` | Triage |
| 10 | `testWooFoundry.js` | Foundry 생성 |
| 11 | `testWooDedup.js` | near dedup |
| 12 | `testWooCompiler.js` | CNF → SQL |
| 13 | `testWooGates.js` | gates |
| 14 | `testWooRepository.js` | Sql·Queue·GapLog |
| 15 | `testWooLifecycle.js` | fragment 생애주기 |
| 16 | `testWooEmbedding.js` | embedding |
| 17 | `testWooMatch.js` | 유사 조건 (Option OFF 기본) |
| 18 | `testWooProbe.js` | preflight·sqlSelect |
| 19 | `testWooStudioContext.js` | Program/WKF API |
| 20 | `testWooWorkflowClone.js` | Campaign/WKF 생성 |
| 21 | `testWooWorkflowUi.js` | Register **commitInject** (SOAP는 embed 전용·미사용) |

**repo에 없음 · 콘솔에 있으면 삭제:**

- `testWooCodemap.js` — DEFERRED
- `testWooWorkflowIo.js` — **폐기** (WF XML Write)

**litmus:** Studio → `testWooAiStudioContext.jssp?action=libVersions` → `allMatch:true`

---

### 3-D. JSSP (`new_ver/jssp/` · URL `/woo/`)

| 파일 | STG |
|---|---|
| `testWooAiGenerate.jssp` | ✅ |
| `testWooAiValidate.jssp` | ✅ |
| `testWooAiRegister.jssp` | ✅ |
| `testWooAiStudio.jssp` | ✅ (**v=202** 확인) |
| `testWooAiStudioJs.jssp` | ✅ |
| `testWooAiStudioContext.jssp` | ✅ Shell 모드 |
| `testWooAiQueueStatus.jssp` | ✅ Foundry 큐 |
| `testWooAiFragmentReview.jssp` | ✅ 승인 JSON |
| ~~`testWooAiGapAdmin.jssp`~~ | ❌ 미사용 → `_retire/unused_jssp/` |
| `testWooAiFragmentAdmin.jssp` | △ fragment 관리 |
| `testWooAiMatch.jssp` | △ Match Option ON 시 |

**콘솔에서 삭제 (repo에도 없음):**

| JSSP | 이유 |
|---|---|
| `testWooAiAuthDebug.jssp` | 폐기 (#197) |
| `testWooAiLogon.jssp` | 폐기 (Host Logon) |
| `testWooAiCatalog.jssp` | Validate catalog 흡수 |
| `testWooAiCount.jssp` | Validate count 흡수 |
| `testWooAiCodemapSync.jssp` | DEFERRED |

---

### 3-E. Workflow JS (`new_ver/workflow/`)

| 파일 | STG |
|---|---|
| `testWooFoundryBatch.js` | ✅ Foundry 배치 |
| `testWooSampleSeed.js` / `testWooSampleSeed2.js` | △ PoC 시드 |
| `testWooGoldenRun.js` | △ Golden |
| `testWooFoundryDryRun.js` | △ 수동 검증 |
| `testWooSampleCustomActivityContract.xml` | △ CA 계약 참고 |

---

### 3-F. Navtree

| 파일 | STG |
|---|---|
| `navtree/testWooAiNavtree.xml` | ✅ Fragment·Queue·Sql 목록 |

---

## 4. STG ZIP **제외** (Git만 · 로컬 검증)

| 경로 | 이유 |
|---|---|
| `old_ver/` | v0.1 프로토타입 — 참고만 |
| `new_ver/_retire/` | WF embed · dev_only · reference |
| `new_ver/html/testWooAiStudio.js` | **원본** — 배포본은 `StudioJs.jssp` |
| `tools/checkRhinoSyntax.js` | 로컬 pre-commit |
| `tools/checkDialectSql.js` | 로컬 pre-commit |
| `docs/` · `.cursor/` | 운영 ACC 불필요 |

---

## 5. 테스트 → STG 이전 체크리스트

### 5-A. 테스트 ACC 콘솔 정리 (9차 · orphan)

- [ ] §3-A WF embed 4종 + orphan JSSP (AuthDebug 등)
- [ ] `testWooExtendWorkflow` / `testWooAiWorkflowUi` — **Delete**
- [ ] xtk:workflow embed 패치 **되돌리기** (backup: `_retire/dev_only/workflow_backup/`)

### 5-B. STG 신규/갱신

- [ ] Named rights: `testWooAiSqlGenerate`, `testWooAiSqlRegister`, …
- [ ] Options: LLM 3종 + `testWooEnv` 관련
- [ ] §3 전체 schema → **Update database structure**
- [ ] JS 21개 → `libVersions` allMatch
- [ ] JSSP → Studio URL **`v=202`**
- [ ] `testWooAiNavtree` — **Tools Studio command**
- [ ] ~~`testWooExtendWorkflow` + SOAP~~ — **미배포**
- [ ] `WKF_testWooFoundry` — 동시 실행 금지
- [ ] 스모크 PASS (또는 7·8·9 billable SKIP 정책 합의)

### 5-C. STG에서 끄거나 기본 OFF

| 항목 | 권장 |
|---|---|
| `testWooAiMatchEnabled` | **OFF** (#154 value-aware 전) |
| Foundry `enabled` | STG 정책에 따라 (테스트=true 유지 가능) |
| embed `testWooExtendWorkflow` | **미사용** — STG 제외 |

---

## 6. 「이전 질문」 저장 — STG 판단 (재확인)

| 방식 | STG 권장 |
|---|---|
| sessionStorage (v=202) | ✅ **현재 정본** — 같은 브라우저 10개 |
| Option `testWooAiNlRecent_*` | 보조만 (1KB 한도) |
| 스키마 `testWooAiNlRecent` | ❌ **지금은 불필요** — 다기기·영구 10개 필요 시 phase 2 |

**PASS 확인됨** — STG도 v=202 배포만 하면 됨. 스키마 신규는 보류.

---

## 7. 패키지 ZIP 예시 구조

```
stg_drop_20260901/
  schema/          ← §3-A (Codemap 제외)
  input_form/      ← §3-B
  js/              ← §3-C 21 files
  jssp/            ← §3-D
  workflow/        ← §3-E (backup 제외)
  navtree/
  README_STG.txt   ← §5 체크리스트 링크
```

---

## 8. 관련 문서

| 문서 | 내용 |
|---|---|
| `docs/report/01_개발가이드.md` | 섹션별 상세 절차 |
| `docs/main/(공용)조건_테이블_컬럼_쉬운설명.md` | fragment·축·컬럼 개념 |
| `docs/report/upgrade_plan/14_미구현_DEFERRED_로드맵.md` | Codemap·9차 폐기 |
| `AGENTS.md` | DEFERRED 목록 |

---

*갱신: log #386*
