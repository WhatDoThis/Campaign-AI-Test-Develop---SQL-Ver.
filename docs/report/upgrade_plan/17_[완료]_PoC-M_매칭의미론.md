# PoC-M · 매칭 의미론 및 복제 가능성 조사 (#145)

> **AGENT_MODE · 조사 전용**. `new_ver/` 코드 변경 없음.  
> 일자: 2026-08-11 · litmus 조사 시점 코드 = v=151 계열

---

## 결론 (단정)

| # | 항목 | 판정 |
|---|---|---|
| (a) | 값 인식 매칭 가능 여부 | **가능** (단, 후보 측은 `used_fragments`만으로는 불가 → `plan_json` 또는 스키마 확장 필요) |
| (b) | plan-only 경로 가능 여부 | **가능** (현행 API는 없음 · Generate 조기 반환으로 분리 가능) |
| (c) | 기존 WKF 복제 가능 여부 및 권장 API | **가능** (문서) · 권장 `xtk.session.Duplicate` / `DuplicateTo` · 캠페인(`operation-id`) 재바인딩은 **미확인** |
| (d) | 상대시점(relative) 표현 사용 여부 | **미사용** (현행은 params → SQL 리터럴 치환 · AddDays/GetDate 경로 없음) |

---

## M1. plan JSON fragment 원소 필드

### [질문]
plan JSON의 fragment 원소 필드 전부. `name` 외에 `value` / `key_column` / `operator` / 값 배열이 있는가?

### [확인된 사실]
Pass1 출력 계약(및 클라이언트 plan) 원소는 다음이다.

**plan 루트**
- `grainKey` (string) — 후보 fragment의 `key_column`을 그대로 복사
- `include[]` — 그룹 AND
- `exclude[]`
- `unmatched[]`

**include[i].any[j] / exclude[k] 원소**
- `fragment` (string) — fragment **논리명** (필드명이 `name`이 아님)
- `label` (string, 한국어 표시)
- `params` (object) — 플레이스홀더 키→값. 값은 스칼라 또는 **배열** 가능

존재하지 않음(계약/검증 기준):
- plan 원소의 `name` 필드 (매칭 fallback만 `.name`을 읽음 — M2)
- plan 원소의 `value` 단일 필드 (값은 `params` 객체에 분산)
- plan 원소의 `key_column` / `operator`

`params` 값이 배열이면 컴파일러가 SQL IN 리스트로 펼친다.

### [근거]
- `new_ver/js/testWooLlm.js:161` — OUTPUT JSON 계약 `fragment`/`label`/`params`
- `new_ver/js/testWooLlm.js:790-803` — `_validatePlanShape` (grainKey, include.any, exclude)
- `new_ver/js/testWooCompiler.js:153-184` — chips: `fragment`, `params`
- `new_ver/js/testWooCompiler.js:186-199` — params 배열 → comma literals
- `new_ver/jssp/testWooAiGenerate.jssp:73-78` — clientPlan 필드

### [미확인]
운영 DB에 저장된 실제 plan_json 샘플 전수 스키마 확장 여부(계약 외 추가 키) — 콘솔 덤프 없음.

---

## M2. fragmentNameSetFromPlan / FromUsed가 읽는 필드 · MATCH_KEY

### [질문]
실제 읽는 필드. `MATCH_KEY="name"`이 값(value)을 무시하는가?

### [확인된 사실]
- `MATCH_KEY = "name"` 상수만 선언·응답 echo. 집합 키로 `params`를 쓰지 않는다.
- **FromUsed**: `used_fragments[]`의 `.name`만 집합에 넣음. `version`/`fragmentId` 무시. **params/값 없음**(스키마 스냅샷에도 없음 — M4).
- **FromPlan (주경로)**: `compiler.collectUsedFragments(plan)` → 각 item의 **`item.fragment`**로 `getByName` → 결과의 **`f.name`**. params 무시.
- **FromPlan (fallback, compiler 없을 때)**: `any[a].name` / `ex[e].name`을 읽음 — Pass1 계약의 `fragment` 필드와 **불일치**. 현재 Match JSSP는 compiler를 load하므로 주경로가 사용된다.

→ 값(params)은 **완전히 무시**된다. 동일 fragment명·다른 params도 같은 집합 원소로 취급.

### [근거]
- `new_ver/js/testWooMatch.js:26`, `47-54`, `58-84`
- `new_ver/js/testWooCompiler.js:271-288` — collectUsedFragments
- `new_ver/schema/testWooAiSql.xml:39` — used_fragments = `{name, version, fragmentId}`

