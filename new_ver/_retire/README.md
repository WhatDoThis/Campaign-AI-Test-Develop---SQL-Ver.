# new_ver/_retire — ACC 미배포 · 제작용 보관

**Studio 진입:** Tools → Test Woo AI Studio (`navtree` command)만 사용.  
**WF 캔버스 Property 옆 embed** 는 사용하지 않음.

## ACC 콘솔에서 제거 (테스트 → STG 전)

| 객체 | namespace/name | 증상 |
|---|---|---|
| Input form | `woo:testWooExtendWorkflow` | WF Properties 옆 **AI Studio** 탭 |
| Schema (SOAP) | `woo:testWooAiWorkflowUi` | embed SOAP (Register는 JS `commitInject`만 사용) |
| xtk:workflow 패치 | Properties 옆 `AI Studio` flatSubFormButton | 캔버스 툴바 아이콘/버튼 |
| JS library | `woo:testWooEmbedding.js` | dedup L2 (#455 retire — ACC 콘솔에서 제거) |
| Dynamic page | `testWooAiGapAdmin.jssp` | Tools Gap Admin (retire) |

### WF 캔버스 AI Studio 버튼 제거 (수동)

repo에서 XML을 `_retire/`로 옮겨도 **ACC 콘솔에 이미 등록된 객체는 그대로** 남는다.

1. **Administration → Configuration → Input forms** → `xtk:workflow` 열기  
2. XML에서 `label="AI Studio"` · `ref="woo:testWooExtendWorkflow:lib/aiStudio"` 블록 **삭제**  
   - 검색 키: `flatSubFormButton` + `AI Studio`  
   - 삽입본: `_retire/wf_canvas_embed/testWooXtkWorkflowRedirectPatch.xml`  
   - 되돌릴 원본 참고: `_retire/dev_only/workflow_backup/xtk_workflow_ORIGINAL.xml`
3. **Save** 후 Campaign에서 WF 재오픈 → Properties 옆 AI Studio 사라짐 확인
4. **Input forms** → `woo:testWooExtendWorkflow` **Delete**
5. **Schemas** → `woo:testWooAiWorkflowUi` 있으면 **Delete**
6. **Dynamic JavaScript pages** → `testWooAiGapAdmin.jssp` 있으면 **Delete**
7. **Navigation hierarchies** → `woo:testWooAiNav` **재등록** (Gap Admin command 제거본)

Studio 진입은 **Tools → Test Woo AI Studio** 만 사용.

## 폴더

| 경로 | 내용 |
|---|---|
| `wf_canvas_embed/` | urlViewer embed 폼 · SOAP 스키마 · xtk 패치 XML |
| `dev_only/` | 시드 WF · DryRun · Golden · sql_validate · smoke · backup |
| `js/` | `#455` retire — `testWooEmbedding.js` (dedup L2 제거) |
| `dev_only/testWooAiGoldenSchema.xml` | Golden 회귀 스키마 (STG 미배포) |
| `reference/` | CA 계약 참고 XML |
| `unused_jssp/` | Gap Admin JSSP (Foundry GapLog 스키마는 유지) |

상세 분류: `docs/main/(공용)new_ver_ACC배포분류.md`
