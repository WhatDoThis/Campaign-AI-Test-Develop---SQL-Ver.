# schema/sample — PoC 샘플 mart 5종

테스트 ACC에서 Foundry·Stage A litmus용 **샘플 mart** 스키마.  
STG/운영 mart 전환 전까지 **테스트 서버에만** 등록·유지.

| 파일 | namespace |
|---|---|
| `testWooSampleCustomer.xml` | `woo:testWooSampleCustomer` |
| `testWooSampleSubscription.xml` | `woo:testWooSampleSubscription` |
| `testWooSampleBill.xml` | `woo:testWooSampleBill` |
| `testWooSampleApp.xml` | `woo:testWooSampleApp` |
| `testWooSampleDevice.xml` | `woo:testWooSampleDevice` |

- 입력폼: `new_ver/input_form/testWooSample*.xml` (동일 name)
- 시드 WF: `new_ver/_retire/dev_only/testWooSampleSeed*.js`

배포 분류: `docs/main/(공용)new_ver_ACC배포분류.md` §3-D
