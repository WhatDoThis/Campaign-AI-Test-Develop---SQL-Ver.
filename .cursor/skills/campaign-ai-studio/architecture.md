# System Architecture — Test Woo

## Problem

Marketers need campaign audience SQL. Today: request → developer writes SQL → review → workflow attach (days). Target: **under 10 minutes**, **<1% execution failure**.

## Solution shape

Not "AI that writes SQL well" — a **pipeline that blocks bad SQL from registering**.

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│ AI Studio   │───▶│ JSSP API     │───▶│ testWoo.*   │───▶│ woo:testWoo  │
│ (browser)   │    │ /woo/*.jssp  │    │ server JS   │    │ AiSql table  │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                          │                    │
                          ▼                    ▼
                   logon(sessionToken)   OpenRouter/Anthropic
                   requireRight          (Pass0 + Pass1 only)
```

## PRD vs Test Woo implementation

| PRD (uplus production vision) | Test Woo (`new_ver/` current) |
|-------------------------------|-------------------------------|
| `uplus:ai_fragment` + `expr` WHERE snippets | `woo:testWooAiFragment` + full `sql_text` SELECT |
| `ir_json` IR | `plan_json` CNF |
| WF XML `<script>` inject + md5 | **Register → `ai_sql_id` → `ibankSqlDM`/`ai-sql-id`** only |
| request_queue on unmatched | **Implemented** — async queue + WKF (Foundry enabled) |
| Funnel COUNT | **DEFERRED** |
| Pass0/StageA/Pass1 for ~100k fragments | **Implemented** |

## CNF plan (compiler input)

```json
{
  "grainKey": "customer_id",
  "include": [{ "any": [{ "fragment": "age_band", "params": { "min": 20, "max": 29 } }] }],
  "exclude": [],
  "unmatched": []
}
```

- `include[]` = AND groups; each group's `any[]` = OR
- `exclude[]` = EXCEPT (Oracle: MINUS)
- Compiler wraps fragments, substitutes `{{param}}`, dedupes grain

## Data schemas (deployed)

| Schema | Purpose |
|--------|---------|
| `woo:testWooAiFragment` | Condition library (`sql_text`, tags, synonyms, params) |
| `woo:testWooAiSql` | Generation history (`plan_json`, `sql_query`, status) |
| `woo:testWooSampleCustomer` | E2E sample mart |
| `woo:testWooSampleSubscription` | E2E sample mart |

Deferred: ~~codemap~~, ~~request_queue~~ (removed). Foundry/queue **implemented** — see `testWooEnv.js`.

## Data access (summary)

- **Seed**: `workflow/testWooSampleSeed.js` → `xtk.session.Write` on `woo:testWooSample*` only
- **Never**: sqlExec, raw INSERT/UPDATE SQL against Campaign tables
- **Read-only SQL**: probe/gates/dedup — SELECT only via `sqlSelect`/`sqlGetInt`
- Details: [acc-data-access.md](acc-data-access.md)

## Security model

- Cookie `__sessiontoken` → `logon(sessionToken)` in JSSP
- Named rights: `testWooAiSqlGenerate`, `testWooAiSqlRegister`
- Register CSRF: `X-Requested-With: TestWooStudio` + Origin/Referer
- LLM keys in XtkOption (plain); production should use `nms:extAccount` + decrypt
- `serverConf.xml` `<urlPermission>` for LLM host

## Section progress (dev guide)

| Section | Status |
|---------|--------|
| 1 Permissions + LLM options | Done |
| 2 Schemas + forms | Done |
| 3 Server JS (7 files) | Done |
| 4 JSSP + Studio | In progress |
| 5 Sample seed + E2E | In progress |

## old_ver relationship

Prototype in `old_ver/` used browser-side LLM + free SQL generation. **Do not copy** that pattern. Reusable: SOAP helpers, count patterns, schema parsing ideas — see PRD appendix E.
