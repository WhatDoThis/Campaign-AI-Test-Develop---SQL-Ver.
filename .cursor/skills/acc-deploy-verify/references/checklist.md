# Deploy verification checklist

- [ ] Schema namespace `woo`, names `testWoo*`
- [ ] JS global `testWoo.*` (not `woo.*`)
- [ ] Form soapCall method names match schema
- [ ] Navtree `__CAMPAIGN_SERVER_URL__` replaced on env
- [ ] Named rights present if command `rights=` set
- [ ] Studio opens: Tools menu and/or WF embed
- [ ] Generate dry path returns JSON (not HTML error)
- [ ] No XTK-170016 in form open
- [ ] `v=` matches build note in phase DoD
