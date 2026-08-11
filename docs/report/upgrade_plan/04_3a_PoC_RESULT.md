# 3a · PoC-1~3 RESULT (HUMAN 실측)

> **상태: PoC-1~3 RESULT 확정** (2026-08-11).  
> **코드**: `new_ver/` 변경·머지 금지였음.  
> **3차 전제**: Open=폴백 · Clone=Write · Lock=soft-lock(`testWooAiWkfLock`).

---

## RESULT 요약표

| PoC | 판정 | 증거(한 줄) | 결정된 폴백/경로 | 일자 |
|---|---|---|---|---|
| PoC-0 | PASS | Tools→Studio 렌더 | view 유지 | 2026-08-11 |
| PoC-1 | FAIL | html `xtk://open` 클릭해도 Explorer WKF 미오픈 (pk=26800) | 3차: 정보바+「콘솔에서 여세요」폴백 | 2026-08-11 |
| PoC-2 | PASS | Write OK `WKF_testWooPoC2_001` id=29140 · folder=1104(Campaign workflows) · **operation/program-id=0** → AI 프로그램(TEST1/2) UI에 안 보임. HUMAN 확인 | 3차: Write + **선택 프로그램(operation) 연결 필수** | 2026-08-11 |
| PoC-3 | FAIL(스킵) | HUMAN: workflow 확장 DB실험 불필요·불명확 → 미실시 | 3차: `woo:testWooAiWkfLock` soft-lock (코어 xtk:workflow 미확장) | 2026-08-11 |

---

## PoC-1 — `xtk://open` from urlViewer (MSHTML)

### 목적
Studio(JSSP-in-urlViewer)에서 WKF 편집창이 열리는지 확정. FAIL이면 3차는 폼 버튼/복사 폴백만.

### 준비
1. Explorer에서 **중지/편집 가능한 기존 WKF 1건** 선택 → Properties에서 **PK(id)** 기록.  
   예: `id=26021` (환경마다 다름).
2. Tools → Test Woo AI Studio 진입(이미 TG-C 경로).

### 검증 A (권장 · Studio 내)
1. 콘솔 **Administration > Configuration > Package jobs** 등이 아니라, Studio가 뜬 urlViewer 컨텍스트에서 아래를 **일회** 실행.  
   - 방법1: IE 개발자도구/콘솔이 되면 `location.href` 또는 `<a>` 클릭으로 테스트.  
   - 방법2: scratch HTML을 임시 JSSP로 서버에만 올리고(repo `new_ver` 커밋 금지) 링크 클릭.
2. 열 링크(PK 치환):

```
xtk://open/?schema=xtk:workflow&form=xtk:workflow&pk=<WKF_PK>
```

3. 성공: Explorer에 해당 WKF 편집 창이 열린다.  
4. 실패: 아무 반응 없음 / 프로토콜 무시 → **FAIL** (폴백 확정).

### 검증 B (보조)
동일 URL을 콘솔 클라이언트 HTML(또는 외부 IE)에서 실행해 A와 비교. A만 실패·B 성공이면 “urlViewer/MSHTML 제한”으로 기록.

### 판정 기입
- PASS → 3차 Open = `xtk://open/...pk=`
- FAIL → 3차 = 정보바에 PK/internalName + “콘솔에서 여세요” (+ 선택: extend form soapCall 버튼)

### 회신 한 줄 예시
`PoC-1 HUMAN: PASS — pk=26021 Explorer 편집창 열림`  
`PoC-1 HUMAN: FAIL — 클릭 무반응(MSHTML)`

---

## PoC-2 — template clone via Write (Spawn 금지)

### 목적
`queryDef` → `xtk.session.Write` insert로 **중지 상태** WKF가 복제되고 액티비티/전이가 보존되는지 확정.

