# old_ver 시스템 분석 — Adobe Campaign LLM 질의 생성기

> Adobe Campaign v7 환경에서 **자연어를 Campaign 질의(queryDef / SQL)로 변환**하기 위해 제작된
> 프로토타입 코드 모음이다. 사용자가 채팅으로 조건을 말하면 LLM(Anthropic Claude)이 대상 스키마의
> 필드 정보를 바탕으로 `queryDefXmlFragment`와 참고용 `sqlQuery`를 생성하고, 이를 Campaign SOAP API로
> 실제 실행하여 대상 건수를 조회하고, 결과 SQL을 커스텀 스키마 `uplus:ai_sql`에 저장한다.

---

## 1. 한눈에 보는 구조

```
[브라우저 - Adobe Campaign 콘솔에 로그인한 세션]
        │
        ▼
html_code/ai_test_page.html      ← 채팅형 UI (HTML/CSS 단일 파일)
        │  (bootstrap.jssp?_token=... 스크립트 동적 로드)
        ▼
jssp_code/config.jssp.js         ← window.SchemaQuery.CONFIG / STR 주입
jssp_code/core.jssp.js           ← SOAP 클라이언트 + LLM 호출 + 스키마 파싱 (SQ.* API)
jssp_code/app.jssp.js            ← UI 컨트롤러 (DOM 이벤트, 채팅 렌더링)
        │
        ├──(HTTPS)──▶ Adobe Campaign  /nl/jsp/soaprouter.jsp   (SOAP: xtk:*)
        └──(HTTPS)──▶ Anthropic API   /v1/messages             (LLM 질의 생성)

workflow/tamplate.xml            ← Campaign 워크플로우/오퍼레이션 템플릿(OP39)
                                    "AI 대상자 추출" customActivity 포함
```

핵심은 **`window.SchemaQuery`(별칭 `SQ`)** 라는 전역 네임스페이스 하나에 설정·코어·UI가 순차적으로 얹히는
IIFE(즉시실행함수) 모듈 패턴이다. 세 개의 `.jssp.js` 파일은 각각 독립적으로 `SQ`에 기능을 추가한다.

---

## 2. 패키지(폴더)별 상세

### 2.1 `html_code/` — 프런트엔드 UI

| 파일 | 역할 |
| --- | --- |
| `ai_test_page.html` | 채팅형 단일 페이지. 인라인 CSS로 헤더(스키마 선택 · 새로고침 · Clear · 접속계정 표시), 채팅 영역, 입력 컴포저를 구성한다. |

- 하단 스크립트에서 `SCHEMA_QUERY_TOKEN`을 붙여 `/uplus/bootstrap.jssp?_token=...` 을 동적 로드한다.
  (이 `bootstrap.jssp`가 config → core → app 순서로 나머지 JSSP를 끌어오는 진입점으로 추정된다. 저장소에는 미포함.)
- 순수 표시/입력만 담당하고 로직은 전혀 없다. 모든 동작은 `app.jssp.js`가 DOM id로 바인딩한다.
  (주요 id: `schemaSelect`, `btnRefreshSchemas`, `btnClearChat`, `operatorStatus`, `schemaStatus`, `chat`, `chatInput`, `btnSend`)

### 2.2 `jssp_code/` — 서버가 토큰 검증 후 내려주는 JavaScript (JSSP)

세 파일 모두 상단에 **JSSP(Java Server Script Page) 가드**가 있다.

```js
<% ... var _t = request.getParameter("_token"); if (_t !== _SQ_TOKEN) { response.sendError(403); return; } %>
```

즉 이 `.js` 파일들은 Campaign 서버에서 `?_token=` 값이 일치할 때만 `application/javascript`로 응답된다.
브라우저 입장에서는 일반 스크립트이지만, 서버 측 토큰 인증으로 보호된다.

#### (1) `config.jssp.js` — 설정/문자열 모듈
- `window.SchemaQuery.CONFIG` 를 정의: Anthropic API 키·모델, Campaign 서버 URL·계정, `authMode`, `schemaListLineCount` 등.
- `window.SchemaQuery.STR` 를 정의: 모든 UI 한국어 문자열(로딩/오류/저장 문구 등) 상수.
- 인증 모드: `authMode: "legacy"` → 아이디/비밀번호 `Logon`, 그 외 → 브라우저 쿠키 세션(`credentials: include`).

