# PoC-T · 캠페인/WKF 템플릿 생성 API 검증

> **코드 머지·3차 재구현 전 필수.** 콘솔 일회 스크립트만.  
> PoC-C의 bare `Write` 캠페인은 **껍데기(FAIL 품질)** 로 판정 — Targeting/Workflow 탭 부재.

## HUMAN 확정 (2026-08-11)

| 구분 | internalName | id | 용도 |
|---|---|---|---|
| **캠페인 템플릿** | `opEmptyTemplate_LLM` | **10002** | **새 캠페인** 생성 시 — LLM Workflow 포함 |
| **WKF 템플릿(원본)** | `wfEmptyTemplate_CUSTOM` | **17234** | **기존 캠페인에 WKF 추가** 시 |
| 폐기 가정 | `WKF89` / 기생성 캠페인 내 WF | — | 이미 만들어진 인스턴스. **원본 템플릿 아님** |

## 왜 bare Write가 틀렸나

| 방식 | 결과 |
|---|---|
| `xtk.session.Write(<operation …>)` only | Explorer에 보이지만 form 탭/섹션 누락 → **사용 불가 껍데기** |
| 콘솔 UI: Template=`opEmptyTemplate_LLM` | Targeting and workflows 등 정상 |

## 어도비 공식 API (권장 경로)

