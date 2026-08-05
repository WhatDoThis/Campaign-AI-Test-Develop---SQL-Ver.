# Pipeline & API Contracts

## JSSP endpoints (`/woo/`)

| Endpoint | Auth | Body | Success shape |
|----------|------|------|---------------|
| `testWooAiGenerate.jssp` | Generate | `{ nl_request, workflow_id? }` | `{ ok, passed, plan, sql, chips, summary, results }` |
| `testWooAiValidate.jssp` | Generate | `{ action:"validate", plan }` | `{ ok, passed, results, sql, summary, chips, plan }` |
| `testWooAiValidate.jssp` | Generate | `{ action:"count", plan }` | `{ ok, sql, keyColumn, funnel:[], … }` |
| `testWooAiValidate.jssp` | Generate | `{ action:"catalog" }` | `{ ok, categories }` |
| `testWooAiRegister.jssp` | Register | `{ plan, title, nl_request, … }` | `{ ok, passed, ai_sql_id, status, sql, summary }` |

Transport: `application/x-www-form-urlencoded`, field `payload` = UTF-8 JSON.

**Register ignores client `sql`** — server recompiles from `plan`.

Unmatched NL: `{ ok:false, unmatched:[…], plan }` — no fabrication.

Auth failure: `{ ok:false, code:"AUTH", logonUrl }`.

## Fragment record (`woo:testWooAiFragment`)

Required fields: `name`, `label`, `category`, `tags`, `key_column`, `sql_text`, `params`, `param_domain`, `description`, `sample_questions`, `status`.

`sql_text` = complete `SELECT DISTINCT grain …` with `{{param}}` placeholders.

## SQL history (`woo:testWooAiSql`)

Key fields: `nl_request`, `plan_json`, `sql_query`, `status`, `workflow_id`.

Status enum: `draft` | `validated` | `registered` | `rejected`.

## Gates (minimal, current)

| Gate | Check |
|------|-------|
| G1 syntax | Single SELECT, no DDL/DML, no `<%`, active fragment contract |
| G3 uniqueness | `COUNT(*) = COUNT(DISTINCT grain)` when enabled |
| G4 scale | Deferred options — implement only when requested |

## LLM calls (max 2 per generation)

1. **Pass0** — NL → slots + searchKeywords (no fragment ids)
2. **Pass1** — slots + Stage A candidates → CNF plan

No LLM for: SQL compile, summary/chips (from compiler), Register.

## Options (section 1)

Required for LLM: `testWooAiLlmApiKey`, `testWooAiLlmModel`, `testWooAiLlmEndpoint` only.

Other tuning: `testWooEnv.js`. Data/seed: [acc-data-access.md](acc-data-access.md).

## Custom activity runtime

Property `ai_sql-id` → load `woo:testWooAiSql.@sql_query` → execute → transition `tableName/schema/recCount`.

See `new_ver/workflow/testWooSampleCustomActivityContract.xml`.
