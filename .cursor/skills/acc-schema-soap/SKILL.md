---
name: acc-schema-soap
description: ACC schema, SOAP out limits, Write/queryDef, sysFilter patterns for new_ver schema and server JS.
paths:
  - new_ver/schema/**
  - new_ver/js/**
---

# ACC Schema & SOAP

## Must

- CRUD via `xtk.session.Write` + `queryDef` only — never `sqlExec` / raw INSERT
- queryDef always set `lineCount` (≤5000)
- SOAP: ShellProbe / ShellPick / ShellBind only for WF UI host
- Scalar out count: keep minimal; DOM envelope when lists needed
- Extension schemas: add fields carefully; Update database structure after deploy
- **Never** `xtk:workflow#Spawn` for WKF create — clone via queryDef `data` + Write insert

## Read next

- `references/data-apis.md`
- `references/adobe-urls.md`
- `campaign-ai-studio/acc-data-access.md`
