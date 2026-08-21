---
name: acc-input-form
description: ACC input form XML rules for urlViewer embed, colspan, enter guards, soapCall outs. Use when editing new_ver/input_form.
paths:
  - new_ver/input_form/**
---

# ACC Input Form

## Must

- Honor `colcount` / `colspan` sum (#141 left-gap root cause)
- `<enter>`: never throw; set Studio URL early; `_r` only on Reload/Apply
- soapCall: keep scalar `out` count within ACC limits; prefer Shell* names only
- urlViewer: container height explicit; pass `embed=1&workflowName=&v=&_r=`

## Never

- `FormatDate` / `GetDate` in form scripts (XTK-170016)
- Old SOAP names Inspect*/Bind* (use ShellProbe / ShellPick / ShellBind)
- Mixing unrelated JSSP layout + form XML without deploy note

## Read next

- `references/form-rules.md`
- `references/adobe-urls.md`
