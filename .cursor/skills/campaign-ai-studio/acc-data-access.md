# ACC Data Access Policy (Test Woo)

**Campaign DB에 SQL DML로 직접 접근하지 않는다.** 스키마·API 경로만 사용.

## 레코드 CRUD (데이터 적재·fragment·이력)

| 작업 | 허용 | 금지 |
|------|------|------|
| INSERT/UPDATE/DELETE | `xtk.session.Write(doc)` — `_operation="insert\|update\|delete"` | `sqlExec`, raw `INSERT`/`UPDATE`/`DELETE` SQL |
| SELECT (메타·목록) | `xtk.queryDef` + `ExecuteQuery()` | 임의 테이블명 SQL 문자열 조합 DML |
| 조건부 대량 삭제 | `xtk.session.DeleteCollection` (문서화된 경우만) | `TRUNCATE`, DDL |

### 샘플 시드 표준 (`new_ver/workflow/testWooSampleSeed.js`)

- 대상: **`woo:testWooSampleCustomer`**, **`woo:testWooSampleSubscription`** (`testWooSampleSeed.js`)
- 추가 mart: **`woo:testWooSampleDevice`**, **`woo:testWooSampleBill`**, **`woo:testWooSampleApp`** (`testWooSampleSeed2.js`, 기존 customer_id만)
- 적재: `_writeCustomer` / `_writeSubscription` → E4X doc + `xtk.session.Write(insert)`
- 삭제: id 조회 후 `Write(delete)` — SQL DELETE 아님
- 실행: **워크플로우 JavaScript code** activity (DB 클라이언트·수동 SQL 아님)

```javascript
var doc = <testWooSampleCustomer xtkschema="woo:testWooSampleCustomer" _operation="insert"/>;
doc.@customer_id = c.customer_id;
// ...
xtk.session.Write(doc);
```

### fragment / SQL 이력 / 큐

- fragment 등록·승인: Explorer 입력 폼 또는 `testWoo.lifecycle.publish` / `testWoo.repo.saveAiSql` (내부 Write)
- **수동 SQL로 `testWooAiFragment` 테이블 INSERT 금지**

## 읽기 전용 SQL (`sqlSelect` / `sqlGetInt`)

**Foundry·Probe·게이트·dedup L3 전용.** SELECT only.

| 경로 | 용도 |
|------|------|
| `testWoo.probe.run` | fragment/후보 SQL 검증 (정적 차단 + EXISTS) |
| `testWoo.toolkit.probe_values` | DISTINCT 값 조회 (스키마 id + 컬럼명 검증 후) |
| `testWoo.gates` | 건수·그레인 검증 |
| `testWoo.dedup` L3 | EXCEPT/MINUS 대칭차집합 |

**금지:** `sqlExec` — Foundry/Probe/Dedup/게이트 경로 전면 금지 (02 스펙 §1).

## `sql_text` vs 데이터 적재 (혼동 금지)

| 개념 | 의미 | DB 쓰기? |
|------|------|----------|
| fragment `sql_text` | 대상 추출용 **SELECT 정의** (컴파일·프로브 시 실행) | fragment **레코드**만 Write로 저장 |
| 샘플 고객/가입 데이터 | mart 행 | `testWooSampleSeed.js` Write만 |
| 최종 `sql_query` | compiler 출력 | Register 시 `testWooAiSql` Write |

fragment `sql_text`에 `SELECT … FROM testWooSampleCustomer`가 들어가는 것은 **데이터 INSERT가 아니라** 조회 정의이다.  
운영 CD/`nms:` 테이블을 fragment에 넣지 말 것 — **테스트는 `woo:testWooSample*` mart만.**

## AI / 가이드 작성 시 금지

- "SQL로 데이터 INSERT/UPDATE 하세요" (Campaign 테이블 대상)
- sqlplus·DB 클라이언트로 Campaign 스키마 직접 수정
- seed를 SQL script 파일로 안내 (WF `testWooSampleSeed.js` 사용)
- fragment 메타를 INSERT 문으로 넣으라고 안내

## 참고

- 02 스펙 §1: `sqlExec` 금지, `sqlSelect`/`sqlGetInt` only
- 02 스pec §1: fragment CRUD = `xtk.session#Write`
- 샘플 스키마: `new_ver/schema/testWooSampleCustomer.xml`
