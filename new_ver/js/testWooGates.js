/*
 * testWooGates.js (Plan·Fragment 검증 게이트)
 * ==================================================
 * litmus 동기 __v=168 (specForParamKey — xpath↔Code param enum 병합).
 * CNF plan·fragment sql_text·param_domain 최소 검증.
 * Stage A 후보 밖 fragment 거절은 LLM Pass1 전용.
 * enum은 nlMap db와 합친다. {db,en} 는 db만. snake↔camel 별칭. 배열 params는 원소별.
 * #168-B: fragmentSqlContract는 {{param}} 템플릿 허용(치환 전). 최종 SQL만 unresolved 금지.
 *
 * [Main Functions]
 * ===========
 * - g1Syntax — SELECT-only·금지 구문 정적 검사
 * - validatePlan — plan 구조·active fragment·SCOPE
 * - runAll — plan+compile 전체 게이트 일괄 실행
 * - fragmentSqlContract — sql_text grain 단일 SELECT 계약
 * - validateFragment — fragment 등록 필드 검증
 * - checkScopePlan — plan scope_key 일관성
 *
 * [Dependencies]
 * =========
 * - testWoo.fragments.getByName — active fragment 존재 확인
 * - testWoo.toolkit.refreshDomain — gates plan 검증 직전 live enum merge (#453)
 * - testWoo.fragContract.specForParamKey — {{param}}↔xpath attr enum·nlMap 병합 (#454)
 */
