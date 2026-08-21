# Adobe Campaign Classic v8 — 커스텀 기능 개발 가이드

> **독립 문서.** ACC Client에서 새 워크플로우 기능·커스텀 액티비티·OOTB UI 확장·임시 테이블 연동을 처음부터 구현할 때 필요한 핵심만 정리합니다.  
> **대상:** Adobe Campaign Classic v8 (ACC)  
> **전제:** Administration > Configuration 접근 권한, JavaScript·XML 기본 지식

---

## 목차

1. [ACC에서 “새 기능”을 만드는 방법](#1-acc에서-새-기능을-만드는-방법)
2. [전체 아키텍처](#2-전체-아키텍처)
3. [커스텀 워크플로우 액티비티 — 완전 가이드](#3-커스텀-워크플로우-액티비티--완전-가이드)
4. [런타임 객체: activity · vars · task](#4-런타임-객체-activity--vars--task)
5. [임시 테이블(Temp Table) — 읽기·쓰기·전달](#5-임시-테이블temp-table--읽기쓰기전달)
6. [Transition(전이) 설계와 구현](#6-transition전이-설계와-구현)
7. [Input Form — 액티비티 UI와 xtk:workflow merge](#7-input-form--액티비티-ui와-xtkworkflow-merge)
8. [OOTB 액티비티 UI 확장 (버튼·팝업 추가)](#8-ootb-액티비티-ui-확장-버튼팝업-추가)
9. [확장 스키마 SOAP Method (Client ↔ Server JS)](#9-확장-스키마-soap-method-client--server-js)
10. [워크플로우 XML 저장 구조](#10-워크플로우-xml-저장-구조)
11. [배포 절차](#11-배포-절차)
12. [테스트·디버깅](#12-테스트디버깅)
13. [제약·한계·금지사항](#13-제약한계금지사항)
14. [새 기능 구현 체크리스트](#14-새-기능-구현-체크리스트)
15. [부록: 최소 코드 템플릿](#15-부록-최소-코드-템플릿)

---

## 1. ACC에서 “새 기능”을 만드는 방법

ACC에 기능을 추가하는 경로는 크게 **세 가지**입니다. 목적에 맞게 선택하거나 조합합니다.

| 경로 | 언제 쓰는가 | 핵심 객체 |
|------|-------------|-----------|
| **A. 커스텀 워크플로우 액티비티** | 팔레트에 새 블록을 추가하고, 실행 시 JS 로직 수행 | JS code, `{ns}:workflow` schema, `{ns}:activity` form, `xtk:workflow` merge |
| **B. OOTB 액티비티/폼 UI 확장** | Query·Enrichment 등 **기존 액티비티 화면**에 버튼·필드·탭 추가 | `xtk:workflow` Input form **부분 merge**, (선택) 별도 Input form |
| **C. 확장 스키마 SOAP Method** | Client 폼에서 **서버 JS** 호출 (DOM 가공, DB 조회, 검증) | `{ns}:workflow` `<methods>`, JS library |

```
┌─────────────────────────────────────────────────────────────┐
│  Campaign Client (Input Form XML)                           │
│    palette / subFormLink / soapCall / enter·leave           │
└──────────────────────────┬──────────────────────────────────┘
                           │ 저장 → workflow data XML
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  xtk:workflow Data schema (+ {ns}:workflow 확장)            │
│    activities/{activityName}/@attributes                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ 워크플로우 실행
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  JavaScript code ({ns}:{activity}.js)                       │
│    {activity}_call()  — activity / vars / task / sqlExec    │
└──────────────────────────┬──────────────────────────────────┘
                           │ population 전달
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  SQL Temp Table  temp:workflow:{wfId}_{act}_{transition}    │
└─────────────────────────────────────────────────────────────┘
```

**실무 조합 예**

- 팔레트 새 액티비티 + temp 읽어 SQL 처리 → **A**
- Query 옆에 “추가 설정…” 버튼 → **B** (+ 필요 시 **C**)
- 폼에서 복잡한 XML merge → **C** (staging 패턴 필수)

---

## 2. 전체 아키텍처

### 2.1 필수 구성 요소 (커스텀 액티비티 A 경로)

| # | 객체 | Administration 경로 | 역할 |
|---|------|---------------------|------|
| 1 | `{ns}:{name}.js` | Configuration > **JavaScript codes** | `{name}_call()` 실행 로직 |
| 2 | `{ns}:workflow` | Configuration > **Data schemas** | `xtk:workflow` 확장 — element, attribute, transition, method |
| 3 | `{ns}:{name}` | Configuration > **Input forms** | 액티비티 더블클릭 Edit UI |
| 4 | `{ns}:{name}.png` (선택) | Configuration > **Images** | 팔레트·캔버스 아이콘 |
| 5 | `xtk:workflow` (merge) | Configuration > **Input forms** | 팔레트 등록 + subform 연결 |

### 2.2 Namespace

- 조직 표준 namespace 사용 (예: `uplus`, `cus`).
- JS file name, schema name, form name, `library` attribute, `ref` 경로가 **모두 일치**해야 합니다.

| 항목 | 예 |
|------|-----|
| JS code | `uplus:myFeature.js` |
| Schema | `uplus:workflow` (extends `xtk:workflow`) |
| Activity element | `name="myFeature"` |
| library attribute | `default="'uplus:myFeature.js'"` |
| Input form | `uplus:myFeature` |
| subform ref | `ref="uplus:myFeature:myFeatureForm"` |

### 2.3 ACC가 액티비티를 실행하는 순서

1. 워크플로우 엔진이 직전 액티비티 완료 후 **inbound vars** 주입  
2. 스키마 `library`에 지정된 JS의 **`{elementName}_call()`** 호출  
3. JS가 `task.postEvent(...)` 로 다음 transition 발생  
4. **`task.setCompleted()`** 호출 — **반드시** 필요 (누락 시 액티비티 hang)  
5. (재호출 시) `{elementName}_recall()` — 대부분 stub, 로그만

---

## 3. 커스텀 워크플로우 액티비티 — 완전 가이드

### 3.1 Data schema — activity element

`template="xtk:workflow:activity"` 를 사용합니다.

```xml
<srcSchema extendedSchema="xtk:workflow" name="workflow" namespace="uplus"
           xtkschema="xtk:srcSchema" ...>

  <!-- ① 액티비티 element 정의 -->
  <element name="myFeature" label="My Feature"
           img="uplus:myFeature48.png"
           template="xtk:workflow:activity">

    <!-- 실행 JS (필수) -->
    <attribute name="library" default="'uplus:myFeature.js'"/>
    <!-- 캔버스 아이콘 -->
    <attribute name="img" default="'uplus:myFeature48.png'"/>

    <!-- ACC 표준 activity flags -->
    <attribute name="andJoin" type="boolean" default="false"/>
    <attribute name="distributable" type="boolean" default="true"/>
    <attribute name="shouldSync" type="boolean" default="true"/>

    <!-- 커스텀 파라미터 (UI·XML·JS activity.* 로 노출) -->
    <attribute name="label" type="string" label="Label"/>
    <attribute name="enableDebugging" type="boolean" label="Enable debugging"/>
    <attribute name="myParam" type="string" label="My parameter"/>

    <!-- 0:N 리스트 파라미터 -->
    <element name="items">
      <element name="item" unbound="true">
        <attribute name="key" type="string"/>
        <attribute name="value" type="string"/>
      </element>
    </element>

    <!-- ENUM (스키마 레벨 enumeration 정의 후 참조) -->
    <!-- <attribute name="mode" type="byte" enum="myEnum"/> -->

    <!-- Transition 정의 -->
    <element name="transitions">
      <element name="done" template="xtk:workflow:transition">
        <attribute name="label" translatedDefault="'Ok'"/>
        <attribute name="enabled" default="true"/>
      </element>
      <element name="error" template="xtk:workflow:transition">
        <attribute name="label" translatedDefault="'Error'"/>
        <attribute name="enabled" default="false"/>
      </element>
    </element>
  </element>

  <!-- ② workflow activities에 등록 (필수) -->
  <element name="workflow">
    <element name="activities" xml="true">
      <element name="myFeature" ref="myFeature" unbound="true"/>
    </element>
  </element>

</srcSchema>
```

**schema attribute type 참고**

| type | JS에서 | UI input |
|------|--------|----------|
| `string` | `activity.myParam` | `<input xpath="@myParam"/>` |
| `long` / `int` | number | `<input xpath="@myParam"/>` |
| `boolean` / `bool` | true/false | `type="checkbox"` |
| `byte` + enum | enum value | `<input xpath="@mode"/>` (enum 자동) |
| unbound element | `activity.items.item` 배열 | `type="list"` |

### 3.2 JavaScript — 진입점 skeleton

```javascript
/**
 * uplus:myFeature.js
 * activity — property object (E4X XML 아님)
 */
function myFeature_call() {
    logInfo("myFeature_call");
    try {
        if (activity.enableDebugging) {
            logInfo("param=" + activity.myParam);
            logInfo("table=" + vars.tableName + ", schema=" + vars.targetSchema);
        }

        // === 핵심 로직 ===
        myFeature_doWork();

        task.postEvent(task.transitionByName("done"));
        task.setCompleted();
        return 0;

    } catch (e) {
        if (myFeature_isErrorEnabled()) {
            logInfo("myFeature error: " + e);
            task.postEvent(task.transitionByName("error"));
        } else {
            logError("myFeature error: " + e);
        }
        task.setCompleted();
        return 0;
    }
}

function myFeature_recall() {
    logInfo("myFeature_recall");
}

function myFeature_isErrorEnabled() {
    try {
        var tr = activity.transitions.error;
        return tr && (tr.enabled === true || tr.enabled === "true" || tr.enabled === 1);
    } catch (e) { return false; }
}
```

### 3.3 Input Form — 액티비티 Edit UI

```xml
<form name="myFeature" namespace="uplus" xtkschema="xtk:form" ...>
  <form name="myFeatureForm">
    <container type="notebook">
      <container label="My Feature">
        <container label="Settings" type="frame">
          <input xpath="@label"/>
          <input xpath="@myParam"/>
          <input label="Enable debugging" type="checkbox" xpath="@enableDebugging"/>
          <input label="Process errors" type="checkbox"
                 xpath="transitions/error[@name='error']/@enabled"/>
        </container>
        <container label="Items" type="frame">
          <input type="list" xpath="items/item" zoom="false" editable="true">
            <input xpath="@key"/>
            <input xpath="@value"/>
          </input>
        </container>
      </container>
      <!-- ACC 표준 Advanced 탭 -->
      <container ref="xtk:workflow:lib/tabs/advancedActivityPage"/>
    </container>
  </form>
</form>
```

### 3.4 xtk:workflow merge — 팔레트 + subform

**① palette** (`<container name="palette">` 직계 자식):

```xml
<container img="xtk:new.png" label="Custom" name="customPalette">
  <input img="uplus:myFeature16.png" label="My Feature" xpath="myFeature"/>
</container>
```

**② subforms** (`<container name="subforms"` 직계 자식):

```xml
<form name="myFeature" ref="uplus:myFeature:myFeatureForm"/>
```

`ref` 형식: `{formNamespace}:{formName}:{innerFormName}`

---

## 4. 런타임 객체: activity · vars · task

### 4.1 activity — 설정값 (워크플로우 XML에 저장)

| 접근 | 설명 |
|------|------|
| `activity.label` | UI label |
| `activity.name` | 액티비티 internal name (워크플로우 내 unique) |
| `activity.myParam` | schema attribute |
| `activity.transitions.done.enabled` | transition on/off |
| `activity.items` | 0:N child element |

- **E4X XML이 아님** — dot notation property object.
- UI에서 저장하지 않은 attribute는 default 또는 empty.

### 4.2 vars — inbound population (직전 액티비티가 넘김)

| vars 필드 | 타입/예 | 설명 |
|-----------|---------|------|
| `vars.tableName` | `Wkf12345_query_done` | 실제 SQL 테이블명 |
| `vars.targetSchema` | `temp:workflow:12345_query_done` | queryDef용 temp schema id |
| `vars.recCount` | number | 현재 population 행 수 |
| `vars.description` | number/string | UI 표시용 (보통 recCount) |

**inbound 없는 액티비티** (Start 직후 등): `vars.tableName` / `vars.targetSchema` 가 비어 있음.

```javascript
if (!vars.tableName) {
    throw "No inbound population. Connect a Query (or similar) activity first.";
}
```

### 4.3 task — 실행 제어

| API | 용도 |
|-----|------|
| `task.setCompleted()` | 액티비티 종료 (**필수**) |
| `task.postEvent(task.transitionByName("done"))` | transition 발생 |
| `task.postEvent(task.doneTransition())` | OOTB success helper |
| `task.postEvent(task.errorTransition())` | OOTB error helper |
| `task.transitionByName("remainder")` | named transition object |

**주의:** `task.postEvent("done")` 처럼 **문자열 직접 전달 불가** → `SCR-160019` 등 오류.

### 4.4 SQL / queryDef API (JS 내)

| API | 용도 |
|-----|------|
| `sqlGetInt("SELECT COUNT(*) FROM " + vars.tableName)` | 단일 값 |
| `sqlExec("DELETE FROM ...")` | DML |
| `sqlSelect("SELECT ...", "alias", false)` | 결과셋 |
| `xtk.queryDef.create(xml).ExecuteQuery()` | schema 기반 조회 |

---

## 5. 임시 테이블(Temp Table) — 읽기·쓰기·전달

워크플로우 액티비티 간 population은 **SQL 임시 테이블**로 전달됩니다. 커스텀 기능의 핵심은 이 temp를 **올바르게 읽고, 필요 시 수정하고, 다음 액티비티에 넘기는 것**입니다.

### 5.1 Temp schema / table 네이밍

ACC OOTB 규칙:

```
temp:workflow:{workflowInternalId}_{sourceActivityName}_{transitionName}
```

| 예 | 의미 |
|----|------|
| `temp:workflow:301_query_done` | workflow 301, query 액티비티, done transition 출력 |
| `temp:workflow:301_enrich2_done` | enrichment 출력 |

**특수 케이스 (OOTB)**

| 패턴 | 조건 |
|------|------|
| `temp:workflow:{id}_{wkfSourceActivity(@name)}` | Query `@useSource=true` (inbound event) |
| `temp:group:{group-id}` | Read group |
| `temp:webApp:{survey-id}` | WebApp |

`vars.tableName`은 위 schema에 대응하는 **물리 SQL 테이블명** (prefix `Wkf` 등 인스턴스별).

### 5.2 XPath → SQL 컬럼 매핑

temp 테이블 컬럼명 규칙:

```
@fieldName  →  iFieldName   (@ 제거, i + PascalCase)
@id         →  iId
@email      →  iEmail
```

```javascript
function xpathToSqlCol(xpathField) {
    if (!xpathField || xpathField.charAt(0) != "@") {
        xpathField = "@" + xpathField;
    }
    var name = xpathField.substr(1);
    return "i" + name.charAt(0).toUpperCase() + name.substr(1);
}
```

Enrichment로 alias·join 키가 바뀌면 schema attribute로 **join 키 xpath**를 UI에 노출하세요.

### 5.3 Temp 읽기 — queryDef (권장)

`vars.targetSchema`를 사용합니다. **tableName 문자열 직접 조립보다 schema 기반이 안전**합니다.

```javascript
function readTempColumn(columnAlias) {
    if (!vars.targetSchema) {
        return [];
    }
    var q = new XML(
        <queryDef schema={vars.targetSchema} operation="select">
            <select>
                <node expr={"[" + columnAlias + "]"}/>
            </select>
        </queryDef>
    );
    var result = xtk.queryDef.create(q).ExecuteQuery();
    var out = [];
    for each (var row in result) {
        out.push(String(row[columnAlias]));
    }
    return out;
}
```

- Query 액티비티 **Additional data**에 추가한 필드는 alias 이름으로 select.
- `@email`이 아니라 alias `@colEmail`이면 `[colEmail]` 또는 `[@colEmail]` (schema 정의 따름).

### 5.4 Temp 읽기/쓰기 — sqlExec (대량 처리)

대량 DELETE/UPDATE/INSERT는 row loop 대신 **set-based SQL** 1회가 효율적입니다.

```javascript
var before = sqlGetInt("SELECT COUNT(*) FROM " + vars.tableName);

sqlExec("DELETE FROM " + vars.tableName + " WHERE iEmail LIKE '%@test.com'");

var after = sqlGetInt("SELECT COUNT(*) FROM " + vars.tableName);
vars.recCount = after;
vars.description = after;

logInfo("removed=" + (before - after) + ", remaining=" + after);
```

**필수:** population 변경 후 `vars.recCount` / `vars.description` 갱신 — 후속 UI·로그·조건 분기에 반영됩니다.

### 5.5 다음 액티비티로 population “넘기기”

| 방식 | 가능 여부 | 설명 |
|------|-----------|------|
| **같은 temp 유지** (inbound 수정만) | ✅ | DELETE/UPDATE 후 `done` transition — 다음 액티비티가 **같은 vars.tableName** 수신 |
| **queryDef select** | ✅ | 읽기 전용 |
| **새 temp 생성 후 vars 교체** | ⚠️ 제한적 | complement 패턴 (아래) |
| **OOTB처럼 완전한 새 temp schema 등록** | ❌ | 공식 API 없음 — ACC 엔진 내부 처리 |

**ACC 알려진 한계:** 커스텀 액티비티가 Query/Enrichment처럼 **새 temp schema를 엔진에正式 등록**하는 API는 문서화되어 있지 않습니다. 실무 우회:

1. **inbound temp 직접 수정** (DELETE/UPDATE) → 가장 흔함  
2. **`CREATE TABLE ... AS SELECT`** 로 complement 생성 → 특정 transition에서 vars 스왑  
3. **JavaScript transition / Query 재실행** — 설계상 피하고, 1·2 우선

### 5.6 Complement(분기) population 패턴

**done** = 처리 후 남은 행, **remainder** = 제외된 행처럼 **두 갈래 population**이 필요할 때:

```javascript
var mainTable = vars.tableName;
var complementTable = mainTable + "R";

sqlExec("DROP TABLE IF EXISTS " + complementTable);
sqlExec(
    "CREATE TABLE " + complementTable + " AS " +
    "SELECT * FROM " + mainTable + " WHERE /* complement 조건 */"
);
sqlExec("DELETE FROM " + mainTable + " WHERE /* main 조건 */");

excludeFilter_updatePopulationCount(mainTable);  // vars.recCount 갱신

// remainder transition postEvent 전 vars 스왑
vars.remainderTableName = complementTable;
vars.remainderRecCount = sqlGetInt("SELECT COUNT(*) FROM " + complementTable);

// postEvent 시:
var saved = { table: vars.tableName, count: vars.recCount, desc: vars.description };
vars.tableName = vars.remainderTableName;
vars.recCount = vars.remainderRecCount;
vars.description = vars.remainderRecCount;
task.postEvent(task.transitionByName("remainder"));
vars.tableName = saved.table;
vars.recCount = saved.count;
vars.description = saved.desc;
```

### 5.7 UI 설계 시 exec schema (`/ignored/@querySchemaExec`)

OOTB Query 편집 UI는 `@schema`가 temp일 때 **실행용 schema**를 별도 계산합니다:

```javascript
// transition output이 temp: 이면
'temp:workflow:' + workflowId + '_' + activityName + '_' + transitionName
```

filterView·preview 등 OOTB 컨트롤은 `propagateXPathToCtx="/ignored/@querySchemaExec|/@querySchemaExec"` 로 이 값을 사용합니다.

**커스텀 UI에서 OOTB filterView에 의존하지 않을 것** — programmatic apply가 Client C++ 전용이라 form script만으로는 where 반영이 안 되는 경우가 많습니다. **직접 XML xpath 수정 + (필요 시) SOAP method** 패턴이 안전합니다.

---

## 6. Transition(전이) 설계와 구현

### 6.1 Schema 정의

```xml
<element name="transitions">
  <element name="done" template="xtk:workflow:transition">
    <attribute name="label" translatedDefault="'Ok'"/>
    <attribute name="enabled" default="true"/>
  </element>
  <element name="remainder" template="xtk:workflow:transition">
    <attribute name="label" translatedDefault="'Other'"/>
    <attribute name="enabled" default="false"/>
  </element>
  <element name="error" template="xtk:workflow:transition">
    <attribute name="label" translatedDefault="'Error'"/>
    <attribute name="enabled" default="false"/>
  </element>
</element>
```

### 6.2 UI에서 transition toggle

```xml
<input label="Process errors" type="checkbox"
       xpath="transitions/error[@name='error']/@enabled"/>
<input label="Enable second output" type="checkbox"
       xpath="transitions/remainder[@name='remainder']/@enabled"/>
```

### 6.3 JS에서 enabled 확인 + postEvent

```javascript
function isTransitionEnabled(name) {
    try {
        var tr = activity.transitions[name];
        return tr && (tr.enabled === true || tr.enabled === "true" || tr.enabled === 1);
    } catch (e) { return false; }
}

// success — 후보 이름 fallback (구버전 호환)
var successNames = ["done", "true", "ok", "result"];
for (var i = 0; i < successNames.length; i++) {
    if (isTransitionEnabled(successNames[i])) {
        task.postEvent(task.transitionByName(successNames[i]));
        break;
    }
}
```

### 6.4 Error handling 두 가지

| 방식 | 동작 |
|------|------|
| `logError(...)` | 워크플로우 **일시 중지**, 액티비티 error 상태 |
| error transition enabled + `task.postEvent(error)` | 워크플로우 **계속**, error 분기로 population 전달 |

---

## 7. Input Form — 액티비티 UI와 xtk:workflow merge

### 7.1 xtk:workflow merge 위치 (표준 3곳)

| # | 검색 | 내용 |
|---|------|------|
| 1 | `<container name="palette">` | Custom 팔레트 + `<input xpath="myFeature"/>` |
| 2 | `<container name="subforms"` | `<form name="myFeature" ref="..."/>` |
| 3 | `<!--[of]:Detail-->` **바로 위** (선택) | 워크플로우 **하단 공통 탭** (액티비티 일괄 설정) |

> **절대 금지:** OOTB `xtk:workflow` Input form **전체 파일 교체**.  
> 서버 ACC 빌드 버전과 불일치 시 Client XML 파싱 실패 → 로그인 불가 수준.

### 7.2 subFormLink — 팝업/dialog

OOTB “Edit query...” 와 동일 패턴:

```xml
<input label="설정..." type="subFormLink" xpath="." prebuildSubForm="false">
  <form ref="uplus:myDialog:lib/settingsForm"/>
</input>
```

| attribute | 설명 |
|-----------|------|
| `xpath="."` | **현재 액티비티 노드** 컨텍스트 (누락 시 xpath 오류) |
| `prebuildSubForm="false"` | 열 때 로드 |
| `align="right"` | colcount=2 레이아웃에서 오른쪽 배치 |
| `nothingToSave="true"` | (자식 form) dialog만 닫고 부모 저장은 별도 |

### 7.3 enter / leave 훅

```xml
<form name="settingsForm" nothingToSave="true">
  <enter>
    <set expr="@schema" xpath="/ignored/@schema"/>
    <reset xpath="/tmp/@workValue"/>
  </enter>
  <leave>
    <!-- OK 클릭 시 — 부모 activity XML 수정 -->
    <set expr="[/tmp/@workValue]" xpath="@myParam"/>
    <setModified/>
    <refresh xpath="."/>
  </leave>
</form>
```

### 7.4 Staging xpath (`/ignored/`, `/tmp/`)

| 경로 | 용도 |
|------|------|
| `/tmp/` | dialog 작업용 임시 값 (저장 안 됨) |
| `/ignored/` | SOAP·copyElement staging (저장 안 됨) |

**SOAP DOM inout 시 staging 필수:** Query `where` 등을 soapCall에 **직접** inout하면 SOAP-ENV namespace가 DOM에 섞여 XML 오염(poisoned). 항상:

```
copyElement → /ignored/staging
soapCall(inout staging)
copyElement staging → 실제 xpath
```

### 7.5 워크플로우 하단 공통 패널 (선택)

여러 동일 액티비티 인스턴스를 **한 화면에서** 편집:

```xml
<container name="myPanel" type="visibleGroup" visibleIf="!@isModel and ![/tmp/@taskState]">
  <container type="notebook">
    <container label="My features">
      <input type="list" xpath="activities/myFeature" lineCount="12">
        <input xpath="@label"/>
        <input xpath="@name" readOnly="true"/>
        <input xpath="@myParam"/>
      </input>
    </container>
  </container>
</container>
<!--[of]:Detail-->
```

---

## 8. OOTB 액티비티 UI 확장 (버튼·팝업 추가)

기존 Query·Incremental Query 등 **OOTB 액티비티 폼을 교체하지 않고** 옆에 버튼만 추가하는 패턴입니다.

### 8.1 원칙

| DO | DON'T |
|----|-------|
| OOTB `queryWizard` 등 **ref 유지** | queryWizard XML 통째 교체 |
| 부모 container `colcount=2` 활용 | nested container로 colcount 깨기 |
| merge **해당 블록만** 교체 | xtk:workflow 전체 paste |
| `xpath="."` subFormLink | xpath 누락 |
| 서버-side SOAP + staging | filterView hidden + JS set (apply 안 됨) |

### 8.2 레이아웃 예 (2열)

```
┌──────────────────────┬──────────────────────┐
│  Edit query... (OOTB)│  내 기능... (custom)  │
└──────────────────────┴──────────────────────┘
```

```xml
<input label="Edit query..." type="subFormLink" xpath=".">
  <form ref="xtk:workflow:lib/tabs/queryWizard"/>
</input>
<input align="right" label="내 기능..." type="subFormLink" xpath=".">
  <form ref="uplus:myExtension:lib/myForm"/>
</input>
```

### 8.3 OOTB XML 직접 수정 시

대상 액티비티 노드의 **schema가 정의한 xpath만** 사용:

- Query: `where`, `humanCond`, `@schema`, `select`, ...
- invalid nested path (`where/where/condition`) → schema error

수정 후 `setModified`, `refresh xpath="."` 로 UI 갱신.

---

## 9. 확장 스키마 SOAP Method (Client ↔ Server JS)

Client Input form에서 **서버 JavaScript**를 호출해야 할 때 `{ns}:workflow`에 static method를 추가합니다.

### 9.1 Schema method 정의

```xml
<methods>
  <!-- 단순 string/int -->
  <method name="ValidateParam" library="uplus:myUtil.js" static="true">
    <parameters>
      <param name="value" type="string" inout="in"/>
      <param name="result" type="string" inout="out"/>
    </parameters>
  </method>

  <!-- DOM 가공 — dom="true" 필수 -->
  <method name="TransformXml" library="uplus:myUtil.js" static="true" dom="true">
    <parameters>
      <param name="input" type="DOMElement" inout="inout"/>
    </parameters>
  </method>
</methods>
```

### 9.2 JS 함수 naming

schema `name="ValidateParam"` → JS:

```javascript
function ValidateParam(value) {
    // out param은 return 또는 inout 인자 수정
    return value.length > 0 ? "OK" : "EMPTY";
}
```

DOM method:

```javascript
function TransformXml(input) {
    // input DOMElement 수정 후 return
    return input;
}
```

### 9.3 Client form soapCall

```xml
<soapCall name="ValidateParam" service="xtk:workflow">
  <param exprIn="@myParam" type="string"/>
  <param type="string" xpathOut="/tmp/@validationResult"/>
</soapCall>
```

- `service="xtk:workflow"` — extended schema methods는 **xtk:workflow** 로 호출.
- DOM: `type="DOMElement"`, staging element 사용.

### 9.4 여러 확장 merge

동일 namespace `{ns}:workflow` **하나**에 element + methods 를 모아 배포.  
이미 `{ns}:workflow`가 있으면 **새 element/method만 merge** — 덮어쓰기 주의.

---

## 10. 워크플로우 XML 저장 구조

워크플로우 저장 시 activity 설정은 **workflow data XML**에 기록됩니다.

```xml
<workflow ...>
  <activities>
    <query name="query" schema="nms:recipient" ...>
      <where displayFilter="...">
        <condition expr="@field = 'X'" internalId="..."/>
      </where>
      <humanCond>Query: ...</humanCond>
      <transitions>
        <done name="done" enabled="true"/>
      </transitions>
    </query>

    <myFeature name="myFeature1" label="My Feature"
               myParam="hello" enableDebugging="false">
      <transitions>
        <done name="done" enabled="true"/>
        <error name="error" enabled="false"/>
      </transitions>
    </myFeature>
  </activities>
</workflow>
```

| 항목 | 설명 |
|------|------|
| `name` | 워크플로우 내 액티비티 unique id — JS `activity.name` |
| `@attribute` | schema attribute → `activity.*` |
| child element | `activity.items.item` 등 |
| `transitions/*/@enabled` | UI checkbox와 1:1 |

**런타임 fallback:** UI 탭과 Edit form이 **같은 xpath**를 쓰지 않으면, JS에서 workflow XML을 다시 읽는 fallback 로직을 둘 수 있습니다 (`xtk:workflow` Load + activity name match).

---

## 11. 배포 절차

### 11.1 권장 순서

```
1. Images (있으면)
2. JavaScript codes
3. Data schemas ({ns}:workflow — 통합본)
4. Input forms ({ns}:activity, {ns}:dialog 등)
5. xtk:workflow partial merge
6. File > Clear the local cache
7. Client 재접속
```

### 11.2 수동 vs Package

| | 수동 배포 | Package import |
|---|-----------|----------------|
| 장점 | diff 확인, OOTB 덮어쓰기 최소 | 빠른 이관 |
| 단점 | 단계 많음 | v8 comment strip, overwrite 위험 |

**운영 권장:** 수동 + merge snippet. Package는 dev→prod 이관 시 선택.

### 11.3 `{ns}:workflow` 이미 존재할 때

1. 기존 schema 열기  
2. 새 `<element name="myFeature">` + `activities` ref 추가  
3. 새 `<method>` 추가  
4. **Save** — ACC가 extension merge  

### 11.4 롤백

- `xtk:workflow` merge 전 **반드시 backup**  
- Client 깨짐 → backup paste → cache clear  
- 오염된 activity instance → 삭제 후 재생성

---

## 12. 테스트·디버깅

### 12.1 기본 테스트 순서

1. 새 workflow (standard template)  
2. Start → Query (temp 생성) → Custom activity → End  
3. Custom activity `enableDebugging=true`  
4. 실행 → 우클릭 **Display logs**  
5. `vars.tableName`, `vars.recCount`, SQL, parameter 값 확인  

### 12.2 로그 API

```javascript
logInfo("...");
logWarning("...");
logError("...");   // 워크플로우 pause
```

### 12.3 자주 하는 실수

| 증상 | 원인 |
|------|------|
| 팔레트에 안 보임 | palette merge / cache |
| 더블클릭 시 빈 화면 | subform ref 오타 |
| `setCompleted` 없음 | 액티비티 hang |
| `SCR-160019` | postEvent에 string transition |
| inbound empty | transition 미연결 / Query 미실행 |
| UI 변경 저장 안 됨 | `setModified` 누락 |
| soapCall DOM 오류 | staging 없이 inout |

---

## 13. 제약·한계·금지사항

### 13.1 ACC 플랫폼 한계

| 항목 | 내용 |
|------|------|
| 후속 temp **생성·등록** | Query/Enrichment 수준의 공식 API 없음 |
| `call` vs `recall` | recall 용도 ACC 내부 — 대부분 stub |
| filterView programmatic apply | Client C++ 전용 — form script만으로 불완전 |
| Package v8 | XML comment 제거 |

### 13.2 금지

- `xtk:workflow` Input form **전체 교체**
- OOTB queryWizard / activity form **통째 overwrite**
- soapCall DOM **직접 inout** (staging 없이)
- `task.postEvent("done")` 문자열 전달

### 13.3 설계 권장

- population 변경 → **set-based SQL** + `vars.recCount` 갱신  
- UI 확장 → **merge snippet** + 별도 namespace form  
- 복잡 DOM → **SOAP method** + staging  
- error transition → 운영 워크플로우에서 **enabled 여부** 명시  

---

## 14. 새 기능 구현 체크리스트

### Phase 1 — 설계

- [ ] A(새 액티비티) / B(OOTB UI 확장) / C(SOAP) 중 경로 결정  
- [ ] inbound/outbound temp 필요 여부  
- [ ] transition 개수 (done / error / remainder)  
- [ ] namespace·이름 규칙 확정  

### Phase 2 — Schema

- [ ] `{ns}:workflow` element + activities ref  
- [ ] attribute type·default·label  
- [ ] transitions + enabled default  
- [ ] (C) methods + library  

### Phase 3 — JavaScript

- [ ] `{name}_call()` / `{name}_recall()`  
- [ ] `activity.*` 파라미터 읽기  
- [ ] `vars.tableName` / `vars.targetSchema` 검증  
- [ ] 핵심 로직  
- [ ] `vars.recCount` 갱신 (population 변경 시)  
- [ ] transition postEvent + **setCompleted**  
- [ ] error handling (logError vs error transition)  

### Phase 4 — UI

- [ ] `{ns}:{name}` Input form  
- [ ] `@label`, parameters, transition toggles  
- [ ] `advancedActivityPage` ref  
- [ ] (B) subFormLink + enter/leave  
- [ ] (B) `/tmp/`, `/ignored/` staging  

### Phase 5 — xtk:workflow merge

- [ ] palette input  
- [ ] subform ref  
- [ ] (선택) 하단 list panel  
- [ ] (B) OOTB block 교체 — **해당 블록만**  
- [ ] XML well-formed 검증  

### Phase 6 — 배포·테스트

- [ ] JS → schema → form → merge 순 배포  
- [ ] cache clear + 재접속  
- [ ] Start → Query → Custom → End  
- [ ] Display logs  
- [ ] error transition on/off 각각 테스트  
- [ ] (remainder) complement table 건수  

---

## 15. 부록: 최소 코드 템플릿

### A. `{ns}:workflow` 최소 schema

```xml
<srcSchema extendedSchema="xtk:workflow" name="workflow" namespace="uplus"
           label="Workflows" xtkschema="xtk:srcSchema">
  <element name="myFeature" template="xtk:workflow:activity"
           label="My Feature" img="xtk:workflow.png">
    <attribute name="library" default="'uplus:myFeature.js'"/>
    <attribute name="img" default="'xtk:workflow.png'"/>
    <attribute name="andJoin" type="boolean" default="false"/>
    <attribute name="distributable" type="boolean" default="true"/>
    <attribute name="shouldSync" type="boolean" default="true"/>
    <attribute name="label" type="string"/>
    <attribute name="enableDebugging" type="boolean"/>
    <element name="transitions">
      <element name="done" template="xtk:workflow:transition">
        <attribute name="enabled" default="true"/>
      </element>
    </element>
  </element>
  <element name="workflow">
    <element name="activities" xml="true">
      <element name="myFeature" ref="myFeature" unbound="true"/>
    </element>
  </element>
</srcSchema>
```

### B. JS 최소 call

```javascript
function myFeature_call() {
    try {
        if (!vars.tableName) throw "No inbound population.";
        logInfo("rows=" + vars.recCount);
        task.postEvent(task.transitionByName("done"));
    } catch (e) {
        logError(String(e));
    }
    task.setCompleted();
    return 0;
}
function myFeature_recall() {}
```

### C. xtk:workflow merge 최소

```xml
<!-- palette -->
<container label="Custom" name="customPalette">
  <input label="My Feature" xpath="myFeature"/>
</container>

<!-- subforms -->
<form name="myFeature" ref="uplus:myFeature:myFeatureForm"/>
```

### D. temp queryDef 한 줄

```javascript
var q = xtk.queryDef.create(
    <queryDef schema={vars.targetSchema} operation="select">
        <select><node expr="@email"/></select>
    </queryDef>
).ExecuteQuery();
```

---

## 용어집

| 용어 | 설명 |
|------|------|
| **activity** | JS runtime property — 워크플로우 XML에 저장된 액티비티 설정 |
| **vars** | inbound population 컨텍스트 (tableName, targetSchema, recCount) |
| **task** | transition·complete 제어 |
| **temp schema** | `temp:workflow:...` — queryDef용 논리 schema id |
| **merge** | OOTB `xtk:workflow` form에 XML snippet만 부분 삽입 |
| **staging** | `/ignored/`, `/tmp/` — 저장·SOAP 오염 방지용 임시 xpath |
| **subFormLink** | OOTB Edit dialog 패턴 — `xpath="."` 로 activity 노드 컨텍스트 |
| **library** | schema attribute — 실행할 JS code name |

---

*Adobe Campaign Classic v8 — Custom Feature Development Guide · 2026-08-18*