### 준비 (HUMAN)
1. repo 원본: `old_ver/workflow/tamplate.xml` (**파일명 오타 유지** — `template.xml`로 고치지 말 것).  
   - 파일 루트는 `nms:operation`(캠페인)이며 내부에 `xtk:workflow`(`WKF89` 등) + `customActivity`(`library="uplus:customActivity.js"`)가 있음.
2. ACC에 **워크플로우 템플릿**(또는 동등 소스 WKF) 1건 확보:  
   - 옵션 A: 기존에 등록된 동등 템플릿 internalName 사용.  
   - 옵션 B: `tamplate.xml`의 workflow부를 템플릿/모델로 import(또는 수동 복제 후 `isModel` 정책은 환경 관례 따름).  
3. 소스 internalName을 메모 → 아래 스크립트 `SRC_NAME`에 넣기.  
4. **Spawn / Start / Execute 호출 금지.**

### 검증 스크립트 (JS Console · Rhino · 일회)

아래를 Administration > Production > Javascript codes 실행창 또는 동등 Console에서 실행.  
`SRC_NAME` / `NEW_NAME` / `FOLDER_ID` 만 치환.

```javascript
// PoC-2 scratch — DO NOT merge to new_ver. Spawn 금지.
var SRC_NAME = "WKF89";              // 템플릿/소스 internalName
var NEW_NAME = "WKF_testWooPoC2_001"; // 미사용 이름
var NEW_LABEL = "PoC-2 clone test";
var FOLDER_ID = 1104;                // 대상 폴더 id (환경값)

var qd = xtk.queryDef.create(
  <queryDef schema="xtk:workflow" operation="get">
    <select>
      <node expr="@id"/>
      <node expr="@internalName"/>
      <node expr="@label"/>
      <node expr="@state"/>
      <node expr="@status"/>
      <node expr="data"/>
    </select>
    <where>
      <condition expr={"@internalName = '" + SRC_NAME + "'"}/>
    </where>
  </queryDef>
);
var src = qd.ExecuteQuery();
if (!src || !src.@id) {
  logError("PoC-2: source workflow not found: " + SRC_NAME);
} else {
  var dataXml = src.data;
  // Write insert: id 제거·이름 교체. 환경에 맞게 속성 조정.
  var wf = <workflow
    xtkschema="xtk:workflow"
    _operation="insert"
    internalName={NEW_NAME}
    label={NEW_LABEL}
    folder-id={FOLDER_ID}
    state="0"
    status="0"
  >{dataXml}</workflow>;
  // data 자식이 중복되면 환경별로 data만 넣고 activities는 data 안에 유지할 것.
  xtk.session.Write(wf);
  logInfo("PoC-2: Write done name=" + NEW_NAME);

  var qd2 = xtk.queryDef.create(
    <queryDef schema="xtk:workflow" operation="get">
      <select>
        <node expr="@id"/>
        <node expr="@internalName"/>
        <node expr="@label"/>
        <node expr="@state"/>
        <node expr="@status"/>
        <node expr="@inProcess"/>
      </select>
      <where>
        <condition expr={"@internalName = '" + NEW_NAME + "'"}/>
      </where>
    </queryDef>
  );
  var created = qd2.ExecuteQuery();
  logInfo("PoC-2 created id=" + created.@id
    + " state=" + created.@state
    + " status=" + created.@status
    + " inProcess=" + created.@inProcess);
}
```

> Write XML 형태는 ACC 버전/권한에 따라 조정이 필요할 수 있다.  
> `data` CDATA 깨짐·`xtkschema` 누락이 흔한 FAIL 원인(가이드 §10).  
> 스크립트가 환경에서 바로 안 되면: Package export/import로 동등 복제 후 **수동으로 state=중지·Spawn 미사용**만 입증해도 폴백 PASS 근거가 된다.

### 성공 기준 체크
- [ ] 새 WKF `NEW_NAME` 존재
- [ ] 콘솔에서 열었을 때 Start→customActivity→… 전이 보존
- [ ] `customActivity` 노드 존재 (library 치환은 3차 이관 — PoC는 보존만)
- [ ] **실행 중 아님**(중지/편집, Spawn 미사용)
- [ ] 로그/스크립트에 `Spawn` 호출 없음

