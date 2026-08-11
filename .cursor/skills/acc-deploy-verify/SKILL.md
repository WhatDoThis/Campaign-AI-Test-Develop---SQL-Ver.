---
name: acc-deploy-verify
description: Post-deploy verification checklist for ACC console packages (schema/js/form/JSSP). Use after any new_ver deploy or when user asks to verify cache/litmus.
---

# ACC Deploy Verify

## Order

1. schema (+ Update database structure if fields added)
2. JS libraries (Publication / JavaScript codes)
3. input form / navtree
4. JSSP pages
5. Clear local client cache if URL stale

## Litmus

- Studio URL query contains `v=<expected>`
- Missing or old `v=` → user still on cached JSSP/html
- Embed: urlViewer shows content (not white); TW-BOOT removed — use visible title + composer

## Read next

- `references/checklist.md`
