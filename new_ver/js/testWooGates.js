/*
 * testWooGates.js (Plan·Fragment 검증 게이트)
 * ==================================================
 * litmus 동기 __v=159 (#160 배포정합).
 * CNF plan·fragment sql_text·param_domain 최소 검증.
 * Stage A 후보 밖 fragment 거절은 LLM Pass1 전용.
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
 */
var testWoo = testWoo || {};
testWoo.gates = (function () {
  "use strict";

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  // 1. [G1] syntax
  function g1Syntax(sql) {
    var raw = String(sql || "");
    if (/"/.test(raw)) return _fail("G1", "quoted identifiers (\") forbidden");
    var s = _stripSqlNoise(raw);
    if (/<%|%>/.test(s)) return _fail("G1", "JST token (<% %>) found");
    if (/\{\{/.test(s)) return _fail("G1", "unresolved {{param}} token");
    if (s.indexOf(";") >= 0) return _fail("G1", "semicolon forbidden");
    if (/\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|MERGE)\b/i.test(s))
      return _fail("G1", "DDL/DML forbidden");
    if (!/^\s*(WITH|SELECT)\b/i.test(s)) return _fail("G1", "not a single SELECT/WITH");
    return _ok("G1");
  }

  // 2. fragment sql_text 계약 — SELECT 리스트가 grain 컬럼 하나 (등록 전·컴파일 시)
  function fragmentSqlContract(sqlText, keyColumn) {
    var s = _stripSqlNoise(String(sqlText || ""));
    if (!String(sqlText || "").replace(/\s+/g, ""))
      return _fail("FRAG", "sql_text empty");
    if (/^\s*WITH\b/i.test(s))
      return _fail("FRAG", "sql_text must not start with WITH (subquery wrap 불가)");
    var syn = g1Syntax(sqlText);
    if (!syn.ok) return _fail("FRAG", syn.reason);
    return _checkSelectIsGrain(s, keyColumn);
  }

  // 3. CNF plan — active fragment + SCOPE
  function validatePlan(plan) {
    if (!plan) return _fail("PLAN", "plan missing");
    if (!plan.grainKey) return _fail("PLAN", "grainKey missing");
    if (_isArray(plan.unmatched) && plan.unmatched.length)
      return _fail("PLAN", "unmatched conditions remain: " + plan.unmatched.join(", "));
    if (!_isArray(plan.include) || !plan.include.length)
      return _fail("PLAN", "include empty");
    if (!_isArray(plan.exclude)) plan.exclude = [];

    var scopeErr = checkScopePlan(plan);
    if (scopeErr) return _fail("SCOPE", scopeErr);

    var grain = plan.grainKey;
    for (var gi = 0; gi < plan.include.length; gi++) {
      var group = plan.include[gi];
      if (!group || !_isArray(group.any) || !group.any.length)
        return _fail("PLAN", "include[" + gi + "].any empty");
      for (var ai = 0; ai < group.any.length; ai++) {
        var r = _checkItem(group.any[ai], grain, "include[" + gi + "].any[" + ai + "]");
        if (!r.ok) return r;
      }
    }
    for (var ei = 0; ei < plan.exclude.length; ei++) {
      var re = _checkItem(plan.exclude[ei], grain, "exclude[" + ei + "]");
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

  function _checkItem(item, grain, path) {
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
    for (var pk in domain) {
      if (!domain.hasOwnProperty(pk)) continue;
      var spec = domain[pk] || {};
      var val = params[pk];
      var missing = (val == null || val === "");
      if (spec.required && missing)
        return _fail("PLAN", "required param missing: " + item.fragment + "." + pk);
      if (missing) continue;
      var tv = _checkTypeEnumRange(val, spec, item.fragment + "." + pk);
      if (!tv.ok) return tv;
    }
    return _ok("PLAN");
  }

  function _checkTypeEnumRange(val, spec, path) {
    if (spec.enum && _isArray(spec.enum)) {
      var ok = false;
      for (var i = 0; i < spec.enum.length; i++) {
        if (String(spec.enum[i]) === String(val)) { ok = true; break; }
      }
      if (!ok) return _fail("PLAN", "param not in enum: " + path + "=" + val);
    }
    var t = String(spec.type || "").toLowerCase();
    if (t === "number" || t === "int" || t === "integer" || t === "long") {
      if (typeof val !== "number" && !/^-?\d+(\.\d+)?$/.test(String(val)))
        return _fail("PLAN", "param type number expected: " + path);
      var num = typeof val === "number" ? val : parseFloat(String(val), 10);
      if (spec.min != null && num < Number(spec.min))
        return _fail("PLAN", "param below min: " + path);
      if (spec.max != null && num > Number(spec.max))
        return _fail("PLAN", "param above max: " + path);
    }
    if (t === "boolean") {
      if (val !== true && val !== false && val !== 0 && val !== 1 &&
          val !== "0" && val !== "1" && val !== "true" && val !== "false")
        return _fail("PLAN", "param type boolean expected: " + path);
    }
    if (spec.min != null && t !== "number" && t !== "int" && t !== "integer" && t !== "long") {
      if (typeof val === "number" && val < Number(spec.min))
        return _fail("PLAN", "param below min: " + path);
    }
    if (spec.max != null && t !== "number" && t !== "int" && t !== "integer" && t !== "long") {
      if (typeof val === "number" && val > Number(spec.max))
        return _fail("PLAN", "param above max: " + path);
    }
    return _ok("PLAN");
  }

  // 최종 SQL SELECT 리스트 (단일 grain 언급)
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
    for (var gi = 0; gi < plan.include.length; gi++) {
      var any = plan.include[gi].any || [];
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
testWoo.gates.__v = "159";