### 판정 기입
- PASS → 생성 `internalName=` ____ / `id=` ____  
- FAIL → 폴백: package export/import 런북 + 수동 복제

### 회신 한 줄 예시
`PoC-2 HUMAN: PASS — WKF_testWooPoC2_001 state=0 activities OK Spawn없음`  
`PoC-2 HUMAN: FAIL — Write data 깨짐 → package 폴백`

---

## PoC-3 — `@lockedBy` 스키마 영향 (staging only)

### 목적
`xtk:workflow`에 `@lockedBy` 확장 후 DB 구조 갱신 시 **기술 WF 영향·재시작 필요**를 Yes/No로 확정.  
FAIL(또는 위험)이면 3차는 soft-lock `woo:testWooAiWkfLock`만.

### 금지
- production 스키마 실험 금지
- 본 PoC용 스키마를 `new_ver/`에 커밋하지 말 것 (3차가 RESULT 보고 분기 구현)

### 검증 절차 (staging)
1. staging 콘솔에서 **임시** Data schema 생성(이름 예: `woo:testWooWorkflowExtPoC`):

```xml
<srcSchema namespace="woo" name="testWooWorkflowExtPoC"
           extendedSchema="xtk:workflow" label="PoC-3 lockedBy (staging)">
  <element name="workflow">
    <attribute name="lockedBy" label="AI Studio locked by"
               type="string" length="64" sqlname="sLockedBy"/>
  </element>
</srcSchema>
```

2. **Tools > Update database structure** 실행 → 적용 전/후 경고·영향 객체 메모.
3. **기술 WF 목록 기록** (최소):
   - Foundry 배치 (`WKF_testWooFoundry` 등)
   - 운영 배치/감시 WF (환경에 있는 것)
   - 샘플 업데이트 직후 오류·락·정지 여부
4. 샘플: 임의 비운영 WKF 1건에 `@lockedBy` 값 Write 후 저장·재오픈.
5. sysFilter 초안(문서만):

```
(@lockedBy = '' OR @lockedBy = $(login) OR ...)
```

6. **재시작 필요 Yes/No** 확정. Yes면 영향 WF 이름 나열.
7. PoC 종료 후: staging 임시 스키마 **롤백 계획** 기록(컬럼 잔존 허용 여부 포함). production 무변경.

### 성공 기준
- [ ] 영향 WF 목록 문서화
- [ ] 재시작 필요 Yes/No 확정
- [ ] sysFilter 초안 1줄 이상
- [ ] 치명 오류 없으면 PASS → 3차 `testWooWorkflowExt`  
- [ ] 기술 WF 장애/과도한 재시작이면 FAIL → 3차 `testWooAiWkfLock`

### 회신 한 줄 예시
`PoC-3 HUMAN: PASS — 재시작=No · 영향=Foundry만 확인 · soft-lock불요`  
`PoC-3 HUMAN: FAIL — Update DB 후 WKF_x 정지 → soft-lock 채택`

---

## 영향 WF 목록 (PoC-3 기입란)

| WF internalName | 역할 | 업데이트 후 상태 | 재시작 |
|---|---|---|---|
| | | | Yes/No |
| | | | |

---

## 3차 전제 (확정)

