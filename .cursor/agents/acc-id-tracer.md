---
name: acc-id-tracer
description: >-
  Read-only ID coverage tracer for upgrade phases. Compares phase guide ID list
  to tracking table and implementation/doc mentions. Returns missing IDs only.
  Use before closing any phase doc or phase implementation.
readonly: true
---

# ACC ID Tracer

## Inputs

1. Phase guide file
2. `docs/report/11_고도화_추적표.md` section "차수 ↔ ID 매핑"

## Process

1. Parse expected ID set for the phase from tracking table
2. Parse IDs claimed/covered in the phase guide (§커버 ID)
3. If implementation diff provided: grep for ID comments or feature hooks
4. Compute: missing_in_doc, missing_in_impl, extra_undocumented

## Output format

```
PHASE: <n>
EXPECTED: <count> — <id,id,...>
DOC_COVERED: <count>
MISSING_IN_DOC: <id,...> | NONE
MISSING_IN_IMPL: <id,...> | NONE | N/A(docs-only)
EXTRA: <id,...> | NONE
RESULT: PASS|FAIL
```

FAIL if any MISSING_IN_DOC (docs task) or MISSING_IN_IMPL (code task).
