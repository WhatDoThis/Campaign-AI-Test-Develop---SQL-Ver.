# 고도화 로드맵 INDEX (for AI)

이 폴더의 문서는 **사람용 설명서가 아니라 Chat/Agent에 첨부해 실행하는 지시서**다.

## 필수 선행 읽기 (모든 차수)

1. `docs/report/upgrade_plan/00_고도화 개발 아이디어_관리자 작성본.md`
2. `docs/report/11_고도화_추적표.md`
3. `.cursor/rules/00-acc-guardrails.mdc`
4. `docs/log/log.md` 최신 10건

## 실행 순서

| 순서 | 파일 | 코드? | 비고 |
|---|---|---|---|
| 기반 | (본 INDEX + 추적표 + rules/skills/agents) | 없음 | #142 |
| 0 | `01_0차_베이스라인안정화.md` | 검증 위주 | #141 유지 |
| 1 | `02_1차_진입점과셸.md` | 있음 | WF 확장 폼 존치 |
| 2 | `03_2차_상태머신과캠페인폴더.md` | 있음 | `@isAiFolder` |
| 3a | `04_3a_PoC.md` | **없음** | 3차 30일 전 |
| 3 | `05_3차_WKF라이프사이클.md` | 있음 | Spawn 금지 |
| 4 | `06_4차_Fragment자동승인.md` | 있음 | UI 미변경 · 1~3과 병렬 |
| 5 | `07_5차_조건매칭과SQL목록.md` | 있음 | Jaccard 0.9 |
| 6 | `08_6차_SQL주입과등록.md` | 있음 | J-9-5-2 구현 금지 |
| 7 | `09_7차_중복Fragment관리.md` | 있음 | JSSP 신규 금지 |
| 8 | `10_8차_확장폼폐기.md` | 있음 | 6차+6개월 후 |

## 운용 규칙

1. **한 차수 = 한 Chat**. 문서 1개만 첨부.
2. Plan 모드 → `docs/plan/N차_plan.md` 저장 후 구현.
3. 후속 수정 **3회 초과** → revert 후 plan 재작성.
4. 코드 변경 후 `/acc-verifier` + `/acc-id-tracer` 필수.
5. 운영자(인간) 콘솔 단계는 각 문서 `## HUMAN_CONSOLE` 섹션 — Agent는 여기 항목을 "완료했다고" 표시하지 말고 **대기/체크리스트**로 남겨라.

## 운영자 확정

- UI-3-2 = folder `@isAiFolder` 확장
- J-9-5-2 = 구현 불가 (6차에 경량 언급만)
