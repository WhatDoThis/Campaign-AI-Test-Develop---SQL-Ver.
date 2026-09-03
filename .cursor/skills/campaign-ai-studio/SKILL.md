---
name: campaign-ai-studio
description: Develops Adobe Campaign Classic Test Woo AI Studio — NL to fragment CNF plan to deterministic SQL, JSSP APIs, Rhino server JS. Use when editing new_ver/, Campaign schemas, JSSP, LLM pipeline, fragment library, or Adobe Campaign v7 integration.
---

# Campaign AI Studio (Test Woo)

LG U+ Adobe Campaign **AI 대상자 추출 시스템**. 마케터 자연어 → 검증된 fragment 조립 → SQL → 커스텀 액티비티 등록.

## Before coding

1. Read `docs/main/PRD.md` (설계 원칙) and `docs/report/01_개발가이드.md` (배포·네이밍·섹션 진행)
2. Match patterns in `new_ver/js/testWoo*.js` and `new_ver/jssp/`
3. For Adobe API details → [adobe-references.md](adobe-references.md)
4. For pipeline/CNF/API contracts → [pipeline-contracts.md](pipeline-contracts.md)
5. For Rhino constraints → [acc-rhino-constraints.md](acc-rhino-constraints.md)
6. For **DB access / seed / no sqlExec** → [acc-data-access.md](acc-data-access.md)
7. For architecture snapshot → [architecture.md](architecture.md)
8. **Bug / incident (before fix)** → [incident-diagnosis/SKILL.md](incident-diagnosis/SKILL.md) — REPRO·PROBE·롤백 판정
9. **After any bug fix** → [pipeline-downstream-review.md](pipeline-downstream-review.md) + `.cursor/rules/fix-downstream-review.mdc` (fix → trace hops → respond)

## Non-negotiable design

| Rule | Detail |
|------|--------|
| AI does NOT write SQL | LLM → CNF `plan_json` only; `testWoo.compiler` assembles SQL |
| Register inject | Register → `sqlDM` `@name=aiStudioSql` → `userScript` + `ai-sql-id`. Start `target="aiStudioSql"` |
| LLM server-side only | JSSP + `HttpClientRequest`; never browser direct API key |
| Namespace `woo` | Files/schemas/forms: `testWoo*` camel; global JS object: `testWoo.*` (NOT `woo.*`) |
| **No raw DB DML** | CRUD = `xtk.session.Write` + queryDef; seed = `testWooSampleSeed.js`; read SQL = `sqlSelect` only; **never sqlExec / INSERT SQL** |
| Foundry ON (test env) | `testWooEnv.js` → `foundry.enabled: true` (log #85). 미매칭 슬롯 → 큐 → `WKF_testWooFoundry` 배치. 끄면 unmatched 오류 UI 로 되돌아간다 |
| **No domain hardcoding** | 운영 스케일: 스키마·컬럼·값·조합 폭발 → JS에 컬럼당 2줄 = 수천 줄·부하·회귀. **도메인은 fragment 카탈로그만.** → `.cursor/rules/no-domain-hardcoding.mdc` |

## Pipeline (current)

```
NL → EnPivot (전체 NL 1콜 · 동일문장 캐시만 스킵) → Stage A
   → M1 원문 → M2 en[] → M3 concept (miss면 probe heal → `_negative`)
   → Pass1 → compiler → gates → Register
   추출 실패 → retryInput. 값 abstain → unresolved (Foundry 큐 금지)
```

## File map

| Path | Role |
|------|------|
| `new_ver/js/testWooCommon.js` | jsonOut, auth, requireRight |
| `new_ver/js/testWooConfig.js` | LLM options, queryDef guardrails |
| `new_ver/js/testWooFragContract.js` | Slot↔Index↔Match↔Bind shared contract (#172) |
| `new_ver/js/testWooFragments.js` | Stage A catalog search |
| `new_ver/js/testWooEnPivot.js` | EN Pivot extract + 도메인 EN 사전화 (`enrichDomainEn`) |
| `new_ver/js/testWooLlm.js` | Pass0/Pass1, OpenRouter/Anthropic |
| `new_ver/js/testWooCompiler.js` | CNF → SQL |
| `new_ver/js/testWooGates.js` | Validation gates |
| `new_ver/js/testWooRepository.js` | History persist |
| `new_ver/jssp/testWooAi*.jssp` | `/woo/` JSON API + Studio UI |
| `new_ver/schema/*.xml` | `woo:testWoo*` data schemas (+ `testWooAiWorkflowUi` SOAP host) |
| `new_ver/js/testWooWorkflowUi.js` | WF form SOAP `BuildStudioUrl` |
| `new_ver/workflow/testWooXtkWorkflowButtonPatch.xml` | xtk:workflow soapCall insert (7a) |

## Implementation checklist

When changing server JS or JSSP:

- [ ] **Downstream review** — [pipeline-downstream-review.md](pipeline-downstream-review.md): fix 후 compile·gates·UI hop 같은 턴 검수
- [ ] Rhino-safe: no `map`/`forEach`/`Promise`/`async`/`=>`/template literals
- [ ] `HttpClientRequest.execute()` sync only — never reference `.wait`
- [ ] `MemoryBuffer`: request `fromString(s,"utf-8")`; response `toString()` (int CODEPAGE)
- [ ] queryDef: `lineCount` ≤ 5000; Stage A excludes `sql_text` bulk load
- [ ] Module header per `.cursor/rules/module-header-docstring.mdc`  
      (역할 한 줄 + 짧은 역할 블록 · `[Main Functions]` 공개 API만 · `[Dependencies]` 연결 방식 · 서술형 최소화)
- [ ] **Data access**: no sqlExec; no SQL INSERT for seed/metadata — see [acc-data-access.md](acc-data-access.md)

## Subagent hints

- **explore**: trace `testWoo.*` call chain from JSSP → JS libraries
- **shell**: seed refresh via WF `testWooSampleSeed.js` only (not SQL scripts; local generator removed)
- **bugbot/security-review**: focus on auth bypass, SQL injection in param substitution, secret leakage
