/*
 * testWooRepository.js (이력·큐·GapLog·fragment CRUD · server-side)
 * ==================================================================
 * woo:testWooAiSql / testWooAiRequestQueue / testWooAiGapLog.
 *
 * [Main Functions]
 * ===========
 * - saveAiSql / enqueueRequest / getQueueStatus / upsertGapLog / listGapLog
 *
 * [Dependencies]
 * =========
 * - xtk.session.Write / GetNewIds
 * - loadLibrary("woo:testWooRepository.js")
 */
var testWoo = testWoo || {};
testWoo.repo = (function () {
  "use strict";

  var SQL_SCHEMA = "woo:testWooAiSql";
  var QUEUE_SCHEMA = "woo:testWooAiRequestQueue";
  var FRAG_SCHEMA = "woo:testWooAiFragment";
  var GAP_SCHEMA = "woo:testWooAiGapLog";

  function nowStr() {
    return formatDate(new Date(), "%4Y/%2M/%2D %02H:%02N:%02S");
  }

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
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
    doc.@workflow_id = rec.workflow_id || 0;
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
            <select><node expr="@usage_count"/></select>
            <where><condition expr={"@id = " + Number(fid)}/></where>
          </queryDef>);
        var res = q.ExecuteQuery();
        var cnt = 0;
        for each (var r in res.testWooAiFragment) cnt = Number(r.@usage_count) || 0;
        doc.@usage_count = cnt + 1;
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
    doc.@workflow_id = rec.workflow_id || 0;
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
    if (!res || !res.testWooAiRequestQueue || !res.testWooAiRequestQueue.length) return null;
    var r = res.testWooAiRequestQueue[0];
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

    if (res && res.testWooAiGapLog && res.testWooAiGapLog.length) {
      var existing = res.testWooAiGapLog[0];
      var doc = <testWooAiGapLog xtkschema={GAP_SCHEMA} _operation="update"/>;
      doc.@id = Number(existing.@id);
      doc.@request_count = (Number(existing.@request_count) || 0) + 1;
      doc.@last_seen_at = now;
      if (rec.verdict) doc.@verdict = rec.verdict;
      if (rec.sampleEvidence) doc.@sample_evidence = rec.sampleEvidence;
      xtk.session.Write(doc);
      return Number(existing.@id);
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
    completeQueue: completeQueue
  };
})();
