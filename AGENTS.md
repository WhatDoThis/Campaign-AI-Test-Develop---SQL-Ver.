# AGENTS.md — Campaign AI Studio

Instructions for Cursor agents and subagents working in this repository.

## Project summary

**Adobe Campaign Classic v7** extension for LG U+: marketers enter Korean natural language → system selects pre-verified SQL fragments → deterministic compiler builds audience SQL → registers `ai_sql_id` for a custom workflow activity.

Implementation lives in `new_ver/` (namespace `woo`, prefix `testWoo`). Production PRD uses `uplus` naming; test deployment uses `woo`/`testWoo*`.

## Mandatory context loading

Before implementing:

1. Read `.cursor/skills/campaign-ai-studio/SKILL.md`
2. Read relevant section of `docs/report/01_개발가이드.md`
3. For Adobe API questions → `.cursor/skills/campaign-ai-studio/adobe-references.md`
4. For API/CNF contracts → `.cursor/skills/campaign-ai-studio/pipeline-contracts.md`

## Subagent routing

| Task type | Subagent | Focus |
|-----------|----------|-------|
| Trace call flow, find usages | `explore` | JSSP → testWoo.* → schema; report file:line |
| Run seed generator, git, shell | `shell` | PowerShell; no direct DB DDL |
| PR-ready review | `bugbot` | Diff against `new_ver/` ACC constraints |
| Auth/secrets/SQL injection | `security-review` | JSSP auth, param substitution, option keys |
| Adobe doc lookup | parent agent | Fetch Experience League URLs from adobe-references.md |

## Architecture invariants (never violate)

1. **LLM does not emit final SQL** — only CNF `plan_json` via Pass0/Pass1
2. **LLM calls only from JSSP/server JS** — no browser API keys
3. **Register inject** — writes registered SQL into `aiStudioSql` editor (`script`) + `ai-sql-id`; Start `target="aiStudioSql"`
4. **Global object `testWoo.*`** — not `woo.*` (schema namespace collision)
5. **Rhino-safe server JS** — no ES6 array methods, no `wait`, no Promise
6. **SOAP** — only `ShellProbe`/`ShellPick`/`ShellBind` (never old Inspect/Bind names). Redeploy schema+JS+form together

## Key files by concern

| Concern | Files |
|---------|-------|
| LLM pipeline | `new_ver/js/testWooLlm.js`, `testWooFragments.js` |
| SQL compile | `new_ver/js/testWooCompiler.js` |
| Validation | `new_ver/js/testWooGates.js` |
| API surface | `new_ver/jssp/testWooAiGenerate.jssp`, `Validate.jssp`, `Register.jssp` |
| UI | `new_ver/jssp/testWooAiStudio.jssp`, `testWooAiStudioJs.jssp` |
| Data | `new_ver/schema/testWooAiFragment.xml`, `testWooAiSql.xml` |
| WF canvas → Studio | `input_form/testWooExtendWorkflow.xml` (iframe embed + Bind); `workflow/testWooXtkWorkflowRedirectPatch.xml`; SOAP Inspect/Bind `testWooAiWorkflowUi` |

## Deferred features (do not implement without explicit request)

- `testWooAiCodemap`, `testWooAiRequestQueue`
- Funnel COUNT, EXPLAIN scale gates
- `testWooWorkflowIo` (deprecated)
- WF canvas fallback B/C (AI tab / campaign WebApp) — only if 7a soapCall path fails on env
- `aiStudioSql` runtime beyond script inject (uplus library outside repo)
- LLM free-form SQL fallback (PRD Phase 2)

## Verification after changes

1. Syntax: Rhino-compatible JS, valid XML
2. Contracts: JSSP response shapes match `pipeline-contracts.md`
3. Connection: frontend `fetch` URLs match `/woo/*.jssp`
4. Header: `.cursor/rules/module-header-docstring.mdc` (역할 / Main Functions / Dependencies)
5. Log: append entry to `docs/log/log.md`
6. **Downstream**: `.cursor/rules/fix-downstream-review.mdc` + `.cursor/skills/campaign-ai-studio/pipeline-downstream-review.md` — NL fix 시 Stage A→compile→gates→UI 같은 턴 trace

## External references priority

1. Adobe Experience League (campaign-api, campaign-classic docs)
2. AdobeDocs GitHub mirrors
3. Project PRD + dev guide
4. OpenRouter / Anthropic API docs (LLM adapter only)

Do not rely on generic "Campaign" knowledge when ACC v7 Rhino limits apply — always check `acc-rhino-constraints.md`.
