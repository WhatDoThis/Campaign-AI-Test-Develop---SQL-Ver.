# 0차 plan — 베이스라인 안정화

| 항목 | 값 |
|---|---|
| 차수 | 0차 |
| 가이드 | `docs/report/upgrade_plan/01_0차_베이스라인안정화.md` |
| 브랜치 | `docs/roadmap-v2` |
| 선행 | `git diff main -- new_ver/` EMPTY — PASS |
| 모드 | 검증만 (신규 기능·new_ver 변경 없음) |
| HEAD (문서 브랜치) | `3efcb5a9007b3e4107298ca9d84cedad6f712c41` |
| #141 베이스라인 커밋 (main/new_ver) | `91f8b6e` — Reload `colspan=3` |
| litmus `v=` | **139** (form + Studio.jssp + StudioJs `?v=139`) |
| 레이아웃 후보 | `fix/embed-layout` 만 (v=143 계열) — 0차 DoD 전 main 병합 금지 |

## 정적 결과 (Agent)

| 검사 | 결과 |
|---|---|
| #133 금지 API call site | 0 |
| CSS flex/grid/vh/var(--)/calc | 0 (`<style>`) |
| FormatDate/GetDate expr | 0 |
| #141 Reload colspan=3 | PASS |
| StudioJs ↔ html body sync | PASS |
| Cache-Control / Pragma | no-store, no-cache |

## 롤백

- 본 차수 `new_ver` 커밋 없음 → 코드 revert 불필요
- 콘솔 이상 시: 직전 정상 form/JSSP 재등록 + Client Console 캐시 클리어
- 로그 번호: 본 차수 완료 = `docs/log/log.md` #151

## HUMAN_CONSOLE 대기

가이드 §9 — 운영자 회신: `0차 HUMAN: PASS|FAIL + 메모`
