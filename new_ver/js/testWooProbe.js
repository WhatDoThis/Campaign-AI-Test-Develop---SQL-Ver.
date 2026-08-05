/*
 * testWooProbe.js (읽기 전용 SQL 프로브 · server-side)
 * ====================================================
 * Foundry/게이트/dedup L3용 SELECT-only 실행. sqlExec 금지.
 *
 * [Main Functions]
 * ===========
 * - run(sql, keyColumn, sampleLimit) → {ok, total, distinctKey, nullKey, sample, error, stage}
 * - dialect() → {type, exceptOp, limit}
 *
 * [Dependencies]
 * =========
 * - sqlSelect / sqlGetInt (ACC server)
 * - application.getDBMSType
 * - loadLibrary("woo:testWooProbe.js")
 */
var testWoo = testWoo || {};
testWoo.probe = (function () {
  "use strict";

  var PROBE_TIMEOUT_MS = 30000;
  var DEFAULT_SAMPLE = 20;

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  function dialect() {
    var t = "";
    try { t = String(application.getDBMSType() || "").toLowerCase(); } catch (e) {}
    var exceptOp = (t.indexOf("oracle") >= 0) ? "MINUS" : "EXCEPT";
    return {
      type: t,
      exceptOp: exceptOp,
      limit: function (sql, n) {
        var lim = Number(n) || DEFAULT_SAMPLE;
        if (t.indexOf("oracle") >= 0)
          return "SELECT * FROM (" + sql + ") tw_lim FETCH FIRST " + lim + " ROWS ONLY";
        if (t.indexOf("mssql") >= 0 || t.indexOf("sqlserver") >= 0)
          return "SELECT TOP " + lim + " * FROM (" + sql + ") tw_lim";
        return "SELECT * FROM (" + sql + ") tw_lim LIMIT " + lim;
      }
    };
  }

  function _stripComments(sql) {
    var s = String(sql || "");
    s = s.replace(/\/\*[\s\S]*?\*\//g, " ");
    s = s.replace(/--[^\n\r]*/g, " ");
    return s;
  }

  function _staticBlock(sql) {
    var s = _trim(_stripComments(sql));
    if (!/^\s*select\b/i.test(s))
      return { ok: false, reason: "not a SELECT statement" };
    if (s.indexOf(";") >= 0)
      return { ok: false, reason: "semicolon forbidden" };
    if (/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|merge|call|execute|do|copy|into)\b/i.test(s))
      return { ok: false, reason: "forbidden keyword detected" };
    return { ok: true, cleaned: s };
  }

  function _validKeyColumn(keyColumn) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(keyColumn || ""));
  }

  function _safeSqlSelect(label, query) {
    var t0 = new Date().getTime();
    try {
      var rows = sqlSelect(String(label || "probe"), String(query));
      var elapsed = new Date().getTime() - t0;
      if (elapsed > PROBE_TIMEOUT_MS)
        return { ok: false, stage: "timeout", error: "probe exceeded " + PROBE_TIMEOUT_MS + "ms" };
      return { ok: true, rows: rows };
    } catch (e) {
      var msg = (e && e.message != null) ? String(e.message) : String(e);
      return { ok: false, stage: "sql", error: msg };
    }
  }

  function _safeSqlGetInt(query) {
    var t0 = new Date().getTime();
    try {
      var n = sqlGetInt(String(query));
      var elapsed = new Date().getTime() - t0;
      if (elapsed > PROBE_TIMEOUT_MS)
        return { ok: false, stage: "timeout", error: "probe count exceeded " + PROBE_TIMEOUT_MS + "ms" };
      return { ok: true, value: Number(n) };
    } catch (e) {
      var msg = (e && e.message != null) ? String(e.message) : String(e);
      return { ok: false, stage: "sql", error: msg };
    }
  }

  function run(sql, keyColumn, sampleLimit) {
    var blk = _staticBlock(sql);
    if (!blk.ok) return { ok: false, stage: "static", error: blk.reason };

    var kc = String(keyColumn || "");
    if (!_validKeyColumn(kc))
      return { ok: false, stage: "static", error: "invalid keyColumn identifier" };

    var inner = blk.cleaned;
    var existsQ = "SELECT * FROM (" + inner + ") tw_probe WHERE 1=0";
    var ex = _safeSqlSelect("probe_exists", existsQ);
    if (!ex.ok) return { ok: false, stage: ex.stage || "exists", error: ex.error };

    var totalR = _safeSqlGetInt("SELECT COUNT(*) FROM (" + inner + ") tw_cnt");
    if (!totalR.ok) return { ok: false, stage: totalR.stage || "count", error: totalR.error };
    var total = totalR.value;

    var distR = _safeSqlGetInt(
      "SELECT COUNT(DISTINCT " + kc + ") FROM (" + inner + ") tw_dist");
    if (!distR.ok) return { ok: false, stage: distR.stage || "distinct", error: distR.error };

    var nullR = _safeSqlGetInt(
      "SELECT COUNT(*) FROM (" + inner + ") tw_null WHERE " + kc + " IS NULL");
    if (!nullR.ok) return { ok: false, stage: nullR.stage || "nullkey", error: nullR.error };

    var lim = sampleLimit != null ? Number(sampleLimit) : DEFAULT_SAMPLE;
    if (isNaN(lim) || lim < 1) lim = DEFAULT_SAMPLE;
    if (lim > 100) lim = 100;

    var dial = dialect();
    var sampleQ = dial.limit("SELECT " + kc + " FROM (" + inner + ") tw_sample", lim);
    var sampR = _safeSqlSelect("probe_sample", sampleQ);
    var sample = [];
    if (sampR.ok && sampR.rows) {
      for (var i = 0; i < sampR.rows.length; i++) {
        var row = sampR.rows[i];
        if (row && row.length) sample.push(row[0]);
        else if (row && row[kc] != null) sample.push(row[kc]);
      }
    }

    return {
      ok: true,
      total: total,
      distinctKey: distR.value,
      nullKey: nullR.value,
      sample: sample,
      error: null,
      stage: "done"
    };
  }

  return { run: run, dialect: dialect, staticBlock: _staticBlock, validKeyColumn: _validKeyColumn };
})();
