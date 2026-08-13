/*
 * testWooToolkit.js (LLM Tool 레지스트리)
 * ==================================================
 * litmus 동기 __v=160 (refreshDomain — 후속 적재 재스냅샷).
 * OpenRouter tools용 spec·invoke·evidenceLog.
 * Triage·Foundry가 schema 조사·probe_sql·search_columns 호출.
 * #168-A: 탐색(툴) 결과를 frag._source 로 결정화. classifyField·fingerprint·TTL.
 * #169: 요청 단위 invoke 캐시 · evidence에 resultCount/cacheHit/elapsedMs.
 *
 * [Main Functions]
 * ===========
 * - register — tool name→handler 등록
 * - specs — OpenRouter tools[] 스펙 반환
 * - invoke — tool name+args 실행(동일 args는 요청 내 캐시, 예산 미차감)
 * - env — 허용 namespace·예산 요약
 * - resetRequest — 요청 단위 카운터·invoke 캐시 초기화
 * - setPhaseBudget — triage|generate 단계 예산
 * - markPhase — 현재 phase 표시
 * - resetBudget — (deprecated) 전체 예산 리셋
 * - getEvidenceLog — 누적 evidence 배열
 * - getEvidenceLogSince — offset 이후 evidence
 * - classifyField — schema+xpath → tier + toolCalls (메타데이터 판정)
 * - resolveDomain — 스냅샷 + _source(provenance·fingerprint)
 * - refreshDomain — 기존 domain을 _source로 재스냅샷(후속 데이터 추가 반영)
 * - pathFromGrain / findSchemaBySqlTable / resolveGrainSchema — 경로·스키마 추론
 * - schemaFingerprint / checkSourceFreshness — 스키마 변화·TTL 판정
 *
 * [Dependencies]
 * =========
 * - testWoo.probe — probe_sql·staticBlock·limitSelect
 * - testWoo.cfg.getConfig — foundry.namespaces·toolkit 예산·triage 도메인 가드
 * - xtk.queryDef·application.getSchema — describe_schema·search_columns
 *
 * [Invariants]
 * =========
 * - #168-A: 실행 경로에 특정 컬럼/enum 리터럴 하드코딩 금지(스키마 메타만)
 * - 캡 초과는 partialScan/truncated + 개수로 알린다(조용히 자르지 않음)
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
  var _classifyCache = {};
  var _invokeCache = {};

  // ACC schema type 문자열(Experience League schema-structure). 추측 추가 금지.
  var RANGE_TYPES = {
    byte: 1, short: 1, long: 1, int64: 1, double: 1, float: 1,
    money: 1, percent: 1, date: 1, datetime: 1, datetimenotz: 1,
    datetimetz: 1, timespan: 1, time: 1, timestamp: 1
  };
  var TEXT_HEAVY_TYPES = { memo: 1, html: 1, CDATA: 1, blob: 1, bin: 1 };
  var FREE_TEXT_LEN = 200;

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

  function _resultCountOf(result) {
    if (!result || result.error) return 0;
    if (result.matches && typeof result.matches.length === "number")
      return result.matches.length;
    if (result.schemas && typeof result.schemas.length === "number")
      return result.schemas.length;
    if (result.values && typeof result.values.length === "number")
      return result.values.length;
    if (result.columns && typeof result.columns.length === "number")
      return result.columns.length;
    if (result.links && typeof result.links.length === "number")
      return result.links.length;
    if (result.returnedAttributes != null) return Number(result.returnedAttributes) || 0;
    if (result.distinctCount != null && !isNaN(Number(result.distinctCount)))
      return Number(result.distinctCount);
    if (result.ok === true && result.total != null) return Number(result.total) || 0;
    return 0;
  }

  function _rawResultLength(result) {
    try {
      return String(JSON.stringify(result || {})).length;
    } catch (eL) {
      return 0;
    }
  }

  function _invokeCacheKey(name, argsObj) {
    var a = argsObj || {};
    var keys = [];
    for (var k in a) {
      if (a.hasOwnProperty(k)) keys.push(k);
    }
    keys.sort();
    var parts = [String(name)];
    for (var i = 0; i < keys.length; i++) {
      parts.push(keys[i] + "=" + String(a[keys[i]]));
    }
    return parts.join("|");
  }

  function _appendEvidence(name, args, result, meta) {
    meta = meta || {};
    _evidenceSeq++;
    var matchCount = null;
    if (result && result.matches && typeof result.matches.length === "number")
      matchCount = result.matches.length;
    var rc = meta.resultCount != null ? Number(meta.resultCount) : _resultCountOf(result);
    _evidenceLog.push({
      seq: _evidenceSeq,
      tool: name,
      argsSummary: _summarizeArgs(args),
      resultSummary: _summarizeResult(result),
      partialScan: !!(result && result.partialScan),
      schemaLoadFailed: !!(result && result.schemaLoadFailed),
      matchCount: matchCount,
      resultCount: isNaN(rc) ? 0 : rc,
      truncated: !!(result && result.truncated),
      cacheHit: !!meta.cacheHit,
      elapsedMs: meta.elapsedMs != null ? Number(meta.elapsedMs) : 0,
      rawResultLength: meta.rawResultLength != null ?
        Number(meta.rawResultLength) : _rawResultLength(result),
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
    _classifyCache = {};
    _invokeCache = {};
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
    var entry = _registry[String(name)];
    if (!entry) return { error: "unknown tool: " + name };

    // #169: 요청 단위 캐시 — 동일 키 재호출은 DB 미실행·예산 미차감
    var cacheKey = _invokeCacheKey(name, argsObj);
    if (_invokeCache.hasOwnProperty(cacheKey)) {
      var cached = _invokeCache[cacheKey];
      var rcHit = _resultCountOf(cached);
      _appendEvidence(name, argsObj, cached, {
        cacheHit: true,
        elapsedMs: 0,
        resultCount: rcHit,
        rawResultLength: _rawResultLength(cached)
      });
      logInfo("[testWoo.toolkit] invoke name=" + name +
        " args=" + _summarizeArgs(argsObj) +
        " ok=" + !!(cached && !cached.error) +
        " resultCount=" + rcHit +
        " cacheHit=true elapsedMs=0");
      return cached;
    }

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

    _totalCalls++;
    _phaseCalls++;
    if (name === "probe_sql") _probeCalls++;
    if (name === "probe_values") _probeValuesCalls++;
    if (name === "search_columns") _searchColumnsCalls++;

    var t0 = new Date().getTime();
    var result;
    try {
      result = entry.impl(argsObj || {});
    } catch (e) {
      result = { error: String(e.message || e) };
    }
    var elapsed = new Date().getTime() - t0;
    if (!result.error) _invokeCache[cacheKey] = result;
    var rc = _resultCountOf(result);
    var rawLen = _rawResultLength(result);
    _appendEvidence(name, argsObj, result, {
      cacheHit: false,
      elapsedMs: elapsed,
      resultCount: rc,
      rawResultLength: rawLen
    });
    var ok = !!(result && !result.error);
    logInfo("[testWoo.toolkit] invoke name=" + name +
      " args=" + _summarizeArgs(argsObj) +
      " ok=" + ok +
      " resultCount=" + rc +
      " truncated=" + !!(result && result.truncated) +
      " cacheHit=false elapsedMs=" + elapsed);
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
    // 캡을 올리지 않는다(메모리). 잘리면 반드시 partialScan 으로 알린다.
    var capped = rows.length >= limit;
    return {
      schemas: rows,
      scanned: rows.length,
      listCap: limit,
      partialScan: capped,
      scanNote: capped
        ? ("scanned " + rows.length + " of ≥" + rows.length +
          " (list_schemas cap=" + limit + "; narrow keyword/namespace)")
        : ("scanned " + rows.length)
    };
  }

  function _primaryAttrNames(xml) {
    var out = {};
    for each (var k in xml..key) {
      for each (var kf in k.keyfield) {
        var xp = String(kf.@xpath || "");
        if (xp.charAt(0) === "@") xp = xp.substring(1);
        if (xp) out[xp.toLowerCase()] = true;
      }
    }
    return out;
  }

  function _rootAutoPk(xml) {
    var rootName = String(xml.@name || "");
    for each (var el in xml.element) {
      if (String(el.@name) === rootName) {
        var ap = String(el.@autopk || "").toLowerCase();
        return ap === "true" || ap === "1";
      }
    }
    return false;
  }

  function _toolDescribeSchema(args) {
    var id = _trim(args.id || "");
    if (!id || id.indexOf(":") < 0) return { error: "id must be ns:name" };
    var parts = id.split(":");
    var ns = parts[0];
    var allowed = _allowedNamespaces();
    if (!allowed[ns]) return { error: "namespace not allowed" };
    var offset = args.offset != null ? Number(args.offset) : 0;
    if (isNaN(offset) || offset < 0) offset = 0;
    try {
      var xml = _schemaXml(id);
      var pkNames = _primaryAttrNames(xml);
      var autoPk = _rootAutoPk(xml);
      var allCols = [];
      for each (var a in xml..attribute) {
        var an = String(a.@name || "");
        var lenRaw = String(a.@length || "");
        var lenNum = lenRaw ? Number(lenRaw) : 0;
        if (isNaN(lenNum)) lenNum = 0;
        allCols.push({
          name: an,
          sqlColumn: _sqlColumnOf(a),
          label: String(a.@label || ""),
          type: String(a.@type || "string"),
          enum: String(a.@enum || ""),
          userEnum: String(a.@userEnum || ""),
          length: lenNum,
          isLink: false,
          target: "",
          isPrimary: !!pkNames[an.toLowerCase()],
          isAutoPk: autoPk && !!pkNames[an.toLowerCase()]
        });
      }
      var links = [];
      for each (var l in xml..element) {
        if (String(l.@type) !== "link") continue;
        var ln = String(l.@name || "");
        var tgt = String(l.@target || "");
        links.push({
          name: ln,
          target: tgt,
          type: "link",
          isLink: true,
          enum: "",
          userEnum: "",
          length: 0,
          isPrimary: false,
          isAutoPk: false
        });
      }
      var totalAttributes = allCols.length;
      // offset 페이지 후 JSON 캡. 조용히 자르지 않고 coverage/nextOffset 제공.
      var page = allCols.slice(offset);
      if (page.length > DESCRIBE_ATTR_CAP) page = page.slice(0, DESCRIBE_ATTR_CAP);
      return _capDescribe(id, page, links, {
        offset: offset,
        totalAttributes: totalAttributes,
        totalLinks: links.length
      });
    } catch (e) {
      // 조용한 실패 금지 — 스키마 로드 실패는 로그로 남기고 근거 없음을 명시한다.
      logWarning("[testWoo.toolkit.describe_schema] schema load failed: " + id +
        " / " + String(e.message || e));
      return { error: String(e.message || e), schemaLoadFailed: true };
    }
  }

  // JSON 캡 초과 시 잘라내되 truncated·전체 N중 M·nextOffset 을 반드시 실음.
  function _capDescribe(id, cols, links, meta) {
    meta = meta || {};
    var offset = meta.offset != null ? Number(meta.offset) : 0;
    var totalAttributes = meta.totalAttributes != null ?
      Number(meta.totalAttributes) : (cols ? cols.length : 0);
    var working = [];
    var ci;
    for (ci = 0; ci < cols.length; ci++) working.push(cols[ci]);
    var jsonTrunc = false;
    var out = {
      schemaId: id,
      columns: working,
      links: links,
      truncated: false,
      offset: offset,
      totalAttributes: totalAttributes,
      returnedAttributes: working.length,
      totalLinks: meta.totalLinks != null ? meta.totalLinks : (links ? links.length : 0)
    };
    while (working.length > 1 && JSON.stringify(out).length > DESCRIBE_JSON_CAP) {
      var keep = working.length - 10;
      var next = [];
      var kj;
      var lim = keep > 1 ? keep : 1;
      for (kj = 0; kj < lim; kj++) next.push(working[kj]);
      working = next;
      jsonTrunc = true;
      out.columns = working;
      out.returnedAttributes = working.length;
    }
    var end = offset + working.length;
    var more = end < totalAttributes;
    out.truncated = jsonTrunc || more || offset > 0;
    out.returnedAttributes = working.length;
    out.nextOffset = more ? end : null;
    out.coverage = working.length + " of " + totalAttributes + " attributes";
    if (offset > 0) out.coverage += " (offset " + offset + ")";
    if (out.truncated)
      out.truncateNote = "truncated:true — " + out.coverage +
        (out.nextOffset != null ? ("; call again with offset=" + out.nextOffset) : "");
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

  function _domainCfg() {
    var t = {};
    try {
      t = testWoo.cfg.getConfig().triage || {};
    } catch (eC) {
      try { t = testWoo.env.getEnv().triage || {}; } catch (eE) { t = {}; }
    }
    return {
      snapshotCap: Number(t.valueProbeLimitMax) || 200,
      rowLimit: Number(t.domainProbeRowLimit) || 1000000,
      ttlDays: Number(t.domainTtlDays) || 7,
      cardCap: Number(t.valueProbeCardinalityCap) || 10000
    };
  }

  function _nowIso() {
    var d = new Date();
    function p(n) { return n < 10 ? "0" + n : String(n); }
    return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()) +
      "T" + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds()) + "Z";
  }

  function _xpathAttrName(xpath) {
    var x = _trim(xpath || "");
    if (x.charAt(0) === "@") x = x.substring(1);
    return x;
  }

  function _findAttrMeta(schemaId, xpath) {
    var want = _xpathAttrName(xpath).toLowerCase();
    if (!want) return { ok: false, error: "xpath required" };
    var xml;
    try {
      xml = _schemaXml(schemaId);
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
    var pkNames = _primaryAttrNames(xml);
    var autoPk = _rootAutoPk(xml);
    for each (var a in xml..attribute) {
      var an = String(a.@name || "");
      var sn = _sqlColumnOf(a);
      if (an.toLowerCase() !== want && String(sn || "").toLowerCase() !== want) continue;
      var lenRaw = String(a.@length || "");
      var lenNum = lenRaw ? Number(lenRaw) : 0;
      if (isNaN(lenNum)) lenNum = 0;
      return {
        ok: true,
        kind: "attribute",
        name: an,
        sqlColumn: sn,
        type: String(a.@type || "string"),
        enumName: String(a.@enum || ""),
        userEnumName: String(a.@userEnum || ""),
        length: lenNum,
        isLink: false,
        target: "",
        isPrimary: !!pkNames[an.toLowerCase()],
        isAutoPk: autoPk && !!pkNames[an.toLowerCase()]
      };
    }
    for each (var l in xml..element) {
      if (String(l.@type) !== "link") continue;
      var ln = String(l.@name || "");
      if (ln.toLowerCase() !== want) continue;
      return {
        ok: true,
        kind: "link",
        name: ln,
        sqlColumn: "",
        type: "link",
        enumName: "",
        userEnumName: "",
        length: 0,
        isLink: true,
        target: String(l.@target || ""),
        isPrimary: false,
        isAutoPk: false
      };
    }
    return { ok: false, error: "xpath not found in schema" };
  }

  function _enumLabelValueMap(schemaId, enumName) {
    var out = {};
    if (!enumName) return out;
    var xml;
    try {
      xml = _schemaXml(schemaId);
    } catch (e) {
      return out;
    }
    for each (var en in xml.enumeration) {
      if (String(en.@name || "") !== enumName) continue;
      for each (var v in en.value) {
        var vName = String(v.@name || "");
        var vVal = String(v.@value != null ? v.@value : "");
        if (!vVal) vVal = vName;
        var lab = String(v.@label || vName);
        if (lab) out[lab] = vVal;
        if (vName) out[vName] = vVal;
      }
    }
    return out;
  }

  function _estimateTableRows(schemaId) {
    try {
      var tbl = _resolveSqlTable(schemaId);
      if (!_validIdent(tbl)) return { ok: false, error: "bad sqltable" };
      return _sqlGetIntSafe("SELECT COUNT(*) FROM " + tbl);
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  // #168-A: 메타데이터만으로 tier 판정. 컬럼명 리터럴 분기 금지.
  function classifyField(schemaId, xpath, opts) {
    opts = opts || {};
    var sid = _trim(schemaId || "");
    var xp = _trim(xpath || "");
    var cacheKey = sid + "|" + xp + "|" + String(opts.snapshotCap != null ? opts.snapshotCap : "");
    if (!opts.skipCache && _classifyCache[cacheKey])
      return _classifyCache[cacheKey];

    var result;
    try {
      result = _classifyFieldInner(sid, xp, opts);
    } catch (eC) {
      result = {
        tier: "unknown",
        evidence: "classify exception: " + String(eC.message || eC),
        cost: "none",
        toolCalls: [],
        schemaId: sid,
        xpath: xp
      };
    }
    if (!opts.skipCache) _classifyCache[cacheKey] = result;
    return result;
  }

  function _clsOut(tier, evidence, cost, toolCalls, schemaId, xpath, meta, extra) {
    var o = {
      tier: tier,
      evidence: evidence,
      cost: cost,
      toolCalls: toolCalls || [],
      schemaId: schemaId,
      xpath: xpath
    };
    if (meta) o.meta = meta;
    if (extra) {
      for (var ek in extra) {
        if (extra.hasOwnProperty(ek)) o[ek] = extra[ek];
      }
    }
    return o;
  }

  function _classifyFieldInner(schemaId, xpath, opts) {
    var dcfg = _domainCfg();
    var snapCap = opts.snapshotCap != null ? Number(opts.snapshotCap) : dcfg.snapshotCap;
    if (isNaN(snapCap) || snapCap < 1) snapCap = dcfg.snapshotCap;

    var meta = _findAttrMeta(schemaId, xpath);
    if (!meta.ok) {
      return _clsOut("unknown", meta.error || "meta missing", "none", [],
        schemaId, xpath, null, null);
    }

    // R1
    if (meta.isLink || meta.kind === "link") {
      return _clsOut("link", "isLink target=" + String(meta.target || ""), "none", [],
        schemaId, xpath, meta, null);
    }

    // R2
    if (meta.enumName || meta.userEnumName) {
      return _clsOut("enum",
        "enum=" + String(meta.enumName || "") + " userEnum=" + String(meta.userEnumName || ""),
        "none", [], schemaId, xpath, meta, null);
    }

    var typ = String(meta.type || "").toLowerCase();

    // R3
    if (RANGE_TYPES[typ]) {
      return _clsOut("range", "type=" + typ + " is numeric/temporal", "none", [],
        schemaId, xpath, meta, null);
    }

    // R4
    if (typ === "boolean") {
      return _clsOut("enum", "type=boolean fixed two-value", "none", [],
        schemaId, xpath, meta, null);
    }

    // S3 free text
    if (TEXT_HEAVY_TYPES[typ] || (typ === "string" && meta.length > FREE_TEXT_LEN)) {
      return _clsOut("highCard",
        "free-text type/length type=" + typ + " length=" + meta.length,
        "none", [], schemaId, xpath, meta, null);
    }

    // R5 string-like → COUNT(DISTINCT) with guards (probe_values 경로와 동일 SQL)
    var rowEst = _estimateTableRows(schemaId);
    if (rowEst.ok && rowEst.value > dcfg.rowLimit) {
      return _clsOut("highCard",
        "rowCount=" + rowEst.value + " > domainProbeRowLimit",
        "count_star", ["probe_values"], schemaId, xpath, meta, null);
    }

    if (!meta.sqlColumn || !_validIdent(meta.sqlColumn)) {
      return _clsOut("unknown", "sqlColumn missing for distinct probe", "none", [],
        schemaId, xpath, meta, null);
    }

    var tbl;
    try {
      tbl = _resolveSqlTable(schemaId);
    } catch (eT) {
      return _clsOut("unknown",
        "sqltable resolve failed: " + String(eT.message || eT),
        "none", [], schemaId, xpath, meta, null);
    }

    var countQ = "SELECT COUNT(DISTINCT " + meta.sqlColumn + ") FROM " + tbl +
      " WHERE " + meta.sqlColumn + " IS NOT NULL";
    var cntR = _sqlGetIntSafe(countQ);
    if (!cntR.ok) {
      return _clsOut("unknown",
        "COUNT(DISTINCT) failed: " + String(cntR.error || ""),
        "count_distinct", ["probe_values"], schemaId, xpath, meta, null);
    }
    var dc = Number(cntR.value) || 0;
    if (dc > snapCap) {
      return _clsOut("highCard",
        "COUNT(DISTINCT)=" + dc + " > snapshotCap=" + snapCap,
        "count_distinct", ["probe_values"], schemaId, xpath, meta,
        { distinctCount: dc });
    }
    return _clsOut("distinct",
      "COUNT(DISTINCT)=" + dc + " <= snapshotCap=" + snapCap,
      "count_distinct", ["probe_values"], schemaId, xpath, meta,
      { distinctCount: dc });
  }

  function pathFromGrain(grainSchemaId, fieldSchemaId, xpath) {
    var g = _trim(grainSchemaId || "");
    var f = _trim(fieldSchemaId || "");
    var xp = _trim(xpath || "");
    if (!xp) return { ok: false, path: "", error: "xpath required" };
    if (!xp || xp.charAt(0) !== "@") {
      if (xp.charAt(0) !== "@") xp = "@" + _xpathAttrName(xp);
    }
    if (!g || !f || g === f) return { ok: true, path: xp, error: "" };
    try {
      var xml = _schemaXml(g);
      for each (var l in xml..element) {
        if (String(l.@type) !== "link") continue;
        var tgt = String(l.@target || "");
        if (tgt === f || tgt.indexOf(f) >= 0) {
          return {
            ok: true,
            path: String(l.@name) + "/" + xp,
            error: ""
          };
        }
      }
    } catch (eP) {
      return { ok: false, path: "", error: String(eP.message || eP) };
    }
    return { ok: false, path: "", error: "no link from grain schema to field schema" };
  }

  // tier별 스냅샷. Foundry 최초 생성·TTL 갱신·miss 병합에서 호출.
  function resolveDomain(schemaId, xpath, opts) {
    opts = opts || {};
    var sid = _trim(schemaId || "");
    var xp = _trim(xpath || "");
    if (xp && xp.charAt(0) !== "@") xp = "@" + _xpathAttrName(xp);

    var cls = classifyField(sid, xp, {
      snapshotCap: opts.snapshotCap,
      skipCache: !!opts.skipCache
    });
    var dcfg = _domainCfg();
    var discoveredBy = opts.discoveredBy;
    if (!discoveredBy || !discoveredBy.length) {
      discoveredBy = ["describe_schema"];
      if (cls.toolCalls && cls.toolCalls.length) {
        for (var dbi = 0; dbi < cls.toolCalls.length; dbi++)
          discoveredBy.push(cls.toolCalls[dbi]);
      }
    }
    var toolCallCount = opts.toolCallCount != null ?
      Number(opts.toolCallCount) : (discoveredBy ? discoveredBy.length : 0);
    var fp = "";
    try { fp = schemaFingerprint(sid); } catch (eFp) { fp = ""; }
    var source = {
      schema: sid,
      xpath: xp,
      pathFromTarget: opts.pathFromTarget || "",
      tier: cls.tier,
      evidence: cls.evidence,
      discoveredBy: discoveredBy,
      toolCallCount: toolCallCount,
      schemaFingerprint: fp,
      freshness: "ok",
      refreshedAt: _nowIso(),
      truncated: false
    };
    if (opts.pathFromTarget == null || opts.pathFromTarget === "") {
      var pfg = pathFromGrain(opts.grainSchemaId || sid, sid, xp);
      if (pfg.ok) source.pathFromTarget = pfg.path;
      else source.pathUnresolved = String(pfg.error || "unresolved");
    }

    var domain = { _source: source };
    var meta = cls.meta || null;

    if (cls.tier === "enum") {
      var map = {};
      if (meta && meta.enumName)
        map = _enumLabelValueMap(sid, meta.enumName);
      if (meta && meta.userEnumName) {
        // userEnum 값은 플랫폼 저장소 — 스키마 내장 enumeration 이 없으면 라벨 맵만 비움
        var um = _enumLabelValueMap(sid, meta.userEnumName);
        for (var uk in um) if (um.hasOwnProperty(uk)) map[uk] = um[uk];
      }
      if (String(meta && meta.type || "").toLowerCase() === "boolean") {
        map["true"] = "1";
        map["false"] = "0";
        map["예"] = "1";
        map["아니오"] = "0";
      }
      var paramKey = _xpathAttrName(xp) || "value";
      domain[paramKey] = {
        required: true,
        type: "string",
        nlMap: map,
        enum: []
      };
      var ev = [];
      for (var mk in map) {
        if (!map.hasOwnProperty(mk)) continue;
        var mv = map[mk];
        var dup = false;
        for (var ei = 0; ei < ev.length; ei++) {
          if (String(ev[ei]) === String(mv)) { dup = true; break; }
        }
        if (!dup) ev.push(mv);
      }
      domain[paramKey].enum = ev;
      return { ok: true, classification: cls, paramDomain: domain };
    }

    if (cls.tier === "range") {
      var minV = null;
      var maxV = null;
      if (meta && meta.sqlColumn && _validIdent(meta.sqlColumn)) {
        try {
          var tblR = _resolveSqlTable(sid);
          var minR = _sqlGetIntSafe(
            "SELECT MIN(" + meta.sqlColumn + ") FROM " + tblR +
              " WHERE " + meta.sqlColumn + " IS NOT NULL");
          var maxR = _sqlGetIntSafe(
            "SELECT MAX(" + meta.sqlColumn + ") FROM " + tblR +
              " WHERE " + meta.sqlColumn + " IS NOT NULL");
          if (minR.ok) minV = minR.value;
          if (maxR.ok) maxV = maxR.value;
        } catch (eR) {
          source.evidence = String(source.evidence || "") +
            " | min/max failed: " + String(eR.message || eR);
        }
      }
      domain._range = { min: minV, max: maxV };
      domain._bucket = { nlMap: {} };
      return { ok: true, classification: cls, paramDomain: domain };
    }

    if (cls.tier === "distinct") {
      var lim = dcfg.snapshotCap;
      if (opts.snapshotCap != null) lim = Number(opts.snapshotCap) || lim;
      var hasPv = false;
      for (var pvi = 0; pvi < discoveredBy.length; pvi++) {
        if (discoveredBy[pvi] === "probe_values") { hasPv = true; break; }
      }
      if (!hasPv) discoveredBy.push("probe_values");
      source.discoveredBy = discoveredBy;
      source.toolCallCount = opts.toolCallCount != null ?
        Number(opts.toolCallCount) : discoveredBy.length;
      var pv = _toolProbeValues({
        schemaId: sid,
        columnName: meta && meta.name ? meta.name : _xpathAttrName(xp),
        limit: lim
      });
      if (!pv || !pv.ok) {
        source.tier = "unknown";
        source.evidence = "probe_values failed: " +
          String(pv && pv.error ? pv.error : "unknown");
        domain._source = source;
        return { ok: false, classification: cls, paramDomain: domain, error: source.evidence };
      }
      if (pv.highCardinality || pv.truncated) {
        source.tier = "highCard";
        source.truncated = !!pv.truncated;
        source.evidence = "probe_values truncated/highCard distinctCount=" +
          String(pv.distinctCount);
        domain._source = source;
        return { ok: true, classification: cls, paramDomain: domain, snapshotSkipped: true };
      }
      var pKey = _xpathAttrName(xp) || "value";
      var nlMap = {};
      var enums = [];
      var vals = pv.values || [];
      for (var vi = 0; vi < vals.length; vi++) {
        var vv = String(vals[vi]);
        if (!vv) continue;
        nlMap[vv] = vv;
        enums.push(vv);
      }
      domain[pKey] = {
        required: true,
        type: "string",
        nlMap: nlMap,
        enum: enums
      };
      source.truncated = false;
      domain._source = source;
      return { ok: true, classification: cls, paramDomain: domain };
    }

    // link / highCard / unknown — 스냅샷 없음
    return { ok: true, classification: cls, paramDomain: domain, snapshotSkipped: true };
  }

  // 제작 이후 적재된 값을 반영. 기존 nlMap 별칭은 유지하고 _range/enum/_source만 넓힌다.
  function refreshDomain(domainRaw, opts) {
    opts = opts || {};
    var domain = {};
    if (testWoo.fragContract && testWoo.fragContract.normalizeParamDomain)
      domain = testWoo.fragContract.normalizeParamDomain(domainRaw);
    else {
      try {
        domain = (domainRaw && typeof domainRaw === "object") ?
          domainRaw : JSON.parse(String(domainRaw || "{}"));
      } catch (eP) { domain = {}; }
    }
    var src = domain._source;
    if (!src || !src.schema || !src.xpath)
      return { ok: false, reason: "SOURCE_MISSING" };
    var rd;
    try {
      rd = resolveDomain(src.schema, src.xpath, {
        grainSchemaId: opts.grainSchemaId,
        pathFromTarget: src.pathFromTarget || src.xpath,
        discoveredBy: src.discoveredBy,
        toolCallCount: src.toolCallCount
      });
    } catch (eR) {
      return { ok: false, reason: String(eR.message || eR) };
    }
    if (!rd || !rd.paramDomain)
      return { ok: false, reason: (rd && rd.error) || "resolveDomain empty" };
    if (rd.ok === false)
      return { ok: false, reason: rd.error || "resolveDomain failed", domain: domain };
    var merged;
    if (testWoo.fragContract && testWoo.fragContract.mergeParamDomainJson)
      merged = testWoo.fragContract.mergeParamDomainJson(domain, rd.paramDomain);
    else
      merged = { changed: true, json: JSON.stringify(rd.paramDomain), domain: rd.paramDomain };
    return {
      ok: true,
      changed: !!merged.changed,
      domain: merged.domain,
      json: merged.json,
      tier: rd.classification ? rd.classification.tier : String(src.tier || "")
    };
  }

  function isDomainStale(sourceBlock) {
    if (!sourceBlock || !sourceBlock.refreshedAt) return true;
    var dcfg = _domainCfg();
    var t = Date.parse(String(sourceBlock.refreshedAt));
    if (isNaN(t)) return true;
    var ageMs = new Date().getTime() - t;
    return ageMs > (dcfg.ttlDays * 24 * 60 * 60 * 1000);
  }

  function _simpleHash(s) {
    var str = String(s || "");
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) | 0;
    }
    return "fp" + String(h >>> 0);
  }

  // 스키마 구조 지문 — 속성/링크 메타만. 컬럼명 리터럴 분기 없음.
  function schemaFingerprint(schemaId) {
    var sid = _trim(schemaId || "");
    if (!sid) return "";
    var xml = _schemaXml(sid);
    var parts = [];
    for each (var a in xml..attribute) {
      parts.push("A:" + String(a.@name) + "|" + String(a.@type) + "|" +
        String(a.@enum) + "|" + String(a.@userEnum) + "|" +
        String(_sqlColumnOf(a)) + "|" + String(a.@length || ""));
    }
    for each (var l in xml..element) {
      if (String(l.@type) !== "link") continue;
      parts.push("L:" + String(l.@name) + ">" + String(l.@target || ""));
    }
    parts.sort();
    return _simpleHash(parts.join(";"));
  }

  // TTL 유효하면 fingerprint 대조 생략(매 요청 대조 금지).
  // 반환 status: ok | ttl_expired | stale | orphaned
  function checkSourceFreshness(sourceBlock) {
    if (!sourceBlock || !sourceBlock.schema)
      return { status: "orphaned", reason: "missing _source.schema" };
    var sid = String(sourceBlock.schema);
    try {
      _schemaXml(sid);
    } catch (eMiss) {
      return {
        status: "orphaned",
        reason: "schema gone: " + String(eMiss.message || eMiss)
      };
    }
    if (sourceBlock.xpath) {
      var meta = _findAttrMeta(sid, sourceBlock.xpath);
      if (!meta.ok)
        return { status: "stale", reason: "xpath missing on schema" };
    }
    if (!isDomainStale(sourceBlock))
      return { status: "ok", reason: "ttl_valid" };

    var curFp = "";
    try { curFp = schemaFingerprint(sid); } catch (eFp) {
      return { status: "orphaned", reason: "fingerprint failed: " + String(eFp.message || eFp) };
    }
    var oldFp = String(sourceBlock.schemaFingerprint || "");
    if (oldFp && curFp && oldFp !== curFp) {
      return {
        status: "stale",
        reason: "schemaFingerprint mismatch",
        currentFingerprint: curFp
      };
    }
    return {
      status: "ttl_expired",
      reason: "ttl expired fingerprint ok",
      currentFingerprint: curFp
    };
  }

  function clearClassifyCache() {
    _classifyCache = {};
  }

  function findSchemaBySqlTable(sqltable) {
    var want = String(sqltable || "").toLowerCase();
    if (!want) return "";
    var allowed = _allowedNamespaces();
    for (var ns in allowed) {
      if (!allowed.hasOwnProperty(ns)) continue;
      var list = _cachedSchemaList(ns);
      if (!list) continue;
      for (var i = 0; i < list.length; i++) {
        var id = list[i].id;
        try {
          if (String(_resolveSqlTable(id)).toLowerCase() === want) return id;
        } catch (eF) {}
      }
    }
    return "";
  }

  // key_column 소유 스키마 추론(메타데이터만). 필드 스키마에 있으면 우선.
  function resolveGrainSchema(keyColumn, fieldSchemaId) {
    var want = _trim(keyColumn || "");
    var field = _trim(fieldSchemaId || "");
    if (!want) return field;
    if (field) {
      var onField = _findAttrMeta(field, want);
      if (onField.ok) return field;
    }
    var allowed = _allowedNamespaces();
    var primaryHit = "";
    var anyHit = "";
    for (var ns in allowed) {
      if (!allowed.hasOwnProperty(ns)) continue;
      var list = _cachedSchemaList(ns);
      if (!list) continue;
      for (var i = 0; i < list.length; i++) {
        var id = list[i].id;
        var meta = _findAttrMeta(id, want);
        if (!meta.ok) continue;
        if (!anyHit) anyHit = id;
        if (meta.isPrimary && !primaryHit) primaryHit = id;
      }
    }
    return primaryHit || anyHit || field;
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
    // SCHEMA_LIST_CAP / SEARCH_SCHEMA_LOAD_CAP 은 올리지 않는다(메모리). 반드시 개수로 알림.
    if (skippedNamespaces.length)
      logWarning("[testWoo.toolkit.search_columns] namespace 조회 실패·미허용으로 스킵: " +
        skippedNamespaces.join(","));
    var listCapped = false;
    for (var nci = 0; nci < namespaces.length; nci++) {
      var schList = _cachedSchemaList(namespaces[nci]);
      if (schList && schList.length >= SCHEMA_LIST_CAP) listCapped = true;
    }
    var partial = capHit || skippedNamespaces.length > 0 ||
      scanned < totalCandidates || listCapped;
    return {
      matches: results,
      scanned: scanned,
      totalCandidates: totalCandidates,
      schemaLoadFailed: (scanned === 0 && loadFailed > 0),
      loadFailed: loadFailed,
      skippedNamespaces: skippedNamespaces,
      allowedNamespaces: _allowedList(allowed),
      partialScan: partial,
      scanNote: "scanned " + scanned + " of " + totalCandidates +
        " schema candidates" +
        (listCapped ? ("; SCHEMA_LIST_CAP=" + SCHEMA_LIST_CAP + " may truncate list") : "") +
        (capHit ? ("; SEARCH_SCHEMA_LOAD_CAP=" + SEARCH_SCHEMA_LOAD_CAP +
          " or MATCH_CAP hit") : "")
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
      "Empty sqlColumn means the field is not stored as a SQL column and is not queryable. " +
      "If truncated:true, use offset=nextOffset to page remaining attributes " +
      "(coverage shows M of N).",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Full schema id ns:name" },
        offset: {
          type: "integer",
          description: "Attribute page offset when previous response was truncated"
        }
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
    getEvidenceLogSince: getEvidenceLogSince,
    classifyField: classifyField,
    resolveDomain: resolveDomain,
    refreshDomain: refreshDomain,
    pathFromGrain: pathFromGrain,
    isDomainStale: isDomainStale,
    schemaFingerprint: schemaFingerprint,
    checkSourceFreshness: checkSourceFreshness,
    clearClassifyCache: clearClassifyCache,
    findSchemaBySqlTable: findSchemaBySqlTable,
    resolveGrainSchema: resolveGrainSchema
  };
})();
testWoo.toolkit.__v = "160";
