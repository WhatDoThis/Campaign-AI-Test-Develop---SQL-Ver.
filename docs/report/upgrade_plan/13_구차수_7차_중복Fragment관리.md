# 7차 · 중복 Fragment 관리 (for AI)

> **[SUPERSEDED BY 19/20/21]** SQL-First 전환(2026-08-12). 실행 라우팅은 `00_INDEX.md` 키 `R0`~`R8` / 가이드 `21_SQLFirst_R차수_실행가이드.md`. 본 문서는 삭제하지 않으며 역사·자산 근거로만 참조한다. 정본 여정: `19_SQLFirst_여정정본.md`.

> **AGENT_MODE**. **신규 JSSP 제작 금지.**  
> navtree `nodeModel` + 기존 스키마 list 뷰만.  
> 5~6차와 병렬 가능. 선행: 4차.

## 0. 실행 프롬프트

```
[#150 · 7차 중복Fragment관리]
첨부: docs/report/upgrade_plan/13_구차수_7차_중복Fragment관리.md
선행: 4차 PASS
고유: JSSP 신규 금지. navtree nodeModel + 기존 schema list. 삭제가 주 기능.
종료: acc-id-tracer + acc-verifier.
```

## 1. 차수 목표

near/exact 중복 fragment를 Explorer 목록에서 보고 **삭제만** 할 수 있게 한다.

## 2. 커버 ID

| ID | 원문 | 구현 |
|---|---|---|
| FRAG-7-4 | 관리자 화면에서 목록 확인 | navtree 폴더 + sysFilter(dedup 플래그/`needsDedup`/near) |
| FRAG-7-5 | 삭제만 가능한 간단한 방식 | list + delete; 편집 최소화. `hiddenCommands`로 dup 등 숨김 |

## 3. 선행 / 후속

- 선행: 4차(승인에서 중복 제거)
- 후속: 없음(운영)

## 4. 근거

- Navtree nodeModel/list: https://experienceleague.adobe.com/en/docs/campaign-classic/using/configuring-campaign-classic/navigation-hierarchy/configuration
- 기존: `testWooAiNavtree.xml` Fragments node, `woo:testWooAiFragment` dedup_* 필드

## 5. 변경 파일

| 경로 | 구분 | 요지 |
|---|---|---|
| `new_ver/navtree/testWooAiNavtree.xml` | 수정 | Dedup 전용 nodeModel + sysFilter |
| `new_ver/schema/testWooAiFragment.xml` | 수정(필요 시) | 필터용 인덱스/플래그 확인 |
| `new_ver/input_form/testWooAiFragment.xml` | 수정(최소) | 삭제 중심. 과한 편집 UX 제거 가능 |
| `docs/log/log.md` | 수정 | 로그 |

**금지**: `new_ver/jssp/testWooAi*Dedup*.jssp` 등 신규 JSSP

## 6. 구현 상세

### Step 1 — nodeModel

- label 예: `[WOO] Fragments Dedup`
- view type=`list`, schema=`woo:testWooAiFragment`
- sysFilter: near/exact 후보 (`@dedup_status` 등 **실제 필드명 코드 확인 후** 사용)
- `hiddenCommands`로 불필요 명령 숨김. 삭제는 운영 권한 있는 명령만

### Step 2 — 삭제 안전

- 삭제 전 `usage_count`/참조 SQL 있으면 콘솔 기본 확인에 의존(프롬프트는 ACC). Studio `confirm` 사용 안 함
- revoked 전환이 삭제보다 안전하면 Option으로 soft-delete(=revoked) 권장 — 필드 존재 시

## 7. 금지사항

- 신규 JSSP/HTML 관리 화면
- 자동 병합 Write
- Studio UI 변경

## 8. DoD

- [ ] Explorer에 Dedup 전용 폴더/노드가 보인다
- [ ] 목록에 중복 후보만 필터된다(샘플 데이터 기준)
- [ ] 관리자가 항목을 삭제(또는 revoked)할 수 있다
- [ ] 신규 `.jssp` 파일이 추가되지 않았다
- [ ] 일반 Fragments 목록과 분리되어 있다

## 9. HUMAN_CONSOLE

1. navtree 재등록
2. 샘플 near fragment 2건 시드(또는 Foundry로 유도)
3. Dedup 노드에서 삭제 1회
4. `7차 HUMAN: …`

## 10. 테스트·디버깅

- [ ] sysFilter xpath가 스키마 필드와 일치(미일치 시 빈 목록)
- [ ] 권한 없는 유저 삭제 실패
- [ ] 삭제 후 Stage A에서 사라짐

### 디버그

| 증상 | 조치 |
|---|---|
| 노드 안 보임 | navtree 미등록 |
| 목록 전체 노출 | sysFilter 누락 |
| 삭제 불가 | rightsRight/operator |

## 11. 롤백

- navtree 노드 제거 배포
- 삭제분 복구는 DB 백업 의존 — 가급적 revoked 사용

## 12. TBD

- soft-delete(revoked) vs hard delete 운영 선택

## 13. 종료 게이트

JSSP 신규 파일 0 + ID 2개 PASS.