#### (2) `core.jssp.js` — 코어 엔진 (`SQ.*` 공개 API)
Campaign SOAP 통신, 스키마 파싱, LLM 호출, 저장을 모두 담당하는 가장 핵심 파일.

- **SOAP 하부 계층**
  - `soapEnvelope / soapPost / assertNoSoapFault / isSessionFault` — SOAP 봉투 생성·전송·오류/세션만료 판별.
  - `ensureSession` — legacy면 `xtk:session#Logon`으로 세션 토큰 확보, 아니면 브라우저 쿠키 세션 사용.
  - `executeQuery` — `xtk:queryDef#ExecuteQuery`로 실제 질의 실행.
  - `getEntityIfMoreRecent` — `xtk:persist#GetEntityIfMoreRecent`로 소스 스키마 원본 XML 조회.
  - `writeDomDoc` — `xtk:persist#Write`로 레코드 저장.
- **스키마 처리**
  - `SQ.fetchSchemaList` — `xtk:schema` 조회 후 `parseSchemaList`로 `{id, namespace, name, label}` 목록화.
  - `SQ.fetchSchemaDetail` → `fetchSchemaDetailInternal` — `xtk:srcSchema` 원본을 받아 `parseSrcSchema`로
    필드(attribute·link) 추출. `template` 상속이 있으면 재귀로 부모 스키마 필드를 `mergeSchemaFields`로 병합,
    `filterFkFields`로 중복 FK 제거.
- **LLM 연동**
  - `buildSystemPrompt(schema)` — 스키마 필드 목록과 **queryDef 작성 규칙**(상대날짜는 `SubDays(GetDate(),30)`,
    `$(date...)` 매크로 금지, boolean은 0/1, 링크 조건 `[link/@id]` 등)을 담은 시스템 프롬프트 생성.
  - `SQ.generateQuery` — Anthropic `/v1/messages` 호출(`anthropic-dangerous-direct-browser-access` 헤더로
    브라우저 직접 호출). 응답에서 JSON을 뽑아(`extractJsonObject`) 검증(`parseQueryJson`, `validateQueryDefFragment`).
- **건수 조회 / 유틸**
  - `SQ.fetchRowCountViaSoap` — `buildCountFragment`로 `Count(1)` 질의를 만들어 대상 건수 조회 후 `parseCount`.
  - `formatSqlQuery` — 참고용 SQL을 보기 좋게 줄바꿈 정렬.
  - `SQ.fetchCurrentOperatorLogin` — 현재 접속 오퍼레이터 로그인명 조회(`xtk:operator`).
- **저장**
  - `SQ.saveAiSqlRecord` — 생성된 SQL을 커스텀 스키마 `uplus:ai_sql`(테이블 `UplusAi_sql`)에 insert 후
    `verifyAiSqlSaved`로 재조회 검증. 저장 필드: `title, creator, sqlQuery, creationDate, targetCount`.

#### (3) `app.jssp.js` — UI 컨트롤러
- DOM 요소 바인딩과 이벤트 처리(스키마 변경, 전송, 초기화, Enter 전송, textarea 자동 높이).
- 채팅 상태 관리: `chatTurns` 배열에 user/assistant 턴 저장 → 멀티턴 대화 컨텍스트로 LLM에 전달.
- 렌더링: `renderBubble`(요약·필터 설명·건수·SQL·복사 버튼), `renderSavePanel`(저장 여부/제목 입력),
  `appendUser/appendLoading/appendSystem`.
- 흐름: `loadSchemas → onSchemaChange(fetchSchemaDetail) → sendMessage(generateQuery → runCount) → 저장 패널`.

### 2.3 `workflow/` — Campaign 워크플로우 템플릿

| 파일 | 역할 |
| --- | --- |
| `tamplate.xml` | `nms:operation` 템플릿 **"[LGU+] LLM 활용 캠페인 템플릿 (OP39)"**. 기본 워크플로우(WKF89)를 포함. |

- 워크플로우 활동 흐름: `start → customActivity("AI 대상자 추출") → changeDataSource(FDA) → enrich(+Recipients)
  → changeAxis → extract(제외조건/블로킹/피로도/Split)`.
