/*
 * testWooProbe.js (읽기 전용 SQL 프로브 · server-side)
 * ====================================================
 * Foundry/게이트/dedup L3용 SELECT-only 실행. sqlExec 금지.
 *
 * [Main Functions]
 * ===========
 * - preflight() → {ok, code, message} : 오퍼레이터 'sql' named right 사전 검증
 * - run(sql, keyColumn, sampleLimit) → {ok, total, distinctKey, nullKey, sample, error, stage}
 * - dialect() → {type, exceptOp, limit}
 * - staticBlock(sql) → {ok, reason} : SELECT-only 정적 차단(주석 제거 후 금지 구문 검사)
 * - validKeyColumn(name) → boolean : keyColumn 식별자 화이트리스트
 *
 * [Dependencies]
 * =========
 * - sqlSelect / sqlGetInt (ACC server)
 * - application.getDBMSType
 * - loadLibrary("woo:testWooProbe.js")
 * Ref sqlSelect(format, query): 1번째 인자는 라벨이 아니라 결과 XML 스키마
 *   "docName,[fieldXPath:type[:length],]*" 이고 반환은 XML 객체(배열 아님).
 *   https://experienceleague.adobe.com/developer/campaign-api/api/f-sqlSelect.html
 * Ref sqlGetInt / sqlSelect 는 오퍼레이터 'sql' named right 필수 (없으면 예외).
 *   https://experienceleague.adobe.com/developer/campaign-api/api/f-sqlGetInt.html
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

  // format = sqlSelect 1번째 인자 규격("docName,@alias:type") — 라벨 아님.
  // 반환 xml 은 XML 객체이므로 .length / [0] 접근 금지, for each 로 순회한다.
  function _safeSqlSelect(format, query) {
    var t0 = new Date().getTime();
    try {
      var xml = sqlSelect(String(format || "row"), String(query));
      var elapsed = new Date().getTime() - t0;
      if (elapsed > PROBE_TIMEOUT_MS)
        return { ok: false, stage: "timeout", error: "probe exceeded " + PROBE_TIMEOUT_MS + "ms" };
      return { ok: true, xml: xml };
    } catch (e) {
      var msg = (e && e.message != null) ? String(e.message) : String(e);
      return { ok: false, stage: "sql", error: msg };
    }
  }

  // 1. 'sql' named right 프리플라이트 — Foundry 배치/큐 처리 진입 시 1회
  function preflight() {
    try {
      sqlGetInt("SELECT 1");
    } catch (e) {
      return {
        ok: false,
        code: "NO_SQL_RIGHT",
        message: "Foundry 실행 오퍼레이터에 'sql' named right가 없습니다. " +
          "관리자에게 권한 부여를 요청하세요. (원인: " + String(e.message || e) + ")"
      };
    }
    try {
      sqlSelect("row,@x:string", "SELECT 1 AS x");
    } catch (e2) {
      return {
        ok: false,
        code: "NO_SQL_SELECT_RIGHT",
        message: "sqlSelect 실행 권한이 없습니다: " + String(e2.message || e2)
      };
    }
    return { ok: true };
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
    // 존재 검증: 결과를 쓰지 않으므로 format 은 docName 만 (예외 발생 여부만 확인)
    var existsQ = "SELECT * FROM (" + inner + ") tw_probe WHERE 1=0";
    var ex = _safeSqlSelect("row", existsQ);
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

    // 샘플: 컬럼 별칭을 tw_key 로 고정해 format 과 1:1 대응시킨다.
    var dial = dialect();
    var sampleInner = "SELECT " + kc + " AS tw_key FROM (" + inner + ") tw_sample";
    var sampleQ = dial.limit(sampleInner, lim);
    var sampR = _safeSqlSelect("row,@tw_key:string", sampleQ);
    var sample = [];
    if (sampR.ok && sampR.xml) {
      for each (var r in sampR.xml.row) {
        sample.push(String(r.@tw_key));
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

  return {
    preflight: preflight,
    run: run,
    dialect: dialect,
    staticBlock: _staticBlock,
    validKeyColumn: _validKeyColumn
  };
})();
