/*
 * testWooToolkit.js (내부 툴킷 레지스트리 · server-side)
 * ==========================================================
 * OpenRouter tools용 spec/invoke. probe_values/search_columns + evidenceLog.
 *
 * [Main Functions]
 * ===========
 * - register / specs / invoke / env / resetBudget / getEvidenceLog
 *
 * [Dependencies]
 * =========
 * - testWoo.probe, testWoo.cfg, xtk.queryDef, application.getSchema
 * - loadLibrary("woo:testWooToolkit.js")
 */
var testWoo = testWoo || {};
testWoo.toolkit = (function () {
  "use strict";

  var _registry = {};
  var _totalCalls = 0;
  var _probeCalls = 0;
  var _probeValuesCalls = 0;
  var _searchColumnsCalls = 0;
  var _evidenceLog = [];
  var _evidenceSeq = 0;

  var TOTAL_BUDGET = 20;
  var PROBE_BUDGET = 8;
  var PROBE_VALUES_BUDGET = 6;
  var SEARCH_COLUMNS_BUDGET = 8;

  function _budgets() {
    try {
      var cfg = testWoo.cfg.getConfig();
      if (cfg.toolkit) {
        return {
          total: cfg.toolkit.totalCallBudget || TOTAL_BUDGET,
          probeSql: cfg.toolkit.probeSqlBudget || PROBE_BUDGET,
          probeValues: cfg.toolkit.probeValuesBudget || PROBE_VALUES_BUDGET,
          searchColumns: cfg.toolkit.searchColumnsBudget || SEARCH_COLUMNS_BUDGET
        };
      }
    } catch (eB) {}
    return {
      total: TOTAL_BUDGET,
      probeSql: PROBE_BUDGET,
      probeValues: PROBE_VALUES_BUDGET,
      searchColumns: SEARCH_COLUMNS_BUDGET
    };
  }

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  function _validIdent(name) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name || ""));
  }

  function _allowedNamespaces() {
    var cfg = testWoo.cfg.getConfig();
    var raw = String(cfg.foundry.namespaces || "nms,cus");
    var parts = raw.split(",");
    var out = {};
    for (var i = 0; i < parts.length; i++) {
      var n = _trim(parts[i]);
      if (n) out[n] = true;
    }
    return out;
  }

  function _summarizeArgs(args) {
    var s = JSON.stringify(args || {});
    return s.length > 200 ? s.substring(0, 200) + "..." : s;
  }

  function _summarizeResult(result) {
    var s = JSON.stringify(result || {});
    return s.length > 300 ? s.substring(0, 300) + "..." : s;
  }

  function _appendEvidence(name, args, result) {
    _evidenceSeq++;
    _evidenceLog.push({
      seq: _evidenceSeq,
      tool: name,
      argsSummary: _summarizeArgs(args),
      resultSummary: _summarizeResult(result),
      at: formatDate(new Date(), "%4Y/%2M/%2D %02H:%02N:%02S")
    });
  }

  function register(name, spec, impl) {
    _registry[String(name)] = { spec: spec, impl: impl };
  }

  function specs() {
    var out = [];
    for (var k in _registry) {
      if (!_registry.hasOwnProperty(k)) continue;
      out.push({ type: "function", function: _registry[k].spec });
    }
    return out;
  }

  function resetBudget() {
    _totalCalls = 0;
    _probeCalls = 0;
    _probeValuesCalls = 0;
    _searchColumnsCalls = 0;
    _evidenceLog = [];
    _evidenceSeq = 0;
  }

  function getEvidenceLog() {
    return _evidenceLog.slice(0);
  }

  function invoke(name, argsObj) {
    var b = _budgets();
    if (_totalCalls >= b.total)
      return { error: "tool call budget exceeded (total " + b.total + ")" };
    if (name === "probe_sql" && _probeCalls >= b.probeSql)
      return { error: "tool call budget exceeded (probe_sql " + b.probeSql + ")" };
    if (name === "probe_values" && _probeValuesCalls >= b.probeValues)
      return { error: "tool call budget exceeded (probe_values " + b.probeValues + ")" };
    if (name === "search_columns" && _searchColumnsCalls >= b.searchColumns)
      return { error: "tool call budget exceeded (search_columns " + b.searchColumns + ")" };

    var entry = _registry[String(name)];
    if (!entry) return { error: "unknown tool: " + name };

    _totalCalls++;
    if (name === "probe_sql") _probeCalls++;
    if (name === "probe_values") _probeValuesCalls++;
    if (name === "search_columns") _searchColumnsCalls++;

    var result;
    try {
      result = entry.impl(argsObj || {});
    } catch (e) {
      result = { error: String(e.message || e) };
    }
    _appendEvidence(name, argsObj, result);
    logInfo("[testWoo.toolkit] invoke name=" + name +
      " args=" + _summarizeArgs(argsObj) +
      " ok=" + (result && !result.error));
    return result;
  }

  function env() {
    var dbms = "";
    try { dbms = String(application.getDBMSType() || ""); } catch (e) {}
    var ns = [];
    var allowed = _allowedNamespaces();
    for (var k in allowed) if (allowed.hasOwnProperty(k)) ns.push(k);
    return {
      dbmsType: dbms,
      allowedNamespaces: ns,
      maxProbeRows: 100,
      grainKeyCandidates: ["customer_id", "iRecipientId", "recipientId"]
    };
  }

  function _resolveSqlTable(schemaId) {
    var sch = application.getSchema(schemaId);
    if (!sch) throw new Error("schema not found: " + schemaId);
    var xml = sch.toXMLString();
    var m = /sqltable="([^"]+)"/.exec(String(xml || ""));
    if (m) return m[1];
    return schemaId.split(":")[1];
  }

  function _sqlGetIntSafe(query) {
    try {
      return { ok: true, value: Number(sqlGetInt(String(query))) };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  function _toolListSchemas(args) {
    var ns = _trim(args.namespace || "");
    var limit = args.limit != null ? Number(args.limit) : 50;
    if (limit > 200) limit = 200;
    var allowed = _allowedNamespaces();
    if (!ns || !allowed[ns])
      return { error: "namespace not allowed: " + ns };

    var esc = ns.replace(/'/g, "''");
    var q = xtk.queryDef.create(
      <queryDef schema="xtk:schema" operation="select" lineCount={String(limit)}>
        <select>
          <node expr="@namespace"/><node expr="@name"/><node expr="@label"/>
        </select>
        <where><condition expr={"@namespace = '" + esc + "'"}/></where>
        <orderBy><node expr="@name"/></orderBy>
      </queryDef>);
    var res = q.ExecuteQuery();
    var rows = [];
    for each (var r in res.schema) {
      rows.push({
        namespace: String(r.@namespace),
        name: String(r.@name),
        label: String(r.@label),
        id: String(r.@namespace) + ":" + String(r.@name)
      });
    }
    return { schemas: rows };
  }

  function _toolDescribeSchema(args) {
    var id = _trim(args.id || "");
    if (!id || id.indexOf(":") < 0) return { error: "id must be ns:name" };
    var parts = id.split(":");
    var ns = parts[0];
    var allowed = _allowedNamespaces();
    if (!allowed[ns]) return { error: "namespace not allowed" };
    try {
      var sch = application.getSchema(id);
      if (!sch) return { error: "schema not found" };
      var xml = sch.toXMLString();
      var summary = _summarizeSchemaXml(xml);
      if (summary.length > 4096)
        return { truncated: true, summary: summary.substring(0, 4096) + "...[truncated]" };
      return { summary: summary };
    } catch (e) {
      return { error: String(e.message || e) };
    }
  }

  function _summarizeSchemaXml(xml) {
    var s = String(xml || "");
    var out = [];
    var reAttr = /<attribute[^>]*name="([^"]*)"[^>]*label="([^"]*)"[^>]*type="([^"]*)"/g;
    var m;
    while ((m = reAttr.exec(s)) !== null) {
      out.push("attr:" + m[1] + " type=" + m[3] + " label=" + m[2]);
    }
    var reLink = /<element[^>]*name="([^"]*)"[^>]*label="([^"]*)"[^>]*target="([^"]*)"/g;
    while ((m = reLink.exec(s)) !== null) {
      out.push("link:" + m[1] + " -> " + m[3]);
    }
    if (!out.length) return s.substring(0, 4096);
    return out.join("\n");
  }

  function _toolProbeSql(args) {
    var sql = String(args.sql || "");
    var kc = String(args.keyColumn || "");
    if (!testWoo.probe) return { error: "probe module not loaded" };
    return testWoo.probe.run(sql, kc, 20);
  }

  function _toolProbeValues(args) {
    var schemaId = _trim(args.schemaId || "");
    var columnName = _trim(args.columnName || "");
    var cfg = testWoo.cfg.getConfig();
    var limit = args.limit != null ? Number(args.limit) : (cfg.triage.valueProbeLimit || 50);
    var maxLim = cfg.triage.valueProbeLimitMax || 200;
    if (limit > maxLim) limit = maxLim;
    if (limit < 1) limit = 50;

    if (!/^[A-Za-z0-9]+:[A-Za-z0-9_]+$/.test(schemaId))
      return { error: "invalid schemaId format" };
    var ns = schemaId.split(":")[0];
    if (!_allowedNamespaces()[ns]) return { error: "namespace not allowed" };
    if (!_validIdent(columnName)) return { error: "invalid columnName" };

    var tbl;
    try { tbl = _resolveSqlTable(schemaId); } catch (eT) {
      return { error: String(eT.message || eT) };
    }
    if (!_validIdent(tbl)) return { error: "invalid sqltable resolved" };

    var cap = cfg.triage.valueProbeCardinalityCap || 10000;
    var countQ = "SELECT COUNT(DISTINCT " + columnName + ") FROM " + tbl +
      " WHERE " + columnName + " IS NOT NULL";
    var cntR = _sqlGetIntSafe(countQ);
    if (!cntR.ok) return { ok: false, error: cntR.error };

    var distinctCount = cntR.value;
    if (distinctCount > cap) {
      return {
        ok: true,
        distinctCount: distinctCount,
        values: [],
        truncated: false,
        highCardinality: true
      };
    }

    var dial = testWoo.probe ? testWoo.probe.dialect() : null;
    var inner = "SELECT DISTINCT " + columnName + " FROM " + tbl +
      " WHERE " + columnName + " IS NOT NULL";
    var sampleQ = dial ?
      dial.limit(inner, limit) :
      "SELECT * FROM (" + inner + ") tw_v LIMIT " + limit;

    var values = [];
    try {
      var rows = sqlSelect("probe_values", sampleQ);
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row && row.length) values.push(row[0]);
        else if (row && row[columnName] != null) values.push(row[columnName]);
      }
    } catch (eS) {
      return { ok: false, error: String(eS.message || eS) };
    }

    return {
      ok: true,
      distinctCount: distinctCount,
      values: values,
      truncated: distinctCount > values.length,
      highCardinality: false
    };
  }

  function _toolSearchColumns(args) {
    var keyword = _trim(args.keyword || "").toLowerCase();
    if (!keyword || keyword.length < 1) return { error: "keyword required" };

    var nsArg = _trim(args.namespaces || "");
    var allowed = _allowedNamespaces();
    var namespaces = [];
    if (nsArg) {
      var parts = nsArg.split(",");
      for (var i = 0; i < parts.length; i++) {
        var n = _trim(parts[i]);
        if (allowed[n]) namespaces.push(n);
      }
    } else {
      for (var k in allowed) if (allowed.hasOwnProperty(k)) namespaces.push(k);
    }
    if (!namespaces.length) return { error: "no allowed namespaces" };

    var results = [];
    var max = 20;
    for (var ni = 0; ni < namespaces.length && results.length < max; ni++) {
      var list = _toolListSchemas({ namespace: namespaces[ni], limit: 80 });
      if (!list.schemas) continue;
      for (var si = 0; si < list.schemas.length && results.length < max; si++) {
        var sid = list.schemas[si].id;
        try {
          var sch = application.getSchema(sid);
          var xml = sch.toXMLString();
          var reAttr = /<attribute[^>]*name="([^"]*)"[^>]*label="([^"]*)"[^>]*type="([^"]*)"/g;
          var m;
          while ((m = reAttr.exec(xml)) !== null && results.length < max) {
            var an = m[1].toLowerCase();
            var al = m[2].toLowerCase();
            if (an.indexOf(keyword) >= 0 || al.indexOf(keyword) >= 0) {
              results.push({
                schemaId: sid,
                columnName: m[1],
                label: m[2],
                type: m[3]
              });
            }
          }
        } catch (eSch) {}
      }
    }
    return { matches: results };
  }

  register("list_schemas", {
    name: "list_schemas",
    description: "List Campaign schemas in allowed namespace (metadata only)",
    parameters: {
      type: "object",
      properties: {
        namespace: { type: "string", description: "Schema namespace e.g. nms, cus, woo" },
        limit: { type: "integer", description: "Max rows default 50" }
      },
      required: ["namespace"]
    }
  }, _toolListSchemas);

  register("describe_schema", {
    name: "describe_schema",
    description: "Summarize schema attributes and links (max 4KB)",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Full schema id ns:name" }
      },
      required: ["id"]
    }
  }, _toolDescribeSchema);

  register("probe_sql", {
    name: "probe_sql",
    description: "Read-only SQL probe: counts and sample rows",
    parameters: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SELECT only SQL" },
        keyColumn: { type: "string", description: "Grain key column name" }
      },
      required: ["sql", "keyColumn"]
    }
  }, _toolProbeSql);

  register("probe_values", {
    name: "probe_values",
    description: "DISTINCT values for a schema column (read-only, cardinality guarded)",
    parameters: {
      type: "object",
      properties: {
        schemaId: { type: "string", description: "ns:name schema id" },
        columnName: { type: "string", description: "Attribute/column name" },
        limit: { type: "integer", description: "Max distinct values default 50" }
      },
      required: ["schemaId", "columnName"]
    }
  }, _toolProbeValues);

  register("search_columns", {
    name: "search_columns",
    description: "Search column names/labels by keyword in allowed namespaces",
    parameters: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Search keyword (Korean or English)" },
        namespaces: { type: "string", description: "Comma-separated namespaces optional" }
      },
      required: ["keyword"]
    }
  }, _toolSearchColumns);

  return {
    register: register,
    specs: specs,
    invoke: invoke,
    env: env,
    resetBudget: resetBudget,
    getEvidenceLog: getEvidenceLog
  };
})();
