# Pipeline & API Contracts

## JSSP endpoints (`/woo/`)

| Endpoint | Auth | Body | Success shape |
|----------|------|------|---------------|
| `testWooAiGenerate.jssp` | Generate | `{ nl_request, workflow_name? }` | `{ ok, passed, plan, sql, chips, summary, results }` |
| `testWooAiValidate.jssp` | Generate | `{ action:"validate", plan }` | `{ ok, passed, results, sql, summary, chips, plan }` |
| `testWooAiValidate.jssp` | Generate | `{ action:"count", plan }` | `{ ok, sql, keyColumn, funnel:[], … }` |
| `testWooAiValidate.jssp` | Generate | `{ action:"catalog" }` | `{ ok, categories }` |
| `testWooAiValidate.jssp` | Generate | `{ action:"listSql", workflow_name }` | `{ ok, workflow_name, items:[{id,title,status,…}] }` |
| `testWooAiValidate.jssp` | Generate | `{ action:"getSql", ai_sql_id }` | `{ ok, item:{id,plan_json,sql_query,…} }` |
| `testWooAiRegister.jssp` | Register | `{ plan, title, nl_request, … }` | `{ ok, passed, ai_sql_id, status, sql, summary }` |

Transport: `application/x-www-form-urlencoded`, field `payload` = UTF-8 JSON.

**Register ignores client `sql`** — server recompiles from `plan`.

Unmatched NL: `{ ok:false, unmatched:[…], plan }` — no fabrication.

Auth failure: `{ ok:false, code:"AUTH", logonUrl }`.

## Fragment record (`woo:testWooAiFragment`)

Required fields: `name`, `label`, `category`, `tags`, `key_column`, `sql_text`, `params`, `param_domain`, `description`, `sample_questions`, `status`.

`sql_text` = complete `SELECT DISTINCT grain …` with `{{param}}` placeholders.

## Slot ↔ Index ↔ Match ↔ Bind (`testWoo.fragContract` / #172)

| Layer | Fields / rule | Owner |
|---|---|---|
| **Slot** | `id`, `text`, `searchKeywords[]`, `hintedCategory`. Audience-only residue (고객/대상자/회원/사용자) is dropped — it is not an unmatched axis. | Pass0 / `normalizeAtomicSlots` |
| **Index (publish)** | `synonyms` ← slot tokens + nlMap/`_bucket` keys; `sample_questions` ← `[slotText]`; `tags` = axis; `category` = `foundry` (축은 tags) | `fragContract.buildIndexFields` |
| **Match LIKE** | token⊂field is recall only. Acceptance = catalog key ⊂ slot (`domainMatchSlot`) after josa stem. Axis fallback is always merged, not only on empty LIKE. | `keywordsFromSlot` / `searchBySlot` |
| **Lexicon split** | Before Pass0: nlMap/enum/_bucket keys in the NL become slots (`인천에 사는` → `인천`). Unknown remainder still goes to Pass0/Foundry. | `collectLexicon` / `splitByLexicon` |
| **Match score** | sample×8, synonyms×6, param_domain×7, label×4, tags×3, description×2, name×1 | `fragContract.scoreCard` |
| **Cover / reuse** | Identity = axesCompatible + `_source` + single tags. Missing nlMap alias is **heal** (validateBind + attachAlias + merge), not a new fragment. keywordsFromSlot appends axis tags; Stage A falls back to `searchByAxis`. | `libraryHitPredicate` / `searchByAxis` / `healDomain` |
| **Sample bind** | nlMap → enum[0] → `_bucket` → ageMin/Max → typed int=`0` → `'__sample__'` | `fragContract.sampleBindSql` (Foundry+Dedup) |
| **NL bind** | `_bucket`/nlMap → plan item.params. Alias miss: `refreshDomain`(_source live MIN/MAX or DISTINCT) → proposeParams → `validateBind` → `healDomain`. Stale snapshot must not reject newly loaded values. | `refreshDomain` + `healDomain` |

Error log prefix: `FRAG_CONTRACT:<AXIS_MISMATCH|INDEX_MISS|DOMAIN_UNBOUND|BIND_TYPE|SOURCE_MISSING|DEDUP_ASYMMETRIC>`.

Load order: `testWooFragContract.js` **before** Fragments / Feasibility / Dedup / Foundry / Compiler.

## SQL history (`woo:testWooAiSql`)

Key fields: `nl_request`, `plan_json`, `sql_query`, `status`, `workflow_name` (WF internal name, e.g. `WKF94` — not the integer `@id`).

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

## Custom activity runtime (B)

WF element `ibankSqlDM` (legacy palette xpath may still be `customActivity`)  
→ child `ai-sql-id` → load `woo:testWooAiSql.@sql_query` → execute → transition `tableName/schema/recCount`.

Do **not** write SQL into `<script>`. OOTB SQL Data Management is not a bind target.

See `new_ver/workflow/testWooSampleCustomActivityContract.xml`.
