# 3a · PoC 선행 검증 (for AI + HUMAN)

> **코드 변경 금지.** 결과만 `docs/report/upgrade_plan/04_3a_PoC_RESULT.md`로 기록(또는 본 파일 하단 RESULT 채움).  
> 3차 착수 **최소 수일 전**(요청문: 30일 전 권장) 완료.

## 0. 실행 프롬프트

```
[PoC · 3차 선행 검증]
첨부: docs/report/upgrade_plan/04_3a_PoC.md
규칙: new_ver 코드 수정 금지. 검증방법/성공기준/폴백/소요만.
산출: 각 PoC PASS|FAIL + 증거(스크린샷 설명/로그)를 RESULT 섹션에 기입.
```

## 1. 차수 목표

3차에 필요한 환경 의존 3건을 공식문서+콘솔 실측으로 확정한다.

## 2. 커버 ID (PoC)

| ID | 질문 |
|---|---|
| PoC-1 | `xtk://open/?schema=xtk:workflow&form=xtk:workflow&pk=<id>` 가 JSSP-in-urlViewer(MSHTML)에서 동작하는가 |
| PoC-2 | `old_ver/workflow/tamplate.xml` data를 queryDef→Write insert 시 액티비티·전이·변수 보존 + 상태가 중지인가 (Spawn 미사용) |
| PoC-3 | `xtk:workflow`에 `@lockedBy` 추가 후 DB 업데이트 시 영향 기술 WF 목록·재시작 필요 여부 |

## 3. 선행 / 후속

- 선행: 2차 권장(폴더 컨텍스트 있으면 테스트 용이). 최소 0차.
- 후속: 3차 전부. PoC-1 FAIL이면 3차는 폼 버튼 폴백만 설계.

## 4. 어도비 근거

- Open protocol (overview use case): https://experienceleague.adobe.com/en/docs/campaign-classic/using/designing-content/web-applications/use-cases-creating-overviews
- Data APIs: https://experienceleague.adobe.com/en/docs/campaign-classic/using/configuring-campaign-classic/api/data-oriented-apis
- Spawn (사용 금지 대조군): https://experienceleague.adobe.com/developer/campaign-api/api/sm-workflow-Spawn.html

## 5. 변경 파일

| 경로 | 구분 | 요지 |
|---|---|---|
| 본 파일 RESULT 섹션 또는 `04_3a_PoC_RESULT.md` | 신규/수정 | 실측 기록 |
| `docs/log/log.md` | 수정 | PoC 완료 로그(선택) |

**new_ver 코드 변경 = FAIL 조건**

## 6. 검증 상세

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

- [ ] PoC-1 PASS|FAIL + 폴백 결정 기록
- [ ] PoC-2 PASS|FAIL + 생성 WKF internalName 예시
- [ ] PoC-3 PASS|FAIL + 영향 목록
- [ ] 3차 문서의 "PoC 결과 전제"가 갱신 가능

## 9. HUMAN_CONSOLE

- 스테이징 콘솔 작업 전부 운영자 수행
- Agent는 절차 안내·결과 문서화만

## 10. 테스트·디버깅

- PoC-2 실패 시: Write XML에 `xtkschema`, 네임스페이스, `data` CDATA 깨짐 여부 확인
- PoC-1 실패가 "아무 반응 없음"이면 MSHTML이 커스텀 프로토콜 무시 → 폴백 확정

## 11. 롤백

- staging schema 실험 롤백 계획만 기록. production 무변경이 원칙

## 12. TBD

- 없음(결과가 TBD를 닫음)

---

## RESULT (채워 넣을 것)

| PoC | 판정 | 증거 | 결정된 폴백 | 일자 |
|---|---|---|---|---|
| PoC-1 | | | | |
| PoC-2 | | | | |
| PoC-3 | | | | |