| API | 문서 | 용도 |
|---|---|---|
| `nms.operation.CreateOperationFromModelId(modelId, operationPlanning)` | [CreateOperationFromModelId](https://experienceleague.adobe.com/developer/campaign-api/api/sm-operation-CreateOperationFromModelId.html) | 캠페인 템플릿 → 캠페인 인스턴스 |
| `nms.operation.CreateWorkflowFromModelId(modelId, operationPlanning)` | [CreateWorkflowFromModelId](https://experienceleague.adobe.com/developer/campaign-api/api/sm-operation-CreateWorkflowFromModelId.html) | WKF 템플릿 → 캠페인 내 WKF |
| (대안) `xtk.queryDef` / `CreateInstanceFromModel` | Community 실측 | WKF 생성 후 `operation-id` 패치 |
| (배송 유사) `createFromModel` + Write | [ACC JS SDK Writer](https://opensource.adobe.com/acc-js-sdk/xtkWrite.html) | 템플릿 기반 엔티티 초기화 |

**금지:** `xtk:workflow#Spawn` (실행까지 시작함 — 가드레일).

## 목표 설계 (검증 PASS 후 3차 반영)

```
[새 캠페인]
  Program 선택
  → CreateOperationFromModelId(opEmptyTemplate_LLM의 id, planning+program)
  → 캠페인 + LLM WKF가 함께 생김 (별도 빈 캠페인 Write 불필요)

[기존 캠페인에 WKF 추가]
  Campaign 선택 · wkfCount < 15
  → CreateWorkflowFromModelId(17234, planning) 또는 CreateInstanceFromModel
  → operation에 연결 · 중지 상태
```

## PoC-T1 — 캠페인 템플릿 id (HUMAN 확정)

| 항목 | 값 |
|---|---|
| 판정 | **PASS** (HUMAN 제공, 2026-08-11) |
| id | **10002** |
| internalName | `opEmptyTemplate_LLM` |

(재확인이 필요하면 name=`opEmptyTemplate_LLM` queryDef로 `@id=10002`만 대조.)

## PoC-T2 — CreateOperationFromModelId (새 캠페인)

`PROGRAM_FULLNAME` = `/작업용/우해인/TEST1/` (환경값).

```javascript
// PoC-T2 전체 — DO NOT merge. Spawn 금지.
// 1) 템플릿 10002로 생성  2) program-id=29110 연결  3) 조회 확인
// (planning의 program은 무시되므로 반드시 2단계 Write)
var MODEL_ID = 10002;      // opEmptyTemplate_LLM
var PROGRAM_ID = 29110;    // TEST1
var LABEL = "PoC-T2 LLM campaign";

var planning = <operation label={LABEL}/>;
var newId = 0;

try {
  newId = nms.operation.CreateOperationFromModelId(MODEL_ID, planning);
  logInfo("PoC-T2 step1 CreateOperationFromModelId → id=" + newId);
} catch (e1) {
  logError("PoC-T2 step1 FAIL: " + e1);
}

if (newId) {
  try {
    xtk.session.Write(
      <operation xtkschema="nms:operation" _operation="update"
                 id={newId} program-id={PROGRAM_ID}/>
    );
    logInfo("PoC-T2 step2 program-id=" + PROGRAM_ID + " OK");
  } catch (e2) {
    logError("PoC-T2 step2 attr FAIL: " + e2);
    try {
      xtk.session.Write(
        <operation xtkschema="nms:operation" _operation="update" id={newId}>
          <program id={PROGRAM_ID}/>
        </operation>
      );
      logInfo("PoC-T2 step2 link OK");
    } catch (e3) {
      logError("PoC-T2 step2 link FAIL: " + e3);
    }
  }

  var q = xtk.queryDef.create(
    <queryDef schema="nms:operation" operation="get">
      <select>
        <node expr="@id"/>
        <node expr="@internalName"/>
        <node expr="@label"/>
        <node expr="[@program-id]"/>
        <node expr="[program/@fullName]"/>
      </select>
      <where>
        <condition expr={"@id = " + newId}/>
      </where>
    </queryDef>
  );
  var o = q.ExecuteQuery();
  logInfo("PoC-T2 check id=" + o.@id
    + " name=" + o.@internalName
    + " label=" + o.@label
    + " program-id=" + o.@["program-id"]
    + " program=" + o.program.@fullName);
}
```

### 성공 기준
- [x] Explorer TEST1 아래 캠페인 생성
- [x] 템플릿 품질(LLM WKF·customActivity) — XML 증거
- [x] program-id 연결

회신: `PoC-T2 HUMAN: PASS|FAIL — id=…`

### PoC-T2 실측 (2026-08-11) — PASS

| 결과 | 내용 |
|---|---|
| step1 | CreateOperationFromModelId(10002) → **id=23000** OP48 |
| step2 | `program-id=29110` OK · program=`/작업용/우해인/TEST1/` |
| 동반 WKF | **WKF101 / id=29290** · modelName=`wfEmptyTemplate_CUSTOM` · state=0 · AI 대상자 추출(customActivity) |
| 실패분 | id=22000(program=0) — HUMAN 삭제 |

```javascript
// PoC-T2c — program-id 연결 (TEST1=29110)
var OP_ID = 22000;
var PROGRAM_ID = 29110;

xtk.session.Write(
  <operation xtkschema="nms:operation" _operation="update"
             id={OP_ID} program-id={PROGRAM_ID}/>
);
// 또는
// <operation ... id={OP_ID}><program id={PROGRAM_ID}/></operation>

logInfo("PoC-T2c program-id set");
```

> API 시그니처/planning XML이 환경에서 실패하면 에러 전문 회신.  
> 대안: `nms.operation.createFromModel` 존재 여부도 같은 Chat에서 시도 가능.

## PoC-T3 — 기존 캠페인에 WKF 추가 (wfEmptyTemplate_CUSTOM=17234)

권장 대상: **OP48 / id=23000** (T2 PASS분 · 이미 WKF101 있음 → 2번째 WKF가 붙는지 확인).  
껍데기 `OP_testWooPoCC_001` 비권장.

### PoC-T3a — CreateWorkflowFromModelId → **FAIL (실측)**

```javascript
// 결과: workflowId=0 · 예외 없음 · DB 변화 없음
var wfId = nms.operation.CreateWorkflowFromModelId(17234, <operation id="23000"/>);
```

| 항목 | 내용 |
|---|---|
| 판정 | **FAIL** (2026-08-11) |
| 로그 | `CreateWorkflowFromModelId → workflowId=0` |
| 의미 | API가 “성공처럼” 끝나도 **인스턴스 미생성**. Adobe Community도 동일 (`plWorkflowId=0`) |
| 추정 | (1) planning XML이 캠페인 스케줄 형식이 아님 (2) 캠페인당 이 API로는 1개만 되는 제약이 있다는 보고 (OP48은 이미 WKF101 보유) |

→ **공식 문서 API지만 이 환경/케이스에서는 사용 불가.** 아래로 전환.

### PoC-T3b — CreateInstanceFromModel (권장 재시도)

문서: [CreateInstanceFromModel](https://experienceleague.adobe.com/developer/campaign-api/api/sm-queryDef-CreateInstanceFromModel.html)  
Community 해결책과 동일: `xtk:workflow` 템플릿 인스턴스 + `operation-id` 패치.

```javascript
// PoC-T3b — DO NOT merge. Spawn 금지.
// 주의: query 표현식은 [@operation-id] (하이픈 attribute는 대괄호 필수)
var WF_MODEL_ID = 17234; // wfEmptyTemplate_CUSTOM
var CAMPAIGN_ID = 23000; // OP48
var LABEL = "PoC-T3b WKF";

try {
  var diff =
    <workflow label={LABEL} operation-id={CAMPAIGN_ID}/>;

  var wfId = xtk.queryDef.CreateInstanceFromModel(
    "xtk:workflow",
    WF_MODEL_ID,
    diff
  );
  logInfo("PoC-T3b CreateInstanceFromModel → workflowId=" + wfId);

  if (wfId == 0 || !wfId) {
    logError("PoC-T3b FAIL: id=0 (no instance)");
  } else {
    var q = xtk.queryDef.create(
      <queryDef schema="xtk:workflow" operation="get">
        <select>
          <node expr="@id"/>
          <node expr="@internalName"/>
          <node expr="@label"/>
          <node expr="@state"/>
          <node expr="[@operation-id]"/>
          <node expr="@modelName"/>
        </select>
        <where>
          <condition expr={"@id=" + wfId}/>
        </where>
      </queryDef>
    );
    var w = q.ExecuteQuery();
    logInfo(
      "PoC-T3b check id=" + w.@id +
      " name=" + w.@internalName +
      " label=" + w.@label +
      " state=" + w.@state +
      " operation-id=" + w["@operation-id"] +
      " modelName=" + w.@modelName
    );
  }
} catch (e) {
  logError("PoC-T3b FAIL: " + e);
}
```

### PoC-T3b 실측 (2026-08-11) — 생성 OK / 검증 쿼리 버그

| 결과 | 내용 |
|---|---|
| CreateInstanceFromModel | **workflowId=29320** ← 생성 성공 |
| 후속 ExecuteQuery | FAIL — `@operation-id` 파싱 오류 (`Attribute 'operation' unknown`) |
| 원인 | XTK 표현식에서 하이픈 attribute는 **`[@operation-id]`** 필요 |
| SCR-160012 | 검증 예외가 스크립트 평가 오류로 이어진 것 (생성 자체와 무관) |

### PoC-T3b-check — id=29320만 재조회 (재생성 금지)

```javascript
// PoC-T3b-check — 이미 생성된 29320만 확인
var wfId = 29320;
var q = xtk.queryDef.create(
  <queryDef schema="xtk:workflow" operation="get">
    <select>
      <node expr="@id"/>
      <node expr="@internalName"/>
      <node expr="@label"/>
      <node expr="@state"/>
      <node expr="[@operation-id]"/>
      <node expr="@modelName"/>
      <node expr="@isModel"/>
    </select>
    <where>
      <condition expr={"@id=" + wfId}/>
    </where>
  </queryDef>
);
var w = q.ExecuteQuery();
logInfo(
  "PoC-T3b-check id=" + w.@id +
  " name=" + w.@internalName +
  " label=" + w.@label +
  " state=" + w.@state +
  " operation-id=" + w["@operation-id"] +
  " modelName=" + w.@modelName +
  " isModel=" + w.@isModel
);
```

### 성공 기준
- [x] `workflowId` **≠ 0** (29320 / WKF102)
- [x] OP48 아래 WKF **추가** (WKF101과 별개 · HUMAN UI)
- [x] `[@operation-id]=23000` · 액티비티 보존 · Being edited(미실행)
- [x] Spawn 미사용

**PoC-T3b HUMAN: PASS** — WKF102 / operation-id=23000 / LLM 그래프 확인

## 3차 코드 영향 — v=144 반영

| v=143 | v=144 |
|---|---|
| `createCampaign` bare Write | `CreateOperationFromModelId` + `program-id` Write |
| `createWkf` WKF89 data 클론 | `xtk.queryDef.CreateInstanceFromModel` (17234) |
| Option `testWooAiWkfTemplateName=WKF89` | 기본 `wfEmptyTemplate_CUSTOM` + `testWooAiWkfTemplateId=17234` |
| (없음) | `testWooAiCampaignTemplateId=10002` |

**롤백:** JS 라이브러리 `testWooWorkflowClone.js` 이전 버전 복원 + Studio litmus v=143.  
PoC-C 껍데기 캠페인·실패한 OP(program=0)는 콘솔 삭제 권장.
