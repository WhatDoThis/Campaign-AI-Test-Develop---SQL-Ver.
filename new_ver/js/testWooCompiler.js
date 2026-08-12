/*
 * testWooCompiler.js (CNF plan → SQL 컴파일러)
 * ==================================================
 * litmus 동기 __v=159 (#160 배포정합).
 * LLM이 낸 CNF plan을 fragment sql_text로 조합해 최종 audience SQL 생성.
 * summary·chips는 compile 결과에서만 만든다. Oracle은 EXCEPT→MINUS.
 *
 * [Main Functions]
 * ===========
 * - compile — plan → {sql, keyColumn, summary, plan}
 * - chipsFromPlan — plan에서 UI 칩 배열 생성
 * - collectUsedFragments — plan에 쓰인 fragment 메타 수집
 *
 * [Dependencies]
 * =========
 * - testWoo.fragments.getByName — fragment sql_text 로드
 * - testWoo.gates — fragmentSqlContract·checkScopePlan(로드 시)
 * - testWoo.cfg.getConfig — search.maxSlots 상한
 * - loadLibrary("woo:testWooCompiler.js") — Generate·Register JSSP
 */
var testWoo = testWoo || {};
testWoo.compiler = (function () {
  "use strict";

  function _dialect() {
    var t = "";
    try { t = String(application.getDBMSType() || "").toLowerCase(); } catch (e) {}
    return {
      type: t,
      exceptOp: (t.indexOf("oracle") >= 0) ? "MINUS" : "EXCEPT"
    };
  }

  // 1. CNF plan → SQL + summary
  function compile(plan) {
    if (!plan) throw new Error("[testWoo.compiler] plan missing");
    if (!_isArray(plan.include) || !plan.include.length)
      throw new Error("[testWoo.compiler] plan.include empty");
    var maxSlots = 40;
    try {
      if (testWoo.cfg && testWoo.cfg.getConfig) {
        var ms = testWoo.cfg.getConfig().search.maxSlots;
        if (ms != null && !isNaN(Number(ms))) maxSlots = Number(ms) || 40;
      }
    } catch (eMs) { maxSlots = 40; }
    var fragCount = _countFragments(plan);
    if (fragCount > maxSlots)
      throw new Error("[testWoo.compiler] too many fragments: " + fragCount + " max=" + maxSlots);

    var grain = plan.grainKey || _inferGrain(plan);
    if (!grain) throw new Error("[testWoo.compiler] grainKey missing");

    if (testWoo.gates && testWoo.gates.checkScopePlan) {
      var scopeErr = testWoo.gates.checkScopePlan(plan);
      if (scopeErr) throw new Error("[testWoo.compiler] SCOPE: " + scopeErr);
    }

    var groupSqls = [];
    var summaryParts = [];
    for (var gi = 0; gi < plan.include.length; gi++) {
      var group = plan.include[gi];
      if (!group || !_isArray(group.any) || !group.any.length)
        throw new Error("[testWoo.compiler] include[" + gi + "].any empty");
      var list = [];
      var labels = [];
      for (var ai = 0; ai < group.any.length; ai++) {
        var built = _buildFragmentSql(group.any[ai], grain);
        list.push(built.sql);
        labels.push(built.label + _paramSuffix(group.any[ai].params));
      }
      groupSqls.push(list);
      summaryParts.push("· [AND] " + (labels.length > 1 ? "(" + labels.join(" OR ") + ")" : labels[0]));
    }

    var excludeSqls = [];
    var excl = plan.exclude || [];
    if (!_isArray(excl)) throw new Error("[testWoo.compiler] plan.exclude must be array");
    for (var ei = 0; ei < excl.length; ei++) {
      var eb = _buildFragmentSql(excl[ei], grain);
      excludeSqls.push(eb.sql);
      summaryParts.push("· [EXCEPT] " + eb.label + _paramSuffix(excl[ei].params));
    }

    var sql = _assemble(groupSqls, excludeSqls, grain);
    return {
      sql: sql,
      keyColumn: grain,
      summary: summaryParts.join("\n"),
      plan: plan
    };
  }

  function _buildFragmentSql(item, grain) {
    if (!item || !item.fragment)
      throw new Error("[testWoo.compiler] fragment name missing");
    var f = testWoo.fragments.getByName(item.fragment);
    if (!f) throw new Error("[testWoo.compiler] fragment missing: " + item.fragment);
    if (!f.sql_text) throw new Error("[testWoo.compiler] sql_text missing: " + item.fragment);
    if (!f.key_column)
      throw new Error("[testWoo.compiler] key_column missing: " + item.fragment);
    if (String(f.status || "") !== "active")
      throw new Error("[testWoo.compiler] fragment not active: " + item.fragment +
        " status=" + (f.status || ""));
    if (f.is_current === false || String(f.is_current) === "false")
      throw new Error("[testWoo.compiler] fragment not current: " + item.fragment);
    if (f.status === "revoked")
      throw new Error("[testWoo.compiler] fragment " + item.fragment + "(v" + f.version +
        ")는 폐기되었습니다. 사유: " + (f.revoked_reason || ""));
    if (f.key_column !== grain)
      throw new Error("[testWoo.compiler] key_column mismatch: " + item.fragment +
        " has " + f.key_column + " want " + grain);
    if (/"/.test(String(f.sql_text)))
      throw new Error("[testWoo.compiler] quoted identifiers forbidden in sql_text: " + item.fragment);
    if (testWoo.gates && testWoo.gates.fragmentSqlContract) {
      var fc = testWoo.gates.fragmentSqlContract(f.sql_text, grain);
      if (!fc.ok)
        throw new Error("[testWoo.compiler] fragment contract: " + fc.reason +
          " name=" + item.fragment);
    } else if (!_sqlHasGrain(f.sql_text, grain)) {
      throw new Error("[testWoo.compiler] grain not in sql_text: " + item.fragment);
    }
    var sql = _substitute(f.sql_text, item.params || {}, f);
    return { sql: sql, label: item.label || f.label || item.fragment };
  }

  // grain 투영 + NULL 차단 (EXCEPT는 NULL을 동일로 취급)
  function _wrapGrain(innerSql, grain) {
    return "SELECT " + grain + " FROM (" + innerSql + ") x WHERE " + grain + " IS NOT NULL";
  }

  // group OR → UNION; groups AND → INTERSECT; exclude 전부 → EXCEPT|MINUS once
  function _assemble(groupSqls, excludeSqls, grain) {
    var dial = _dialect();
    var inc = [];
    for (var i = 0; i < groupSqls.length; i++) {
      var parts = [];
      for (var j = 0; j < groupSqls[i].length; j++) {
        parts.push(_wrapGrain(groupSqls[i][j], grain));
      }
      inc.push("(" + parts.join(" UNION ") + ")");
    }
    var acc = inc.join(" INTERSECT ");
    if (excludeSqls.length) {
      var exParts = [];
      for (var k = 0; k < excludeSqls.length; k++) {
        exParts.push(_wrapGrain(excludeSqls[k], grain));
      }
      acc = "(" + acc + ") " + dial.exceptOp + " (" + exParts.join(" UNION ") + ")";
    }
    return "SELECT " + grain + " FROM (" + acc + ") t";
  }

  // 2. UI chips — Generate/Validate 공통 (클라 복제 금지)
  function chipsFromPlan(plan) {
    var chips = [];
    if (!plan) return chips;
    var inc = plan.include || [];
    for (var i = 0; i < inc.length; i++) {
      var any = (inc[i] && inc[i].any) || [];
      for (var j = 0; j < any.length; j++) {
        chips.push({
          id: "i" + i + "_" + j,
          group: i,
          role: "include",
          label: any[j].label || any[j].fragment,
          fragment: any[j].fragment,
          params: any[j].params || {},
          op: any.length > 1 ? "OR" : "AND"
        });
      }
    }
    var ex = plan.exclude || [];
    for (var k = 0; k < ex.length; k++) {
      chips.push({
        id: "e" + k,
        group: -1,
        role: "exclude",
        label: ex[k].label || ex[k].fragment,
        fragment: ex[k].fragment,
        params: ex[k].params || {},
        op: "EXCEPT"
      });
    }
    return chips;
  }

  function _substitute(sqlText, params, frag) {
    var used = {};
    var out = String(sqlText).replace(/\{\{(\w+)\}\}/g, function (_, key) {
      used[key] = true;
      if (!params.hasOwnProperty(key) || params[key] == null)
        throw new Error("[testWoo.compiler] param missing: " + key);
      var v = params[key];
      if (_isArray(v)) {
        if (!v.length) throw new Error("[testWoo.compiler] empty array param: " + key);
        var buf = [];
        for (var i = 0; i < v.length; i++) buf.push(_lit(v[i]));
        return buf.join(",");
      }
      return _lit(v);
    });
    for (var pk in params) {
      if (!params.hasOwnProperty(pk)) continue;
      if (!used[pk])
        throw new Error("[testWoo.compiler] unused param (fragment mismatch?): " +
          (frag ? frag.name + "." : "") + pk);
    }
    return out;
  }

  function _lit(v) {
    if (v === true) return "1";
    if (v === false) return "0";
    if (v === null || v === undefined)
      throw new Error("[testWoo.compiler] null/undefined literal forbidden");
    if (typeof v === "number") {
      if (isNaN(v)) throw new Error("[testWoo.compiler] NaN literal forbidden");
      return String(v);
    }
    return "'" + String(v).replace(/'/g, "''") + "'";
  }

  function _inferGrain(plan) {
    function fromItem(item) {
      if (!item || !item.fragment) return "";
      var f = testWoo.fragments.getByName(item.fragment);
      return f && f.key_column ? f.key_column : "";
    }
    var inc = plan.include || [];
    for (var i = 0; i < inc.length; i++) {
      var any = (inc[i] && inc[i].any) || [];
      for (var j = 0; j < any.length; j++) {
        var g = fromItem(any[j]);
        if (g) return g;
      }
    }
    var ex = plan.exclude || [];
    for (var k = 0; k < ex.length; k++) {
      var ge = fromItem(ex[k]);
      if (ge) return ge;
    }
    return "";
  }

  function _countFragments(plan) {
    var n = 0;
    var inc = plan.include || [];
    for (var i = 0; i < inc.length; i++) {
      if (inc[i] && _isArray(inc[i].any)) n += inc[i].any.length;
    }
    if (_isArray(plan.exclude)) n += plan.exclude.length;
    return n;
  }

  function _sqlHasGrain(sqlText, grain) {
    var g = String(grain || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!g) return false;
    return new RegExp("\\b" + g + "\\b", "i").test(String(sqlText));
  }

  function _paramSuffix(params) {
    if (!params) return "";
    var kv = [];
    for (var k in params) if (params.hasOwnProperty(k)) kv.push(k + "=" + params[k]);
    return kv.length ? " (" + kv.join(", ") + ")" : "";
  }

  function _isArray(x) {
    return Object.prototype.toString.call(x) === "[object Array]";
  }

  function collectUsedFragments(plan) {
    var out = [];
    var seen = {};
    function add(item) {
      if (!item || !item.fragment || seen[item.fragment]) return;
      seen[item.fragment] = true;
      var f = testWoo.fragments.getByName(item.fragment);
      if (!f) return;
      out.push({ name: f.name, version: f.version || 1, fragmentId: f.id || 0 });
    }
    var inc = plan.include || [];
    for (var i = 0; i < inc.length; i++) {
      var any = (inc[i] && inc[i].any) || [];
      for (var j = 0; j < any.length; j++) add(any[j]);
    }
    var ex = plan.exclude || [];
    for (var k = 0; k < ex.length; k++) add(ex[k]);
    return out;
  }

  return { compile: compile, chipsFromPlan: chipsFromPlan, collectUsedFragments: collectUsedFragments };
})();
testWoo.compiler.__v = "159";
