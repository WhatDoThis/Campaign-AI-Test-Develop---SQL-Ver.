# 4차 · Fragment 자동승인 (for AI)

> **AGENT_MODE**. **UI 파일 일절 미변경** (`jssp/testWooAiStudio*`, `html/`, `input_form/` 금지).  
> 1~3차와 **병렬 브랜치** 가능.

## 0. 실행 프롬프트

```
[#147 · 4차 Fragment자동승인]
첨부: docs/report/upgrade_plan/06_4차_Fragment자동승인.md
선행: 0차 PASS (UI 선행 불필요)
고유: UI 파일 미변경. Foundry publish → active 자동. near dedup은 승인대기 제거.
참고: docs/report/10_Fragment_생애주기_설계.md
종료: acc-id-tracer + acc-verifier.
```

## 1. 차수 목표

게이트 통과 fragment는 사람 승인 없이 `active`로 들어가 Stage A/컴파일에 즉시 쓰이게 한다.  
중복(near)은 승인 큐가 아니라 7차 관리 목록으로 돌린다.

## 2. 커버 ID

| ID | 원문 | 구현 |
|---|---|---|
| FRAG-7-1 | 조건→frag조회→필요시생성 | 현행 Foundry 유지(사실). 회귀 테스트 |
| FRAG-7-2 | 승인→자동승인 | publish 경로 `status=active`, `active=true` (+ approved_by=`system`/`foundry` 등) |
| FRAG-7-3 | 중복을 승인 로직에서 제외 | near여도 awaiting_approval 강제 중단; verified 정체 금지 |
| J-9-2 | frag 없으면 자동생성 후 SQL | 자동 active 후 Generate 재시도 경로 확인 |

## 3. 선행 / 후속

- 선행: 0차. Foundry ON (`testWooEnv.js`)
- 병렬: 1~3차 UI
- 후속: 5차 매칭 품질, 7차 중복 UI

## 4. 근거

- 프로젝트 설계: `docs/report/10_Fragment_생애주기_설계.md` (active 자동 진입)
- 현행 코드: `testWooFoundry.js` publish `status:"verified"` / `testWooRepository.js` `approveFragment`
- Data APIs: Write/queryDef 공식 URL

## 5. 변경 파일

| 경로 | 구분 | 요지 |
|---|---|---|
| `new_ver/js/testWooFoundry.js` | 수정 | publish status active |
| `new_ver/js/testWooLifecycle.js` | 수정 | publish 기본값 |
| `new_ver/js/testWooRepository.js` | 수정 | 승인 API는 관리/민감용으로 축소 가능 |
| `new_ver/js/testWooFragments.js` | 확인 | Stage A가 active 요구 — 자동 active와 정합 |
| `new_ver/jssp/testWooAiFragmentReview.jssp` | 수정(최소) | 자동승인 후 큐 상태 메시지 |
| `new_ver/navtree/testWooAiNavtree.xml` | 수정 | Fragments view의 sysFilter **주석 블록**이 `@status='verified' AND @active=0` 기준이라 자동승인 후 무효 → 주석을 `active` 정책에 맞게 갱신하거나 제거(운영 필터와 모순 금지) |
| `docs/log/log.md` | 수정 | 로그 |

**금지 경로**: `testWooAiStudio.jssp`, `testWooAiStudioJs.jssp`, `testWooAiStudio.js`, `input_form/**`

## 6. 구현 상세

### Step 1 — publish 기본값

- **무엇을**: 게이트 통과 일반 슬롯 → `status=active`, `active=true`
- **민감 컬럼**(설계 문서 verified 잔존 의미)만 수동 경로 유지할지는 코드 주석+Option 킬스위치 `testWooAiAutoApprove=false`로 가드
- **왜**: FRAG-7-2

### Step 2 — 큐 상태

- awaiting_approval 전이를 near/일반 생성에서 제거
- 큐 done + fragmentId 연결

### Step 3 — 회귀

- Generate → unmatched → Foundry → 재검색 → compile 가능(active)
- `docs/report/10_…`의 certified 라벨 추가는 **본 차수 범위 외**(별도). 최소 변경만

## 7. 금지사항

- Studio UI 수정
- 게이트/ feasibility 제거(“전부 저장”)
- dedup exact merge 자동 삭제(7차 사람 삭제)

## 8. DoD

- [ ] 신규 Foundry fragment 1건의 `@status`가 `active`다
- [ ] `@active` = 1/true
- [ ] 동일 NL 재요청 시 사람 승인 화면 없이 SQL 생성까지 진행된다
- [ ] near dedup 건이 승인 대기 큐에 남지 않는다
- [ ] Option으로 자동승인 OFF 가능(킬스위치)
- [ ] Studio 파일 git diff 없음
- [ ] navtree Fragments sysFilter 주석이 자동승인 정책(`active`)과 모순되지 않는다

## 9. HUMAN_CONSOLE

1. JS 라이브러리 재배포: Foundry/Lifecycle/Repository/Fragments
2. Foundry 배치 WF 재시작(필요 시)
3. 스모크 NL 1건으로 큐→fragment→Generate
4. Explorer Fragments 목록에서 status 확인
5. `4차 HUMAN: …`

## 10. 테스트·디버깅

### Agent

- [ ] publish 호출부 status 문자열 검사
- [ ] compiler/gates가 active만 쓰는지 확인
- [ ] Studio 경로 diff empty

### HUMAN 스모크

- [ ] 기존 verified 잔여분 1건 수기 active 이관(운영 메모)
- [ ] 자동승인 OFF 시 구동작(또는 안전한 fail)

### 디버그

| 증상 | 조치 |
|---|---|
| 생성돼도 compile 실패 | status 아직 verified — publish 경로 누락 |
| 큐 stuck awaiting_approval | 전이 코드 잔존 |
| 민감 데이터 유출 우려 | 킬스위치 OFF + verified 경로 |

## 11. 롤백

- Option `testWooAiAutoApprove=false` + 이전 JS 재배포
- 잘못 active된 fragment는 revoked/수기 처리

## 12. TBD

- 민감 컬럼 자동승인 제외 목록(운영 정책) — Option JSON

## 13. 종료 게이트

UI diff empty + ID 4개 PASS.
