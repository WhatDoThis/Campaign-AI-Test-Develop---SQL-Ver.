/*
 * testWooRepository.js (이력·큐·GapLog·fragment CRUD · server-side)
 * ==================================================================
 * woo:testWooAiSql / testWooAiRequestQueue / testWooAiGapLog.
 *
 * [Main Functions]
 * ===========
 * - saveAiSql / enqueueRequest / getQueueStatus / upsertGapLog / listGapLog
 * - listAiSqlByWorkflow / getAiSqlById / deleteAiSql — WF별 SQL 목록·불러오기·삭제 (섹션 7b)
 * - listAiSqlForMatch / findAiSqlBySqlHash — 5차 매칭·Register 중복 스킵 (#146 plan_json)
 * - approveFragment : 민감/킬스위치 OFF 잔여 verified → active (4차 일반 경로는 Foundry 자동)
 *
 * [Dependencies]
 * =========
 * - xtk.session.Write / GetNewIds / queryDef
 * - testWoo.lifecycle.sqlContentHash (findAiSqlBySqlHash)
 * - loadLibrary("woo:testWooRepository.js")
 */
var testWoo = testWoo || {};
testWoo.repo = (function () {
  "use strict";

  var SQL_SCHEMA = "woo:testWooAiSql";
  var QUEUE_SCHEMA = "woo:testWooAiRequestQueue";
  var FRAG_SCHEMA = "woo:testWooAiFragment";
  var GAP_SCHEMA = "woo:testWooAiGapLog";
  var WF_NAME_MAX = 64;

  function nowStr() {
    return formatDate(new Date(), "%4Y/%2M/%2D %02H:%02N:%02S");
  }

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  // 워크플로 인터널네임(WKF94 등)을 보관한다. 정수 @id 는 패키지 이동 시 바뀌므로 쓰지 않는다.
  function _wfName(v) {
    var s = _trim(v);
    if (s.length <= WF_NAME_MAX) return s;
    logWarning("[testWoo.repo] workflow_name 길이 초과로 절단: " + s);
    return s.substring(0, WF_NAME_MAX);
  }

  function saveAiSql(rec) {
    if (!rec || !rec.sql_query) throw new Error("[testWoo.repo.saveAiSql] sql_query missing");
    if (!rec.used_fragments)
      throw new Error("[testWoo.repo.saveAiSql] used_fragments required");
    if (!rec.compile_hash)
      throw new Error("[testWoo.repo.saveAiSql] compile_hash required");

    var id;
    try {
      var idList = xtk.session.GetNewIds(1);
      id = parseInt(String(idList).split(",")[0], 10);
      if (!id || isNaN(id)) throw new Error("GetNewIds returned invalid id: " + idList);
    } catch (e) {
      throw new Error("[testWoo.repo.saveAiSql] GetNewIds failed: " +
        (e && e.message != null ? e.message : String(e)));
    }

    var hasExclusion = !!(rec.excluded_slots && String(rec.excluded_slots).length > 2);

    var doc = <testWooAiSql xtkschema={SQL_SCHEMA} _operation="insert"/>;
    doc.@id = id;
    doc.@title = rec.title || "";
    doc.@creator = rec.creator || "";
    doc.@nl_request = rec.nl_request || "";
    doc.@plan_json = rec.plan_json || "";
    doc.@used_fragments = rec.used_fragments;
    doc.@compile_hash = rec.compile_hash;
    doc.@sql_query = rec.sql_query;
    doc.@summary_ko = rec.summary_ko || "";
    doc.@target_count = rec.target_count != null ? rec.target_count : 0;
    doc.@workflow_name = _wfName(rec.workflow_name);
    doc.@excluded_slots = rec.excluded_slots || "";
    doc.@has_exclusion = hasExclusion;
    doc.@status = rec.status || "draft";
    doc.@impact_status = rec.impact_status || "ok";
    doc.@creation_date = nowStr();

    try {
      xtk.session.Write(doc);
    } catch (eW) {
      throw new Error("[testWoo.repo.saveAiSql] Write failed: id=" + id + " cause=" +
        (eW && eW.message != null ? eW.message : String(eW)));
    }

    bumpFragmentUsage(rec.used_fragments);
    return id;
  }

  function bumpFragmentUsage(usedFragmentsJson) {
    var list = [];
    try { list = JSON.parse(String(usedFragmentsJson || "[]")); } catch (e) {}
    for (var i = 0; i < list.length; i++) {
      var fid = list[i].fragmentId;
      if (!fid) continue;
      var doc = <testWooAiFragment xtkschema={FRAG_SCHEMA} _operation="update"/>;
      doc.@id = fid;
      doc.@last_used_at = nowStr();
      try {
        var q = xtk.queryDef.create(
          <queryDef schema={FRAG_SCHEMA} operation="getIfExists">
            <select><node expr="@id"/><node expr="@usage_count"/></select>
            <where><condition expr={"@id = " + Number(fid)}/></where>
          </queryDef>);
        var res = q.ExecuteQuery();
        // getIfExists 는 엘리먼트 자체를 반환한다(무매치는 빈 엘리먼트). 컬렉션 접근 금지.
        if (!res || String(res.@id || "") === "") {
          logWarning("[testWoo.repo.bumpFragmentUsage] fragment not found id=" + fid);
          continue;
        }
        doc.@usage_count = (Number(res.@usage_count) || 0) + 1;
        xtk.session.Write(doc);
      } catch (eUp) {
        logWarning("[testWoo.repo.bumpFragmentUsage] id=" + fid + " " + eUp.message);
      }
    }
    if (testWoo.fragments && testWoo.fragments.clearCache) testWoo.fragments.clearCache();
  }

  function updateAiSqlStatus(id, status) {
    if (!id) throw new Error("[testWoo.repo.updateAiSqlStatus] id missing");
    var doc = <testWooAiSql xtkschema={SQL_SCHEMA} _operation="update"/>;
    doc.@id = id;
    doc.@status = status;
    xtk.session.Write(doc);
  }

  function enqueueRequest(rec) {
    var idList = xtk.session.GetNewIds(1);
    var id = parseInt(String(idList).split(",")[0], 10);
    var doc = <testWooAiRequestQueue xtkschema={QUEUE_SCHEMA} _operation="insert"/>;
    doc.@id = id;
    doc.@nl_text = rec.nl_text || "";
    doc.@slots_json = rec.slots_json || "[]";
    doc.@missing_slots_json = rec.missing_slots_json || "[]";
    doc.@plan_json = rec.plan_json || "";
    doc.@status = "queued";
    doc.@attempt_count = 0;
    doc.@created_by = rec.created_by || "";
    doc.@workflow_name = _wfName(rec.workflow_name);
    doc.@created_at = nowStr();
    doc.@updated_at = nowStr();
    xtk.session.Write(doc);
    return id;
  }

  function _parseJsonSafe(raw, dflt) {
    try { return JSON.parse(String(raw || "")); } catch (e) { return dflt; }
  }

  function getQueueStatus(queueId) {
    var q = xtk.queryDef.create(
      <queryDef schema={QUEUE_SCHEMA} operation="getIfExists">
        <select>
          <node expr="@id"/><node expr="@status"/><node expr="@last_error"/>
          <node expr="@missing_slots_json"/><node expr="@updated_at"/>
          <node expr="@slot_results"/><node expr="@evidence_log"/>
          <node expr="@partial_preview"/><node expr="@clarify_answers"/>
        </select>
        <where><condition expr={"@id = " + Number(queueId)}/></where>
      </queryDef>);
    var res = q.ExecuteQuery();
    // getIfExists 는 엘리먼트 자체를 반환한다(무매치는 빈 엘리먼트). 컬렉션 접근 금지.
    if (!res || String(res.@id || "") === "") return null;
    var r = res;
    return {
      queueId: Number(r.@id),
      status: String(r.@status),
      lastError: String(r.@last_error || ""),
      missingSlots: String(r.@missing_slots_json || "[]"),
      updatedAt: String(r.@updated_at || ""),
      slotResults: _parseJsonSafe(r.@slot_results, []),
      evidenceLog: _parseJsonSafe(r.@evidence_log, []),
      partialPreview: _parseJsonSafe(r.@partial_preview, null),
      clarifyAnswers: _parseJsonSafe(r.@clarify_answers, [])
    };
  }

  function upsertGapLog(rec) {
    var concept = _trim(rec.normalizedConcept || rec.slotText || "").toLowerCase();
    if (concept.length > 128) concept = concept.substring(0, 128);
    if (!concept) return null;

    var esc = concept.replace(/'/g, "''");
    var q = xtk.queryDef.create(
      <queryDef schema={GAP_SCHEMA} operation="getIfExists">
        <select>
          <node expr="@id"/><node expr="@request_count"/>
        </select>
        <where><condition expr={"@normalized_concept = '" + esc + "'"}/></where>
      </queryDef>);
    var res = q.ExecuteQuery();
    var now = nowStr();

    // getIfExists 는 엘리먼트 자체를 반환한다(무매치는 빈 엘리먼트). 컬렉션 접근 금지.
    // 컬렉션으로 읽으면 기존 레코드를 못 찾아 같은 개념이 매번 새 행으로 쌓인다.
    if (res && String(res.@id || "") !== "") {
      var doc = <testWooAiGapLog xtkschema={GAP_SCHEMA} _operation="update"/>;
      doc.@id = Number(res.@id);
      doc.@request_count = (Number(res.@request_count) || 0) + 1;
      doc.@last_seen_at = now;
      if (rec.verdict) doc.@verdict = rec.verdict;
      if (rec.sampleEvidence) doc.@sample_evidence = rec.sampleEvidence;
      xtk.session.Write(doc);
      return Number(res.@id);
    }

    var idList = xtk.session.GetNewIds(1);
    var id = parseInt(String(idList).split(",")[0], 10);
    var ins = <testWooAiGapLog xtkschema={GAP_SCHEMA} _operation="insert"/>;
    ins.@id = id;
    ins.@slot_text = rec.slotText || "";
    ins.@verdict = rec.verdict || "ambiguous";
    ins.@normalized_concept = concept;
    ins.@request_count = 1;
    ins.@first_seen_at = now;
    ins.@last_seen_at = now;
    ins.@sample_evidence = rec.sampleEvidence || "";
    ins.@status = "open";
    xtk.session.Write(ins);
    return id;
  }

  function listGapLog(limit) {
    var lim = limit != null ? Number(limit) : 100;
    var q = xtk.queryDef.create(
      <queryDef schema={GAP_SCHEMA} operation="select" lineCount={String(lim)}>
        <select>
          <node expr="@id"/><node expr="@slot_text"/><node expr="@verdict"/>
          <node expr="@normalized_concept"/><node expr="@request_count"/>
          <node expr="@first_seen_at"/><node expr="@last_seen_at"/>
          <node expr="@status"/><node expr="@note"/>
        </select>
        <orderBy><node expr="@request_count" sortDesc="true"/></orderBy>
      </queryDef>);
    var res = q.ExecuteQuery();
    var rows = [];
    for each (var r in res.testWooAiGapLog) {
      rows.push({
        id: Number(r.@id),
        slotText: String(r.@slot_text || ""),
        verdict: String(r.@verdict || ""),
        normalizedConcept: String(r.@normalized_concept || ""),
        requestCount: Number(r.@request_count) || 0,
        firstSeenAt: String(r.@first_seen_at || ""),
        lastSeenAt: String(r.@last_seen_at || ""),
        status: String(r.@status || "open"),
        note: String(r.@note || "")
      });
    }
    return rows;
  }

  function updateGapLogStatus(id, status, note) {
    var doc = <testWooAiGapLog xtkschema={GAP_SCHEMA} _operation="update"/>;
    doc.@id = Number(id);
    doc.@status = status;
    if (note != null) doc.@note = note;
    xtk.session.Write(doc);
  }

  function approveFragment(fragmentId, operator) {
    var doc = <testWooAiFragment xtkschema={FRAG_SCHEMA} _operation="update"/>;
    doc.@id = fragmentId;
    doc.@status = "active";
    doc.@active = true;
    doc.@approved_by = operator || "";
    doc.@approved_at = nowStr();
    xtk.session.Write(doc);
    if (testWoo.fragments && testWoo.fragments.clearCache) testWoo.fragments.clearCache();
  }

  function rejectFragment(fragmentId, reason) {
    var doc = <testWooAiFragment xtkschema={FRAG_SCHEMA} _operation="update"/>;
    doc.@id = fragmentId;
    doc.@status = "rejected";
    doc.@active = false;
    doc.@revoked_reason = reason || "";
    xtk.session.Write(doc);
    if (testWoo.fragments && testWoo.fragments.clearCache) testWoo.fragments.clearCache();
  }

  function completeQueue(queueId, status) {
    var doc = <testWooAiRequestQueue xtkschema={QUEUE_SCHEMA} _operation="update"/>;
    doc.@id = queueId;
    doc.@status = status || "done";
    doc.@updated_at = nowStr();
    xtk.session.Write(doc);
  }

  // 3. WF 인터널네임으로 등록 SQL 목록 (sql_query/plan 제외 — 목록용)
  function listAiSqlByWorkflow(workflowName, limit) {
    var wf = _wfName(workflowName);
    if (!wf) return [];
    var lim = limit != null ? Number(limit) : 50;
    if (isNaN(lim) || lim < 1) lim = 50;
    if (lim > 200) lim = 200;
    var esc = wf.replace(/'/g, "''");
    var q = xtk.queryDef.create(
      <queryDef schema={SQL_SCHEMA} operation="select" lineCount={String(lim)}>
        <select>
          <node expr="@id"/><node expr="@title"/><node expr="@status"/>
          <node expr="@summary_ko"/><node expr="@target_count"/>
          <node expr="@workflow_name"/><node expr="@creation_date"/>
          <node expr="@creator"/><node expr="@impact_status"/>
        </select>
        <where>
          <condition expr={"@workflow_name = '" + esc + "'"}/>
        </where>
        <orderBy>
          <node expr="@creation_date" sortDesc="true"/>
        </orderBy>
      </queryDef>);
    var res = q.ExecuteQuery();
    var rows = [];
    for each (var r in res.testWooAiSql) {
      rows.push({
        id: Number(r.@id),
        title: String(r.@title || ""),
        status: String(r.@status || ""),
        summary_ko: String(r.@summary_ko || ""),
        target_count: Number(r.@target_count) || 0,
        workflow_name: String(r.@workflow_name || ""),
        creation_date: String(r.@creation_date || ""),
        creator: String(r.@creator || ""),
        impact_status: String(r.@impact_status || "ok")
      });
    }
    return rows;
  }

  // 4. ai_sql_id 이력 삭제 (Studio 목록 · WF 바인딩은 호출측에서 정리)
  function deleteAiSql(id) {
    var n = Number(id);
    if (!n || isNaN(n))
      throw new Error("[testWoo.repo.deleteAiSql] invalid id");
    var doc = <testWooAiSql xtkschema={SQL_SCHEMA} _operation="delete"/>;
    doc.@id = n;
    try {
      xtk.session.Write(doc);
    } catch (eD) {
      throw new Error("[testWoo.repo.deleteAiSql] Write failed: id=" + n + " cause=" +
        (eD && eD.message != null ? eD.message : String(eD)));
    }
    return true;
  }

  // 5a. 매칭용 등록 SQL (used_fragments·compile_hash·nl · sql 본문 제외)
  function listAiSqlForMatch(limit) {
    var lim = limit != null ? Number(limit) : 500;
    if (isNaN(lim) || lim < 1) lim = 500;
    if (lim > 5000) lim = 5000;
    var q = xtk.queryDef.create(
      <queryDef schema={SQL_SCHEMA} operation="select" lineCount={String(lim)}>
        <select>
          <node expr="@id"/><node expr="@workflow_name"/>
          <node expr="@used_fragments"/><node expr="@compile_hash"/>
          <node expr="@nl_request"/><node expr="@title"/>
          <node expr="@plan_json"/>
          <node expr="@status"/><node expr="@creation_date"/>
        </select>
        <where>
          <condition expr="@status = 'registered'"/>
        </where>
        <orderBy>
          <node expr="@creation_date" sortDesc="true"/>
        </orderBy>
      </queryDef>);
    var res = q.ExecuteQuery();
    var rows = [];
    for each (var r in res.testWooAiSql) {
      rows.push({
        id: Number(r.@id),
        workflow_name: String(r.@workflow_name || ""),
        used_fragments: String(r.@used_fragments || "[]"),
        compile_hash: String(r.@compile_hash || ""),
        nl_request: String(r.@nl_request || ""),
        title: String(r.@title || ""),
        plan_json: String(r.@plan_json || ""),
        status: String(r.@status || ""),
        creation_date: String(r.@creation_date || "")
      });
    }
    return rows;
  }

  // 5b. 동일 workflow + 정규화 SQL 해시 중복 조회 (J-9-3-4)
  function findAiSqlBySqlHash(workflowName, sqlHash) {
    var wf = _wfName(workflowName);
    var want = _trim(sqlHash);
    if (!wf || !want) return null;
    if (!testWoo.lifecycle || !testWoo.lifecycle.sqlContentHash) {
      throw new Error(
        "[testWoo.repo.findAiSqlBySqlHash] lifecycle.sqlContentHash missing"
      );
    }
    var esc = wf.replace(/'/g, "''");
    var q = xtk.queryDef.create(
      <queryDef schema={SQL_SCHEMA} operation="select" lineCount="100">
        <select>
          <node expr="@id"/><node expr="@title"/><node expr="@status"/>
          <node expr="@sql_query"/><node expr="@workflow_name"/>
          <node expr="@creation_date"/><node expr="@compile_hash"/>
        </select>
        <where>
          <condition expr={"@workflow_name = '" + esc + "'"}/>
        </where>
        <orderBy>
          <node expr="@creation_date" sortDesc="true"/>
        </orderBy>
      </queryDef>);
    var res = q.ExecuteQuery();
    for each (var r in res.testWooAiSql) {
      var h = testWoo.lifecycle.sqlContentHash(String(r.@sql_query || ""));
      if (h === want) {
        return {
          id: Number(r.@id),
          title: String(r.@title || ""),
          status: String(r.@status || ""),
          workflow_name: String(r.@workflow_name || ""),
          creation_date: String(r.@creation_date || ""),
          compile_hash: String(r.@compile_hash || ""),
          sqlHash: h
        };
      }
    }
    return null;
  }

  // 5. ai_sql_id 단건 (Studio 불러오기 / 커스텀 액티비티 로드용)
  function getAiSqlById(id) {
    var n = Number(id);
    if (!n || isNaN(n)) return null;
    var q = xtk.queryDef.create(
      <queryDef schema={SQL_SCHEMA} operation="getIfExists">
        <select>
          <node expr="@id"/><node expr="@title"/><node expr="@status"/>
          <node expr="@nl_request"/><node expr="@plan_json"/><node expr="@sql_query"/>
          <node expr="@summary_ko"/><node expr="@target_count"/>
          <node expr="@workflow_name"/><node expr="@creation_date"/>
          <node expr="@creator"/><node expr="@used_fragments"/>
          <node expr="@compile_hash"/><node expr="@impact_status"/>
          <node expr="@excluded_slots"/><node expr="@has_exclusion"/>
        </select>
        <where><condition expr={"@id = " + n}/></where>
      </queryDef>);
    var res = q.ExecuteQuery();
    if (!res || String(res.@id || "") === "") return null;
    var r = res;
    return {
      id: Number(r.@id),
      title: String(r.@title || ""),
      status: String(r.@status || ""),
      nl_request: String(r.@nl_request || ""),
      plan_json: String(r.@plan_json || ""),
      sql_query: String(r.@sql_query || ""),
      summary_ko: String(r.@summary_ko || ""),
      target_count: Number(r.@target_count) || 0,
      workflow_name: String(r.@workflow_name || ""),
      creation_date: String(r.@creation_date || ""),
      creator: String(r.@creator || ""),
      used_fragments: String(r.@used_fragments || "[]"),
      compile_hash: String(r.@compile_hash || ""),
      impact_status: String(r.@impact_status || "ok"),
      excluded_slots: String(r.@excluded_slots || ""),
      has_exclusion: String(r.@has_exclusion) === "true" || Number(r.@has_exclusion) === 1
    };
  }

  return {
    saveAiSql: saveAiSql,
    updateAiSqlStatus: updateAiSqlStatus,
    bumpFragmentUsage: bumpFragmentUsage,
    enqueueRequest: enqueueRequest,
    getQueueStatus: getQueueStatus,
    upsertGapLog: upsertGapLog,
    listGapLog: listGapLog,
    updateGapLogStatus: updateGapLogStatus,
    approveFragment: approveFragment,
    rejectFragment: rejectFragment,
    completeQueue: completeQueue,
    listAiSqlByWorkflow: listAiSqlByWorkflow,
    listAiSqlForMatch: listAiSqlForMatch,
    findAiSqlBySqlHash: findAiSqlBySqlHash,
    deleteAiSql: deleteAiSql,
    getAiSqlById: getAiSqlById
  };
})();
