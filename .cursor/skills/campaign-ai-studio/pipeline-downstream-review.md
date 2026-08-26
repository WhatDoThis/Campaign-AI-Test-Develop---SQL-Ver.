# Pipeline downstream review (Test Woo)

버그/기능 수정 후 **같은 턴**에 이어지는 hop을 검수한다.  
규칙: `.cursor/rules/fix-downstream-review.mdc`

## End-to-end hops (Generate 기준)

| # | Stage | 주요 모듈 | JSSP | 실패 시 흔한 메시지 |
|---|--------|-----------|------|---------------------|
| 1 | EnPivot | `testWooEnPivot.js` | Generate | retryInput, slot=0 |
| 2 | Stage A | `testWooLlm.js`, `testWooFragContract.js`, `testWooFragments.js` | Generate | unresolved, stageA_empty, span_gap |
| 3 | Foundry queue | `testWooLlm.js`, `testWooFoundry.js`, `testWooFeasibility.js` | Generate | queued, promote, library_cache_hit |
| 4 | Pass1 plan | `testWooLlm.js` selectPlan | Generate | plan `{}`, wrong fragment |
| 5 | Param bind | `testWooCompiler.bindPlanParams`, `resolveNlParams`, `_applyMatchParams` | Generate | params stripped |
| 6 | Compile | `testWooCompiler.js` `_substitute`, `spanRangeSqlText` | Generate | param missing: X |
| 7 | Gates | `testWooGates.js` validatePlan | Generate | PLAN required param missing |
| 8 | UI | `testWooAiStudioJs.jssp`, chips, relative badge | Studio | chip ×, validation failed |

**Foundry 배치**는 hop 3과 별도: `WKF_testWooFoundry` → `testWooFoundryBatch.js` (EnPivot load 포함).

## Touch map — 수정 시 같이 볼 모듈

| If you change… | Also trace… |
|----------------|-------------|
| `domainMatchSlot`, `_boundHas`, span helpers | `matchEnPivotSlot`, `_applyMatchParams`, `resolveNlParams`, `spanRangeSqlText`, gates `_checkItem` |
| `_resolveEnPivotSlot`, span gap, Foundry promote | `testWooAiGenerate` queue shape, `_normalizeSlots`, `_tryLibraryCacheHit`, after_foundry |
| `spanRangeSqlText` | `_buildFragmentSql`, gates `_relativeParamSpanBound`, smoke 1b |
| Foundry domain merge | `sql_text` placeholders, axis reuse sql adopt, compiler substitute |
| `bindPlanParams` | compile + gates (둘 다 sql `{{}}` vs domain 불일치 가능) |
| Studio clarify / chips | `applyNlPatch`, `generatePlan` clarifyPick, fragContract hints |

## Same-turn checklist (copy mentally)

```
[ ] grep callers/callees of changed export
[ ] plan.params shape at Generate exit (debug plan line)
[ ] compile path: substitute vs span rewrite
[ ] gates validatePlan on same plan + nl_request
[ ] litmus __v bumped + StudioContext expectedByMod
[ ] smoke row added if new contract (tools/testWooSmoke.js 1b)
[ ] deploy bundle listed (not single file)
[ ] HUMAN litmus one NL + expected SQL + gate
```

## Lesson — calendar span (2026-08-25)

단편 수정만 하면 5+ 턴 반복:

1. span gap `frag=` empty → Foundry wrong axis  
2. Stage A M3 no bind → `_boundHas` / fresh domain  
3. compile `joinDaysWithin` → `spanRangeSqlText`  
4. domain without `_range` → NL induce fallback  
5. gates PLAN missing joinDaysWithin → gates span skip  

**한 번에 잡으려면:** Stage A fix 직후 `plan → bindPlanParams → compile → gates` 를 같은 diff/턴에서 walk.

## Deploy bundle reminder

최소 Generate span stack (예시 — 버전은 `testWooAiStudioContext.jssp` expectedByMod 기준):

- `testWooFragContract.js`
- `testWooLlm.js`
- `testWooCompiler.js`
- `testWooGates.js`
- (`testWooFoundry.js` — queue/axis reuse 변경 시)
- `testWooAiStudioContext.jssp` (expectedByMod)

Foundry WKF: `testWooFoundryBatch.js`에 `testWooEnPivot.js` load 포함 여부.
