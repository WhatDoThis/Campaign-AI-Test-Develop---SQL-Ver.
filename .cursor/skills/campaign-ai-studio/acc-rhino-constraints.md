# ACC Server JavaScript (Rhino) Constraints

Applies to: `new_ver/js/*.js`, server blocks in `new_ver/jssp/*.jssp`, workflow JS.

ACC server JS is **Rhino + Campaign APIs**, not browser ES6.

## Forbidden (use alternatives)

| Forbidden | Alternative |
|-----------|-------------|
| `Array.map/forEach/filter/every/some/find/includes` | `for` loop + `.push` |
| `String.trim()` | `s.replace(/^\s+\|\s+$/g, "")` |
| `const` / `let` | `var` |
| Arrow functions `=>` | `function` |
| Template literals | String concat |
| `Promise`, `async/await` | Sync only |
| `fetch` (server) | `HttpClientRequest` |
| `HttpClientRequest.wait` | `execute([hasProxy])` — do not even typeof-check wait |
| `woo.cfg` global | `testWoo.cfg` — `woo.*` resolves to schema namespace |

## HttpClientRequest + MemoryBuffer

```javascript
var req = new HttpClientRequest(endpoint);
req.method = "POST";
req.header["Content-Type"] = "application/json";
var buf = new MemoryBuffer();
buf.fromString(jsonBody, "utf-8");  // request: string codepage OK
req.body = buf;
req.execute(useProxy);  // sync — blocks until response

var respBody = req.response.body.toString();  // NO "utf-8" string arg
```

## queryDef pagination

```javascript
var q = xtk.queryDef.create(
  <queryDef schema="woo:testWooAiFragment" operation="select">
    <select>
      <node expr="@name"/>
      <node expr="@label"/>
      <!-- NEVER select sql_text in list/search -->
    </select>
    <where>...</where>
    <orderBy><node expr="@name"/></orderBy>
    <lineCount>{pageSize}</lineCount>
    <startLine>{offset}</startLine>
  </queryDef>
);
```

Single row with `sql_text`: `lineCount=1`, filter by `@name`.

## JSSP authentication pattern

```javascript
loadLibrary("woo:testWooCommon.js");
var token = request.getCookies()["__sessiontoken"];
if (!token) { /* redirect logon.jsp */ }
logon(token);
testWoo.common.requireRight("testWooAiSqlGenerate");
```

## Browser Studio JS (separate rules)

`testWooAiStudioJs.jssp` / `html/testWooAiStudio.js`: external Chrome/Edge — `fetch`, `URLSearchParams` OK. ACC embedded IE is unsupported.

## Encoding for console paste

- Korean in JSSP shell HTML: `&#x....;` entities
- Runtime strings in StudioJs: `\uXXXX`
- API payload: `getUTF8Parameter("payload")` for form POST JSON
