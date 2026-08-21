# 3차 plan — WKF 라이프사이클

| 항목 | 값 |
|---|---|
| litmus | **v=146** |
| 상태 | **HUMAN PASS** (기능 v=144 + UI v=146). TG-D 잔여(계정B 잠금)는 선택 · 다음 **4차** |

## 올바른 뎁스

```
AI Program (@isAiFolder)
  → Campaign from template opEmptyTemplate_LLM (id=10002)
      ← CreateOperationFromModelId + program-id Write
      → (템플릿이 LLM WKF 포함)
  → 기존 Campaign에 WKF 추가
      ← CreateInstanceFromModel(wfEmptyTemplate_CUSTOM id=17234)
```

## 검증된 사실 (PoC)

| 사실 | 판정 |
|---|---|
| bare Write 캠페인 = 껍데기 | FAIL 품질 |
| CreateOperationFromModelId(10002)+program-id | **T2 PASS** |
| CreateWorkflowFromModelId | **T3a FAIL** (id=0) |
| CreateInstanceFromModel(17234) | **T3b PASS** |
| Spawn | 금지 |

## Options (콘솔)

| Option | 기본값 |
|---|---|
| `testWooAiCampaignTemplateId` | `10002` |
| `testWooAiWkfTemplateId` | `17234` |
| `testWooAiWkfTemplateName` | `wfEmptyTemplate_CUSTOM` |
| `testWooAiWkfMaxPerCampaign` | `15` |

문서: `docs/report/upgrade_plan/04_3a_PoC_Template.md`
