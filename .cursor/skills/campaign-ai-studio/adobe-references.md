# Adobe Campaign Official References

Use these before inventing ACC APIs. Prefer Experience League over blog posts.

## Core API (JavaScript on server)

| Topic | URL |
|-------|-----|
| Campaign JS API index | https://experienceleague.adobe.com/developer/campaign-api/api/ |
| `logon(sessionToken)` | https://experienceleague.adobe.com/developer/campaign-api/api/f-logon.html |
| `getOption` | https://experienceleague.adobe.com/developer/campaign-api/api/f-getOption.html |
| `HttpClientRequest` | https://experienceleague.adobe.com/developer/campaign-api/api/c-HttpClientRequest.html |
| `MemoryBuffer` | https://experienceleague.adobe.com/developer/campaign-api/api/c-MemoryBuffer.html |
| `application.getDBMSType` | https://experienceleague.adobe.com/developer/campaign-api/api/c-application.html |

## Configuration & integration

| Topic | URL |
|-------|-----|
| Web service calls (SOAP + HttpClientRequest) | https://experienceleague.adobe.com/en/docs/campaign-classic/using/configuring-campaign-classic/api/web-service-calls |
| SOAP methods in JavaScript | https://experienceleague.adobe.com/en/docs/campaign-classic/using/configuring-campaign-classic/api/soap-methods-in-javascript |
| Data-oriented APIs (queryDef) | https://experienceleague.adobe.com/en/docs/campaign-classic/using/configuring-campaign-classic/api/data-oriented-apis |
| Security zones | https://experienceleague.adobe.com/en/docs/campaign-classic/using/installing-campaign-classic/additional-configurations/security-zones |
| Schemas and forms | https://experienceleague.adobe.com/en/docs/campaign-classic/using/configuring-campaign-classic/schema/schema-and-form-structure |

## Known ACC pitfalls (this project)

| Issue | Reference / note |
|-------|------------------|
| queryDef default lineCount ~10000 | Adobe KCS KA-28003 — always set `lineCount` (use 5000) |
| `HttpClientRequest.wait` | Documented but **broken on some builds** — use sync `execute()` only |
| JST in SQL | `<% %>` breaks workflow XML — gate in `testWooGates` |
| urlPermission | `serverConf.xml` — JST-310026 if LLM host blocked |
| Dynamic JavaScript Pages | Namespace `woo` → URL `/woo/<name>.jssp` |

## GitHub source docs (mirror)

| Repo | Use |
|------|-----|
| https://github.com/AdobeDocs/campaign-classic.en | Official doc markdown |
| https://github.com/AdobeDocs/campaign-classic-v7-developer | v7 developer reference |

## LLM providers (outbound, not Adobe)

| Provider | Docs |
|----------|------|
| OpenRouter (default) | https://openrouter.ai/docs/api-reference/chat-completions |
| Anthropic (rollback) | https://docs.anthropic.com/en/api/messages |

Project options: `testWooAiLlmProvider`, `testWooAiLlmEndpoint`, `testWooAiLlmModel`, `testWooAiLlmApiKey`.

## Workflow & custom activity

| Topic | Project file |
|-------|--------------|
| Custom activity contract | `new_ver/workflow/testWooSampleCustomActivityContract.xml` |
| Canvas button patch (future) | `new_ver/workflow/testWooXtkWorkflowButtonPatch.xml` |
| PRD section 3.1 | `docs/main/PRD.md` — input `<script>`, output transition vars |
