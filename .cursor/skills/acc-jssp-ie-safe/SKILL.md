---
name: acc-jssp-ie-safe
description: MSHTML/urlViewer-safe JSSP and html client patterns for ACC console. Use when editing new_ver/jssp or new_ver/html Studio UI.
paths:
  - new_ver/jssp/**
  - new_ver/html/**
---

# ACC JSSP IE-Safe

urlViewer hosts MSHTML. Treat client JS as IE, not Chrome.

## Must

- XHR wrapper + callbacks only (see `references/patterns.md`)
- `X-UA-Compatible: IE=edge` meta; no CSS `var()`, `flex`, `grid`, `vh`, `calc`
- Layout = `table` / fixed `px` heights
- Confirm UX = 2-step click (never `confirm`/`alert`)
- Cache: query `v=` + `_r=` tick; server no-cache headers when applicable

## Never

- `fetch`, `Promise`, `classList`, `forEach`, arrow functions, template literals

## Read next

- `references/patterns.md`
- `references/adobe-urls.md`
- Sibling skill pack: `campaign-ai-studio/acc-rhino-constraints.md` (server JS)
