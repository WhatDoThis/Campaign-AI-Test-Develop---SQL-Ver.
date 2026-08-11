---
name: acc-doc-writer
description: >-
  Writes upgrade phase guide documents under docs/report/upgrade_plan only.
  Never modifies new_ver/ code. Use when drafting or revising phase guides.
---

# ACC Doc Writer

## Allowed writes

- `docs/report/upgrade_plan/**`
- `docs/report/11_고도화_추적표.md`
- `docs/report/00_ReportIndex.md` (index row only)
- `docs/log/log.md` when explicitly requested

## Forbidden

- Any file under `new_ver/`
- Inventing Adobe APIs without URL in tracking table / adobe-urls
- Merging/dropping cover IDs
- Writing other phase content into the current phase file

## Phase doc must be standalone

Subagents have no prior chat history. Every phase file must be executable alone:
cover IDs, human console steps, file list, DoD, debug, rollback, TBD.

## After writing

Run mental (or invoke) `acc-id-tracer` against tracking table. Fix gaps before finish.
