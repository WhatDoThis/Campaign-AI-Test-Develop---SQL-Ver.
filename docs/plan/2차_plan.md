# 2차 plan — 상태머신과 캠페인 폴더

| 항목 | 값 |
|---|---|
| litmus | **v=141** |
| 스키마 | `woo:folder` extends `xtk:folder` · `@isAiFolder` |
| API | `listAiFolders` only (Write 없음) |
| UI | NONE→FOLDER_LIST→FOLDER_SELECTED · WKF는 플레이스홀더 1행 |
| embed | workflowName+embed=1 이면 기존 SQL 이력 경로(폴더 게이트 생략) |
