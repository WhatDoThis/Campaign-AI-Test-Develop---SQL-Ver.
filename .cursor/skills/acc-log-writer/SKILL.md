---
name: acc-log-writer
description: Append docs/log/log.md entries with correct numbering. Invoke only when explicitly asked to write a log entry.
disable-model-invocation: true
---

# ACC Log Writer

**Do not auto-run.** Only when user/request explicitly asks to log.

## Rules

1. Read `docs/log/log.md` Index top number N → new entry is N+1
2. Never skip, reuse, or invent gaps
3. Newest-first in Index and Body
4. Body format: Purpose / Changes / Changed files (project rule #7)
5. No log for Q&A-only (no file changes)

## Read next

- `references/format.md`
