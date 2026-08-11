# 3a · PoC 선행 검증 (for AI + HUMAN)

> **코드 변경 금지.** 결과만 `docs/report/upgrade_plan/04_3a_PoC_RESULT.md`로 기록(또는 본 파일 하단 RESULT 채움).  
> **PoC-0은 1차 착수 전 필수.** PoC-1~3은 3차 착수 전(요청문: 30일 전 권장).

## 0. 실행 프롬프트

```
[PoC · 선행 검증 — PoC-0 필수 / PoC-1~3는 3차 전]
첨부: docs/report/upgrade_plan/04_3a_PoC.md
규칙: new_ver 코드 수정 금지. 검증방법/성공기준/폴백/소요만.
산출: 각 PoC PASS|FAIL + 증거(스크린샷 설명/로그)를 RESULT 섹션에 기입.
PoC-0 FAIL 이면 1차 착수 금지(폴백 경로로 1차 설계만 허용).
```

## 1. 차수 목표

1차에 필요한 navtree Tools 진입(PoC-0)과, 3차에 필요한 환경 의존 3건(PoC-1~3)을 공식문서+콘솔 실측으로 확정한다.

## 2. 커버 ID (PoC)

| ID | 질문 | 선행 대상 |
|---|---|---|
| PoC-0 | navtree `<command>` 의 URL 뷰(`view`/`viewType`)가 Tools에서 Studio를 여는가 | **1차** |
| PoC-1 | `xtk://open/?schema=xtk:workflow&form=xtk:workflow&pk=<id>` 가 JSSP-in-urlViewer(MSHTML)에서 동작하는가 | 3차 |
| PoC-2 | `old_ver/workflow/tamplate.xml` data를 queryDef→Write insert 시 액티비티·전이·변수 보존 + 상태가 중지인가 (Spawn 미사용) | 3차 |
| PoC-3 | `xtk:workflow`에 `@lockedBy` 추가 후 DB 업데이트 시 영향 기술 WF 목록·재시작 필요 여부 | 3차 |

## 3. 선행 / 후속

- 선행: PoC-0은 0차 후 즉시. PoC-1~3는 2차 권장(최소 0차).
- 후속: PoC-0 → 1차. PoC-1~3 → 3차. PoC-1 FAIL이면 3차는 폼 버튼 폴백만.

## 4. 어도비 근거

- Navtree / Global commands: https://experienceleague.adobe.com/en/docs/campaign-classic/using/configuring-campaign-classic/navigation-hierarchy/configuration — documented `<command>` attrs: name, label, desc, form, rights, promptLabel; action = **input form or SOAP call** (URL view not documented)
- Open protocol (overview use case): https://experienceleague.adobe.com/en/docs/campaign-classic/using/designing-content/web-applications/use-cases-creating-overviews
- Data APIs: https://experienceleague.adobe.com/en/docs/campaign-classic/using/configuring-campaign-classic/api/data-oriented-apis
- Spawn (사용 금지 대조군): https://experienceleague.adobe.com/developer/campaign-api/api/sm-workflow-Spawn.html

## 5. 변경 파일

| 경로 | 구분 | 요지 |
|---|---|---|
| 본 파일 RESULT 섹션 또는 `04_3a_PoC_RESULT.md` | 신규/수정 | 실측 기록 |
| `docs/log/log.md` | 수정 | PoC 완료 로그(선택) |

**new_ver 코드 변경 = FAIL 조건** (PoC-0 폴백용 런처 폼은 **1차 구현 시** 작성 — PoC 단계에서는 만들지 않음)

## 6. 검증 상세

### PoC-0 — navtree command URL 뷰 (1차 선행 · 필수)

| 항목 | 내용 |
|---|---|
| 배경 | 공식 `<command>` 속성은 name/label/desc/**form**/rights/promptLabel. *"This action can be an input form or a SOAP call."* 현재 `testWooAiNavtree.xml`의 `view` / `viewType="view"`는 **비문서화** 속성이다. |
| 검증방법 | 현행 `woo:testWooAiNav` navtree를 콘솔에 등록(또는 이미 등록된 것 확인) → 메뉴 **Tools**에 `Test Woo AI Studio` 노출 여부 → 클릭 시 `/woo/testWooAiStudio.jssp`가 렌더되는지 확인. `__CAMPAIGN_SERVER_URL__` 치환 필수. |
| 성공기준 | Tools에 항목이 보이고, 클릭 시 Studio JSSP가 로드된다(제목/본문 가시). |
| 실패 시 폴백 | 신규 입력폼 `woo:testWooAiStudioLauncher`(urlViewer 단일 컨테이너) + `<command form="woo:testWooAiStudioLauncher" rights="…">`. 이는 공식 스펙(`form` 속성). **1차 문서 Step 1 FAIL 분기**로 구현. |
| 소요예상 | 30분 이내 |

### PoC-1 — xtk://open from urlViewer

