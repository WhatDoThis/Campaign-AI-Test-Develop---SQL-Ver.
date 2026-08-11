/*
 * testWooLifecycle.js (fragment 생애주기 · server-side)
 * =======================================================
 * contentHash, 버전 발행, revoke, hardDelete, impact 조회.
 * publish는 dedup 판정(dedup_verdict/dedup_match_id/dedup_diff_count)도 함께 기록한다.
 * 4차: Foundry가 status=active·active=true·approved_by=foundry 로 넘기면 그대로 저장.
 *      fragDoc.status 없으면 기본 active (구 verified 기본값에서 변경).
 * 5차: sqlContentHash — 정규화 SQL만 해시(Register 중복 스킵 J-9-3-4).
 *
 * [Main Functions]
 * ===========
 * - normalizeSql / contentHash / sqlContentHash / nextVersion
 * - publish / revoke / hardDelete / listImpact / compileHash
 *
 * [Dependencies]
 * =========
 * - xtk.session.Write
 * - Schema: woo:testWooAiFragment, woo:testWooAiSql
 * - loadLibrary("woo:testWooLifecycle.js")
 */
var testWoo = testWoo || {};
testWoo.lifecycle = (function () {
  "use strict";

  var FRAG_SCHEMA = "woo:testWooAiFragment";
  var SQL_SCHEMA = "woo:testWooAiSql";

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  function nowStr() {
    return formatDate(new Date(), "%4Y/%2M/%2D %02H:%02N:%02S");
  }

  function normalizeSql(sql) {
    var s = String(sql || "").toLowerCase();
    s = s.replace(/\/\*[\s\S]*?\*\//g, " ");
    s = s.replace(/--[^\n\r]*/g, " ");
    s = s.replace(/\s+/g, " ");
    s = s.replace(/;\s*$/, "");
    return _trim(s);
  }

  function _djb2(str) {
    var h = 5381;
    var s = String(str || "");
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) + h) + s.charCodeAt(i);
      h = h & 0x7fffffff;
    }
    return ("00000000" + h.toString(16)).slice(-16);
  }

  function contentHash(sqlText, keyColumn, scopeKey) {
    var norm = normalizeSql(sqlText) + "|" +
      String(keyColumn || "") + "|" +
      String(scopeKey || "");
    return _djb2(norm);
  }

  function nextVersion(name) {
    if (!name) throw new Error("[testWoo.lifecycle.nextVersion] name missing");
    var esc = String(name).replace(/'/g, "''");
    try {
      var q = xtk.queryDef.create(
        <queryDef schema={FRAG_SCHEMA} operation="select" lineCount="1">
          <select><node expr="@version"/></select>
          <where><condition expr={"@name = '" + esc + "'"}/></where>
          <orderBy><node expr="@version" sortDesc="true"/></orderBy>
        </queryDef>);
      var res = q.ExecuteQuery();
      for each (var r in res.testWooAiFragment) {
        var v = parseInt(String(r.@version), 10);
        return (isNaN(v) ? 0 : v) + 1;
      }
      return 1;
    } catch (e) {
      throw new Error("[testWoo.lifecycle.nextVersion] query failed: " + e.message);
    }
  }

  function _getFragmentById(id) {
    var q = xtk.queryDef.create(
      <queryDef schema={FRAG_SCHEMA} operation="getIfExists">
        <select>
          <node expr="@id"/><node expr="@name"/><node expr="@version"/><node expr="@status"/>
          <node expr="@is_current"/><node expr="@usage_count"/>
        </select>
        <where><condition expr={"@id = " + Number(id)}/></where>
      </queryDef>);
    var res = q.ExecuteQuery();
    // getIfExists 는 엘리먼트 자체를 반환한다(무매치는 빈 엘리먼트). 컬렉션 접근 금지.
    if (!res || String(res.@id || "") === "") return null;
    var r = res;
    return {
      id: Number(r.@id),
      name: String(r.@name),
      version: Number(r.@version),
      status: String(r.@status),
      is_current: String(r.@is_current) === "true" || r.@is_current === true,
      usage_count: Number(r.@usage_count) || 0
    };
  }

  function publish(fragDoc) {
    if (!fragDoc || !fragDoc.name)
      throw new Error("[testWoo.lifecycle.publish] fragDoc.name missing");
    var name = String(fragDoc.name);
    var ver = fragDoc.version != null ? Number(fragDoc.version) : nextVersion(name);
    var hash = contentHash(fragDoc.sql_text, fragDoc.key_column, fragDoc.scope_key);
    var esc = name.replace(/'/g, "''");

    var prevQ = xtk.queryDef.create(
      <queryDef schema={FRAG_SCHEMA} operation="select" lineCount="10">
        <select><node expr="@id"/></select>
        <where>
          <condition expr={"@name = '" + esc + "'"}/>
          <condition expr="@is_current = 1"/>
        </where>
      </queryDef>);
    var prevRes = prevQ.ExecuteQuery();
    for each (var pr in prevRes.testWooAiFragment) {
      var upd = <testWooAiFragment xtkschema={FRAG_SCHEMA} _operation="update"/>;
      upd.@id = Number(pr.@id);
      upd.@is_current = false;
      upd.@status = "deprecated";
      upd.@active = false;
      xtk.session.Write(upd);
    }

    var idList = xtk.session.GetNewIds(1);
    var newId = parseInt(String(idList).split(",")[0], 10);
    var doc = <testWooAiFragment xtkschema={FRAG_SCHEMA} _operation="insert"/>;
    doc.@id = newId;
    doc.@name = name;
    doc.@version = ver;
    doc.@is_current = true;
    doc.@content_hash = hash;
    doc.@label = fragDoc.label || name;
    doc.@category = fragDoc.category || "other";
    doc.@tags = fragDoc.tags || "";
    doc.@synonyms = fragDoc.synonyms || "";
    doc.@key_column = fragDoc.key_column || "";
    doc.@scope_key = fragDoc.scope_key || "";
    doc.@sql_text = fragDoc.sql_text || "";
    doc.@params = fragDoc.params || "";
    doc.@param_domain = fragDoc.param_domain || "";
    doc.@description = fragDoc.description || "";
    doc.@sample_questions = fragDoc.sample_questions || "";
    doc.@status = fragDoc.status || "active";
    doc.@active = fragDoc.active === true || fragDoc.status === "active";
    if (fragDoc.approved_by) {
      doc.@approved_by = String(fragDoc.approved_by);
      doc.@approved_at = nowStr();
    }
    doc.@origin = fragDoc.origin || "manual";
    doc.@source_request_id = fragDoc.source_request_id || 0;
    doc.@gate_report = fragDoc.gate_report || "";
    doc.@audit_sample = fragDoc.audit_sample || "";
    doc.@usage_count = 0;
    doc.@dedup_verdict = fragDoc.dedup_verdict || "novel";
    doc.@dedup_match_id = fragDoc.dedup_match_id != null ? Number(fragDoc.dedup_match_id) : 0;
    doc.@dedup_diff_count = fragDoc.dedup_diff_count != null ?
      Number(fragDoc.dedup_diff_count) : -1;
    if (fragDoc.supersedes_id) doc.@supersedes_id = fragDoc.supersedes_id;
    xtk.session.Write(doc);
    if (testWoo.fragments && testWoo.fragments.clearCache) testWoo.fragments.clearCache();
    return newId;
  }

  function revoke(fragmentId, reason, operator) {
    var f = _getFragmentById(fragmentId);
    if (!f) throw new Error("[testWoo.lifecycle.revoke] fragment not found: " + fragmentId);
    var doc = <testWooAiFragment xtkschema={FRAG_SCHEMA} _operation="update"/>;
    doc.@id = fragmentId;
    doc.@status = "revoked";
    doc.@is_current = false;
    doc.@active = false;
    doc.@revoked_reason = reason || "";
    doc.@revoked_by = operator || "";
    doc.@revoked_at = nowStr();
    xtk.session.Write(doc);
    if (testWoo.fragments && testWoo.fragments.clearCache) testWoo.fragments.clearCache();

    var affected = [];
    var q = xtk.queryDef.create(
      <queryDef schema={SQL_SCHEMA} operation="select" lineCount="5000">
        <select>
          <node expr="@id"/><node expr="@title"/><node expr="@creator"/>
          <node expr="@creation_date"/><node expr="@impact_status"/><node expr="@used_fragments"/>
        </select>
      </queryDef>);
    var res = q.ExecuteQuery();
    for each (var r in res.testWooAiSql) {
      var arr = _parseUsedFragments(r.@used_fragments);
      var status = "";
      if (arr === null) {
        logWarning("[testWoo.lifecycle.revoke] used_fragments parse failed id=" +
          String(r.@id));
        status = "unknown";
      } else if (_usesFragment(arr, f.name)) {
        status = "affected";
      }
      if (!status) continue;
      var upd = <testWooAiSql xtkschema={SQL_SCHEMA} _operation="update"/>;
      upd.@id = Number(r.@id);
      upd.@impact_status = status;
      xtk.session.Write(upd);
      affected.push(_sqlRow(r, status));
    }
    return { fragmentId: fragmentId, name: f.name, affected: affected };
  }

  function hardDelete(fragmentId) {
    var f = _getFragmentById(fragmentId);
    if (!f) throw new Error("[testWoo.lifecycle.hardDelete] not found");
    if (f.status !== "draft" && f.status !== "rejected")
      throw new Error("[testWoo.lifecycle.hardDelete] status must be draft or rejected");
    if (f.usage_count > 0)
      throw new Error("[testWoo.lifecycle.hardDelete] usageCount>0");
    var impact = listImpact(f.name);
    if (impact && impact.length)
      throw new Error("[testWoo.lifecycle.hardDelete] referenced by ai_sql");
    var doc = <testWooAiFragment xtkschema={FRAG_SCHEMA} _operation="delete"/>;
    doc.@id = fragmentId;
    xtk.session.Write(doc);
    if (testWoo.fragments && testWoo.fragments.clearCache) testWoo.fragments.clearCache();
  }

  // used_fragments 는 [{name, version, fragmentId}] JSON. 파싱 불가면 null 을 돌려
  // 호출부가 "unknown" 으로 표시하게 한다(조용히 무시 금지).
  function _parseUsedFragments(raw) {
    var arr;
    try {
      arr = JSON.parse(String(raw || "[]"));
    } catch (e) {
      return null;
    }
    if (Object.prototype.toString.call(arr) !== "[object Array]") return null;
    return arr;
  }

  // 부분 문자열 매칭 금지 — "x" 조회에 "x_v2" 가 걸리면 무관한 SQL이 affected 로 마킹된다.
  function _usesFragment(arr, name) {
    var target = String(name);
    for (var i = 0; i < arr.length; i++) {
      var it = arr[i];
      var n = (it && it.name != null) ? String(it.name) : String(it);
      if (n === target) return true;
    }
    return false;
  }

  function _sqlRow(r, status) {
    return {
      id: Number(r.@id),
      title: String(r.@title),
      creator: String(r.@creator),
      creation_date: String(r.@creation_date),
      impact_status: status
    };
  }

  function listImpact(fragmentName) {
    var out = [];
    var q = xtk.queryDef.create(
      <queryDef schema={SQL_SCHEMA} operation="select" lineCount="5000">
        <select>
          <node expr="@id"/><node expr="@title"/><node expr="@creator"/>
          <node expr="@creation_date"/><node expr="@impact_status"/><node expr="@used_fragments"/>
        </select>
      </queryDef>);
    var res = q.ExecuteQuery();
    var needle = String(fragmentName || "");
    for each (var r in res.testWooAiSql) {
      var arr = _parseUsedFragments(r.@used_fragments);
      if (arr === null) {
        logWarning("[testWoo.lifecycle.listImpact] used_fragments parse failed id=" +
          String(r.@id));
        out.push(_sqlRow(r, "unknown"));
        continue;
      }
      if (_usesFragment(arr, needle))
        out.push(_sqlRow(r, String(r.@impact_status || "ok")));
    }
    return out;
  }

  function compileHash(plan, sql) {
    return _djb2(JSON.stringify(plan || {}) + "|" + normalizeSql(sql));
  }

  // 5차 J-9-3-4: SQL 본문만 정규화 후 해시 (plan 제외)
  function sqlContentHash(sql) {
    return _djb2(normalizeSql(sql));
  }

  return {
    normalizeSql: normalizeSql,
    contentHash: contentHash,
    sqlContentHash: sqlContentHash,
    nextVersion: nextVersion,
    publish: publish,
    revoke: revoke,
    hardDelete: hardDelete,
    listImpact: listImpact,
    compileHash: compileHash
  };
})();