### [미확인]
없음 (코드 확정).

---

## M3. SQL 없이 plan만 산출하는 경로

### [질문]
plan(fragment 집합)만 산출하는 경로가 있는가? 없다면 Generate 조기 반환 분리 가능성과 부작용.

### [확인된 사실]
**현행 전용 plan-only API/엔드포인트는 없다.**

`testWooAiMatch.jssp`는 **이미 만들어진 `plan`을 입력**으로 받는다 (`plan missing` 시 throw). plan 생성은 Studio가 `testWooAiGenerate.jssp`를 호출한 뒤에야 가능하다.

Generate 성공 분기( unmatched 없음 ):
1. `llm.generatePlan` (Pass0 + StageA + Pass1) — LLM 호출
2. `compiler.compile(plan)` — SQL 조립
3. `gates.runAll` — 검증
4. JSON에 `plan` + `sql` + gates 반환  
   → **이력(Register) 저장 없음**. 큐 적재 없음.

Generate unmatched + Foundry ON:
- `repo.enqueueRequest` — **승인/생성 큐 적재** (부작용)

**분리 가능성**: `generatePlan` 직후 `compile`/`gates` 전에 `plan`만 반환하는 분기는 코드상 **가능**. 신규 엔드포인트 또는 `action=planOnly`로 분리 가능.

| 부작용 항목 | plan-only 조기 반환 시 |
|---|---|
| LLM 호출 비용 | **유지** (Pass0+Pass1은 plan 산출에 필수) |
| SQL compile / gates | **생략 가능** |
| 이력(`testWooAiSql`) 저장 | Generate 경로 원래 없음 · 변화 없음 |
| Foundry 큐 적재 | unmatched 처리 정책을 그대로 두면 **유지**; plan-only에서 unmatched를 큐에 안 넣도록 하면 **회피 가능**(설계 선택) |

Studio 현행: `generate()` 성공 후 `runMatch(plan)` — SQL 생성과 매칭이 한 버튼에 결합 (`testWooAiStudio.js` generate→runMatch).

### [근거]
- `new_ver/jssp/testWooAiMatch.jssp:25-26`, `39-41`
- `new_ver/jssp/testWooAiGenerate.jssp:24-88`
- `new_ver/html/testWooAiStudio.js:390-449` (generate → runMatch)

