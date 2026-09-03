/*
 * testWooOperatorPrefs.js (로그인별 Studio/WF 개인 설정 — 스키마 정본)
 * ==================================================
 * woo:testWooAiOperatorPrefs 1행(login UK)에 컬럼으로 저장한다.
 * NL recent는 nl_recent_1..10 고정 슬롯 + nl_recent_at_* 타임스탬프.
 * litmus __v=169 (last_* nav 컬럼 제거 · setBindWkf · bind=최근 WKF 단축).
 *
 * [Main Functions]
 * ===========
 * - setBindPick / getBindPick — 최근 WKF·ai_sql_id (Apply·Studio 단축)
 * - setBindWkf — WKF 선택 시 bind_wkf_name만 갱신(동일 WKF면 sql id 유지)
 * - listRecentNl / pushRecentNl — 이전 질문 10슬롯(컬럼)
 * - peekRowId — login 행 @id 진단
 * - peekFetchSource — 마지막 _resolveRow 경로(queryDef|sql|sqlId)
 * - saveInjectBackup / readInjectBackup — Register inject 롤백 스냅샷
 *
 * [Dependencies]
 * =========
 * - woo:testWooAiOperatorPrefs — 스키마·UK operator_login
 * - testWooCommon.js — twTrim · twBindOperator · currentLogin
 * - legacy Option testWooAiInjectBackup — inject 1회 migrate(readInjectBackup)
 */
