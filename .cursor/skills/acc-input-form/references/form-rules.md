# Form rules (project)

## colspan (#141)

If container `colcount="3"`, visible controls on that row must sum colspan to 3.
Missing colspan on a button → empty left column gap after reload.

## enter cache (#140 / #143)

- On enter: ensure `twStudioUrl` set before urlViewer paints
- Append `_r=<tick>` on Reload/Apply (ShellPick), and also on re-open path if urlViewer caches blank page

## soapCall outs

- Too many scalar outs → SOAP "Too many arguments" (#119–#120)
- Element≠string type mismatch → use string outs or dedicated list method (#110)

## Shell* only

Redeploy schema + JS + form together when renaming methods.
