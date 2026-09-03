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
| `testWooAiSqlRegister.jssp` | Register | `{ plan, title, nl_request, … }` | `{ ok, passed, ai_sql_id, status, sql, summary }` |

Transport: `application/x-www-form-urlencoded`, field `payload` = UTF-8 JSON.

**Register ignores client `sql`** — server recompiles from `plan`.

Unmatched NL: `{ ok:false, unmatched:[…], plan }` — no fabrication.  
Extract fail: `{ ok:false, retryInput:true, unmatched:[…] }` — no Foundry.  
Value abstain: `{ ok:false, unresolved:[{surface,reason,concept,en_literal}], unmatched:[…] }` — reasons `concept_not_found` / `value_not_in_domain` / `ambiguous` only. No Foundry, no SQL.

Auth failure: `{ ok:false, code:"AUTH", logonUrl }`.

## Fragment record (`woo:testWooAiFragment`)

Required fields: `name`, `label`, `category`, `tags`, `key_column`, `sql_text`, `params`, `param_domain`, `description`, `sample_questions`, `status`.

`sql_text` = complete `SELECT DISTINCT grain …` with `{{param}}` placeholders.

`param_domain` value entries may be `{ db, en[] }` (#174-3). Bind/sample always use `db` (`fragContract.entryDb`). Do not put `en` into SQL. nlMap keys are kept.

## Slot ↔ Index ↔ Match ↔ Bind (`testWoo.fragContract` / #172)

| Layer | Fields / rule | Owner |
|---|---|---|
| **Slot** | `id`, `text`, `searchKeywords[]`, `hintedCategory`. Audience-only residue (고객/대상자/회원/사용자) is dropped — it is not an unmatched axis. `text` = original surface (never translated `en_literal`). | EnPivot (`extractSlots`) · Pass0 fallback / `normalizeAtomicSlots` |
| **Index (publish)** | `synonyms` ← slot tokens + nlMap/`_bucket` keys; `sample_questions` ← `[slotText]`; `tags` = axis; `category` = `foundry` (축은 tags) | `fragContract.buildIndexFields` |
| **Match** | M1 원문⊂NL → M2 `en_literal`⊂`en[]` → M3 concept+kind. M3는 값 미해결(heal 후도 없으면 unresolved). Bind always `db`. | `matchEnPivotSlot` |
| **Match LIKE** | token⊂field is recall only. Acceptance = M1/M2/M3 after josa stem. Axis fallback is always merged, not only on empty LIKE. | `keywordsFromSlot` / `searchBySlot` |
| **Lexicon split** | Catalog keys in NL still become match hints. Extract always translates the **full** NL. M1 does not skip translate. | `collectLexicon` / `splitByLexicon` / `testWoo.enPivot.extractSlots` |
| **Match score** | sample×8, synonyms×6, param_domain×7, label×4, tags×3, description×2, name×1 | `fragContract.scoreCard` |
| **Cover / reuse** | Identity = axesCompatible + `_source` + single tags. Missing nlMap alias is **heal** (validateBind + attachAlias + merge), not a new fragment. keywordsFromSlot appends axis tags; Stage A falls back to `searchByAxis`. | `libraryHitPredicate` / `searchByAxis` / `healDomain` |
| **Sample bind** | nlMap → enum[0] → `_bucket` → ageMin/Max → typed int=`0` → `'__sample__'` | `fragContract.sampleBindSql` (Foundry+Dedup) |
| **NL bind** | `_bucket`/nlMap → plan item.params. Alias miss: `refreshDomain`(_source live MIN/MAX or DISTINCT) → proposeParams → `validateBind` → `healDomain`. Stale snapshot must not reject newly loaded values. | `refreshDomain` + `healDomain` |

Error log prefix: `FRAG_CONTRACT:<AXIS_MISMATCH|INDEX_MISS|DOMAIN_UNBOUND|BIND_TYPE|SOURCE_MISSING|DEDUP_ASYMMETRIC>`.

Load order: `testWooFragContract.js` **before** Fragments / Feasibility / Dedup / Foundry / Compiler.  
`testWooEnPivot.js` **before** `testWooLlm.js`.

## SQL history (`woo:testWooAiSql`)

Key fields: `nl_request`, `plan_json`, `sql_query`, `status`, `workflow_name` (WF internal name, e.g. `WKF94` — not the integer `@id`).

Status enum: `draft` | `validated` | `registered` | `rejected`.

## Gates (minimal, current)

| Gate | Check |
|------|-------|
| G1 syntax | Single SELECT, no DDL/DML, no `<%`, active fragment contract |
| G3 uniqueness | `COUNT(*) = COUNT(DISTINCT grain)` when enabled |
| G4 scale | Deferred options — implement only when requested |

## LLM calls (max 2 per generation when EnPivot hits)

1. **EnPivot `translateAndExtract`** — **full** NL → `{en, slots[]}` (0 calls only on identical NL-hash cache TTL 1d). JOSA/NOISE matching dictionaries are removed (#174-5).
2. **Pass0** — only if `testWoo.enPivot` is not loaded (partial deploy). Extract fail → `retryInput`, not Pass0.
3. **Pass1** — slots + Stage A candidates → CNF plan

Do not run EnPivot LLM and Pass0 on the same request.  
Extract fail: `{ ok:false, retryInput:true, unmatched:["조건을 해석하지 못했습니다. …"] }` — no Foundry queue.  
No LLM for: SQL compile, summary/chips (from compiler), Register. No `response_format: json_object`.

## Options (section 1)

Required for LLM: `testWooAiLlmApiKey`, `testWooAiLlmModel`, `testWooAiLlmEndpoint` only.

Other tuning: `testWooEnv.js`. Data/seed: [acc-data-access.md](acc-data-access.md).

## Custom activity runtime (B)

Campaign template `OPEmptyTemplate_AI` (id **28001**) · WKF template `wfEmptyTemplate_AI` (id **41145**).  
Inject target: **`sqlDM` `@name=aiStudioSql`** → schema child **`userScript`** (AI Studio SQL) + `ai-sql-id`.  
Start `target="aiStudioSql"`. Old WKF `customActivity` still writes `script`. Generic unnamed OOTB `sqlDM` is not a bind target.

OOTB SQL Data Management (`sql`) is not a bind target.

See `new_ver/workflow/testWooSampleCustomActivityContract.xml`.