| 항목 | 내용 |
|---|---|
| 검증방법 | (A) 임시로 Studio 더미 링크 `href="xtk://open/?schema=xtk:workflow&form=xtk:workflow&pk=<기존WKF_pk>"` 클릭 — **코드 커밋 없이** 콘솔 개발자 주입 또는 일회성 JSSP 로컬만. 가능하면 별도 scratch JSSP. (B) 동일 URL을 외부 IE/콘솔 HTML에서 실행 |
| 성공기준 | Explorer에 해당 WKF 편집 창이 열린다 |
| 실패 폴백 | 폼 `<input type="button">` + soapCall → 콘솔측 open (extend form). Studio JSSP에서는 PK/internalName만 표시+복사 |
| 소요예상 | 0.5~1일 |

### PoC-2 — template clone via Write

| 항목 | 내용 |
|---|---|
| 검증방법 | 1) `tamplate.xml`을 ACC에 워크플로우 **템플릿**으로 등록(또는 동등 템플릿). 2) JS Console/일회 스크립트: queryDef로 `data` 읽기 → 새 internalName → `xtk.session.Write` insert. 3) **Spawn 호출하지 말 것** |
| 성공기준 | 새 WKF가 존재, 액티비티/전이 보존, **실행 상태가 시작되지 않음(중지/편집)**, customActivity 노드 존재 |
| 실패 폴백 | 템플릿을 `xtk:workflow` package export/import 절차로 고정 + 최소 수동 복제 런북 |
| 소요예상 | 1~2일 |
| 주의 | 템플릿 내 `library="uplus:customActivity.js"` → Test Woo에서는 `ibankSqlDM` 계약으로 **치환 필요**(3차 구현 항목으로 이관). PoC는 보존 여부만 |

### PoC-3 — lockedBy 영향

| 항목 | 내용 |
|---|---|
| 검증방법 | staging에서 workflow extension `@lockedBy` 추가 → Update database structure → 기술 WF(운영 배치/Foundry 등) 목록 기록 → 샘플 업데이트 후 오류/락 여부 |
| 성공기준 | 영향 WF 목록 문서화 + 재시작 필요 여부 Yes/No 확정 + sysFilter 초안 |
| 실패 폴백 | DB lock 대신 Studio 측 soft-lock 옵션 테이블(`woo:testWooAiWkfLock`) — 동시성 약하지만 기술 WF 무영향 |
| 소요예상 | 1일 |

## 7. 금지사항

- Spawn 사용
- production 스키마 실험
- PoC 코드를 main/new_ver에 머지

## 8. DoD

- [ ] PoC-0 PASS|FAIL + 폴백 결정 기록 (**1차 전 필수**)
- [ ] PoC-1 PASS|FAIL + 폴백 결정 기록
- [ ] PoC-2 PASS|FAIL + 생성 WKF internalName 예시
- [ ] PoC-3 PASS|FAIL + 영향 목록
- [ ] 1차/3차 문서의 "PoC 결과 전제"가 갱신 가능

## 9. HUMAN_CONSOLE

- 스테이징 콘솔 작업 전부 운영자 수행
- Agent는 절차 안내·결과 문서화만
- PoC-0: navtree 등록 → Tools 클릭 5분 스모크

## 10. 테스트·디버깅

- PoC-0 실패(메뉴 없음): hierarchy 미등록 / rights 치환 / rights·viewType 무시
- PoC-0 실패(메뉴는 있으나 빈 창): URL/JSSP 404 — secrets URL 확인
- PoC-2 실패 시: Write XML에 `xtkschema`, 네임스페이스, `data` CDATA 깨짐 여부 확인
- PoC-1 실패가 "아무 반응 없음"이면 MSHTML이 커스텀 프로토콜 무시 → 폴백 확정

## 11. 롤백

- staging schema 실험 롤백 계획만 기록. production 무변경이 원칙

## 12. TBD

- 없음(결과가 TBD를 닫음)

---

## RESULT (채워 넣을 것)

상세 절차·기입란: [`04_3a_PoC_RESULT.md`](04_3a_PoC_RESULT.md) (HUMAN 대기 — Agent 자체 PASS 금지)

| PoC | 판정 | 증거 | 결정된 폴백 | 일자 |
|---|---|---|---|---|
| PoC-0 | PASS | Tools→Test Woo AI Studio 렌더(제목/본문) HUMAN 확인 | view 유지 | 2026-08-11 |
| PoC-1 | FAIL | html xtk://open 무반응 (pk=26800) | 정보바+콘솔에서 여세요 | 2026-08-11 |
| PoC-2 | PASS | id=29140 folder=1104 · program-id=0(AI프로그램 미표시) | Write+**3차는 program 연결** | 2026-08-11 |
| PoC-3 | FAIL(스킵) | DB 확장 실험 미실시(운영자 판단) | soft-lock `testWooAiWkfLock` | 2026-08-11 |