| 항목 | 값 |
|---|---|
| Open 경로 | **폴백** — 정보바에 name/PK + 「콘솔에서 여세요」(xtk://open 미사용) |
| Clone 경로 | **queryDef + Write** (`WKF_testWooPoC2_001` 실증) |
| **클론 소스 템플릿** | **`WKF89` / id=`26021`** (운영 확정). PoC-2 검증용 소스 `WKF94`와 무관 |
| Lock 경로 | **soft-lock** `woo:testWooAiWkfLock` (코어 `@lockedBy` 확장 안 함) |
| Spawn | 전 경로 금지 |

### HUMAN 추가 전제 — 클론 템플릿 (2026-08-11)

| 항목 | 값 |
|---|---|
| 템플릿 internalName | `WKF89` |
| 템플릿 id (PK) | `26021` |
| repo 원본 참고 | `old_ver/workflow/tamplate.xml` (파일명 오타 유지; 내장 WF가 WKF89 계열) |
| PoC-2에서 쓴 것 | `WKF94`(26800) — **API 검증용일 뿐**, 3차 템플릿 아님 |
| Option (3차 권장) | `testWooAiWkfTemplateName` = `WKF89` |

### HUMAN 추가 전제 — 프로그램 단위 (2026-08-11)

`@isAiFolder` 대상 = **Program 폴더** (`TEST1`=29110 / `TEST2`=29111).

| 관찰 | 값 |
|---|---|
| PoC-2 클론 folder-id | `1104` = Campaign workflows |
| PoC-2 operation-id | `0` → AI 트리 미표시 |
| WKF94 대조 | folder=1104 + operation-id 연결 필요 |

### HUMAN 정정 — 뎁스 한 단 (2026-08-11) ★3차 재작업 근거

**잘못된 해석:** AI Program 선택 = “캠페인 선택” → 바로 WKF.  
**올바른 계층:**

```
Program (@isAiFolder)  →  Campaign (nms:operation)  →  Workflow
```

| 용어 | ACC 객체 | Studio 역할 |
|---|---|---|
| AI 폴더/프로그램 | program / folder `@isAiFolder` | 2차 목록 (생성 없음) |
| 캠페인 | `nms:operation` | 생성 또는 선택 (3차+) |
| 워크플로 | `xtk:workflow` | 캠페인 아래 클론. `operation-id`=**캠페인 id** |

**제약:** 캠페인당 WKF ACC 상한 20 → Studio **Max=15**. 목록에 개수 표시, 15 도달 시 생성 차단.

**v=142 코드 상태:** Program id를 `operation-id`에 넣어 WKF를 만든 것은 **오해 구현**. PoC-C(캠페인 생성) 후 재작업.

### PoC-C — 캠페인(nms:operation) 생성

| 항목 | 내용 |
|---|---|
| 판정 | **PASS(위치만)** / **품질 FAIL** (2026-08-11) |
| 증거 | id=`20000` name=`OP_testWooPoCC_001` 가 TEST1 하위에 보임 |
| 품질 | Targeting and workflows 탭·Edit 섹션 부재 → **사용 불가 껍데기** (템플릿 미사용 bare Write) |
| 후속 | **PoC-T** — `opEmptyTemplate_LLM` / `wfEmptyTemplate_CUSTOM`(17234) 공식 API |

### HUMAN 템플릿 정정 (2026-08-11)

| 용도 | 템플릿 | 비고 |
|---|---|---|
| 새 캠페인 | `opEmptyTemplate_LLM` **id=10002** | UI와 동일. LLM Workflow 동반 생성 → 빈 캠페인+별도 WKF 불필요 |
| 기존 캠페인에 WKF 추가 | `wfEmptyTemplate_CUSTOM` **id=17234** | 원본 템플릿 · **CreateWorkflowFromModelId=FAIL(0)** → T3b |
| 아님 | `WKF89` 등 기생성 인스턴스 | 원본 템플릿 아님 |

공식: `CreateOperationFromModelId` (캠페인). WKF 추가는 Community 경로 `xtk.queryDef.CreateInstanceFromModel` 검증 중 (Spawn 금지).  
절차: [`04_3a_PoC_Template.md`](04_3a_PoC_Template.md)

### PoC-T3a — CreateWorkflowFromModelId

| 항목 | 내용 |
|---|---|
| 판정 | **FAIL** (2026-08-11) |
| 로그 | `workflowId=0` · 예외 없음 · 생성 없음 |
| 해석 | soft-fail (Adobe Community 동일). 이 경로 폐기 후보 |
| 다음 | **PoC-T3b** `CreateInstanceFromModel("xtk:workflow", 17234, diff)` |

### PoC-T3b — CreateInstanceFromModel

| 항목 | 내용 |
|---|---|
| 판정 | **PASS** (2026-08-11) |
| WKF | name=`WKF102` · label=`PoC-T3b WKF` · id≈29320 · folder=1104 |
| 캠페인 링크 | `[@operation-id]=23000` (OP48) |
| 상태 | Being edited (미실행) |
| 액티비티 | Start→AI 대상자 추출→Change Data Source→+Recipients→… (템플릿 그래프 보존) |
| 검증 스크립트 | `@operation-id` 파싱 오류만 — **생성과 무관** · 올바른 식은 `[@operation-id]` |
| 확정 API | `xtk.queryDef.CreateInstanceFromModel("xtk:workflow", 17234, <workflow label operation-id/>)` |

### v=144 코드 반영 (2026-08-11)

| 항목 | 내용 |
|---|---|
| `createCampaign` | T2 경로 (`testWooWorkflowClone.js`) |
| `createWkfFromTemplate` | T3b 경로 |
| litmus | Studio **v=144** → HUMAN 후 **v=145** (litmus 잔존+목록 스크롤) |

### v=144 HUMAN (2026-08-11) — 기능 PASS

| 항목 | 판정 |
|---|---|
| 새 캠페인 + LLM WKF + program | PASS |
| WKF 추가 · Being edited · 템플릿 그래프 | PASS |
| Max15 차단 | PASS |
| Spawn/자동 실행 없음 | PASS (Being edited 유지) |
| Option 숫자 Integer | OK (`parseInt` · text 불필요) |
| 진단 `js ok … v=143` | litmus 문자열 잔존 → **v=145에서 수정** |
| 목록 15건 UI 깨짐 | → **v=145** `#twDummyList` max-height 420px + overflow |

### Option `testWooAiBindPick_hiwoo`

| 항목 | 내용 |
|---|---|
| 용도 | Studio SQL 선택 → Apply용 임시 픽 (형식 `WKFname\\tai_sql_id`) |
| 값 `WKF94` alone | 구형/무효 · 코드가 tab 없으면 무시 |
| 삭제 | **Option 행 삭제 OK** (다음 SQL 클릭 시 재생성). 키 개념은 유지 |

### v=146 HUMAN — UI 고정 PASS (2026-08-11)

| 항목 | 판정 |
|---|---|
| litmus | `TW-BOOT v=146` + `js ok … v=146` |
| 작업영역 560px | PASS — 목록 장/단 동일 · composer 부유/잘림 해소 |
| 3차 기능축 | PASS (v=144에서 생성·Max15·Spawn 없음) |

### PoC-T2 — CreateOperationFromModelId + program-id

| 항목 | 내용 |
|---|---|
| 판정 | **PASS** (2026-08-11) |
| 캠페인 | id=`23000` name=`OP48` label=`[LGU+] LLM 활용 캠페인 템플릿` |
| program | `program-id=29110` · `/작업용/우해인/TEST1/` |
| 동반 WKF | id=`29290` name=`WKF101` · `modelName=wfEmptyTemplate_CUSTOM` · `operation-id=23000` · `state=0` · customActivity 포함 |
| 확정 절차 | ① `CreateOperationFromModelId(10002, <operation label/>)` ② `Write`로 `program-id` 연결 |
| 비고 | planning의 `<program>`은 무시됨. 새 캠페인 시 추가 WKF 클론 불필요 |

---

## 회신 형식 (Chat)

```
PoC-1 HUMAN: PASS|FAIL — <메모>
PoC-2 HUMAN: PASS|FAIL — <internalName|원인>
PoC-3 HUMAN: PASS|FAIL — 재시작=Yes|No · 영향=<목록|없음>
PoC-1~3 HUMAN: PASS|FAIL
```

전체 PASS 후에만: `@00_INDEX.md` + `3차`
