# PoC-S · SQL-First 전환 타당성 조사 (#145R)

> **AGENT_MODE · 조사 전용**. `new_ver/` 코드 변경 없음.  
> 일자: 2026-08-12 · 조사 시점 litmus 계열 = v=153  
> 선행 PoC: `17_[완료]_PoC-M_매칭의미론.md` (#145) — 본 문서는 **여정 순서 반전(SQL-First)** 전용.

---

## 결론 (단정)

| # | 항목 | 판정 |
|---|---|---|
| (a) | 컨텍스트 없는 조건 입력 가능 여부 | **가능** (서버 Generate는 `nl_request`만 필수. Shell UI는 캠페인/intent 게이트가 있으나 API 제약 아님) |
| (b) | plan-only 경로 가능 여부 | **가능** (`plan_only` / `planOnly` 이미 구현 · #147) |
| (c) | 미반영 SQL을 DB에 쓰지 않고 유지 가능 여부·저장처 | **가능**(DB 미기록) · 저장처 **HUMAN_CONSOLE 대기** (`sessionStorage` 가용성 미확인). 코드상 storage API 사용 이력 없음. JS 전역은 리로드 시 소멸 **확정** |
| (d) | 동일 SQL 다중 WKF 반영 시 데이터 모델 권고안 | **가능** · 현행=(b) WKF별 신규 행 · 권고=반영 1건당 신규 행 1건(`sqlHash` 동일 허용, `workflow_name` 스코프 유지) |
| (e) | 큐 잔여물 정리 필요 여부 | **필요** (폴링 중단 시 큐 행 잔존 · TTL 삭제/orphan 정리 WF 없음 · stale→queued 복구만 존재) |
| (f) | 상대시점 표현 사용 여부 | **미사용** (params → SQL 리터럴 치환 · AddDays/GetDate 경로 없음) |

---

## S1. Generate 컨텍스트 필수 여부

### [질문]
`testWooAiGenerate.jssp`가 `campaign_id` · `workflow_id` · folder 없이 호출 가능한가? 필수 파라미터 전부.

### [확인된 사실]
서버 API는 **가능**. 필수 파라미터는 `nl_request` 하나뿐.

| Param | 필수 | 역할 |
|---|---|---|
| `nl_request` | **예** | Pass0→StageA→Pass1 |
| `plan_only` / `planOnly` | 아니오 | compile·gates·Foundry 큐 스킵 |
| `workflow_name` | 아니오 | Foundry enqueue 메타만 (unmatched + Foundry ON일 때) |

`campaign_id` / `workflow_id` / folder는 Generate.jssp에서 **읽지 않음**.

Shell 클라이언트만 캠페인·intent를 요구한다 (`testWooAiStudioJs.jssp` generate 가드). 이는 UI 정책이며 서버 계약이 아니다.

### [근거]
- `new_ver/jssp/testWooAiGenerate.jssp:19-32` — `requireRight` + `nl_request` + `planOnly` 파싱
- `new_ver/jssp/testWooAiGenerate.jssp:55-61` — `workflow_name`은 큐 적재 시에만 사용
- `new_ver/jssp/testWooAiStudioJs.jssp:412-418` — Shell: 캠페인/intent 없으면 generate 거부

### [미확인]
ACC 세션/패키징이 payload 밖에서 암묵 캠페인 컨텍스트를 주입하는지(본 파일들에서 비가시).

---

## S2. plan-only 경로

### [질문]
plan(fragment 집합)만 산출하고 SQL 생성·저장·큐 적재를 하지 않는 경로가 있는가?

### [확인된 사실]
**존재한다** (`#147`).

- `plan_only=true` + unmatched → 큐/SQL 없이 unmatched 반환 (`ok:false`, `planOnly:true`)
- `plan_only=true` + matched → `sql:""` + chips, compile/gates 미실행
- 전체 경로(compile+gates)는 `plan_only`가 아닐 때만

| 부작용 | plan_only |
|---|---|
| LLM 비용 | **발생** (`generatePlan`은 분기 전 항상 호출) |
| Foundry 큐 | **스킵** |
| `woo:testWooAiSql` | **미기록** (Generate는 `saveAiSql` 미호출) |
| fragment `usage_count` | **미증가** (bump는 `saveAiSql`만) |

### [근거]
- `new_ver/jssp/testWooAiGenerate.jssp:24-30`, `:42-53`, `:82-93`, `:94-110`
- 클라이언트: `testWooAiStudioJs.jssp:484-520` (`discoverFind` → `plan_only: true`)

### [미확인]
unmatched로 Stage A에서 조기 종료 시 Pass1 토큰 비용 절감 폭(운영 실측 없음).

---

## S3. SQL DB 기록 시점

### [질문]
생성된 SQL이 `woo:testWooAiSql`에 기록되는 시점. `saveAiSql` 호출부 전부.

### [확인된 사실]
**Register 시점만**. Generate는 JSON으로 SQL을 반환할 뿐 DB에 쓰지 않는다.

| 구분 | file:line |
|---|---|
| 정의 | `new_ver/js/testWooRepository.js:45` |
| export | `testWooRepository.js:474` |
| 호출 #1 (wfName 있음·dup miss) | `new_ver/jssp/testWooAiRegister.jssp:75` |
| 호출 #2 (wfName 빈 문자열) | `testWooAiRegister.jssp:107` |

Register는 항상 `status: "registered"`로 저장한다 (`:87`, `:119`).  
스키마 docstring도 Producers를 `saveAiSql` + Register로 명시 (`testWooAiSql.xml:53`).

### [근거]
위 표 + `testWooAiGenerate.jssp:101-110` (응답만, Write 없음).

### [미확인]
콘솔/navtree 수동 insert 경로(본 코드 밖).

---

## S4. workflow 참조 필드 · nullable

### [질문]
`woo:testWooAiSql`의 workflow 참조 필드명·타입. workflow 미지정 insert 가능 여부.

### [확인된 사실]
- 필드: `@workflow_name` — `string` length 64 (정수 WF `@id` 아님)
- 스키마에 `required` / `notNull` / unique key **없음** → XML 기준 nullable
- `idx_wf`는 non-unique index
- 앱 코드: `workflow_name` 없이 insert 허용. `saveAiSql` 필수 가드는 `sql_query` / `used_fragments` / `compile_hash`만
- Register `wfName=""` 분기에서 `workflow_name: ""`로 insert

### [근거]
- `new_ver/schema/testWooAiSql.xml:41-42`, `:72-74`, `:85`
- `new_ver/js/testWooRepository.js:45-50`, `:75`
- `new_ver/jssp/testWooAiRegister.jssp:48`, `:102-120`

### [미확인]
Update database structure 이후 DBMS 물리 컬럼 NULL 제약 실측.

---

## S5. listAiSqlForMatch 조건 · draft 혼입 · 정렬

### [질문]
매칭 코퍼스 필터. 미반영(초안) 레코드 혼입 가능 여부. `MATCH_SQL_LIMIT=500` 정렬.

### [확인된 사실]
- 필터: `@status = 'registered'` **만**
- draft / validated / rejected는 **포함되지 않음**
- 정렬: `@creation_date` **내림차순**(최신순)
- limit: 기본 500, 상한 5000 (`listAiSqlForMatch`); Match 상수 `MATCH_SQL_LIMIT = 500`
- `workflow_name` 빈 행은 로드될 수 있으나 scoring에서 **스킵**

스키마에 “unreflected/미반영” status는 없다. 용어상 미반영은 아직 Register되지 않은 클라이언트 캐시를 뜻하며, 현행 매칭 코퍼스와 분리되어 있다.

### [근거]
- `new_ver/js/testWooRepository.js:352-370`
- `new_ver/js/testWooMatch.js:31`, `:320-324`, `:446-447`
- status enum: `testWooAiSql.xml:59-63`

### [미확인]
과거 `registered`이지만 액티비티 미주입인 레거시 행 존재 여부(상태값만으로는 “반영됨”을 보장하지 않음).

---

## S6. sqlContentHash · 동일 SQL 다중 WKF

### [질문]
정규화 규칙. 동일 SQL을 서로 다른 WKF에 반영할 때 (a) 레코드 재사용 vs (b) 동일 hash 신규 행.

### [확인된 사실]
**정규화** (`normalizeSql`):
1. lower-case
2. `/*…*/` 제거
3. `--` 라인 코멘트 제거
4. 연속 공백 → 단일 공백
5. 끝 `;` 제거 + trim  
→ `sqlContentHash` = `_djb2(normalizeSql(sql))` (plan **제외**)

**다중 WKF**: 현행 = **(b) 신규 행**.  
`findAiSqlBySqlHash(workflowName, sqlHash)`는 `@workflow_name`으로 스코프한다. 다른 WKF면 miss → insert.  
같은 WKF + 동일 hash → **(a) 재사용** (`created:false`).  
`wfName` 비면 해시 중복 검사 없이 **항상 insert**.

### [근거]
- `new_ver/js/testWooLifecycle.js:36-43`, `:294-297`
- `new_ver/js/testWooRepository.js:391-430`
- `new_ver/jssp/testWooAiRegister.jssp:47-120`

### [미확인]
없음 (코드 확정).

---

## S7. Foundry 큐 비동기 · 잔여물

### [질문]
`QUEUE_POLL_MS` · `QUEUE_POLL_MAX`. 창 닫을 때 큐 상태. 잔여물 정리 존재 여부.

### [확인된 사실]
- `QUEUE_POLL_MS = 20000`, `QUEUE_POLL_MAX = 30` (≈ 10분). **클라이언트 상수** (`testWooConfig.js` 아님)
- 폴링 종료는 터미널 status / max attempts에서 `clearInterval`만. unload 시 cancel/delete API **없음**
- 창 종료 시: 클라이언트 폴링 중단 · **서버 큐 행은 잔존** (`queued` / `processing` / …)
- 정리 현황:
  - status enum 존재
  - `_recoverStale`: `processing`이 `staleProcessingMinutes`(기본 30) 초과 → `queued`로 복구
  - **TTL 삭제 · orphan 정리 워크플로우 · 클라이언트 포기 시 취소 필드 없음**

→ SQL-First에서 “확정 저장 안 함”은 지킬 수 있으나 “서버에 아무것도 없음”은 **불가**. 잔여물 정책 필요(R8).

### [근거]
- `new_ver/jssp/testWooAiStudioJs.jssp:45-46`, `:314-351`
- `new_ver/js/testWooFoundry.js:174-218`
- `new_ver/schema/testWooAiRequestQueue.xml` status 모델

### [미확인]
HUMAN: 창 닫는 순간이 `queued` vs `processing`일 때 운영 인스턴스에서의 실측 상태 문자열.

---

## S8. 클라이언트 캐시 구현처 사실 수집

### [질문]
`X-UA-Compatible`, `documentMode` 확인 방법, storage 사용 이력.

### [확인된 사실]
- `X-UA-Compatible`: **`IE=edge`** (`testWooAiStudio.jssp:98`, `:126`)
- 진단: TW-BOOT가 `documentMode=…` 출력; StudioJs init이 `#twDiagLog`에 동일 기록
- repo 전역 `sessionStorage` / `localStorage` **사용 이력 0건**

### [근거]
- `new_ver/jssp/testWooAiStudio.jssp:97-98`, `:125-126`, `:299-312`, `:388-391`
- `new_ver/jssp/testWooAiStudioJs.jssp:2030-2051`

### [미확인] → **HUMAN_CONSOLE**
1. urlViewer에서의 실제 `documentMode` 값
2. 해당 호스트에서 `sessionStorage` / `localStorage` setItem/getItem 가능 여부  
   ※ “가능”으로 단정하지 말 것. R2(#148R)는 이 확인 전 구현 금지.

**R2 구현 메모 (2026-08-12):** Studio 클라이언트는 **runtime probe**(`sessionStorage` set/get → 실패 시 JS 메모리)로 backend를 선택한다. 진단 로그 `cacheBackend=session|memory`. **S8 HUMAN PASS를 주장하지 않음** — HUMAN_CONSOLE 체크리스트는 여전히 [ ].

**HUMAN_CONSOLE 체크리스트**
```
[ ] Studio 진단/TW-BOOT에 표시된 documentMode = ____
[ ] 콘솔(F12 가능 시) 또는 임시 진단 문구로 sessionStorage.setItem('twProbe','1') 성공 여부
[ ] getItem 왕복 확인
[ ] Reload Studio(_r) 후 동일 세션에서 getItem 유지 여부
```

---

## S9. urlViewer 리로드와 JS 전역

### [질문]
Reload / `_r` / 폼 재진입 시 완전 리로드 여부 · JS 전역 초기화 여부.

### [확인된 사실]
- **Reload Studio**: ShellPick → `/tmp/@twStudioUrl`에 `&_r=`+tick → UrlViewer `urlExpr` 변경 → Studio JSSP **새 URL 요청**
- **Apply**도 `_r` 갱신
- **최초 enter**: `v=`만, `_r` 없음 (#139)
- Studio JS는 `testWooAiStudioJs.jssp?v=…`로 로드. 페이지 문서가 바뀌면 IIFE/`var`/`state` **초기화**
- 이력: `_r` 없는 재오픈이 흰화면을 유발(#143) → Reload+_r로 가시성 복구. 즉 캐시/문서 재사용 이슈가 있었고, 의도된 해법은 **URL 전체 리로드**

### [근거]
- `new_ver/input_form/testWooExtendWorkflow.xml:55-71`, `:75-77`
- `new_ver/jssp/testWooAiStudio.jssp:394-395`
- `new_ver/jssp/testWooAiStudioJs.jssp:73-82` (state 객체)

### [미확인]
UrlViewer가 query `_r` 변경 시 항상 full navigation인지 vs 부분 refresh인지 — 코드 의은 full reload; CDP 실측 없음.

---

## S10. selectWkf lock soft-fail

### [질문]
lock 스키마 미배포 시 응답.

### [확인된 사실]
- `acquireLock` 예외 중 `code === "LOCKED"`만 하드 실패(throw)
- 그 외(스키마 미배포·Write 오류 등) → **`ok: true`**, `lock: null`, `lock_warning`=에러 문자열, `open_mode: "fallback"`
- 클라이언트: 경고 배너 후 SQL 목록 진입 계속
- `getLock`은 예외 시 `null` 반환(삼킴)

※ SQL-First 커밋 단계(#150R)는 soft-fail을 **허용하지 않도록** 재정의 예정. 현행 select는 soft-fail.

### [근거]
- `new_ver/jssp/testWooAiStudioContext.jssp:91-122`
- `new_ver/js/testWooWorkflowClone.js:371-415` (getLock/acquireLock)
- `new_ver/jssp/testWooAiStudioJs.jssp:1519-1524`

### [미확인]
미배포 시 Adobe가 내는 정확한 에러 문구(인스턴스별 `lock_warning`에만 나타남).

---

## S11. fragment 날짜 조건 형태

### [질문]
리터럴 날짜인가, Adobe 상대 표현(AddDays/AddHours/GetDate/getCurrentDate)인가?

### [확인된 사실]
**리터럴**. `_substitute` → `_lit`이 문자열을 `'…'` SQL 리터럴로 치환.  
compiler/Foundry/LLM 경로에 AddDays/GetDate/getCurrentDate **미사용**(PoC-M M7과 동일).

### [근거]
- `new_ver/js/testWooCompiler.js:186-219`
- `docs/report/upgrade_plan/17_[완료]_PoC-M_매칭의미론.md` M7
- Adobe Filter relative: https://experienceleague.adobe.com/en/docs/campaign/campaign-v8/data/query/filter-conditions  
- `getCurrentDate`: https://experienceleague.adobe.com/developer/campaign-api/api/f-getCurrentDate.html

### [미확인]
운영 DB에 수동 작성된 fragment `sql_text`에 상대 함수가 들어 있을 가능성(콘솔 전수 스캔 없음).

---

## S12. 기존 WKF 복제 API (문서 · 호출 금지)

### [질문]
현행 `CreateInstanceFromModel` vs `Duplicate` / `DuplicateTo` / `DuplicateWithMappingId`.

### [확인된 사실]
| API | 코드 사용 | 문서 요약 |
|---|---|---|
| `xtk.queryDef.CreateInstanceFromModel` | **사용 중** — 템플릿→신규 WKF (`operation-id` 바인딩). PoC-T3b PASS | 템플릿 인스턴스 생성(기존 WKF 복제 아님) |
| `xtk.session.Duplicate(pk)` | **호출 0** | 소스 문서에서 새 문서 생성 ([Duplicate](https://experienceleague.adobe.com/developer/campaign-api/api/sm-session-Duplicate.html)) |
| `DuplicateTo` / `DuplicateWithMappingId` | **호출 0** | Experience League session API 문서에 존재. 본 차수 호출 금지 |
| `CreateWorkflowFromModelId` | PoC FAIL (returns 0) | T3b로 전환됨 |

Adobe 워크플로 가이드: activity 교차 copy/paste보다 Duplicate 권장.  
https://experienceleague.adobe.com/en/docs/campaign/automation/workflows/introduction/build-a-workflow

캠페인(`operation-id`) 재바인딩 + Duplicate 조합 = **미확인**(PoC-M과 동일). SQL-First R7은 미확인 시 `createWkfFromTemplate` 폴백.

### [근거]
- `new_ver/js/testWooWorkflowClone.js:504-530`
- `docs/report/upgrade_plan/06_[완료]_구차수_3a_PoC_RESULT.md` T3b
- `docs/report/upgrade_plan/17_[완료]_PoC-M_매칭의미론.md` M8
- Adobe Duplicate URL (위)

### [미확인]
Duplicate* + operation-id 재바인드 / folder / soft-lock 상호작용(인스턴스 PoC 필요 · 본 차수 호출 금지).

---

## 부록 · SQL-First와의 정합 메모 (조사 관찰 · 구현 지시 아님)

1. **API는 이미 SQL-First 가능** — Generate/plan_only/Match(global)가 컨텍스트 없이 동작. 막힌 곳은 Shell 상태머신(캠페인 선선택·intent).
2. **현행 discover(#147)는 containment == 1.0 + Top-N 20** — 관리자 원문 “상위 10·임계 없음” 및 #147R(intersection≥1 · Top-10)과 **불일치**. R1에서 재정의 대상.
3. **매칭 코퍼스 = registered만** — 캐시 초안을 DB에 쓰지 않으면 코퍼스 오염 없음(설계와 일치).
4. **락 점유**: 현행은 `selectWkf`에서 acquire. SQL-First는 반영 순간에만 잡는 편이 타당(S10 soft-fail과 #150R 엄격 커밋의 분리 근거).

### 참조 (유사도 이론 · 구현 금지 범위의 근거)
- Jaccard 편향 / containment: http://www.vldb.org/pvldb/vol9/p1185-zhu.pdf  
- LSH Ensemble containment: https://ekzhu.com/datasketch/lshensemble.html