### [미확인]
없음. (#147 “plan-only 불가” 판정에는 해당하지 않음 — **분리 가능**)

---

## M4. woo:testWooAiSql 필드 · sql_hash

### [질문]
`nl_request` / `used_fragments` / `sql_hash` 실제 필드명·타입·길이. 절단 로직.

### [확인된 사실]

| 필드 | 스키마 | 타입·길이 | 절단 |
|---|---|---|---|
| `nl_request` | `@nl_request` | **memo** (길이 제한 속성 없음) | repo 저장 시 절단 없음 |
| `used_fragments` | `@used_fragments` | **memo** · JSON `[{name,version,fragmentId}]` | 절단 없음 |
| `compile_hash` | `@compile_hash` | string **64** | plan+정규화SQL djb2 hex |
| `sql_hash` / `sqlContentHash` | **스키마 필드 없음** | lifecycle에서 **계산만** (`sqlContentHash`) · Register dedup 조회용 | 미저장 |
| `workflow_name` | `@workflow_name` | string **64** | `_wfName` → `WF_NAME_MAX=64` 초과 시 절단+logWarning |
| `title` | `@title` | string **200** | Register에서 `TW_TITLE_MAX` 절단 가능 |
| `target_count` | `@target_count` | long | Studio Register가 **0** 전송 |

### [근거]
- `new_ver/schema/testWooAiSql.xml:29-45`, `76-90`
- `new_ver/js/testWooRepository.js:25`, `35-41`, `351-385`
- `new_ver/js/testWooLifecycle.js:289-296` (`compileHash` / `sqlContentHash`)
- `new_ver/jssp/testWooAiRegister.jssp` — sqlHash 응답 필드만, 컬럼 insert 아님

### [미확인]
memo의 DB 물리 상한(엔진별 CLOB) — ACC/DB 인스턴스 의존.

---

## M5. WKF 최종 실행일시 · 직전 대상 건수

### [질문]
xtk:workflow 또는 기존 스키마에 필드가 있는가?

### [확인된 사실]
**본 repo 스키마/코드 기준**
- `woo:testWooAiWkfLock`: `workflow_id`, `workflow_name`, `locked_by`, `locked_at`만. 실행·건수 **없음**.
- `woo:testWooAiSql.@target_count`: “등록 시점 대상 건수”. Studio는 **0 전송**. 최종 실행 건수가 **아님**.
- `listWkfsByCampaign` select: `@id/@internalName/@label/@state/@status/@inProcess/[@operation-id]` — **실행일시·건수 없음**.

**Adobe 커뮤니티(공식 스키마 전문은 repo 미포함)**  
- `xtk:workflow`에 Last processing `@processDate`, Next `@nextProcessingDate`가 있다는 **커뮤니티 답변**이 있음.  
- 본 PoC는 콘솔/공식 schema XML로 `@processDate`를 실측하지 않음 → **환경 실측 전제 시 사용 가능 후보**, 코드 미연동.

**직전 대상 건수**: repo 스키마에 “마지막 실행 audience count” 필드 **없음**. `xtk:workflowLog` 등은 미조사.

→ #147 작업 3: 최종 실행일·대상 건수는 **지금 표시하지 말 것**(자리 금지). `@processDate` 실측 PoC 후에만 재검토.

### [근거]
- `new_ver/schema/testWooAiWkfLock.xml:14-17`, `34-37`
- `new_ver/schema/testWooAiSql.xml:36`, `84`
- `new_ver/js/testWooWorkflowClone.js:446-454`
- Community: https://experienceleaguecommunities-beta.adobe.com/campaign-classic-v7-campaign-v8-6/view-last-few-runs-of-a-workflow-along-with-next-processing-101278

### [미확인]
현재 고객 ACC 인스턴스의 `xtk:workflow`에 `@processDate` 존재·권한·값 갱신 여부 (실측 필요).

---

## M6. MATCH_SQL_LIMIT=500 정렬·누락

### [질문]
전역 스코프에서 어떤 정렬로 잘리는가? 최신순 보장?

### [확인된 사실]
- `MATCH_SQL_LIMIT = 500` (`testWooMatch.js:29`)
- `listAiSqlForMatch`: `status='registered'`, `orderBy @creation_date sortDesc=true`, `lineCount=limit`
- → **전역 최신 등록 SQL 최대 500행**만 로드한 뒤, 코드에서 `workflow_name`별 fragment 집합을 합친다.

**최신순 보장**: SQL **행** 단위로는 최신 500건 보장.  
**누락 위험**: 등록 이력이 많은 환경에서, 예전에만 쓰이고 최근 500건 밖에 있는 WKF는 후보에서 **통째로 탈락**할 수 있다. WKF별 “최신 1건 보장” 쿼리는 아님.

### [근거]
- `new_ver/js/testWooMatch.js:29`, `159`
- `new_ver/js/testWooRepository.js:352-369`

### [미확인]
운영 이력 총량(500 초과 여부).

---

## M7. fragment 날짜 조건 형태 (리터럴 vs relative)

### [질문]
리터럴 날짜인가, AddDays/GetDate/getCurrentDate 인가?

### [확인된 사실]
- 컴파일 경로: `sql_text`의 `{{param}}`을 `item.params` 값으로 치환. `_lit`는 문자열을 **SQL 따옴표 리터럴**로 넣는다 (`'…'`). Adobe 필터 함수 호출을 생성하지 않는다.
- Foundry/Match/Compiler/Llm 소스에 `AddDays` / `AddHours` / `GetDate` / `getCurrentDate` **문자열 사용 없음** (repo rg).
- 디버깅 리포트 샘플 fragment SQL: `WHERE sRegion = '서울'` 형태 리터럴.
- Seed 구독 데이터도 `start_date: "2026-07-13"` 등 **캘린더 리터럴**(샘플 데이터; fragment SQL 본문은 seed에 없음).

→ 현행 파이프라인은 **absolute(리터럴) 치환**. ACC 쿼리 필터의 relative Filter type과는 별개(대상자 SQL fragment 모델).

공식 relative 함수 문서(인용만, 현행 미사용):
- https://experienceleague.adobe.com/en/docs/campaign/campaign-v8/data/query/filter-conditions
- https://experienceleague.adobe.com/developer/campaign-api/api/f-getCurrentDate.html

### [근거]
- `new_ver/js/testWooCompiler.js:121`, `186-219`
- `docs/report/08_SQL생성추가_디버깅2.md:165` 샘플
- Foundry 프롬프트 params 규약: `testWooFoundry.js:400`

### [미확인]
운영 DB에 사람이 수기 등록한 fragment `sql_text`에 relative/DBMS 함수가 들어 있는지 — 콘솔 전수 미실시.

---

## M8. 현행 복제 경로 vs session.Duplicate*

### [질문]
`CreateInstanceFromModel`과 `Duplicate` / `DuplicateTo` / `DuplicateWithMappingId` 중 기존 WKF 복제에 쓸 수 있는 것.

### [확인된 사실]
**현행 코드**
- `createWkfFromTemplate` → `xtk.queryDef.CreateInstanceFromModel(WF_SCHEMA, modelId, diff)`  
  `diff = <workflow label=… operation-id=캠페인/>`  
  → **템플릿 WF에서 인스턴스 생성**. 기존(이미 저장된) WKF를 소스로 쓰지 않음. Spawn 없음.

**xtk:session 공식 메서드 (목록에 존재)**
| API | 시그니처(문서) | 기존 문서 복제 용도 |
|---|---|---|
| `Duplicate` | `session.Duplicate(String pk)` | 소스 문서 pk로 신규 문서 생성. 반환값 None |
| `DuplicateTo` | `session.DuplicateTo(pk, folder)` | 지정 폴더로 복제 |
| `DuplicateWithMappingId` | mapping = `DuplicateWithMappingId(pk)` | 복제 + ID 매핑 XML 반환 |

Adobe UX 가이드: activity 교차 copy/paste **비권장**, **workflow Duplicate 권장**. 복제 후 원본 수정은 사본에 전파되지 않음.

**판정**
- 문서상 기존 WKF(엔티티) 복제: **Duplicate / DuplicateTo / DuplicateWithMappingId 사용 가능**.
- 권장 출발점: **`Duplicate`** (또는 폴더 지정이 필요하면 `DuplicateTo`).
- **미확인(호출 금지 유지)**:  
  - 캠페인 WKF 복제 후 `operation-id`를 **현재 ctx.campaign**으로 바꾸는 Write가 필요한지  
  - `DuplicateTo`의 `folder`가 nms:operation 연결과 어떤 관계인지  
  - soft-lock / internalName 자동 생성 동작

이 차수에서 Duplicate* **미호출**.

### [근거]
- `new_ver/js/testWooWorkflowClone.js:504-530`
- https://experienceleague.adobe.com/developer/campaign-api/api/s-xtk-session.html
- https://experienceleague.adobe.com/developer/campaign-api/api/sm-session-Duplicate.html
- https://experienceleague.adobe.com/developer/campaign-api/api/sm-session-DuplicateTo.html
- https://experienceleague.adobe.com/developer/campaign-api/api/sm-session-DuplicateWithMappingId.html
- https://experienceleague.adobe.com/en/docs/campaign/automation/workflows/introduction/build-a-workflow (Duplicate workflows · copy/paste caution)

### [미확인]
Duplicate 후 캠페인 재바인딩·Studio soft-lock 상호작용 — 별도 HUMAN PoC 필요.

---

## #146 / #147 착수 게이트

| 선행 조건 | 결과 |
|---|---|
| #146: M1 또는 M3이 “미확인”이면 금지 | M1·M3 **확인됨** → #146 착수 **가능** |
| #146 작업 3(값 인식): M1이 값 필드 존재일 때만 | plan.`params` **존재** → 작업 3 수행 가능. 단 후보 집합은 `plan_json` 파싱 또는 used_fragments 확장 없이는 name-only |
| #147: M3이 plan-only 불가면 중단 | M3 = **분리 가능** → plan-only 구현 후 reuse 경로 진행 가능 |

### 값 인식 구현 시 주의 (조사 메모)
- Q(사용자 plan): `fragment` + 정규화 `params`로 compositeKey 가능.
- X(이력): `used_fragments`에 params **없음** → `testWooAiSql.plan_json`을 Match 조회에 포함해야 valueContainment 산출 가능. 스키마 신규 필드 없이 memo 파싱으로 가능할지 여부는 #146 구현 시 확정.

---

## 변경 파일 (본 PoC)

- `docs/report/upgrade_plan/17_[완료]_PoC-M_매칭의미론.md` (본 문서)
- `docs/report/00_ReportIndex.md`
- `docs/log/log.md`  
`new_ver/` **변경 없음** (#145 시점).

---

## #146 후속 메모 (값 인식)

- M1 값 필드(`params`) 존재 → discover에 `nameContainment` / `valueContainment` 구현.
- 후보 값 집합: `listAiSqlForMatch`가 `@plan_json`을 읽어 `name=정규화params` 복합키 생성.
- dedup 모드 키·임계·정렬 **불변**.
