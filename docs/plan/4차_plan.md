# 4차 plan — Fragment 자동승인

| 항목 | 값 |
|---|---|
| 가이드 | `docs/report/upgrade_plan/06_4차_Fragment자동승인.md` |
| 상태 | **HUMAN PASS** (2026-08-11) — Foundry→active→Generate→등록·SQL 목록. 킬스위치 Skip |
| Studio UI | **미변경** (금지) |

## 변경 요지

| 경로 | 내용 |
|---|---|
| `testWooFoundry.js` | publish `status=active` · 큐 `done` · Option `testWooAiAutoApprove` |
| `testWooLifecycle.js` | 기본 status active · approved_by/at |
| `testWooFragments.js` | 주석 정합 (Stage A 기본 active) |
| `testWooRepository.js` | approveFragment = 잔여/킬스위치용 |
| `testWooAiFragmentReview.jssp` | autoApprove 노트 |
| `testWooAiNavtree.xml` | verified+active=0 주석 폐기 |

## Option

| 이름 | 기본 | OFF |
|---|---|---|
| `testWooAiAutoApprove` | 비움 = ON | `0` / `false` / `off` / `no` → verified + awaiting_approval |

## DoD (HUMAN)

- [ ] 신규 Foundry frag `@status=active`, `@active=true`
- [ ] 큐 status=`done` (awaiting_approval 아님)
- [ ] 동일 NL 재요청 시 승인 없이 Generate→SQL
- [ ] 킬스위치 OFF 시 verified 경로
