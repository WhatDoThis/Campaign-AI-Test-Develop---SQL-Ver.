/*
 * testWooToolkit.js (내부 툴킷 레지스트리 · server-side)
 * ==========================================================
 * OpenRouter tools용 spec/invoke. probe_values/search_columns + evidenceLog.
 * 스키마 파싱은 정규식이 아니라 E4X (속성 순서 자유 · label 누락 대응).
 *
 * [Main Functions]
 * ===========
 * - register / specs / invoke / env
 * - resetRequest(요청 단위 1회) / markPhase(단계 구분자) / resetBudget(deprecated)
 * - getEvidenceLog / getEvidenceLogSince
 *
 * [Dependencies]
 * =========
 * - testWoo.probe, testWoo.cfg, xtk.queryDef, application.getSchema
 * - loadLibrary("woo:testWooToolkit.js")
 * Ref sqlSelect(format, query): format="docName,@alias:type", 반환은 XML 객체
 *   https://experienceleague.adobe.com/developer/campaign-api/api/f-sqlSelect.html
 * Ref getSchema: 스크립트 종료까지 메모리에 유지 → namespace당 로드 상한 필요
 *   https://experienceleague.adobe.com/developer/campaign-api/api/m-Application-getSchema.html
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
  var _schemaListCache = {};

  var TOTAL_BUDGET = 20;
  var PROBE_BUDGET = 8;
  var PROBE_VALUES_BUDGET = 6;
  var SEARCH_COLUMNS_BUDGET = 8;

  // getSchema는 스크립트 종료까지 메모리 유지 → namespace당 인스턴스화 상한
  var SEARCH_SCHEMA_LOAD_CAP = 30;
  var SEARCH_MATCH_CAP = 20;
  var SCHEMA_LIST_CAP = 80;
  var DESCRIBE_ATTR_CAP = 120;
  var DESCRIBE_JSON_CAP = 4096;

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
      partialScan: !!(result && result.partialScan),
      schemaLoadFailed: !!(result && result.schemaLoadFailed),
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

  // 요청 단위로 1회만 호출한다. 슬롯·단계마다 호출하면 툴 예산이 무력화된다.
  function resetRequest() {
    _totalCalls = 0;
    _probeCalls = 0;
    _probeValuesCalls = 0;
    _searchColumnsCalls = 0;
    _evidenceLog = [];
    _evidenceSeq = 0;
    _schemaListCache = {};
  }

  // 카운터는 유지하고 evidenceLog에 단계 구분자만 넣는다.
  // 반환값 = 이 단계의 로그 시작 인덱스 (getEvidenceLogSince 인자)
  function markPhase(phaseName) {
    _evidenceSeq++;
    _evidenceLog.push({
      seq: _evidenceSeq,
      phase: String(phaseName || ""),
      marker: true
    });
    return _evidenceLog.length;
  }

  // deprecated — resetRequest의 별칭. 신규 호출부는 resetRequest/markPhase를 쓴다.
  function resetBudget() {
    resetRequest();
  }

  function getEvidenceLog() {
    return _evidenceLog.slice(0);
  }

  // startIndex 이후의 실제 툴 호출만 (단계 구분자 제외)
  function getEvidenceLogSince(startIndex) {
    var from = Number(startIndex);
    if (isNaN(from) || from < 0) from = 0;
    var out = [];
    for (var i = from; i < _evidenceLog.length; i++) {
      if (!_evidenceLog[i] || _evidenceLog[i].marker) continue;
      out.push(_evidenceLog[i]);
    }
    return out;
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

  // getSchema는 Schema 클래스 객체이고 공식 메서드는 toDocument 하나뿐이다.
  // toXMLString은 DOMElement 메서드이므로 Schema에 직접 호출하면 예외가 난다.
  // Ref Schema(class): https://experienceleague.adobe.com/developer/campaign-api/api/c-Schema.html
  // Ref toDocument → DOMDocument:
  //   https://experienceleague.adobe.com/developer/campaign-api/api/m-Schema-toDocument.html
  // 정규식 속성 파싱 금지 (ACC 스키마는 속성 순서가 자유롭고 label 생략 가능).
  function _schemaXml(schemaId) {
    var sch = application.getSchema(schemaId);
    if (!sch) throw new Error("schema not found: " + schemaId);
    var doc = sch.toDocument();
    if (!doc || !doc.documentElement)
      throw new Error("schema toDocument failed: " + schemaId);
    return new XML(String(doc.documentElement.toXMLString()));
  }

  // 루트 element의 sqltable만 사용 (정규식 첫 매칭은 하위 element 값을 집을 수 있음)
  function _resolveSqlTable(schemaId) {
    var xml = _schemaXml(schemaId);
    var rootName = String(xml.@name || "");
    var tbl = "";
    for each (var el in xml.element) {
      if (String(el.@name) === rootName) {
        tbl = String(el.@sqltable || "");
        break;
      }
    }
    if (!tbl) {
      for each (var el0 in xml.element) {
        tbl = String(el0.@sqltable || "");
        break;
      }
    }
    if (!tbl) throw new Error("sqltable not resolvable for " + schemaId);
    return tbl;
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
      var xml = _schemaXml(id);
      var cols = [];
      for each (var a in xml..attribute) {
        cols.push({
          name: String(a.@name),
          label: String(a.@label || ""),
          type: String(a.@type || "string")
        });
        if (cols.length >= DESCRIBE_ATTR_CAP) break;
      }
      var links = [];
      for each (var l in xml..element) {
        if (String(l.@type) !== "link") continue;
        links.push({ name: String(l.@name), target: String(l.@target || "") });
      }
      return _capDescribe(id, cols, links);
    } catch (e) {
      // 조용한 실패 금지 — 스키마 로드 실패는 로그로 남기고 근거 없음을 명시한다.
      logWarning("[testWoo.toolkit.describe_schema] schema load failed: " + id +
        " / " + String(e.message || e));
      return { error: String(e.message || e), schemaLoadFailed: true };
    }
  }

  // 직렬화 4KB 초과 시 attribute를 잘라내고 truncated 표시 (LLM 컨텍스트 보호)
  function _capDescribe(id, cols, links) {
    var truncated = false;
    var out = { schemaId: id, columns: cols, links: links, truncated: false };
    while (cols.length > 1 && JSON.stringify(out).length > DESCRIBE_JSON_CAP) {
      var keep = cols.length - 10;
      cols = cols.slice(0, keep > 1 ? keep : 1);
      truncated = true;
      out = { schemaId: id, columns: cols, links: links, truncated: true };
    }
    out.truncated = truncated;
    return out;
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

    // 별칭 tw_val 고정 → sqlSelect format 과 1:1 대응 (반환은 XML 객체)
    // limitSelect 로 서브쿼리 중첩 없이 생성 + ORDER BY 1 로 재현성 확보.
    // DISTINCT 는 selectList 에 넣지 않고 opts 로 넘긴다 — T-SQL 은 DISTINCT 가 TOP 앞이다.
    if (!testWoo.probe) return { ok: false, error: "probe module not loaded" };
    var sampleQ = testWoo.probe.dialect().limitSelect(
      columnName + " AS tw_val", tbl, columnName + " IS NOT NULL", limit,
      { distinct: true });

    var values = [];
    try {
      var xml = sqlSelect("row,@tw_val:string", sampleQ);
      for each (var r in xml.row) {
        values.push(String(r.@tw_val));
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

  // 스키마 목록은 요청 단위 캐시 (동일 namespace queryDef 재조회 방지)
  function _cachedSchemaList(namespace) {
    var key = String(namespace);
    if (_schemaListCache[key]) return _schemaListCache[key];
    var list = _toolListSchemas({ namespace: namespace, limit: SCHEMA_LIST_CAP });
    if (!list.schemas) return null;
    _schemaListCache[key] = list.schemas;
    return list.schemas;
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
    var scanned = 0;
    var totalCandidates = 0;
    var capHit = false;
    var loadFailed = 0;

    for (var ni = 0; ni < namespaces.length; ni++) {
      var schemas = _cachedSchemaList(namespaces[ni]);
      if (!schemas) continue;
      totalCandidates += schemas.length;
      var loaded = 0;
      for (var si = 0; si < schemas.length; si++) {
        if (loaded >= SEARCH_SCHEMA_LOAD_CAP || results.length >= SEARCH_MATCH_CAP) {
          capHit = true;
          break;
        }
        var sid = schemas[si].id;
        try {
          var xml = _schemaXml(sid);
          loaded++;
          scanned++;
          for each (var a in xml..attribute) {
            if (results.length >= SEARCH_MATCH_CAP) break;
            var an = String(a.@name || "");
            var al = String(a.@label || "");
            if (an.toLowerCase().indexOf(keyword) < 0 &&
                al.toLowerCase().indexOf(keyword) < 0) continue;
            results.push({
              schemaId: sid,
              columnName: an,
              label: al,
              type: String(a.@type || "string")
            });
          }
        } catch (eSch) {
          // 조용한 실패 금지 — 스키마 로드 실패가 "0건 매칭"으로 위장되면
          // Triage가 근거 없이 no_column 을 낸다.
          loadFailed++;
          logWarning("[testWoo.toolkit.search_columns] schema load failed: " + sid +
            " / " + String(eSch.message || eSch));
        }
      }
    }

    // partialScan=true 는 "전수 조사 아님" — no_column 확신도를 medium 이하로 제한하는 근거
    // schemaLoadFailed=true 는 근거 자체가 없다는 뜻 — no_column 판정 금지 근거
    return {
      matches: results,
      scanned: scanned,
      totalCandidates: totalCandidates,
      schemaLoadFailed: (scanned === 0 && loadFailed > 0),
      loadFailed: loadFailed,
      partialScan: capHit || scanned < totalCandidates
    };
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
    resetRequest: resetRequest,
    markPhase: markPhase,
    resetBudget: resetBudget,
    getEvidenceLog: getEvidenceLog,
    getEvidenceLogSince: getEvidenceLogSince
  };
})();