(function() {
  if (typeof testWoo === "undefined") {
    testWoo = {};
  }

  var SCHEMA = "woo:testWooAiOperatorPrefs";
  var NL_SLOTS = 10;
  var NL_MAX_LEN = 96;

  testWoo.opPrefs = {
    __v: 169,
    _lastFetchSource: "",

    setBindPick: function(wkfName, aiSqlId) {
      var login = this._login();
      if (!login) {
        return { ok: false, error: "no_login" };
      }
      var patch = {
        bind_wkf_name: twTrim(String(wkfName || "")),
        bind_ai_sql_id: twTrim(String(aiSqlId || ""))
      };
      return this._writeRow(login, patch, {
        bind_wkf_name: patch.bind_wkf_name,
        bind_ai_sql_id: patch.bind_ai_sql_id
      });
    },

    getBindPick: function() {
      var login = this._login();
      if (!login) {
        return null;
      }
      var row = this._resolveRow(login);
      if (!row) {
        return null;
      }
      var wkf = twTrim(String(row.@bind_wkf_name || ""));
      var sqlId = twTrim(String(row.@bind_ai_sql_id || ""));
      if (!wkf && !sqlId) {
        return null;
      }
      return { wkf_name: wkf, ai_sql_id: sqlId };
    },

    setBindWkf: function(wkfName) {
      var login = this._login();
      if (!login) {
        return { ok: false, error: "no_login" };
      }
      var wkf = twTrim(String(wkfName || ""));
      if (!wkf) {
        return { ok: false, error: "no_wkf" };
      }
      var keepSql = "";
      var row = this._resolveRow(login);
      if (row) {
        var prevWkf = twTrim(String(row.@bind_wkf_name || ""));
        if (prevWkf === wkf) {
          keepSql = twTrim(String(row.@bind_ai_sql_id || ""));
        }
      }
      return this.setBindPick(wkf, keepSql);
    },

    listRecentNl: function() {
      var login = this._login();
      if (!login) {
        return [];
      }
      var row = this._resolveRow(login);
      if (!row) {
        return [];
      }
      return this._readRecentFromRow(row);
    },

    peekRowId: function() {
      var login = this._login();
      if (!login) {
        return "";
      }
      var row = this._resolveRow(login);
      if (row && row.@id) {
        return String(row.@id);
      }
      return "";
    },

    peekFetchSource: function() {
      return String(this._lastFetchSource || "");
    },

    pushRecentNl: function(text) {
      var login = this._login();
      var nl = twTrim(String(text || ""));
      if (!login || !nl) {
        return { ok: false, error: "empty" };
      }
      if (nl.length > NL_MAX_LEN) {
        nl = nl.substring(0, NL_MAX_LEN);
      }
      var items = this.listRecentNl();
      var next = [];
      var i;
      var seen = false;
      for (i = 0; i < items.length; i++) {
        if (items[i].text === nl) {
          seen = true;
          continue;
        }
        next.push(items[i]);
      }
      next.unshift({ text: nl, at: this._recentAtNow() });
      if (next.length > NL_SLOTS) {
        next = next.slice(0, NL_SLOTS);
      }
      var patch = this._recentPatchFromItems(next);
      var verify = {};
      if (patch.nl_recent_1) verify.nl_recent_1 = patch.nl_recent_1;
      return this._writeRow(login, patch, verify);
    },

    saveInjectBackup: function(payload) {
      var login = this._login();
      if (!login) {
        return { ok: false, error: "no_login" };
      }
      payload = payload || {};
      return this._writeRow(login, {
        inject_backup_wkf: twTrim(String(payload.workflowName || payload.wkf_name || "")),
        inject_backup_activity: twTrim(String(payload.activityName || payload.activity || "")),
        inject_backup_ai_sql_id: twTrim(String(payload.aiSqlId || payload.ai_sql_id || "")),
        inject_backup_script: String(payload.script || "")
      });
    },

    readInjectBackup: function() {
      var login = this._login();
      if (!login) {
        return null;
      }
      var row = this._resolveRow(login);
      if (!row) {
        return this._migrateLegacyInjectBackup(login);
      }
      var wkf = twTrim(String(row.@inject_backup_wkf || ""));
      var act = twTrim(String(row.@inject_backup_activity || ""));
      var sqlId = twTrim(String(row.@inject_backup_ai_sql_id || ""));
      var script = String(row.inject_backup_script || "");
      if (!wkf && !script) {
        return this._migrateLegacyInjectBackup(login);
      }
      return {
        workflowName: wkf,
        activityName: act,
        aiSqlId: sqlId,
        script: script
      };
    },

    _login: function() {
      try {
        if (typeof twBindOperator === "function") {
          return twTrim(String(twBindOperator() || ""));
        }
      } catch (eBind) {
        try {
          logWarning("[testWoo.opPrefs] twBindOperator: " +
            String(eBind.message || eBind));
        } catch (eL) { /* non-ACC */ }
      }
      try {
        if (typeof currentLogin === "function") {
          return twTrim(String(currentLogin() || ""));
        }
      } catch (eCur) { /* skip */ }
      try {
        return twTrim(String(application.operator.login || ""));
      } catch (eLogin) {
        return "";
      }
    },

    _nowStr: function() {
      return formatDate(new Date(), "%4Y/%2M/%2D %02H:%02N:%02S");
    },

    _recentAtNow: function() {
      return Math.floor((new Date()).getTime() / 1000);
    },

    _isDupLoginErr: function(msg) {
      var s = String(msg || "").toLowerCase();
      return s.indexOf("duplicate key") >= 0 ||
        s.indexOf("idx_operator_login") >= 0 ||
        s.indexOf("soperator_login") >= 0;
    },

    _allocId: function() {
      try {
        var idList = xtk.session.GetNewIds(1);
        var id = parseInt(String(idList).split(",")[0], 10);
        if (id && !isNaN(id)) return id;
      } catch (eId) {
        try {
          logWarning("[testWoo.opPrefs] GetNewIds: " + String(eId.message || eId));
        } catch (eL) { /* non-ACC */ }
      }
      return 0;
    },

    _verifyRow: function(row, verify) {
      if (!row || !row.@id) return "verify_no_row";
      if (!verify) return "";
      var k;
      for (k in verify) {
        if (!verify.hasOwnProperty(k)) continue;
        var want = String(verify[k] == null ? "" : verify[k]);
        var got = "";
        if (k === "inject_backup_script") {
          got = String(row.inject_backup_script || "");
        } else {
          got = String(row.@[k] || "");
        }
        if (got !== want) return "verify_mismatch:" + k;
      }
      return "";
    },

    _fetchSelectNodes: function() {
      return <select>
        <node expr="@id"/>
        <node expr="@operator_login"/>
        <node expr="@bind_wkf_name"/>
        <node expr="@bind_ai_sql_id"/>
        <node expr="@nl_recent_1"/><node expr="@nl_recent_at_1"/>
        <node expr="@nl_recent_2"/><node expr="@nl_recent_at_2"/>
        <node expr="@nl_recent_3"/><node expr="@nl_recent_at_3"/>
        <node expr="@nl_recent_4"/><node expr="@nl_recent_at_4"/>
        <node expr="@nl_recent_5"/><node expr="@nl_recent_at_5"/>
        <node expr="@nl_recent_6"/><node expr="@nl_recent_at_6"/>
        <node expr="@nl_recent_7"/><node expr="@nl_recent_at_7"/>
        <node expr="@nl_recent_8"/><node expr="@nl_recent_at_8"/>
        <node expr="@nl_recent_9"/><node expr="@nl_recent_at_9"/>
        <node expr="@nl_recent_10"/><node expr="@nl_recent_at_10"/>
        <node expr="@inject_backup_wkf"/>
        <node expr="@inject_backup_activity"/>
        <node expr="@inject_backup_ai_sql_id"/>
        <node expr="inject_backup_script"/>
      </select>;
    },

    _rowFromQueryRes: function(res) {
      var row;
      if (!res) {
        return null;
      }
      if (String(res.@id || "") !== "") {
        return res;
      }
      try {
        for each (row in res.testWooAiOperatorPrefs) {
          if (String(row.@id || "") !== "") {
            return row;
          }
        }
      } catch (eEach) { /* select collection */ }
      try {
        var kids = res.testWooAiOperatorPrefs;
        if (kids) {
          if (typeof kids.length === "function") {
            if (kids.length() > 0 && String(kids[0].@id || "") !== "") {
              return kids[0];
            }
          } else if (String(kids.@id || "") !== "") {
            return kids;
          }
        }
      } catch (eKids) { /* single child */ }
      return null;
    },

    _fetchRowIdBySql: function(login) {
      try {
        var esc = this._sqlEsc(login);
        var sql =
          "SELECT iTestWooAiOperatorPrefsId AS id FROM testWooAiOperatorPrefs " +
          "WHERE sOperator_login='" + esc + "'";
        var xml = sqlSelect("row,@id:long", sql);
        var row;
        for each (row in xml.row) {
          var id = parseInt(String(row.@id || "0"), 10);
          if (id > 0) {
            return id;
          }
        }
      } catch (eSql) {
        try {
          logWarning("[testWoo.opPrefs] sql id lookup failed login=" + login +
            " err=" + String(eSql.message || eSql));
        } catch (eL) { /* non-ACC */ }
      }
      return 0;
    },

    _sqlSelectFmt: function() {
      return "row,@id:long,@operator_login:string,@bind_wkf_name:string,@bind_ai_sql_id:string," +
        "@nl_recent_1:string,@nl_recent_at_1:long,@nl_recent_2:string,@nl_recent_at_2:long," +
        "@nl_recent_3:string,@nl_recent_at_3:long,@nl_recent_4:string,@nl_recent_at_4:long," +
        "@nl_recent_5:string,@nl_recent_at_5:long,@nl_recent_6:string,@nl_recent_at_6:long," +
        "@nl_recent_7:string,@nl_recent_at_7:long,@nl_recent_8:string,@nl_recent_at_8:long," +
        "@nl_recent_9:string,@nl_recent_at_9:long,@nl_recent_10:string,@nl_recent_at_10:long," +
        "@inject_backup_wkf:string,@inject_backup_activity:string,@inject_backup_ai_sql_id:string";
    },

    _sqlSelectCols: function() {
      return "iTestWooAiOperatorPrefsId AS id, sOperator_login AS operator_login, " +
        "sBind_wkf_name AS bind_wkf_name, sBind_ai_sql_id AS bind_ai_sql_id, " +
        "sNl_recent_1 AS nl_recent_1, iNl_recent_at_1 AS nl_recent_at_1, " +
        "sNl_recent_2 AS nl_recent_2, iNl_recent_at_2 AS nl_recent_at_2, " +
        "sNl_recent_3 AS nl_recent_3, iNl_recent_at_3 AS nl_recent_at_3, " +
        "sNl_recent_4 AS nl_recent_4, iNl_recent_at_4 AS nl_recent_at_4, " +
        "sNl_recent_5 AS nl_recent_5, iNl_recent_at_5 AS nl_recent_at_5, " +
        "sNl_recent_6 AS nl_recent_6, iNl_recent_at_6 AS nl_recent_at_6, " +
        "sNl_recent_7 AS nl_recent_7, iNl_recent_at_7 AS nl_recent_at_7, " +
        "sNl_recent_8 AS nl_recent_8, iNl_recent_at_8 AS nl_recent_at_8, " +
        "sNl_recent_9 AS nl_recent_9, iNl_recent_at_9 AS nl_recent_at_9, " +
        "sNl_recent_10 AS nl_recent_10, iNl_recent_at_10 AS nl_recent_at_10, " +
        "sInject_backup_wkf AS inject_backup_wkf, " +
        "sInject_backup_activity AS inject_backup_activity, " +
        "sInject_backup_ai_sql_id AS inject_backup_ai_sql_id";
    },

    _rowFromSql: function(r) {
      if (!r || String(r.@id || "") === "") {
        return null;
      }
      var row = <testWooAiOperatorPrefs/>;
      row.@id = String(r.@id || "");
      row.@operator_login = String(r.@operator_login || "");
      row.@bind_wkf_name = String(r.@bind_wkf_name || "");
      row.@bind_ai_sql_id = String(r.@bind_ai_sql_id || "");
      row.@nl_recent_1 = String(r.@nl_recent_1 || "");
      row.@nl_recent_at_1 = String(r.@nl_recent_at_1 || "");
      row.@nl_recent_2 = String(r.@nl_recent_2 || "");
      row.@nl_recent_at_2 = String(r.@nl_recent_at_2 || "");
      row.@nl_recent_3 = String(r.@nl_recent_3 || "");
      row.@nl_recent_at_3 = String(r.@nl_recent_at_3 || "");
      row.@nl_recent_4 = String(r.@nl_recent_4 || "");
      row.@nl_recent_at_4 = String(r.@nl_recent_at_4 || "");
      row.@nl_recent_5 = String(r.@nl_recent_5 || "");
      row.@nl_recent_at_5 = String(r.@nl_recent_at_5 || "");
      row.@nl_recent_6 = String(r.@nl_recent_6 || "");
      row.@nl_recent_at_6 = String(r.@nl_recent_at_6 || "");
      row.@nl_recent_7 = String(r.@nl_recent_7 || "");
      row.@nl_recent_at_7 = String(r.@nl_recent_at_7 || "");
      row.@nl_recent_8 = String(r.@nl_recent_8 || "");
      row.@nl_recent_at_8 = String(r.@nl_recent_at_8 || "");
      row.@nl_recent_9 = String(r.@nl_recent_9 || "");
      row.@nl_recent_at_9 = String(r.@nl_recent_at_9 || "");
      row.@nl_recent_10 = String(r.@nl_recent_10 || "");
      row.@nl_recent_at_10 = String(r.@nl_recent_at_10 || "");
      row.@inject_backup_wkf = String(r.@inject_backup_wkf || "");
      row.@inject_backup_activity = String(r.@inject_backup_activity || "");
      row.@inject_backup_ai_sql_id = String(r.@inject_backup_ai_sql_id || "");
      return row;
    },

    _fetchRowBySql: function(login) {
      if (!login) {
        return null;
      }
      try {
        var esc = this._sqlEsc(login);
        var sql = "SELECT " + this._sqlSelectCols() +
          " FROM testWooAiOperatorPrefs WHERE sOperator_login='" + esc + "'";
        var xml = sqlSelect(this._sqlSelectFmt(), sql);
        var r;
        for each (r in xml.row) {
          return this._rowFromSql(r);
        }
      } catch (eSql) {
        try {
          logWarning("[testWoo.opPrefs] sql row fetch failed login=" + login +
            " err=" + String(eSql.message || eSql));
        } catch (eL) { /* non-ACC */ }
      }
      return null;
    },

    _fetchRowByIdSql: function(rowId) {
      var id = parseInt(String(rowId || "0"), 10);
      if (!id || isNaN(id)) {
        return null;
      }
      try {
        var sql = "SELECT " + this._sqlSelectCols() +
          " FROM testWooAiOperatorPrefs WHERE iTestWooAiOperatorPrefsId=" + id;
        var xml = sqlSelect(this._sqlSelectFmt(), sql);
        var r;
        for each (r in xml.row) {
          return this._rowFromSql(r);
        }
      } catch (eSql) {
        try {
          logWarning("[testWoo.opPrefs] sql row by id failed id=" + id +
            " err=" + String(eSql.message || eSql));
        } catch (eL) { /* non-ACC */ }
      }
      return null;
    },

    _resolveRow: function(login) {
      this._lastFetchSource = "";
      if (!login) {
        return null;
      }
      var row = this._fetchRowQueryDef(login);
      if (row) {
        this._lastFetchSource = "queryDef";
        return row;
      }
      row = this._fetchRowBySql(login);
      if (row) {
        this._lastFetchSource = "sql";
        return row;
      }
      var sqlId = this._fetchRowIdBySql(login);
      if (sqlId) {
        row = this._fetchRowByIdSql(sqlId);
        if (row) {
          this._lastFetchSource = "sqlId";
          return row;
        }
      }
      return null;
    },

    _fetchRowById: function(rowId) {
      var id = parseInt(String(rowId || "0"), 10);
      if (!id || isNaN(id)) {
        return null;
      }
      try {
        var selNodes = this._fetchSelectNodes();
        var q = xtk.queryDef.create(
          <queryDef schema={SCHEMA} operation="getIfExists">
            {selNodes}
            <where>
              <condition expr={"@id = " + id}/>
            </where>
          </queryDef>
        );
        var res = q.ExecuteQuery();
        var row = this._rowFromQueryRes(res);
        if (row) {
          return row;
        }
        if (res && String(res.@id || "") !== "") {
          return res;
        }
      } catch (eId) {
        try {
          logWarning("[testWoo.opPrefs] fetchById failed id=" + id +
            " err=" + String(eId.message || eId));
        } catch (eL) { /* non-ACC */ }
      }
      return this._fetchRowByIdSql(id);
    },

    _fetchRowQueryDef: function(login) {
      if (!login) {
        return null;
      }
      var esc = this._sqlEsc(login);
      var whereExpr = "@operator_login = '" + esc + "'";
      var selNodes = this._fetchSelectNodes();
      var row = null;
      try {
        var q = xtk.queryDef.create(
          <queryDef schema={SCHEMA} operation="select" lineCount="1">
            {selNodes}
            <where>
              <condition expr={whereExpr}/>
            </where>
          </queryDef>
        );
        var res = q.ExecuteQuery();
        var row = this._rowFromQueryRes(res);
        if (row) {
          return row;
        }
      } catch (eSel) {
        try {
          logWarning("[testWoo.opPrefs] select fetch failed login=" + login +
            " err=" + String(eSel.message || eSel));
        } catch (eL) { /* non-ACC */ }
      }
      try {
        var q2 = xtk.queryDef.create(
          <queryDef schema={SCHEMA} operation="getIfExists">
            {selNodes}
            <where>
              <condition expr={whereExpr}/>
            </where>
          </queryDef>
        );
        var res2 = q2.ExecuteQuery();
        row = this._rowFromQueryRes(res2);
        if (row) {
          return row;
        }
        if (res2 && String(res2.@id || "") !== "") {
          return res2;
        }
      } catch (eGet) {
        try {
          logWarning("[testWoo.opPrefs] getIfExists fetch failed login=" + login +
            " err=" + String(eGet.message || eGet));
        } catch (eL2) { /* non-ACC */ }
      }
      return null;
    },

    _fetchRow: function(login) {
      return this._resolveRow(login);
    },

    _writeRowDoc: function(login, patch, existing) {
      var doc;
      var op = "update";
      if (existing && existing.@id) {
        doc = <testWooAiOperatorPrefs _operation="update" xtkschema={SCHEMA}
              id={String(existing.@id)}/>;
        doc.@operator_login = login;
      } else {
        op = "insert";
        doc = <testWooAiOperatorPrefs _operation="insert" xtkschema={SCHEMA}/>;
        doc.@operator_login = login;
        var newId = this._allocId();
        if (newId) doc.@id = newId;
      }
      this._applyPatch(doc, patch);
      doc.@modified_at = this._nowStr();
      xtk.session.Write(doc);
      return op;
    },

    _writeRow: function(login, patch, verify) {
      patch = patch || {};
      try {
        var existing = this._resolveRow(login);
        var op = this._writeRowDoc(login, patch, existing);
        var row = this._resolveRow(login);
        var vErr = this._verifyRow(row, verify);
        if (vErr) {
          try {
            logWarning("[testWoo.opPrefs] " + vErr + " login=" + login +
              " op=" + op);
          } catch (eV) { /* non-ACC */ }
          return { ok: false, error: vErr };
        }
        try {
          logInfo("[testWoo.opPrefs] write ok login=" + login + " op=" + op +
            " id=" + String(row && row.@id ? row.@id : ""));
        } catch (eOk) { /* non-ACC */ }
        return { ok: true, id: row && row.@id ? String(row.@id) : "" };
      } catch (eWrite) {
        var errMsg = String(eWrite.message || eWrite);
        if (this._isDupLoginErr(errMsg)) {
          try {
            var existing2 = this._resolveRow(login);
            if (!existing2 || !existing2.@id) {
              var sqlId = this._fetchRowIdBySql(login);
              if (sqlId) {
                existing2 = this._fetchRowByIdSql(sqlId);
                if (!existing2 || !existing2.@id) {
                  existing2 = <testWooAiOperatorPrefs/>;
                  existing2.@id = sqlId;
                }
              }
            }
            if (existing2 && existing2.@id) {
              var op2 = this._writeRowDoc(login, patch, existing2);
              var row2 = this._resolveRow(login);
              var vErr2 = this._verifyRow(row2, verify);
              if (vErr2) {
                return { ok: false, error: vErr2 };
              }
              try {
                logInfo("[testWoo.opPrefs] write ok(retry) login=" + login +
                  " op=" + op2 + " id=" + String(row2 && row2.@id ? row2.@id : ""));
              } catch (eOk2) { /* non-ACC */ }
              return { ok: true, id: row2 && row2.@id ? String(row2.@id) : "" };
            }
          } catch (eRetry) {
            errMsg = String(eRetry.message || eRetry);
          }
        }
        logWarning("[testWoo.opPrefs] write failed login=" + login + " err=" + errMsg);
        return { ok: false, error: errMsg };
      }
    },

    _applyPatch: function(doc, patch) {
      var k;
      for (k in patch) {
        if (!patch.hasOwnProperty(k)) {
          continue;
        }
        if (k === "inject_backup_script") {
          doc.inject_backup_script = String(patch[k] || "");
        } else {
          doc.@[k] = patch[k];
        }
      }
    },

    _readRecentFromRow: function(row) {
      var items = [];
      var i;
      var text;
      var at;
      for (i = 1; i <= NL_SLOTS; i++) {
        text = this._slotText(row, i);
        if (!text) {
          continue;
        }
        at = this._slotAt(row, i);
        items.push({ text: text, at: at, slot: i });
      }
      return items;
    },

    _slotText: function(row, i) {
      if (!row) return "";
      if (i === 1) return twTrim(String(row.@nl_recent_1 || ""));
      if (i === 2) return twTrim(String(row.@nl_recent_2 || ""));
      if (i === 3) return twTrim(String(row.@nl_recent_3 || ""));
      if (i === 4) return twTrim(String(row.@nl_recent_4 || ""));
      if (i === 5) return twTrim(String(row.@nl_recent_5 || ""));
      if (i === 6) return twTrim(String(row.@nl_recent_6 || ""));
      if (i === 7) return twTrim(String(row.@nl_recent_7 || ""));
      if (i === 8) return twTrim(String(row.@nl_recent_8 || ""));
      if (i === 9) return twTrim(String(row.@nl_recent_9 || ""));
      if (i === 10) return twTrim(String(row.@nl_recent_10 || ""));
      return "";
    },

    _slotAt: function(row, i) {
      var at = 0;
      if (!row) return 0;
      if (i === 1) at = parseInt(String(row.@nl_recent_at_1 || "0"), 10);
      else if (i === 2) at = parseInt(String(row.@nl_recent_at_2 || "0"), 10);
      else if (i === 3) at = parseInt(String(row.@nl_recent_at_3 || "0"), 10);
      else if (i === 4) at = parseInt(String(row.@nl_recent_at_4 || "0"), 10);
      else if (i === 5) at = parseInt(String(row.@nl_recent_at_5 || "0"), 10);
      else if (i === 6) at = parseInt(String(row.@nl_recent_at_6 || "0"), 10);
      else if (i === 7) at = parseInt(String(row.@nl_recent_at_7 || "0"), 10);
      else if (i === 8) at = parseInt(String(row.@nl_recent_at_8 || "0"), 10);
      else if (i === 9) at = parseInt(String(row.@nl_recent_at_9 || "0"), 10);
      else if (i === 10) at = parseInt(String(row.@nl_recent_at_10 || "0"), 10);
      if (isNaN(at) || at <= 0) return 0;
      return at;
    },

    _recentPatchFromItems: function(items) {
      var patch = {};
      var i;
      var slot;
      for (i = 1; i <= NL_SLOTS; i++) {
        patch["nl_recent_" + i] = "";
      }
      for (i = 0; i < items.length && i < NL_SLOTS; i++) {
        slot = i + 1;
        patch["nl_recent_" + slot] = twTrim(String(items[i].text || ""));
        var at = parseInt(String(items[i].at || "0"), 10) || 0;
        if (at > 0) patch["nl_recent_at_" + slot] = at;
      }
      return patch;
    },

    _migrateLegacyInjectBackup: function(login) {
      var raw = "";
      try {
        raw = String(getOption("testWooAiInjectBackup") || "");
      } catch (eOpt) {
        return null;
      }
      if (!raw) {
        return null;
      }
      var snap = this._parseInjectBackupRaw(raw);
      if (!snap) {
        return null;
      }
      this.saveInjectBackup(snap);
      return snap;
    },

    _parseJson: function(raw, fallback) {
      try {
        return JSON.parse(String(raw || ""));
      } catch (eJson) {
        return fallback;
      }
    },

    _parseInjectBackupRaw: function(raw) {
      raw = String(raw || "");
      if (!raw) {
        return null;
      }
      if (raw.charAt(0) === "{") {
        var parsed = this._parseJson(raw, null);
        if (!parsed) {
          return null;
        }
        return {
          workflowName: twTrim(String(parsed.workflowName || "")),
          activityName: twTrim(String(parsed.activityName || "")),
          aiSqlId: twTrim(String(parsed.aiSqlId || "")),
          script: String(parsed.script || "")
        };
      }
      var p1 = raw.indexOf("\t");
      if (p1 < 0) {
        return null;
      }
      var p2 = raw.indexOf("\t", p1 + 1);
      if (p2 < 0) {
        return null;
      }
      var p3 = raw.indexOf("\t", p2 + 1);
      if (p3 < 0) {
        return null;
      }
      return {
        workflowName: raw.substring(0, p1),
        activityName: raw.substring(p1 + 1, p2),
        aiSqlId: raw.substring(p2 + 1, p3),
        script: raw.substring(p3 + 1)
      };
    },

    _sqlEsc: function(s) {
      return String(s || "").replace(/'/g, "''");
    }
  };
})();
