# Write / queryDef / Spawn

## Clone workflow (allowed)

1. `queryDef` select template `xtk:workflow` including `data` (or needed nodes)
2. New `internalName` / label / folder link
3. Ensure created instance is **not started** (state stopped/edition)
4. `xtk.session.Write` insert

## Spawn (forbidden for Studio create)

Spawn = create instance + patch + **start**. Empty custom activity would run.

Doc: https://experienceleague.adobe.com/developer/campaign-api/api/sm-workflow-Spawn.html

## sysFilter lock pattern (conceptual)

- Extension attribute e.g. `@lockedBy` on workflow
- Write-path filter blocks other operators
- PoC-3 required before mass deploy (technical WF restart impact)
