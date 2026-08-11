# PoC-C · Program 아래 Campaign(nms:operation) 생성

> **코드 머지 금지.** 콘솔 JS 일회 실행 → 결과만 Chat 회신.  
> 3차 재작업(Program→Campaign→WKF) 선행.

## 목적

Studio에서 「새 캠페인」이 API로 가능한지 확정한다.

## 계층

```
TEST1 / TEST2 (Program, isAiFolder)
  └── Campaign (nms:operation)   ← 이번 PoC
        └── Workflow             ← operation-id = 캠페인
```

## 방식

1. **Program id**(또는 name)로 `fullName` **조회**
2. 그 `fullName`으로 `nms:operation` Write
3. 손으로 fullName을 외울 필요 없음

## 스크립트 (JS Console 일회)

`PROGRAM_ID` / `NEW_NAME` 만 바꿔 실행. (TEST1=`29110`)

```javascript
// PoC-C — id→fullName 조회 후 Campaign Write. DO NOT merge to new_ver.
var PROGRAM_ID = "29110";
var NEW_NAME = "OP_testWooPoCC_001";
var NEW_LABEL = "PoC-C campaign test";

function _esc(s) {
  return String(s == null ? "" : s).replace(/'/g, "''");
}

// 1) Program(폴더) fullName 조회
var qProg = xtk.queryDef.create(
  <queryDef schema="xtk:folder" operation="get">
    <select>
      <node expr="@id"/>
      <node expr="@name"/>
      <node expr="@label"/>
      <node expr="@fullName"/>
    </select>
    <where>
      <condition expr={"@id = " + PROGRAM_ID}/>
    </where>
  </queryDef>
);
var prog = qProg.ExecuteQuery();
if (!prog || !prog.@id) {
  logError("PoC-C FAIL: program/folder not found id=" + PROGRAM_ID);
} else {
  var fullName = String(prog.@fullName || "");
  logInfo("PoC-C program id=" + prog.@id
    + " name=" + prog.@name
    + " fullName=" + fullName);

  if (!fullName) {
    logError("PoC-C FAIL: @fullName empty — try nms:program schema in env");
  } else {
    // 2) Campaign Write (부모 = 조회한 fullName)
    var op =
      <operation xtkschema="nms:operation" _operation="insert"
                 internalName={NEW_NAME} label={NEW_LABEL}
                 isModel="0" status="1" type="0" messageType="127">
        <program fullName={fullName}/>
      </operation>;
    try {
      xtk.session.Write(op);
      logInfo("PoC-C Write OK name=" + NEW_NAME);
    } catch (eW) {
      logError("PoC-C Write FAIL: " + eW);
    }

    // 3) 확인
    var qd = xtk.queryDef.create(
      <queryDef schema="nms:operation" operation="get">
        <select>
          <node expr="@id"/>
          <node expr="@internalName"/>
          <node expr="@label"/>
          <node expr="[program/@fullName]"/>
        </select>
        <where>
          <condition expr={"@internalName = '" + _esc(NEW_NAME) + "'"}/>
        </where>
      </queryDef>
    );
    var created = qd.ExecuteQuery();
    logInfo("PoC-C check id=" + created.@id
      + " name=" + created.@internalName
      + " program=" + created.program.@fullName);
  }
}
```

> `@fullName`이 비면: `schema="nms:program"` 으로 같은 id 조회를 한 번 더 시도.  
> Write가 `program-id`만 받는 환경이면 `<program id={PROGRAM_ID}/>` 로 바꿔 재시도.

## 성공 기준

- [ ] 로그에 program `fullName=...` 출력
- [ ] Explorer **TEST1 하위**에 캠페인 보임
- [ ] 캠페인 `@id` / `@internalName` 확보

## 회신

```
PoC-C HUMAN: PASS — id=… name=OP_testWooPoCC_001 fullName=… under TEST1
PoC-C HUMAN: FAIL — <에러 한 줄>
```

PASS 후: 3차 코드를 Program→Campaign→WKF + Max15 로 수정.