var testWoo = testWoo || {};
testWoo.gates = (function () {
  "use strict";

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  // 1. [G1] syntax
  // opts.allowParamPlaceholders: fragment 템플릿(sql_text) 검사용 — {{param}} 허용
  function g1Syntax(sql, opts) {
    opts = opts || {};
    var raw = String(sql || "");
    if (/"/.test(raw)) return _fail("G1", "quoted identifiers (\") forbidden");
    var s = _stripSqlNoise(raw);
    if (/<%|%>/.test(s)) return _fail("G1", "JST token (<% %>) found");
    if (!opts.allowParamPlaceholders && /\{\{/.test(s))
      return _fail("G1", "unresolved {{param}} token");
    if (s.indexOf(";") >= 0) return _fail("G1", "semicolon forbidden");
    if (/\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|MERGE)\b/i.test(s))
      return _fail("G1", "DDL/DML forbidden");
    if (!/^\s*(WITH|SELECT)\b/i.test(s)) return _fail("G1", "not a single SELECT/WITH");
    return _ok("G1");
  }

  // 2. fragment sql_text 계약 — SELECT 리스트가 grain 컬럼 하나 (등록 전·컴파일 시)
  // #167/#168-B: 저장본은 {{param}} 템플릿. 치환 전 계약 검사에서는 placeholder 허용.
  function fragmentSqlContract(sqlText, keyColumn) {
    var s = _stripSqlNoise(String(sqlText || ""));
    if (!String(sqlText || "").replace(/\s+/g, ""))
      return _fail("FRAG", "sql_text empty");
    if (/^\s*WITH\b/i.test(s))
      return _fail("FRAG", "sql_text must not start with WITH (subquery wrap 불가)");
    var syn = g1Syntax(sqlText, { allowParamPlaceholders: true });
    if (!syn.ok) return _fail("FRAG", syn.reason);
    // grain 검사 시 {{param}} 토큰은 식별자가 아니므로 플레이스홀더를 제거한 뒤 본다
    var sGrain = String(sqlText || "").replace(/\{\{\w+\}\}/g, "0");
    sGrain = _stripSqlNoise(sGrain);
    return _checkSelectIsGrain(sGrain, keyColumn);
  }

  // 3. CNF plan — active fragment + SCOPE
  function validatePlan(plan) {
    if (!plan) return _fail("PLAN", "plan missing");
    if (!plan.grainKey) return _fail("PLAN", "grainKey missing");
    if (_isArray(plan.unmatched) && plan.unmatched.length)
      return _fail("PLAN", "unmatched conditions remain: " + plan.unmatched.join(", "));
    if (!_isArray(plan.include)) plan.include = [];
    if (!_isArray(plan.exclude)) plan.exclude = [];
    if (!plan.include.length && !plan.exclude.length)
      return _fail("PLAN", "include empty");

    var scopeErr = checkScopePlan(plan);
    if (scopeErr) return _fail("SCOPE", scopeErr);

    var grain = plan.grainKey;
    for (var gi = 0; gi < plan.include.length; gi++) {
      var group = plan.include[gi];
      if (!group || !_isArray(group.any) || !group.any.length)
        return _fail("PLAN", "include[" + gi + "].any empty");
      for (var ai = 0; ai < group.any.length; ai++) {
        var r = _checkItem(group.any[ai], grain, "include[" + gi + "].any[" + ai + "]", plan);
        if (!r.ok) return r;
      }
    }
    for (var ei = 0; ei < plan.exclude.length; ei++) {
      var re = _checkItem(plan.exclude[ei], grain, "exclude[" + ei + "]", plan);
      if (!re.ok) return re;
    }
    return _ok("PLAN");
  }

  // 4. runAll(plan, sql)
  function runAll(plan, sql) {
    var results = [];
    var p = validatePlan(plan);
    results.push(p);
    if (!p.ok) return results;
    var g1 = g1Syntax(sql);
    results.push(g1);
    if (!g1.ok) return results;
    var go = _checkOutput(sql, plan.grainKey);
    results.push(go);
    return results;
  }

  function _relativeParamSpanBound(f, item, pk, nlHay) {
    if (!testWoo.fragContract || !testWoo.fragContract.spanRangeSqlText) return false;
    var sql = String(f.sql_text || "");
    if (sql.indexOf("{{" + String(pk) + "}}") < 0) return false;
    try {
      return !!testWoo.fragContract.spanRangeSqlText(
        sql, f.param_domain, (item && item.params) || {}, f.key_column, nlHay || "");
    } catch (eB) { return false; }
  }

  function _checkItem(item, grain, path, plan) {
    if (!item || !item.fragment) return _fail("PLAN", path + ": fragment missing");
    var f = testWoo.fragments.getByName(item.fragment);
    if (!f) return _fail("PLAN", "unknown fragment: " + item.fragment);
    if (String(f.status || "") !== "active")
      return _fail("PLAN", "fragment not active: " + item.fragment +
        " status=" + (f.status || ""));
    if (f.is_current === false || String(f.is_current) === "false")
      return _fail("PLAN", "fragment not current: " + item.fragment);
    if (f.status === "revoked")
      return _fail("PLAN", "fragment revoked: " + item.fragment +
        (f.revoked_reason ? " reason=" + f.revoked_reason : ""));
    if (!f.key_column)
      return _fail("PLAN", "key_column missing on fragment: " + item.fragment);
    if (f.key_column !== grain)
      return _fail("PLAN", "key_column mismatch: " + item.fragment +
        " has " + f.key_column + " want " + grain);
    if (/"/.test(String(f.sql_text || "")))
      return _fail("PLAN", "quoted identifiers in sql_text: " + item.fragment);

    var fc = fragmentSqlContract(f.sql_text, grain);
    if (!fc.ok) return _fail("PLAN", path + ": " + fc.reason + " (" + item.fragment + ")");

    var domainParse = _parseDomain(f.param_domain);
    if (!domainParse.ok) return _fail("PLAN", path + ": param_domain JSON invalid: " + item.fragment);
    var domain = domainParse.value || {};
    var params = item.params || {};
    var nlHay = "";
    if (testWoo.fragContract && testWoo.fragContract.planHaystack)
      nlHay = testWoo.fragContract.planHaystack(plan);
    else if (plan && plan.nl_request)
      nlHay = String(plan.nl_request);
    if (testWoo.toolkit && testWoo.toolkit.refreshDomain) {
      try {
        var rrDom = testWoo.toolkit.refreshDomain(domain);
        if (rrDom && rrDom.ok && rrDom.domain) domain = rrDom.domain;
      } catch (eRd) { /* stale snapshot */ }
    }
    // sql_text {{}} 만 검사. 도메인 키는 planCode↔plan_code 별칭으로 합친다.
    var need = {};
    var sql = String(f.sql_text || "");
    var re = /\{\{(\w+)\}\}/g;
    var m;
    while ((m = re.exec(sql)) != null) need[m[1]] = 1;
    if (testWoo.fragContract && testWoo.fragContract.fillSqlParamGaps) {
      params = testWoo.fragContract.fillSqlParamGaps(domain, need, params, nlHay);
      item.params = params;
    }
    for (var pk in need) {
      if (!need.hasOwnProperty(pk)) continue;
      var spec = _specForParam(domain, pk);
      var val = params[pk];
      var missing = (val == null || val === "");
      if (spec.required && missing) {
        if (_relativeParamSpanBound(f, item, pk, nlHay)) continue;
        return _fail("PLAN", "required param missing: " + item.fragment + "." + pk);
      }
      if (missing) continue;
      var tv = _checkTypeEnumRange(val, spec, item.fragment + "." + pk, nlHay, domain, pk);
      if (!tv.ok) return tv;
      if (tv.normalized != null && params[pk] != null &&
          String(tv.normalized) !== String(params[pk]))
        params[pk] = tv.normalized;
    }
    return _ok("PLAN");
  }

  function _aliasParamKey(key) {
    var k = String(key || "");
    if (!k) return "";
    if (k.indexOf("_") >= 0)
      return k.replace(/_([a-zA-Z])/g, function (_, c) {
        return String(c).toUpperCase();
      });
    return k.replace(/[A-Z]/g, function (c) {
      return "_" + String(c).toLowerCase();
    });
  }

  function _enumDb(v) {
    if (v == null) return null;
    if (typeof v === "object" && !_isArray(v)) {
      if (v.db != null && typeof v.db !== "object") return v.db;
      return null;
    }
    return v;
  }

  function _addEnum(list, v) {
    var dbv = _enumDb(v);
    if (dbv == null || dbv === "") return;
    var i;
    for (i = 0; i < list.length; i++) {
      if (String(list[i]) === String(dbv)) return;
    }
    list.push(dbv);
  }

  function _collectEnum(spec) {
    var enumList = [];
    if (!spec) return enumList;
    var ei, nk;
    if (spec.enum && _isArray(spec.enum)) {
      for (ei = 0; ei < spec.enum.length; ei++) _addEnum(enumList, spec.enum[ei]);
    }
    if (spec.nlMap && typeof spec.nlMap === "object") {
      for (nk in spec.nlMap) {
        if (!spec.nlMap.hasOwnProperty(nk)) continue;
        _addEnum(enumList, spec.nlMap[nk]);
        _addEnum(enumList, nk);
      }
    }
    return enumList;
  }

  function _specForParam(domain, pk) {
    if (testWoo.fragContract && testWoo.fragContract.specForParamKey)
      return testWoo.fragContract.specForParamKey(domain, pk);
    var spec = (domain && domain[pk]) || null;
    var alt = _aliasParamKey(pk);
    var altSpec = (alt && alt !== pk && domain && domain[alt]) ? domain[alt] : null;
    if (!spec && !altSpec) return {};
    if (!spec) return altSpec;
    if (!altSpec) return spec;
    var out = {};
    var k;
    for (k in spec) {
      if (spec.hasOwnProperty(k)) out[k] = spec[k];
    }
    var union = _collectEnum(spec);
    var extra = _collectEnum(altSpec);
    var xi;
    for (xi = 0; xi < extra.length; xi++) _addEnum(union, extra[xi]);
    if (union.length) out.enum = union;
    if (spec.required || altSpec.required) out.required = true;
    if (!out.type) out.type = spec.type || altSpec.type;
    return out;
  }

  function _checkTypeEnumRange(val, spec, path, haystack, domain, pk) {
    if (_isArray(val)) {
      if (!val.length) return _fail("PLAN", "empty array param: " + path);
      var ai;
      for (ai = 0; ai < val.length; ai++) {
        var rA = _checkTypeEnumRange(val[ai], spec, path + "[" + ai + "]", haystack, domain, pk);
        if (!rA.ok) return rA;
      }
      return _ok("PLAN");
    }
    var normVal = val;
    if (testWoo.fragContract && testWoo.fragContract.normalizeParamForCatalog)
      normVal = testWoo.fragContract.normalizeParamForCatalog(spec, val, haystack || "");
    var enumList = _collectEnum(spec);
    if (enumList.length) {
      var ok = false;
      for (var i = 0; i < enumList.length; i++) {
        if (String(enumList[i]) === String(normVal)) { ok = true; break; }
      }
      if (!ok && testWoo.fragContract && testWoo.fragContract.catalogProvesParamValue)
        ok = testWoo.fragContract.catalogProvesParamValue(
          spec, normVal, haystack || "", domain, pk);
      if (!ok) return _fail("PLAN", "param not in enum: " + path + "=" + val);
    }
    var t = String(spec.type || "").toLowerCase();
    if (t === "number" || t === "int" || t === "integer" || t === "long") {
      if (typeof normVal !== "number" && !/^-?\d+(\.\d+)?$/.test(String(normVal)))
        return _fail("PLAN", "param type number expected: " + path);
      var num = typeof normVal === "number" ? normVal : parseFloat(String(normVal), 10);
      if (spec.min != null && num < Number(spec.min))
        return _fail("PLAN", "param below min: " + path);
      if (spec.max != null && num > Number(spec.max))
        return _fail("PLAN", "param above max: " + path);
    }
    if (t === "boolean") {
      if (normVal !== true && normVal !== false && normVal !== 0 && normVal !== 1 &&
          normVal !== "0" && normVal !== "1" && normVal !== "true" && normVal !== "false")
        return _fail("PLAN", "param type boolean expected: " + path);
    }
    if (spec.min != null && t !== "number" && t !== "int" && t !== "integer" && t !== "long") {
      if (typeof normVal === "number" && normVal < Number(spec.min))
        return _fail("PLAN", "param below min: " + path);
    }
    if (spec.max != null && t !== "number" && t !== "int" && t !== "integer" && t !== "long") {
      if (typeof normVal === "number" && normVal > Number(spec.max))
        return _fail("PLAN", "param above max: " + path);
    }
    return { gate: "PLAN", ok: true, data: null, normalized: normVal };
  }
  function _checkOutput(sql, grain) {
    var s = _stripSqlNoise(String(sql || ""));
    var m = s.match(/^\s*SELECT\s+([\s\S]+?)\s+FROM\s/i);
    if (!m) return _fail("OUT", "cannot parse SELECT list");
    var sel = _trim(m[1].replace(/\s+/g, " "));
    if (sel.indexOf(",") >= 0)
      return _fail("OUT", "final SQL must project single grain column");
    if (grain && sel.toLowerCase().indexOf(String(grain).toLowerCase()) < 0)
      return _fail("OUT", "final SQL select list missing grain: " + grain);
    return _ok("OUT");
  }

  // fragment: SELECT 리스트 코어가 grain 또는 *.grain (WHERE 내 grain 언급만으로 통과 금지)
  function _checkSelectIsGrain(strippedSql, grain) {
    var m = strippedSql.match(/^\s*SELECT\s+(?:DISTINCT\s+)?([\s\S]+?)\s+FROM\s/i);
    if (!m) return _fail("FRAG", "cannot parse SELECT list");
    var sel = _trim(m[1].replace(/\s+/g, " "));
    if (sel.indexOf(",") >= 0)
      return _fail("FRAG", "sql_text must project single grain column");
    var core = _trim(sel.replace(/\s+AS\s+[A-Za-z_][\w]*$/i, ""));
    var g = String(grain || "");
    if (!g) return _fail("FRAG", "keyColumn missing");
    var gl = g.toLowerCase();
    var cl = core.toLowerCase();
    if (cl === gl) return _ok("FRAG");
    if (cl.length > gl.length && cl.substring(cl.length - gl.length - 1) === "." + gl)
      return _ok("FRAG");
    return _fail("FRAG", "SELECT list must be grain column only, got: " + sel);
  }

  function _stripSqlNoise(sql) {
    var s = String(sql || "");
    s = s.replace(/'(?:[^']|'')*'/g, "''");
    s = s.replace(/"(?:[^"]|"")*"/g, '""');
    s = s.replace(/\/\*[\s\S]*?\*\//g, " ");
    s = s.replace(/--[^\n\r]*/g, " ");
    return s;
  }

  function _parseDomain(s) {
    if (s == null || s === "") return { ok: true, value: {} };
    if (typeof s !== "string") return { ok: true, value: s };
    try {
      return { ok: true, value: JSON.parse(s) };
    } catch (e) {
      return { ok: false, value: null };
    }
  }

  function _isArray(x) {
    return Object.prototype.toString.call(x) === "[object Array]";
  }

  function _okResult(code, pass, detail) {
    return { code: code, pass: pass, detail: detail || "" };
  }

  // SCOPE — same scopeKey in different AND groups
  function checkScopePlan(plan) {
    var scopeGroups = {};
    function noteScope(item, groupIdx, role) {
      if (!item || !item.fragment) return;
      var f = testWoo.fragments.getByName(item.fragment);
      if (!f || !f.scope_key) return;
      var sk = String(f.scope_key);
      if (!scopeGroups[sk]) scopeGroups[sk] = [];
      scopeGroups[sk].push({ group: groupIdx, role: role, fragment: item.fragment });
    }
    var incG = plan.include || [];
    for (var gi = 0; gi < incG.length; gi++) {
      var any = (incG[gi] && incG[gi].any) || [];
      for (var ai = 0; ai < any.length; ai++) noteScope(any[ai], gi, "include");
    }
    for (var ei = 0; ei < (plan.exclude || []).length; ei++)
      noteScope(plan.exclude[ei], -1, "exclude");
    for (var sk in scopeGroups) {
      if (!scopeGroups.hasOwnProperty(sk)) continue;
      var entries = scopeGroups[sk];
      if (entries.length < 2) continue;
      var groups = {};
      for (var i = 0; i < entries.length; i++) {
        var key = entries[i].role + ":" + entries[i].group;
        groups[key] = true;
      }
      var gkCount = 0;
      for (var gk in groups) if (groups.hasOwnProperty(gk)) gkCount++;
      if (gkCount > 1) {
        return "동일 대상 단위(scopeKey=" + sk +
          ")에 대한 조건을 집합 연산으로 결합할 수 없습니다. 복합 fragment가 필요합니다.";
      }
    }
    return "";
  }

  var NAME_PATTERN = /^[a-z0-9]+__[a-z0-9]+__[a-z0-9_]+(__[a-z0-9_]+)?$/;

  // validateFragment — Foundry G-A~G-F
  function validateFragment(frag) {
    var results = [];
    var pass = true;
    var sql = String(frag.sql_text || "");
    var kc = String(frag.key_column || "");

    if (!testWoo.probe) {
      results.push(_okResult("G-A", false, "probe module missing"));
      return { pass: false, results: results };
    }

    var probe = testWoo.probe.run(sql, kc, 20);
    if (!probe.ok) {
      results.push(_okResult("G-A", false, probe.error || "probe failed"));
      pass = false;
    } else {
      results.push(_okResult("G-A", true, "probe ok total=" + probe.total));
    }

    if (probe.ok) {
      var gB = probe.total === probe.distinctKey && probe.nullKey === 0;
      if (!gB) {
        pass = false;
        results.push(_okResult("G-B", false,
          "grain uniqueness failed total=" + probe.total +
          " distinct=" + probe.distinctKey + " nullKey=" + probe.nullKey));
      } else {
        results.push(_okResult("G-B", true, "unique grain"));
      }

      // 분모 부재(populationCountSql 미설정·조회 실패)면 pop=0 → 95% 상한 검사를 건너뛴다.
      // probe.total 을 분모로 쓰면 total>=total*0.95 가 항상 참이 되어 G-C 가 상시 실패한다.
      var pop = 0;
      var cfg = testWoo.cfg ? testWoo.cfg.getConfig() : null;
      if (cfg && cfg.foundry.populationCountSql) {
        try {
          pop = Number(sqlGetInt(cfg.foundry.populationCountSql));
        } catch (eP) {
          pop = 0;
          logWarning("[testWoo.gates] populationCountSql 실행 실패 — G-C 상한 검사 생략: " +
            String(eP.message || eP));
        }
      }
      if (isNaN(pop)) pop = 0;

      var gC = true;
      var gCMsg = pop > 0 ? "scale ok (population=" + pop + ")" : "scale ok (population 미설정)";
      if (probe.total === 0) {
        gC = false; pass = false;
        gCMsg = "결과 0건";
      } else if (pop > 0 && probe.total >= pop * 0.95) {
        gC = false; pass = false;
        gCMsg = "결과가 모집단의 95% 이상 (" + probe.total + "/" + pop + ") — 필터 효과 없음";
      }
      results.push(_okResult("G-C", gC, gCMsg));

      var domainParse = _parseDomain(frag.param_domain);
      if (!domainParse.ok) {
        pass = false;
        results.push(_okResult("G-D", false, "param_domain invalid JSON"));
      } else {
        results.push(_okResult("G-D", true, "param_domain ok"));
      }
    }

    var nm = String(frag.name || "");
    var gF = NAME_PATTERN.test(nm);
    if (!gF) {
      pass = false;
      results.push(_okResult("G-F", false, "name pattern violation: " + nm));
    } else {
      results.push(_okResult("G-F", true, "name ok"));
    }

    var fc = fragmentSqlContract(sql, kc);
    if (!fc.ok) {
      pass = false;
      results.push(_okResult("FRAG", false, fc.reason));
    }

    var auditSample = {
      included: probe.ok ? (probe.sample || []) : [],
      boundary: [],
      boundaryReason: "no boundary params detected",
      excluded_similar: []
    };

    return { pass: pass, results: results, auditSample: auditSample };
  }

  function _ok(gate, data) { return { gate: gate, ok: true, data: data || null }; }
  function _fail(gate, reason) { return { gate: gate, ok: false, reason: reason }; }

  return {
    g1Syntax: g1Syntax,
    validatePlan: validatePlan,
    runAll: runAll,
    fragmentSqlContract: fragmentSqlContract,
    validateFragment: validateFragment,
    checkScopePlan: checkScopePlan
  };
})();
testWoo.gates.__v = "168";
