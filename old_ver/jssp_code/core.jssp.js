<%
  response.setContentType("application/javascript;charset=utf-8");
  // 실제 값은 old_ver/secrets/OLD_VER_SECRETS.md 참조 (git 제외)
  var _SQ_TOKEN = "__SQ_TOKEN__";
  var _t = String(request.getParameter("_token") || "");
  if (_t !== _SQ_TOKEN) {
    response.sendError(403, "Forbidden");
    return;
  }
%>
(function (SQ) {
  "use strict";
  var STR = SQ && SQ.STR;
  if (!SQ || !SQ.CONFIG || !STR) throw new Error("config required");

  var CONFIG = SQ.CONFIG;
  var ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
  var sessionReady = false;
  var sessionToken = "";
  var useBrowserSession = true;
  var cachedBrowserOperatorLogin = null;

  function campaignCfg() {
    return CONFIG.campaign || {};
  }

  function getSoapSessionToken() {
    return sessionToken;
  }

  function getSoapUrl() {
    var base = String(campaignCfg().serverUrl || "").trim().replace(/\/$/, "");
    if (base) return base + "/nl/jsp/soaprouter.jsp";
    return "/nl/jsp/soaprouter.jsp";
  }

  function formatCampaignDateTime(d) {
    return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, ".000Z");
  }

  function escapeXml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function soapEnvelope(nsUrn, bodyInner, withXsi) {
    var xsi = withXsi ? ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' : "";
    return (
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="' + nsUrn + '"' + xsi + ">" +
      "<SOAP-ENV:Body>" + bodyInner + "</SOAP-ENV:Body></SOAP-ENV:Envelope>"
    );
  }

  function assertNoSoapFault(xml) {
    if (!/SOAP-ENV:Fault|soapenv:Fault|soap:Fault/i.test(xml)) return;
    var str = (xml.match(/<faultstring[^>]*>([^<]*)<\/faultstring>/i) || [])[1];
    var detail = (xml.match(/<detail[^>]*>([\s\S]*?)<\/detail>/i) || [])[1];
    if (detail) {
      detail = detail.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (detail.length > 220) detail = detail.slice(0, 220) + "…";
    }
    var msg = "SOAP Fault: " + (str || "unknown");
    if (detail) msg += " — " + detail;
    throw new Error(msg);
  }

  function isSessionFault(xml) {
    var t = String(xml || "").toLowerCase();
    return (
      t.indexOf("session") >= 0 ||
      t.indexOf("logon") >= 0 ||
      t.indexOf("authentication") >= 0 ||
      t.indexOf("not logged") >= 0
    );
  }

  function soapPost(soapAction, body, opts) {
    opts = opts || {};
    var browserOnly = !!opts.browserOnly;
    function doFetch(headers) {
      return fetch(getSoapUrl(), {
        method: "POST",
        headers: headers,
        body: body,
        credentials: "include",
        cache: "no-cache",
      }).then(function (res) {
        return res.text().then(function (data) {
          if (res.status === 401 || res.status === 403) {
            throw new Error(STR.sessionRequired);
          }
          if (!res.ok) throw new Error("HTTP " + res.status + ": " + data.slice(0, 400));
          if (/SOAP-ENV:Fault|soapenv:Fault|soap:Fault/i.test(data) && isSessionFault(data)) {
            throw new Error(STR.sessionRequired);
          }
          assertNoSoapFault(data);
          return data;
        });
      });
    }
    return doFetch({ "Content-Type": "text/xml; charset=utf-8", SOAPAction: soapAction });
  }

  function extractLogonToken(xml) {
    var m =
      xml.match(/<pstrSessionToken[^>]*>([^<]*)<\/pstrSessionToken>/i) ||
      xml.match(/<sessiontoken[^>]*>([^<]*)<\/sessiontoken>/i);
    return m ? m[1].trim() : null;
  }

  function ensureLineCount(fragment) {
    var t = String(fragment || "").trim();
    if (!t) throw new Error(STR.emptyFragment);
    if (/<lineCount>/i.test(t)) return t;
    return t + "<lineCount>100</lineCount>";
  }

  function compactSoapPreview(xml) {
    return xml.replace(/\s+/g, " ").trim().slice(0, 1200);
  }

  function ensureSession() {
    if (sessionReady) return Promise.resolve();
    var c = campaignCfg();
    if (c.authMode === "legacy" && c.username && c.password) {
      useBrowserSession = false;
      var remember = c.logonRememberMe
        ? '<ns:elemParameters><parameters rememberMe="true"/></ns:elemParameters>'
        : "<ns:elemParameters></ns:elemParameters>";
      var inner2 =
        "<ns:Logon><ns:sessiontoken></ns:sessiontoken>" +
        "<ns:strLogin>" + escapeXml(c.username || "") + "</ns:strLogin>" +
        "<ns:strPassword>" + escapeXml(c.password || "") + "</ns:strPassword>" + remember + "</ns:Logon>";
      return soapPost("xtk:session#Logon", soapEnvelope("urn:xtk:session", inner2)).then(function (data) {
        sessionToken = extractLogonToken(data) || "";
        if (!sessionToken) throw new Error(STR.logonTokenMissing);
        sessionReady = true;
      });
    }
    useBrowserSession = true;
    sessionToken = "";
    sessionReady = true;
    return Promise.resolve();
  }

  function executeBrowserSessionQuery(schema, fragment, operation) {
    operation = operation || "select";
    var body =
      "<ns:ExecuteQuery><ns:sessiontoken></ns:sessiontoken>" +
      '<ns:entity><queryDef schema="' + escapeXml(schema) + '" operation="' + escapeXml(operation) + '">' +
      ensureLineCount(fragment) + "</queryDef></ns:entity></ns:ExecuteQuery>";
    return soapPost("xtk:queryDef#ExecuteQuery", soapEnvelope("urn:xtk:queryDef", body), { browserOnly: true });
  }

  function fetchOperatorLoginViaSoap() {
    var fragment =
      '<select><node expr="@name"/></select>' +
      '<where><condition expr="@id = $(loginId)"/></where><lineCount>1</lineCount>';
    return executeBrowserSessionQuery("xtk:operator", fragment).then(function (raw) {
      var login = parseOperatorLogin(raw);
      if (!login) throw new Error(STR.sessionRequired);
      return login;
    });
  }

  function isLegacyAuth() {
    var c = campaignCfg();
    return c.authMode === "legacy" && c.username && c.password;
  }

  function fetchLegacyOperatorLogin() {
    return ensureSession().then(function () {
      return String(campaignCfg().username || "");
    });
  }

  function fetchBrowserSessionOperatorLogin() {
    if (cachedBrowserOperatorLogin) return Promise.resolve(cachedBrowserOperatorLogin);
    var chain = isLegacyAuth()
      ? fetchLegacyOperatorLogin()
      : fetchOperatorLoginViaSoap();
    return chain.then(function (login) {
      if (!login) throw new Error(STR.sessionRequired);
      cachedBrowserOperatorLogin = login;
      return login;
    });
  }

  function executeQuery(schema, fragment, operation) {
    operation = operation || "select";
    return ensureSession().then(function () {
      var body =
        "<ns:ExecuteQuery><ns:sessiontoken>" + escapeXml(getSoapSessionToken()) + "</ns:sessiontoken>" +
        '<ns:entity><queryDef schema="' + escapeXml(schema) + '" operation="' + escapeXml(operation) + '">' +
        ensureLineCount(fragment) + "</queryDef></ns:entity></ns:ExecuteQuery>";
      return soapPost("xtk:queryDef#ExecuteQuery", soapEnvelope("urn:xtk:queryDef", body));
    }).then(function (raw) {
      return { raw: raw, preview: compactSoapPreview(raw) };
    });
  }

  function getEntityIfMoreRecent(pk) {
    return ensureSession().then(function () {
      var body =
        "<ns:GetEntityIfMoreRecent><ns:sessiontoken>" + escapeXml(getSoapSessionToken()) + "</ns:sessiontoken>" +
        "<ns:strPk>" + escapeXml(pk.trim()) + "</ns:strPk><ns:strMd5></ns:strMd5>" +
        "<ns:bMustExist>false</ns:bMustExist></ns:GetEntityIfMoreRecent>";
      return soapPost("xtk:persist#GetEntityIfMoreRecent", soapEnvelope("urn:xtk:persist", body, true));
    });
  }

  function resolveSchema(schema) {
    return schema === "nms:folder" ? "xtk:folder" : schema;
  }

  function parseSchemaList(raw) {
    var list = [];
    var seen = {};
    var re = /<schema\b([^>]*)\/?>/gi;
    var m;
    while ((m = re.exec(raw))) {
      var a = m[1];
      var namespace = (a.match(/namespace="([^"]*)"/i) || [])[1] || "";
      var name = (a.match(/name="([^"]*)"/i) || [])[1] || "";
      if (!namespace || !name) continue;
      var id = namespace + ":" + name;
      if (seen[id]) continue;
      seen[id] = 1;
      list.push({ id: id, namespace: namespace, name: name, label: (a.match(/label="([^"]*)"/i) || [])[1] || name });
    }
    list.sort(function (a, b) { return a.id.localeCompare(b.id); });
    return list;
  }

  function parseSrcSchemaFields(rootEl) {
    var fields = [];
    var seen = {};
    if (!rootEl) return fields;

    function addField(field) {
      if (!field.xpath || seen[field.xpath]) return;
      seen[field.xpath] = 1;
      fields.push(field);
    }

    var children = rootEl.children || rootEl.childNodes;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (!child || child.nodeType !== 1) continue;
      var tag = child.tagName || child.nodeName;
      if (tag === "attribute") {
        var name = child.getAttribute("name");
        if (!name) continue;
        if (child.getAttribute("xml") === "true") continue;
        addField({
          xpath: "@" + name,
          name: name,
          sqlname: child.getAttribute("sqlname") || name,
          type: child.getAttribute("type") || "string",
          label: child.getAttribute("label") || name,
        });
      } else if (tag === "element" && child.getAttribute("type") === "link") {
        var linkName = child.getAttribute("name");
        if (!linkName) continue;
        var linkLabel = child.getAttribute("label") || linkName;
        var target = child.getAttribute("target") || "";
        addField({
          xpath: "[" + linkName + "/@id]",
          name: linkName + ".id",
          sqlname: linkName,
          type: "link",
          label: linkLabel + " ID",
          target: target,
        });
        addField({
          xpath: "[" + linkName + "/@label]",
          name: linkName + ".label",
          sqlname: linkName,
          type: "link",
          label: linkLabel + " label",
          target: target,
        });
      }
    }
    return fields;
  }

  function filterFkFields(fields) {
    var linkNames = {};
    fields.forEach(function (f) {
      var m = f.xpath.match(/^\[([^/]+)\/@id\]$/);
      if (m) linkNames[m[1]] = 1;
    });
    return fields.filter(function (f) {
      if (f.xpath.charAt(0) !== "@") return true;
      var fk = f.xpath.match(/^@(.+)-id$/);
      if (fk && linkNames[fk[1]]) return false;
      return true;
    });
  }

  function parseSrcSchema(srcXml, meta) {
    var doc = new DOMParser().parseFromString(srcXml, "text/xml");
    var rootEl = doc.querySelector("srcSchema > element") || doc.querySelector("element");
    var sqlTable = (rootEl && (rootEl.getAttribute("sqltable") || rootEl.getAttribute("name"))) || meta.name;
    var template = rootEl ? rootEl.getAttribute("template") : null;
    return {
      id: meta.id,
      label: meta.label,
      namespace: meta.namespace,
      name: meta.name,
      sqlTable: sqlTable,
      template: template,
      fields: parseSrcSchemaFields(rootEl),
    };
  }

  function mergeSchemaFields(parent, child) {
    var seen = {};
    var merged = [];
    function add(f) {
      if (!f || !f.xpath || seen[f.xpath]) return;
      seen[f.xpath] = 1;
      merged.push(f);
    }
    (parent.fields || []).forEach(add);
    (child.fields || []).forEach(add);
    child.fields = filterFkFields(merged);
    return child;
  }

  function fetchSrcSchemaXml(meta) {
    var pk = "xtk:srcSchema|" + meta.namespace + ":" + meta.name;
    return getEntityIfMoreRecent(pk).then(function (raw) {
      var inner = (raw.match(/<pdomDoc[^>]*>([\s\S]*?)<\/pdomDoc>/i) || [])[1];
      if (!inner) throw new Error(STR.noSrcSchema + pk);
      return inner.trim();
    });
  }

  function fetchSchemaDetailInternal(meta, stack) {
    stack = stack || {};
    if (stack[meta.id]) return Promise.resolve(parseSrcSchema("", meta));
    stack[meta.id] = 1;
    return fetchSrcSchemaXml(meta).then(function (srcXml) {
      var parsed = parseSrcSchema(srcXml, meta);
      if (!parsed.template) {
        parsed.fields = filterFkFields(parsed.fields);
        return parsed;
      }
      var parts = parsed.template.split(":");
      if (parts.length !== 2) return parsed;
      var tMeta = { id: parsed.template, namespace: parts[0], name: parts[1], label: parsed.template };
      return fetchSchemaDetailInternal(tMeta, stack).then(function (parent) {
        return mergeSchemaFields(parent, parsed);
      });
    });
  }

  function buildCountFragment(fragment) {
    var where = (String(fragment || "").match(/<where[\s\S]*?<\/where>/i) || [])[0] || "";
    return '<select><node expr="Count(1)" alias="@count"/></select>' + where + "<lineCount>1</lineCount>";
  }

  function parseCount(raw) {
    var patterns = [/\bcount="(\d+)"/i, /\b@_count="(\d+)"/i, /<count[^>]*>(\d+)<\/count>/i];
    for (var i = 0; i < patterns.length; i++) {
      var m = String(raw).match(patterns[i]);
      if (m) return parseInt(m[1], 10);
    }
    return null;
  }

  function extractJsonObject(text) {
    var t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    var start = t.indexOf("{");
    if (start < 0) return t;
    var depth = 0;
    for (var i = start; i < t.length; i++) {
      if (t[i] === '"') {
        for (i++; i < t.length; i++) {
          if (t[i] === "\\") { i++; continue; }
          if (t[i] === '"') break;
        }
        continue;
      }
      if (t[i] === "{") depth++;
      else if (t[i] === "}") { depth--; if (!depth) return t.slice(start, i + 1); }
    }
    return t.slice(start);
  }

  function validateQueryDefFragment(fragment) {
    var f = String(fragment || "");
    if (/\$\(date[-\w]*\(/i.test(f)) {
      throw new Error(
        "queryDef 날짜 조건 오류: $(date...) 매크로는 사용할 수 없습니다. " +
          "예) @eventDate >= SubDays(GetDate(), 30)"
      );
    }
  }

  function buildSystemPrompt(schema) {
    var table = schema.sqlTable || schema.name;
    var fields = schema.fields.map(function (f) {
      return "- " + f.xpath + " -> `" + (f.sqlname || f.name) + "` (" + f.type + ")" + STR.fieldSep + f.label;
    }).join("\n");
    return (
      "Adobe Campaign v7 query designer. Korean. JSON only.\n" +
      "SCHEMA: " + schema.id + " | TABLE: " + table +
      "\nFIELDS (use ONLY these xpaths in queryDef; link FK uses [link/@id] NOT @link-id):\n" + fields +
      "\n\nqueryDefXmlFragment RULES (XTK expressions — NOT SQL, NOT invented macros):\n" +
      "- Relative dates (last N days): @eventDate >= SubDays(GetDate(), 30)  — NEVER $(date(...)), $(date-days(...)), DaysAgo(), etc.\n" +
      "- Boolean false: @quarantine = 0 OR @seedMember = 0 (use 0/1 for boolean fields)\n" +
      "- Status enum: @status = 1\n" +
      "- Link exists: [recipient/@id] != 0  OR  [recipient/@id] IS NOT NULL\n" +
      "- Combine with AND in separate <condition> nodes inside <where>\n" +
      "- orderBy: <orderBy><node expr=\"@eventDate\" sortDesc=\"true\"/></orderBy>\n" +
      "- lineCount: <lineCount>500</lineCount>\n" +
      "- sqlQuery is reference SQL only; ExecuteQuery uses queryDefXmlFragment\n" +
      '\n{"schema":"' + schema.id + '","summaryKo":"...","humanReadableFilter":"...","queryDefXmlFragment":"...","sqlQuery":"...","selectFields":[],"assumptions":[],"warnings":[]}'
    );
  }

  function buildChatMessages(schema, chatTurns, latest) {
    var messages = [];
    chatTurns.forEach(function (turn) {
      if (turn.role === "user") messages.push({ role: "user", content: turn.content });
      else if (turn.role === "assistant" && turn.query) messages.push({ role: "assistant", content: JSON.stringify(turn.query) });
    });
    var prefix = chatTurns.length ? "" : STR.schemaPrefix + schema.id + "\n\n";
    messages.push({ role: "user", content: prefix + latest.trim() });
    return messages;
  }

  function formatSqlQuery(sql) {
    var s = String(sql || "").trim();
    if (!s || s === STR.noSql) return s;
    s = s.replace(/\s+/g, " ").trim();

    var clauses = [
      "UNION ALL", "UNION",
      "LEFT OUTER JOIN", "RIGHT OUTER JOIN", "FULL OUTER JOIN",
      "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "OUTER JOIN", "CROSS JOIN",
      "GROUP BY", "ORDER BY", "HAVING",
      "LIMIT", "OFFSET",
      "WHERE", "FROM", "JOIN",
    ];
    clauses.forEach(function (c) {
      var re = new RegExp("\\s" + c.replace(/ /g, "\\s+") + "\\s", "gi");
      s = s.replace(re, "\n" + c.toUpperCase() + " ");
    });

    if (/^SELECT\s/i.test(s)) {
      s = s.replace(/^SELECT\s+([\s\S]*?)(?=\nFROM\b)/i, function (_, cols) {
        cols = cols.trim();
        if (cols.indexOf(",") < 0) return "SELECT " + cols;
        return "SELECT\n       " + cols.split(/\s*,\s*/).join(",\n       ");
      });
    }

    s = s.replace(
      /\nWHERE\s([\s\S]*?)(?=\n(?:GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|UNION)\b|$)/i,
      function (_, cond) {
        return "\nWHERE " + cond.replace(/\s+AND\s+/gi, "\n  AND ").replace(/\s+OR\s+/gi, "\n  OR ").trim();
      }
    );

    return s.trim();
  }

  function parseQueryJson(text, schemaId) {
    var parsed = JSON.parse(extractJsonObject(text));
    if (parsed.schema !== schemaId) throw new Error(STR.schemaMismatch + schemaId + " vs " + parsed.schema);
    if (!parsed.queryDefXmlFragment) throw new Error(STR.noFragment);
    validateQueryDefFragment(parsed.queryDefXmlFragment);
    if (!parsed.sqlQuery || !parsed.sqlQuery.trim()) parsed.sqlQuery = STR.noSql;
    else parsed.sqlQuery = formatSqlQuery(parsed.sqlQuery);
    return parsed;
  }

  SQ.resetSoapClient = function () {
    sessionReady = false;
    sessionToken = "";
    useBrowserSession = true;
  };

  SQ.clearOperatorLoginCache = function () {
    cachedBrowserOperatorLogin = null;
  };

  SQ.fetchSchemaList = function (lineCount) {
    var n = lineCount != null ? lineCount : (CONFIG.schemaListLineCount || 3000);
    var fragment =
      '<select><node expr="@namespace"/><node expr="@name"/><node expr="@label"/></select>' +
      '<orderBy><node expr="@namespace" sortDesc="false"/><node expr="@name" sortDesc="false"/></orderBy>' +
      "<lineCount>" + n + "</lineCount>";
    return executeQuery("xtk:schema", fragment).then(function (r) { return parseSchemaList(r.raw); });
  };

  function parseOperatorLogin(raw) {
    var s = String(raw);
    var tag = s.match(/<operator\s+([^>]*?)\/?>/i);
    if (tag) {
      var name = (tag[1].match(/\bname="([^"]*)"/i) || [])[1];
      if (name) return name.trim();
    }
    var patterns = [
      /<operator[^>]*\bname="([^"]*)"/i,
      /\b@_name="([^"]+)"/i,
      /<name[^>]*>([^<]+)<\/name>/i,
      /<strLogin[^>]*>([^<]+)<\/strLogin>/i,
      /login="([^"]+)"/i,
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = String(raw).match(patterns[i]);
      if (m && m[1]) return m[1].trim();
    }
    return null;
  }

  SQ.fetchCurrentOperatorLogin = function () {
    return fetchBrowserSessionOperatorLogin();
  };

  function escExprLiteral(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/'/g, "''");
  }

  SQ.saveAiSqlRecord = function (opts) {
    var title = String(opts.title || "").trim();
    var sqlQuery = String(opts.sqlQuery || "").trim();
    var targetCount = opts.targetCount != null ? parseInt(opts.targetCount, 10) : 0;
    if (!title) return Promise.reject(new Error(STR.saveTitleRequired));
    if (!sqlQuery || sqlQuery === STR.noSql) return Promise.reject(new Error(STR.noSql));
    if (isNaN(targetCount)) targetCount = 0;
    return fetchBrowserSessionOperatorLogin().then(function (creator) {
      SQ.resetSoapClient();
      var now = formatCampaignDateTime(new Date());
      var doc =
        '<ai_sql xtkschema="uplus:ai_sql" _operation="insert"' +
        ' title="' + escapeXml(title) + '"' +
        ' creator="' + escapeXml(creator) + '"' +
        ' sqlQuery="' + escapeXml(sqlQuery) + '"' +
        ' creationDate="' + escapeXml(now) + '"' +
        ' targetCount="' + String(targetCount) + '"/>';
      return writeDomDoc(doc).then(function (writeRaw) {
        return verifyAiSqlSaved(title, parseWriteInsertedId(writeRaw));
      });
    });
  };
  function parseWriteInsertedId(raw) {
    var s = String(raw);
    var patterns = [
      /<pstrId[^>]*>(\d+)<\/pstrId>/i,
      /<ai_sql[^>]*\bid="(\d+)"/i,
      /<id[^>]*>(\d+)<\/id>/i,
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = s.match(patterns[i]);
      if (m && m[1]) return parseInt(m[1], 10);
    }
    return null;
  }

  function parseAiSqlRow(raw) {
    var s = String(raw);
    var tag = s.match(/<ai_sql\s+([^>]*?)\/?>/i);
    if (tag) {
      var a = tag[1];
      return {
        id: (a.match(/\bid="(\d+)"/i) || [])[1] || null,
        title: (a.match(/\btitle="([^"]*)"/i) || [])[1] || null,
      };
    }
    return {
      id: (s.match(/\bid="(\d+)"/i) || [])[1] || null,
      title: ((s.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || (s.match(/\btitle="([^"]*)"/i) || [])[1] || "").trim() || null,
    };
  }

  function writeDomDoc(doc) {
    return ensureSession().then(function () {
      var body =
        "<ns:Write><ns:sessiontoken>" + escapeXml(getSoapSessionToken()) + "</ns:sessiontoken>" +
        "<ns:domDoc>" + doc + "</ns:domDoc></ns:Write>";
      return soapPost("xtk:persist#Write", soapEnvelope("urn:xtk:persist", body, true));
    });
  }

  function verifyAiSqlSaved(title, expectedId) {
    var fragment;
    if (expectedId != null) {
      fragment =
        '<select><node expr="@id"/><node expr="@title"/></select>' +
        '<where><condition expr="@id = ' + String(expectedId) + '"/></where>' +
        "<lineCount>1</lineCount>";
    } else {
      fragment =
        '<select><node expr="@id"/><node expr="@title"/></select>' +
        '<where><condition expr="@title = \'' + escExprLiteral(title) + '\'"/></where>' +
        "<lineCount>1</lineCount>";
    }
    return executeQuery("uplus:ai_sql", fragment).then(function (r) {
      if (/SOAP-ENV:Fault|soapenv:Fault/i.test(r.raw)) {
        throw new Error(STR.saveVerifyFail + " " + compactSoapPreview(r.raw));
      }
      var row = parseAiSqlRow(r.raw);
      if (row.id || row.title) {
        return {
          id: row.id ? parseInt(row.id, 10) : (expectedId != null ? expectedId : null),
          schema: "uplus:ai_sql",
          table: "UplusAi_sql",
        };
      }
      throw new Error(STR.saveVerifyFail + " " + compactSoapPreview(r.raw));
    });
  }

  SQ.fetchSchemaDetail = function (meta) {
    return fetchSchemaDetailInternal(meta, {});
  };

  SQ.executeQueryViaSoap = function (opts) {
    return executeQuery(resolveSchema(opts.schema), opts.queryDefXmlFragment);
  };

  SQ.formatRowCount = function (n) {
    return n == null || isNaN(n) ? STR.dash : n.toLocaleString("ko-KR");
  };

  SQ.formatSqlQuery = formatSqlQuery;

  SQ.fetchRowCountViaSoap = function (opts) {
    return executeQuery(resolveSchema(opts.schema), buildCountFragment(opts.queryDefXmlFragment)).then(function (r) {
      var count = parseCount(r.raw);
      if (count == null) throw new Error(STR.countParseFail + r.preview.slice(0, 300));
      return { count: count, raw: r.raw };
    });
  };

  SQ.generateQuery = function (opts) {
    var schema = opts.schema;
    var userMessage = opts.userMessage;
    var chatTurns = opts.chatTurns || [];
    var apiKey = (CONFIG.anthropicApiKey || "").trim();
    if (!apiKey) return Promise.reject(new Error(STR.apiKeyRequired));
    if (!userMessage || !userMessage.trim()) return Promise.reject(new Error(STR.messageRequired));
    return fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: CONFIG.anthropicModel || "claude-sonnet-4-6",
        max_tokens: 4096,
        system: buildSystemPrompt(schema),
        messages: buildChatMessages(schema, chatTurns, userMessage),
      }),
    }).then(function (res) {
      return res.text().then(function (txt) {
        if (!res.ok) throw new Error("Anthropic " + res.status + ": " + txt.slice(0, 300));
        var data = JSON.parse(txt);
        var text = (data.content || []).filter(function (b) { return b.type === "text"; }).map(function (b) { return b.text; }).join("");
        return parseQueryJson(text, schema.id);
      });
    });
  };
})(window.SchemaQuery);
