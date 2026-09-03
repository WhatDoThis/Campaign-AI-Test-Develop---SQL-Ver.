/*
 * testWooProbe.js (읽기 전용 SQL 프로브)
 * ==================================================
 * litmus 동기 __v=161. Env probe.sampleLimit · timeoutMs (_probeTimeoutMs).
 * Foundry·게이트·dedup L3용 SELECT-only 실행. sqlExec 금지.
 * 방언별 LIMIT/TOP/FETCH 래핑은 limitSelect 단일 지점.
 *
 * [Main Functions]
 * ===========
 * - preflight — 'sql' named right 사전 검증
 * - run — SQL+keyColumn → total·distinctKey·nullKey·sample
 * - dialect — 현재 DBMS 방언 객체
 * - dialectFor — dbmsType 인자 방언 객체(스모크용)
 * - staticBlock — SELECT-only 정적 차단
 * - validKeyColumn — keyColumn 식별자 화이트리스트
 *
 * [Dependencies]
 * =========
 * - sqlSelect·sqlGetInt — ACC server('sql' right 필수)
 * - application.getDBMSType — exceptOp·limitSelect 분기
 */
var testWoo = testWoo || {};
testWoo.probe = (function () {
  "use strict";

  function _sampleLimit() {
    try {
      if (testWoo.cfg && testWoo.cfg.getConfig) {
        var n = Number(testWoo.cfg.getConfig().probe.sampleLimit);
        if (!isNaN(n) && n > 0) return n;
      }
    } catch (eC) {}
    try {
      if (testWoo.env && testWoo.env.getEnv) {
        var p = testWoo.env.getEnv().probe;
        if (p && p.sampleLimit) return Number(p.sampleLimit);
      }
    } catch (eE) {}
    return 20;
  }

  function _probeTimeoutMs() {
    try {
      if (testWoo.env && testWoo.env.getEnv) {
        var p = testWoo.env.getEnv().probe;
        if (p && p.timeoutMs) return Number(p.timeoutMs);
      }
    } catch (eT) {}
    return 30000;
  }

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  // DBMS 타입을 인자로 받는 방언 팩토리 (스모크에서 mssql/oracle 시뮬레이션에 사용).
  // Oracle FETCH FIRST / MSSQL TOP 은 ORDER BY 없으면 결과가 비결정적이다.
  // auditSample 은 승인 화면의 근거 자료이므로 재현성이 필수 → 기본 ORDER BY 1.
  function dialectFor(dbmsType) {
    var t = String(dbmsType || "").toLowerCase();
    var isOracle = t.indexOf("oracle") >= 0;
    var isMssql = t.indexOf("mssql") >= 0 || t.indexOf("sqlserver") >= 0;
    var exceptOp = isOracle ? "MINUS" : "EXCEPT";

    // 유일한 limit 래핑 지점. 중첩을 한 겹도 만들지 않는다.
    //   limitSelect(selectList, fromClause, whereSql, n, opts)
    //   opts = { distinct: false, orderBy: "1" }
    // selectList 에 DISTINCT 를 직접 넣지 말 것 — 방언별 위치가 다르다.
    //   T-SQL 은 SELECT [ALL|DISTINCT] [TOP n] select_list 순서이므로
    //   "SELECT TOP n DISTINCT …" 는 구문 오류가 된다.
    // orderBy: null 이면 ORDER BY 를 생략한다(파생 테이블·집합연산 내부 래핑용).
    //   MSSQL 은 파생 테이블/서브쿼리 안의 ORDER BY 를 거부한다.
    function limitSelect(selectList, fromClause, whereSql, n, opts) {
      var lim = Number(n) || _sampleLimit();
      var o = opts || {};
      var dis = o.distinct ? "DISTINCT " : "";
      var ob = (o.orderBy === null) ? "" : String(o.orderBy || "1");

      var head = isMssql ?
        ("SELECT " + dis + "TOP " + lim + " ") :
        ("SELECT " + dis);

      var s = head + selectList + " FROM " + fromClause;
      if (whereSql) s = s + " WHERE " + whereSql;
      if (ob) s = s + " ORDER BY " + ob;
      if (isOracle) s = s + " FETCH FIRST " + lim + " ROWS ONLY";
      else if (!isMssql) s = s + " LIMIT " + lim;
      return s;
    }

    return { type: t, exceptOp: exceptOp, limitSelect: limitSelect };
  }

  // 현재는 nms:default 데이터소스 기준(getDBMSType 인자 생략 시 기본값).
  // FDA 외부 데이터소스 지원 시 dialect(dsName) → application.getDBMSType(dsName) 으로
  // 확장이 필요하다. 지금은 확장하지 않는다.
  //   https://experienceleague.adobe.com/developer/campaign-api/api/m-Application-getDBMSType.html
  function dialect() {
    var t = "";
    try { t = String(application.getDBMSType() || "").toLowerCase(); } catch (e) {}
    return dialectFor(t);
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
      if (elapsed > _probeTimeoutMs())
        return { ok: false, stage: "timeout", error: "probe exceeded " + _probeTimeoutMs() + "ms" };
      return { ok: true, xml: xml };
    } catch (e) {
      var msg = (e && e.message != null) ? String(e.message) : String(e);
      return { ok: false, stage: "sql", error: msg };
    }
  }

  // 현재 접속 DBMS 와 방언 실동 검증 여부. ACC v7 은 PG/Oracle/MSSQL 을 지원하지만
  // 본 시스템은 PostgreSQL 에서만 실동 검증된다 — 나머지는 문자열 정합까지만 맞춘다.
  function _dbmsInfo() {
    var t = "";
    try { t = String(application.getDBMSType() || "").toLowerCase(); } catch (e) { t = ""; }
    return { dbms: t, dialectVerified: (t.indexOf("postgres") >= 0) };
  }

  // 1. 'sql' named right 프리플라이트 — Foundry 배치/큐 처리 진입 시 1회
  function preflight() {
    var info = _dbmsInfo();
    try {
      sqlGetInt("SELECT 1");
    } catch (e) {
      return {
        ok: false,
        code: "NO_SQL_RIGHT",
        message: "Foundry 실행 오퍼레이터에 'sql' named right가 없습니다. " +
          "관리자에게 권한 부여를 요청하세요. (원인: " + String(e.message || e) + ")",
        dbms: info.dbms,
        dialectVerified: info.dialectVerified
      };
    }
    try {
      sqlSelect("row,@x:string", "SELECT 1 AS x");
    } catch (e2) {
      return {
        ok: false,
        code: "NO_SQL_SELECT_RIGHT",
        message: "sqlSelect 실행 권한이 없습니다: " + String(e2.message || e2),
        dbms: info.dbms,
        dialectVerified: info.dialectVerified
      };
    }
    // 분기 존재가 곧 지원 보장으로 오해되는 것을 막는 경고 — 차단하지 않는다.
    if (!info.dialectVerified) {
      logWarning("[testWoo.probe] 검증되지 않은 DBMS: " + info.dbms +
        " — dialect() 분기는 PostgreSQL 에서만 실동 검증됨. " +
        "probe/dedup 생성 SQL 을 직접 확인할 것");
    }
    return { ok: true, dbms: info.dbms, dialectVerified: info.dialectVerified };
  }

  function _safeSqlGetInt(query) {
    var t0 = new Date().getTime();
    try {
      var n = sqlGetInt(String(query));
      var elapsed = new Date().getTime() - t0;
      if (elapsed > _probeTimeoutMs())
        return { ok: false, stage: "timeout", error: "probe count exceeded " + _probeTimeoutMs() + "ms" };
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

    var lim = sampleLimit != null ? Number(sampleLimit) : _sampleLimit();
    if (isNaN(lim) || lim < 1) lim = _sampleLimit();
    if (lim > 100) lim = 100;

    // 샘플: 컬럼 별칭을 tw_key 로 고정해 format 과 1:1 대응시킨다.
    // limitSelect 로 한 겹만 감싼다(기존 limit 이중 래핑 제거 + ORDER BY 1 결정성).
    var dial = dialect();
    var sampleQ = dial.limitSelect(kc + " AS tw_key", "(" + inner + ") tw_sample", "", lim);
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
    dialectFor: dialectFor,
    staticBlock: _staticBlock,
    validKeyColumn: _validKeyColumn
  };
})();
testWoo.probe.__v = "161";
