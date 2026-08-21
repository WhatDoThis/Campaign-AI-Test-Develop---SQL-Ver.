# 1차 plan — 진입점과 셸

| 항목 | 값 |
|---|---|
| 선행 | PoC-0 RESULT = PASS (view 유지) |
| 분기 | A — view/viewType + rights |
| litmus | **v=140** |
| 범위 | navtree rights · Studio 정보바+table 2열 · 더미 목록 · WF 폼 존치(v만 동기) |

## 구현 요약

- `testWooAiNavtree.xml`: Studio/GapAdmin `rights="admin,testWooAiOperator"`
- `testWooAiStudio.jssp`: `#twInfoBar` 48px + `#twMainTable` 좌 AI/우 목록
- `testWooAiStudioJs.jssp` + `html/testWooAiStudio.js`: `renderDummyList` / `setInfoBar`
- embed+workflowName → 우측 SQL 이력(기존). Tools/standalone → 더미 3행
