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

## Non-negotiable design

| Rule | Detail |
|------|--------|
| AI does NOT write SQL | LLM → CNF `plan_json` only; `testWoo.compiler` assembles SQL |
| No WF XML inject | Register returns `ai_sql_id`; custom activity loads `woo:testWooAiSql` |
| LLM server-side only | JSSP + `HttpClientRequest`; never browser direct API key |
| Namespace `woo` | Files/schemas/forms: `testWoo*` camel; global JS object: `testWoo.*` (NOT `woo.*`) |
| **No raw DB DML** | CRUD = `xtk.session.Write` + queryDef; seed = `testWooSampleSeed.js`; read SQL = `sqlSelect` only; **never sqlExec / INSERT SQL** |
| Foundry ON (test env) | `testWooEnv.js` → `foundry.enabled: true` (log #85). 미매칭 슬롯 → 큐 → `WKF_testWooFoundry` 배치. 끄면 unmatched 오류 UI 로 되돌아간다 |

## Pipeline (current)

```
NL → Pass0 (LLM slots) → Stage A (fragment search, paginated)
   → Pass1 (LLM CNF plan) → compiler (INTERSECT/UNION/EXCEPT)
   → gates → Register (ai_sql_id)
```

## File map

| Path | Role |
|------|------|
| `new_ver/js/testWooCommon.js` | jsonOut, auth, requireRight |
| `new_ver/js/testWooConfig.js` | LLM options, queryDef guardrails |
| `new_ver/js/testWooFragments.js` | Stage A catalog search |
| `new_ver/js/testWooLlm.js` | Pass0/Pass1, OpenRouter/Anthropic |
| `new_ver/js/testWooCompiler.js` | CNF → SQL |
| `new_ver/js/testWooGates.js` | Validation gates |
| `new_ver/js/testWooRepository.js` | History persist |
| `new_ver/jssp/testWooAi*.jssp` | `/woo/` JSON API + Studio UI |
| `new_ver/schema/*.xml` | `woo:testWoo*` data schemas |

## Implementation checklist

When changing server JS or JSSP:

- [ ] Rhino-safe: no `map`/`forEach`/`Promise`/`async`/`=>`/template literals
- [ ] `HttpClientRequest.execute()` sync only — never reference `.wait`
- [ ] `MemoryBuffer`: request `fromString(s,"utf-8")`; response `toString()` (int CODEPAGE)
- [ ] queryDef: `lineCount` ≤ 5000; Stage A excludes `sql_text` bulk load
- [ ] Module docstring (Korean) at file top per project rule #6
- [ ] **Data access**: no sqlExec; no SQL INSERT for seed/metadata — see [acc-data-access.md](acc-data-access.md)

## Subagent hints

- **explore**: trace `testWoo.*` call chain from JSSP → JS libraries
- **shell**: seed refresh via WF `testWooSampleSeed.js` only (not SQL scripts; local generator removed)
- **bugbot/security-review**: focus on auth bypass, SQL injection in param substitution, secret leakage