- 핵심은 `customActivity` (`library="uplus:customActivity.js"`, JS 라이브러리 기반)로,
  위 UI/코어에서 생성·저장한 AI SQL을 **실제 캠페인 대상자 추출 단계에서 소비**하도록 연결하는 지점이다.
- 제외조건 예: `[target/EXCEPTION_ENTR/@column_68] = 'Y'` ("(디캠)CJVOD월정액여부 ... equal to 'Y'").

---

## 3. 전체 데이터 흐름 (엔드투엔드)

1. Campaign 콘솔에 로그인한 사용자가 `ai_test_page.html`을 연다.
2. `bootstrap.jssp`가 토큰 검증 후 `config → core → app`를 로드하여 `window.SchemaQuery`를 구성한다.
3. `loadSchemas()` → SOAP `xtk:schema` 조회로 스키마 드롭다운을 채운다.
4. 스키마 선택 시 `fetchSchemaDetail()` → `xtk:srcSchema` 원본을 받아 필드 목록(상속 병합 포함)을 구성한다.
5. 사용자가 자연어로 조건 입력 → `generateQuery()`가 스키마 필드 + 규칙 프롬프트로 **Anthropic Claude** 호출.
6. LLM이 `{queryDefXmlFragment, sqlQuery, summaryKo, ...}` JSON 반환 → 검증 후 화면 표시.
7. `fetchRowCountViaSoap()`로 `Count(1)` 질의 실행 → 예상 대상 건수 표시.
8. 사용자가 저장 → `saveAiSqlRecord()`가 `uplus:ai_sql`에 SQL 저장·검증.
9. 저장된 SQL/조건은 워크플로우 템플릿(OP39)의 `customActivity`에서 실제 캠페인 대상자 추출에 활용.

---

## 4. 외부 의존성 / 연동점

| 대상 | 방식 | 사용처 |
| --- | --- | --- |
| Adobe Campaign v7 | SOAP (`/nl/jsp/soaprouter.jsp`) — `xtk:session`, `xtk:queryDef`, `xtk:persist`, `xtk:schema`, `xtk:srcSchema`, `xtk:operator` | `core.jssp.js` |
| Anthropic Claude | REST (`/v1/messages`, 모델 `claude-sonnet-4-6`) | `core.jssp.js` `generateQuery` |
| 커스텀 스키마 `uplus:ai_sql` | SOAP Write/ExecuteQuery | 생성 SQL 저장 |
| JSSP 서버 스크립트 | `?_token=` 인증 | 3개 `.jssp.js` 파일 서빙 |
| `uplus:customActivity.js` | 워크플로우 커스텀 활동 라이브러리 | `tamplate.xml` |

---

## 5. 특징 및 주의사항 (분석 소견)

- **모듈 패턴**: 역할별로 config / core / app 3계층 분리(설정 · 비즈니스 · UI)가 명확하다.
- **인증 이원화**: legacy(ID/PW Logon)와 브라우저 쿠키 세션을 모두 지원하며, 세션 만료를 SOAP Fault 문자열로 감지한다.
- **LLM 출력 방어 로직**: `extractJsonObject`(코드펜스/중괄호 파싱), `validateQueryDefFragment`(금지 매크로 차단),
  스키마 ID 일치 검증 등으로 LLM 오출력에 대비한다.
- **보안상 검토 필요(개발/테스트용 프로토타입 한계)**:
  - `config.jssp.js`에 **Anthropic API 키, Campaign admin 계정/비밀번호가 평문 하드코딩**되어 있다.
  - JSSP 토큰(`_SQ_TOKEN`)이 HTML·JS 모두에 노출되어 있어 실질적 접근 통제가 약하다.
  - LLM API를 **브라우저에서 직접 호출**(`anthropic-dangerous-direct-browser-access`)하므로 API 키가 클라이언트에 노출된다.
  → 운영 전환 시 서버 프록시 경유·시크릿 분리·계정 최소권한화가 필요하다. (본 문서는 현 상태 분석이며 코드는 변경하지 않음)
- **파일명 오탈자**: 워크플로우 파일명이 `tamplate.xml`(→ `template.xml`)로 되어 있다.

---

_작성 기준: `old_ver/` 하위 5개 파일(html 1, jssp 3, workflow xml 1) 전수 분석._
