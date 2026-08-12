/*
 * testWooToolkit.js (LLM Tool 레지스트리)
 * ==================================================
 * OpenRouter tools용 spec·invoke·evidenceLog.
 * Triage·Foundry가 schema 조사·probe_sql·search_columns 호출.
 *
 * [Main Functions]
 * ===========
 * - register — tool name→handler 등록
 * - specs — OpenRouter tools[] 스펙 반환
 * - invoke — tool name+args 실행
 * - env — 허용 namespace·예산 요약
 * - resetRequest — 요청 단위 카운터 초기화
 * - setPhaseBudget — triage|generate 단계 예산
 * - markPhase — 현재 phase 표시
 * - resetBudget — (deprecated) 전체 예산 리셋
 * - getEvidenceLog — 누적 evidence 배열
 * - getEvidenceLogSince — offset 이후 evidence
 *
 * [Dependencies]
 * =========
 * - testWoo.probe — probe_sql·staticBlock
 * - testWoo.cfg.getConfig — foundry.namespaces·toolkit 예산
 * - xtk.queryDef·application.getSchema — describe_schema·search_columns
 */
var testWoo = testWoo || {};
testWoo.toolkit = (function () {
  "use strict";

  var _registry = {};
  var _totalCalls = 0;
  var _probeCalls = 0;
  var _probeValuesCalls = 0;
  var _searchColumnsCalls = 0;
  var _phaseKind = "";
  var _phaseCalls = 0;
  var _phaseLimit = 0;
  var _evidenceLog = [];
  var _evidenceSeq = 0;
  var _schemaListCache = {};

  // env.toolkit 과 동일하게 유지 (cfg 로드 실패 시 fallback). 산식은 testWooEnv.js 주석 참고.
  // total = maxNewFragments(3)*(triage 12 + generate 24) + margin 24 = 132
  var TOTAL_BUDGET = 132;
  var TRIAGE_PHASE_BUDGET = 12;
  var GENERATE_PHASE_BUDGET = 24;
  var PROBE_BUDGET = 18;
  var PROBE_VALUES_BUDGET = 14;
  var SEARCH_COLUMNS_BUDGET = 18;

  // getSchema는 스크립트 종료까지 메모리 유지 → namespace당 인스턴스화 상한
  var SEARCH_SCHEMA_LOAD_CAP = 30;
  var SEARCH_MATCH_CAP = 20;
  var SCHEMA_LIST_CAP = 80;
  var DESCRIBE_ATTR_CAP = 120;
  // sqlColumn 추가로 컬럼당 직렬화 길이가 늘어 4096 이면 nms:recipient(47컬럼)가
  // 절단된다. 물리명은 SQL 작성에 필수라 생략할 수 없으므로 상한을 함께 올린다.
  var DESCRIBE_JSON_CAP = 6144;

  function _budgets() {
    try {
      var cfg = testWoo.cfg.getConfig();
      if (cfg.toolkit) {
        return {
          total: cfg.toolkit.totalCallBudget || TOTAL_BUDGET,
          triage: cfg.toolkit.triageCallBudget || TRIAGE_PHASE_BUDGET,
          generate: cfg.toolkit.generateCallBudget || GENERATE_PHASE_BUDGET,
          probeSql: cfg.toolkit.probeSqlBudget || PROBE_BUDGET,
          probeValues: cfg.toolkit.probeValuesBudget || PROBE_VALUES_BUDGET,
          searchColumns: cfg.toolkit.searchColumnsBudget || SEARCH_COLUMNS_BUDGET
        };
      }
    } catch (eB) {}
    return {
      total: TOTAL_BUDGET,
      triage: TRIAGE_PHASE_BUDGET,
      generate: GENERATE_PHASE_BUDGET,
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
    var raw = String(cfg.foundry.namespaces || "woo");
    var parts = raw.split(",");
    var out = {};
    for (var i = 0; i < parts.length; i++) {
      var n = _trim(parts[i]);
      if (n) out[n] = true;
    }
    return out;
  }

  function _allowedList(allowed) {
    var ns = [];
    for (var k in allowed) if (allowed.hasOwnProperty(k)) ns.push(k);
    return ns;
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
    var matchCount = null;
    if (result && result.matches && typeof result.matches.length === "number")
      matchCount = result.matches.length;
    _evidenceLog.push({
      seq: _evidenceSeq,
      tool: name,
      argsSummary: _summarizeArgs(args),
      resultSummary: _summarizeResult(result),
      partialScan: !!(result && result.partialScan),
      schemaLoadFailed: !!(result && result.schemaLoadFailed),
      matchCount: matchCount,
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
    _phaseKind = "";
    _phaseCalls = 0;
    _phaseLimit = 0;
    _evidenceLog = [];
    _evidenceSeq = 0;
    _schemaListCache = {};
  }

  // 단계별 예산 카운터를 연다. markPhase 직전에 호출한다.
  // kind="triage"|"generate". 요청 전체 상한(total)과 별도로 단계 상한을 적용한다.
  function setPhaseBudget(kind) {
    _phaseKind = String(kind || "");
    _phaseCalls = 0;
    var b = _budgets();
    if (_phaseKind === "triage") _phaseLimit = b.triage;
    else if (_phaseKind === "generate") _phaseLimit = b.generate;
    else _phaseLimit = 0;
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
    if (_phaseLimit > 0 && _phaseCalls >= _phaseLimit)
      return {
        error: "tool call budget exceeded (phase " + _phaseKind + " " +
          _phaseLimit + ")"
      };
    if (name === "probe_sql" && _probeCalls >= b.probeSql)
      return { error: "tool call budget exceeded (probe_sql " + b.probeSql + ")" };
    if (name === "probe_values" && _probeValuesCalls >= b.probeValues)
      return { error: "tool call budget exceeded (probe_values " + b.probeValues + ")" };
    if (name === "search_columns" && _searchColumnsCalls >= b.searchColumns)
      return { error: "tool call budget exceeded (search_columns " + b.searchColumns + ")" };

    var entry = _registry[String(name)];
    if (!entry) return { error: "unknown tool: " + name };

    _totalCalls++;
    _phaseCalls++;
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
    var ok = !!(result && !result.error);
    // 실패 사유를 저널에 남긴다. ok=false 만 찍으면 원인 추적에 evidence_log 조회가 필요하다.
    logInfo("[testWoo.toolkit] invoke name=" + name +
      " args=" + _summarizeArgs(argsObj) + " ok=" + ok);
    if (!ok)
      logWarning("[testWoo.toolkit] invoke failed name=" + name +
        " reason=" + String((result && result.error) || "unknown"));
    return result;
  }

  function env() {
    var dbms = "";
    try { dbms = String(application.getDBMSType() || ""); } catch (e) {}
    var ns = _allowedList(_allowedNamespaces());
    return {
      dbmsType: dbms,
      allowedNamespaces: ns,
      maxProbeRows: 100,
      // 물리 컬럼명. SQL 에 그대로 넣을 수 있는 형태여야 한다(논리명 금지).
      // 허용 namespace 안에 실재하는 키만 넣는다 — Triage 프롬프트에 그대로 들어가므로
      // 닿을 수 없는 키(nms:recipient 의 iRecipientId)를 남기면 그 키로 SQL 을 만들다
      // 게이트에서 실패하며 턴을 소진한다. namespaces 를 넓히면 함께 되돌린다.
      grainKeyCandidates: ["sCustomer_id"]
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

  // 논리 속성명(@name)과 물리 컬럼명(@sqlname)은 다르다. ACC 는 sqlname 을 생략하면
  // 타입 접두사를 붙여 물리명을 생성한다(customer_id → sCustomer_id, age → iAge).
  // 원시 SQL 에는 물리명만 통하므로 도구는 항상 sqlColumn 을 함께 노출해야 한다.
  // Ref: https://experienceleague.adobe.com/en/docs/campaign-classic/using/configuring-campaign-classic/schema-reference/database-mapping
  function _sqlColumnOf(attr) {
    return String(attr.@sqlname || "");
  }

  // LLM 이 논리명·물리명 중 무엇을 넘겨도 스키마에 선언된 물리명으로 해석한다.
  // 스키마에 없는 식별자는 거부 → 원시 SQL 에 임의 문자열이 들어가지 않는다(정합성 + 방어).
  function _resolveSqlColumn(schemaId, requested) {
    var want = String(requested || "").toLowerCase();
    if (!want) return { ok: false, error: "columnName required" };
    var xml = _schemaXml(schemaId);
    var noSqlName = "";
    for each (var a in xml..attribute) {
      var nm = String(a.@name || "");
      var sn = _sqlColumnOf(a);
      if (sn && sn.toLowerCase() === want) return { ok: true, sqlColumn: sn, name: nm };
      if (nm.toLowerCase() === want) {
        if (sn) return { ok: true, sqlColumn: sn, name: nm };
        noSqlName = nm;
      }
    }
    if (noSqlName)
      return {
        ok: false,
        error: "column '" + noSqlName + "' has no sqlname in the deployed schema " +
          "(XML-stored or not SQL-mapped) and cannot be used in SQL"
      };
    return { ok: false, error: "column not declared in schema: " + String(requested) };
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
    // 허용 목록을 함께 돌려준다 — 모델이 다음 턴에 스스로 고칠 수 있어야 턴을 낭비하지 않는다
    if (!ns || !allowed[ns])
      return {
        error: "namespace not allowed: " + ns +
          " (allowed: " + _allowedList(allowed).join(",") + ")"
      };

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
          sqlColumn: _sqlColumnOf(a),
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

    // LLM 이 논리명(customer_id)을 넘겨도 물리명(sCustomer_id)으로 해석한다.
    // 논리명을 그대로 SQL 에 넣으면 'column does not exist' 로 실패한다.
    var colR;
    try { colR = _resolveSqlColumn(schemaId, columnName); } catch (eC) {
      return { ok: false, error: String(eC.message || eC) };
    }
    if (!colR.ok) return { ok: false, error: colR.error };
    var col = colR.sqlColumn;
    if (!_validIdent(col)) return { ok: false, error: "invalid sqlColumn resolved" };

    var cap = cfg.triage.valueProbeCardinalityCap || 10000;
    var countQ = "SELECT COUNT(DISTINCT " + col + ") FROM " + tbl +
      " WHERE " + col + " IS NOT NULL";
    var cntR = _sqlGetIntSafe(countQ);
    if (!cntR.ok) return { ok: false, error: cntR.error };

    var distinctCount = cntR.value;
    if (distinctCount > cap) {
      return {
        ok: true,
        name: colR.name,
        sqlColumn: col,
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
      col + " AS tw_val", tbl, col + " IS NOT NULL", limit,
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
      name: colR.name,
      sqlColumn: col,
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
    var rejected = [];
    if (nsArg) {
      var parts = nsArg.split(",");
      for (var i = 0; i < parts.length; i++) {
        var n = _trim(parts[i]);
        if (allowed[n]) namespaces.push(n);
        else if (n) rejected.push(n);
      }
    } else {
      namespaces = _allowedList(allowed);
    }
    if (!namespaces.length)
      return {
        error: "no allowed namespaces (requested: " + (nsArg || "-") +
          " / allowed: " + _allowedList(allowed).join(",") + ")"
      };

    var results = [];
    var scanned = 0;
    var totalCandidates = 0;
    var capHit = false;
    var loadFailed = 0;
    // 조회하지 못한 namespace 를 조용히 건너뛰면 "조사했으나 0건"으로 위장되어
    // Triage 가 근거 없이 no_column 을 낸다 → 반드시 결과에 노출한다.
    var skippedNamespaces = rejected;

    for (var ni = 0; ni < namespaces.length; ni++) {
      var schemas = _cachedSchemaList(namespaces[ni]);
      if (!schemas) {
        skippedNamespaces.push(namespaces[ni]);
        continue;
      }
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
            var asql = _sqlColumnOf(a);
            if (an.toLowerCase().indexOf(keyword) < 0 &&
                al.toLowerCase().indexOf(keyword) < 0 &&
                asql.toLowerCase().indexOf(keyword) < 0) continue;
            results.push({
              schemaId: sid,
              columnName: an,
              sqlColumn: asql,
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
    if (skippedNamespaces.length)
      logWarning("[testWoo.toolkit.search_columns] namespace 조회 실패·미허용으로 스킵: " +
        skippedNamespaces.join(","));
    return {
      matches: results,
      scanned: scanned,
      totalCandidates: totalCandidates,
      schemaLoadFailed: (scanned === 0 && loadFailed > 0),
      loadFailed: loadFailed,
      skippedNamespaces: skippedNamespaces,
      allowedNamespaces: _allowedList(allowed),
      partialScan: capHit || skippedNamespaces.length > 0 || scanned < totalCandidates
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
    description: "Summarize schema attributes and links. Each column returns the logical " +
      "'name' and the physical 'sqlColumn' — ALWAYS use sqlColumn in SQL. " +
      "Empty sqlColumn means the field is not stored as a SQL column and is not queryable",
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
        sql: {
          type: "string",
          description: "SELECT only SQL. Use physical names: sqltable for tables and " +
            "sqlColumn for columns, as reported by describe_schema"
        },
        keyColumn: {
          type: "string",
          description: "Grain key physical column (sqlColumn), e.g. sCustomer_id"
        }
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
        columnName: {
          type: "string",
          description: "Logical attribute name or physical sqlColumn — both are accepted " +
            "and resolved against the schema"
        },
        limit: { type: "integer", description: "Max distinct values default 50" }
      },
      required: ["schemaId", "columnName"]
    }
  }, _toolProbeValues);

  register("search_columns", {
    name: "search_columns",
    description: "Search column names/labels/sqlColumn by keyword in allowed namespaces. " +
      "Matches report both logical columnName and physical sqlColumn — use sqlColumn in SQL",
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
    setPhaseBudget: setPhaseBudget,
    markPhase: markPhase,
    resetBudget: resetBudget,
    getEvidenceLog: getEvidenceLog,
    getEvidenceLogSince: getEvidenceLogSince
  };
})();
