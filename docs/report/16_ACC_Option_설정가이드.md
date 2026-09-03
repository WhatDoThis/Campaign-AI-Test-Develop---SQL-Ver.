# 16 · ACC Option·Env 설정 가이드

> **상태:** 2026-09-01 반영 (#404)  
> **정본 코드:** `testWooEnv.js` [A][B] · `testWooConfig.js` · `testWooWorkflowClone.js`  
> **관련:** `upgrade_plan/15_JS_환경값_중앙화_2단계.md` · `(공용)모듈_기능맵.md` §C

---

## 0. 한 줄 요약

| 구분 | 어디서 설정 | 예시 |
|---|---|---|
| **템플릿 id (숫자)** | ACC **Option** (정본) | `testWooAiWkfTemplateId` |
| **템플릿 internalName (계약)** | **Env** Git (정본) | `wfEmptyTemplate_AI` |
| **LLM 시크릿·모델** | ACC **Option** | `testWooAiLlmApiKey` |
| **엔진 튜닝·가드** | **Env** Git | `guard` · `llm.pass0MaxTokens` |
| **PoC mart** | **Env** Git `[C] mart` | `grainKeyCandidates` |

**병합 우선순위 (템플릿 id):**  
`Option id` → `internalName 검증(Env contract)` → `DB lookup` → `Env fallback id`

---

## 1. ACC 콘솔 경로

| 항목 | 경로 |
|---|---|
| XtkOption | **Administration → Application settings → Options** |
| Named right | **Administration → Access management → Named rights** |
| JS library | **Administration → Configuration → JavaScript libraries** |
| Schema / Form / JSSP | 각각 Configuration 메뉴 |

Option 검색: 이름 접두 `testWooAi` 로 필터.

---

## 2. XtkOption 전체 (필수·권장)

### 2-A. LLM (Generate·Foundry **필수**)

| Option | 필수 | 설명 | 설정 예 |
|---|---|---|---|
| `testWooAiLlmApiKey` | ✅ | OpenRouter/Anthropic API 키 | `sk-or-…` |
| `testWooAiLlmModel` | ✅ | chat completions 모델 슬러그 | `anthropic/claude-opus-4` 등 |
| `testWooAiLlmEndpoint` | ✅ | chat API URL | OpenRouter: `https://openrouter.ai/api/v1/chat/completions` |

비우면 Generate·Foundry LLM 호출 실패. **Env에 넣지 않음.**

---

### 2-B. Campaign / WKF 템플릿 (**운영 정본**)

| Option | 필수 | 설명 | 확인 방법 |
|---|---|---|---|
| `testWooAiCampaignTemplateId` | ✅ | 새 **캠페인** 복제 모델 id | Explorer → Campaign templates → `@internalName` = **`OPEmptyTemplate_AI`** 인 행의 `@id` |
| `testWooAiWkfTemplateId` | ✅ | 새 **WKF** 복제 모델 id | Explorer → Workflow templates → `@internalName` = **`wfEmptyTemplate_AI`** 인 행의 `@id` |
| `testWooAiWkfTemplateName` | 권장 | WKF 템플릿 internalName (표시·검증) | `wfEmptyTemplate_AI` |
| `testWooAiWkfMaxPerCampaign` | 선택 | 캠페인당 WKF 생성 상한 | 비우면 Env fallback `15` (hard cap `20`) |

**중요**

- id는 **ACC 인스턴스마다 다름**. Git의 Env `campaignTemplateId`/`wkfTemplateId`는 **Option 미설정 dev용 fallback**일 뿐.
- Option id의 `@internalName`이 Env contract와 다르면 서버가 **lookup/env_fallback으로 교정**하거나 **오류**를 냄.
- WKF 템플릿 캔버스에 **`aiStudioSql`** (sqlDM) 액티비티가 있어야 Register inject 성공.

**internalName 계약 (Env Git — 변경 시 JS 재등록)**

| 키 | contract 값 |
|---|---|
| `nms.campaignTemplateName` | `OPEmptyTemplate_AI` |
| `nms.wkfTemplateName` | `wfEmptyTemplate_AI` |
| `nms.aiActivityName` | `aiStudioSql` |

---

### 2-C. Foundry / Match / Inject

| Option | 기본 | 설명 |
|---|---|---|
| `testWooAiAutoApprove` | ON (비움) | Foundry 신규 fragment 즉시 `active`. `0`/`false`/`off`/`no` = `verified` 대기 |
| `testWooAiMatchEnabled` | **OFF** (비움) | Studio 유사 WKF 매칭 UI. `1`/`true`만 ON (#154 HUMAN 별도) |
| `testWooAiInjectBackup` | 시스템 | Register inject 직전 SQL·id 스냅샷. **수동 편집 금지** |

---

### 2-D. 시스템·레거시 (수동 생성 금지)

| Option | 설명 |
|---|---|
| `testWooAiInjectBackup` | ~~Register inject 스냅샷~~ → **#406 schema `inject_backup_*` per-login** (전역 Option은 1회 migrate만) |
| `testWooAiStudioBaseUrl` | WF 폼→Studio URL (`https://host` 만 · `/woo/` 금지) |

**폐기 (Option write 중단 · #405):** `testWooAiBindPick_{login}` · `testWooAiNlRecent_{login}`  
→ **`woo:testWooAiOperatorPrefs` schema** (로그인당 1행). 기존 Option은 최초 조회 시 1회 migrate 후 미사용.

---

## 3. Schema `woo:testWooAiOperatorPrefs` (로그인별 prefs)

| 컬럼 | 용도 |
|---|---|
| `operator_login` | UK · ACC login |
| `bind_wkf_name` / `bind_ai_sql_id` | WF Apply용 마지막 선택 |
| `nl_recent_1` … `nl_recent_10` | 이전 질문 텍스트 (96자) |
| `nl_recent_at_1` … `nl_recent_at_10` | 슬롯별 ms 타임스탬프 |
| `last_program_id` / `last_campaign_id` / `last_wkf_id` / `last_wkf_name` | Studio 마지막 탐색 위치 (재접속 resume) |
| `inject_backup_wkf` / `inject_backup_activity` / `inject_backup_ai_sql_id` / `inject_backup_script` | Register inject 롤백 (로그인별) |
| `modified_at` | 갱신 시각 |

**UI 정본:** NL recent는 브라우저 **sessionStorage** · schema는 다기기·재접속 보조.

**의도적으로 schema 밖 (browser-only):** `twStudioCache` — WKF별 draft plan/SQL (R2/S8 · 세션 캐시).

---

## 4. Env `[B] nms` — contract vs fallback

```text
contract (Git 정본)          fallback (Option 없을 때만)
─────────────────────        ────────────────────────────
campaignTemplateName         campaignTemplateId  ← lgu-test 예시
wkfTemplateName              wkfTemplateId
aiActivityName               wkfMaxPerCampaign / wkfMaxHardCap
```

**운영에서 템플릿을 바꿀 때:** ACC Option id만 수정. Env id를 Git에서 바꿔도 **Option이 설정돼 있으면 Option이 이김.**

---

## 5. Env `[E]` — Git만 (Option 없음)

주요 블록. PoC→운영 시 `[C] mart` 위주 교체.

| 블록 | 용도 | 대표 키 |
|---|---|---|
| `guard` | Stage A·Pass0 상한 | `MAX_SLOTS`, `STAGE_A_TOP_N` |
| `llm` | provider·토큰·penalty | `pass0MaxTokens`, `frequencyPenalty` |
| `foundry` | 큐·배치·namespace | `enabled`, `batchSize`, `namespaces` |
| `triage` | 실현가능성 판정 | `minConfidence`, `valueProbeLimit` |
| `toolkit` | LLM tool call 예산 | `totalCallBudget` |
| `probe` | sqlSelect 프로브 | `timeoutMs`, `sampleLimit` |
| `match` | Match 알고리즘 상수 | `jaccardThreshold` (UI 킬스위치는 Option) |
| `mart` | grain·population SQL | `grainKeyCandidates`, `populationCountSql` |
| `debug` | `#twDiag` 트레이스 | `enabled` |
| `security` | Studio IP 게이트 | `allowedCidr` |

---

## 6. Named right (필수)

| Right | 필수 | 용도 |
|---|---|---|
| `testWooAiSqlGenerate` | ✅ | Generate·Validate·Foundry·목록 |
| `testWooAiSqlRegister` | ✅ | SQL 저장·WKF inject |
| `testWooAiLibraryManage` | 권장 | fragment 승인·GapLog |

---

## 7. 배포 순서·캐시

```
schema → js library → form/navtree → JSSP
```

배포 후 Studio URL에 `v=<n>` 확인. `libVersions` allMatch:

| 모듈 | 기대 __v (2026-09-01) |
|---|---|
| env / cfg | 164 |
| wfClone | 165 |
| workflowUi | 171 |
| llm | 204 |
| fragContract | 208 |
| opPrefs | 162 |

---

## 8. 설정 검증 (HUMAN litmus)

### 8-A. libVersions

Studio 부트 → `#twDiag` 또는 Network `action=libVersions` → `allMatch: true`.

### 8-B. template_diagnostics

StudioContext `listWkfs` / `createWkf` / `createCampaign` 응답:

```json
"template_diagnostics": {
  "priority": "Option id -> contract internalName verify -> ...",
  "campaign": {
    "contract_name": "OPEmptyTemplate_AI",
    "option_id": 30030,
    "option_internalName": "OPEmptyTemplate_AI",
    "resolved_id": 30030,
    "resolved_source": "option",
    "mismatch": false
  },
  "wkf": {
    "contract_name": "wfEmptyTemplate_AI",
    "resolved_source": "option",
    "ai_activity": "aiStudioSql"
  }
}
```

| `resolved_source` | 의미 |
|---|---|
| `option` | Option id 사용 (contract 일치) |
| `lookup` | Option 없음 → DB internalName 조회 |
| `env_fallback` | Option 없음 → Env fallback id |
| `option_corrected` | Option id 불일치 → 자동 교정 (warning) |

### 8-C. WKF 생성 → Register

1. Program 선택 → 캠페인 생성  
2. WKF 생성 → Explorer에서 **`aiStudioSql`** 캔버스 확인  
3. Generate → Register → inject 성공 (`ai_sql_id` 반영)

---

## 8. 자주 하는 실수

| 증상 | 원인 | 조치 |
|---|---|---|
| 구 템플릿으로 WKF 생성 | Option id가 구 모델 가리킴 | Option id를 contract internalName과 일치하는 id로 수정 |
| Env id 바꿨는데 안 바뀜 | Option이 우선 | **Option** 수정 (Env id는 fallback) |
| `aiStudioSql` 없음 오류 | WKF 템플릿에 sqlDM 없음 | `wfEmptyTemplate_AI` 템플릿·Option id 재확인 |
| Generate LLM 실패 | LLM Option 3종 미설정 | §2-A 설정 |
| libVersions mismatch | JS/JSSP 미배포 | §6 순서 재배포 |

---

## 9. lgu-test 초기 세팅 체크리스트

- [ ] Option LLM 3종 (`ApiKey`, `Model`, `Endpoint`)
- [ ] `testWooAiCampaignTemplateId` → `@internalName=OPEmptyTemplate_AI`
- [ ] `testWooAiWkfTemplateId` → `@internalName=wfEmptyTemplate_AI`
- [ ] `testWooAiWkfTemplateName` = `wfEmptyTemplate_AI` (권장)
- [ ] Named right 2종 이상 오퍼레이터 부여
- [ ] JS library `woo:testWooEnv.js` · `testWooConfig.js` · `testWooWorkflowClone.js` __v=164/165
- [ ] Studio `libVersions` allMatch
- [ ] `template_diagnostics.wkf.resolved_source` = `option`, `mismatch` = false
- [ ] 신규 WKF → Register smoke PASS
