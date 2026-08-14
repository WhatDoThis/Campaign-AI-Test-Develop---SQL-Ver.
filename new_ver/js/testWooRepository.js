/*
 * testWooRepository.js (AI SQL·큐·GapLog 저장소)
 * ==================================================
 * litmus 동기 __v=163 (injected_at 스키마 반영 상태).
 * woo:testWooAiSql·testWooAiRequestQueue·testWooAiGapLog CRUD.
 * Register·Foundry·Match·Studio가 xtk.session#Write·queryDef 경유.
 *
 * [Main Functions]
 * ===========
 * - allocAiSqlId — GetNewIds 1건 (주입 선할당)
 * - saveAiSql — ai_sql 이력 Insert (rec.id 있으면 그 id, param_key 저장)
 * - updateAiSqlStatus — ai_sql status 갱신
 * - bumpFragmentUsage — used_fragments usage_count 증가
 * - enqueueRequest — Foundry 큐 Insert
 * - getQueueStatus — 큐 건 status 조회
 * - upsertGapLog — GapLog Insert/Update
 * - listGapLog — GapLog 목록
 * - updateGapLogStatus — GapLog status 갱신
 * - approveFragment — verified→active 승인
 * - rejectFragment — fragment 거절
 * - completeQueue — 큐 완료 status 기록
 * - listAiSqlByWorkflow — WF별 SQL 목록 (injected_* · is_current=max injected_at)
 * - listRecentAiSql — 최근 반영 SQL(목록·분기 B 점프, used_fragments 포함 · sql_query 제외)
 * - listAiSqlForMatch — 매칭용 plan_json·sql_query 목록
 * - findAiSqlBySqlHash — sqlContentHash 중복 조회
 * - deleteAiSql — ai_sql 삭제
 * - getAiSqlById — id 단건 조회
 * - hasInjectedAiSql — 해당 WF에 injected_at 있는 행 여부 (XML 미조회)
 * - markAiSqlInjected — 주입 성공 후 injected_at·count·prev_injected_id 갱신
 *
 * [Dependencies]
 * =========
 * - woo:testWooAiSql·testWooAiRequestQueue·testWooAiGapLog·testWooAiFragment — schema
 * - testWoo.lifecycle.sqlContentHash — findAiSqlBySqlHash
 * - xtk.session#Write·GetNewIds·queryDef
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

  function allocAiSqlId() {
    try {
      var idList = xtk.session.GetNewIds(1);
      var id = parseInt(String(idList).split(",")[0], 10);
      if (!id || isNaN(id)) throw new Error("GetNewIds returned invalid id: " + idList);
      return id;
    } catch (e) {
      throw new Error("[testWoo.repo.allocAiSqlId] GetNewIds failed: " +
        (e && e.message != null ? e.message : String(e)));
    }
  }

  function saveAiSql(rec) {
    if (!rec || !rec.sql_query) throw new Error("[testWoo.repo.saveAiSql] sql_query missing");
    if (!rec.used_fragments)
      throw new Error("[testWoo.repo.saveAiSql] used_fragments required");
    if (!rec.compile_hash)
      throw new Error("[testWoo.repo.saveAiSql] compile_hash required");

    var id = 0;
    if (rec.id) {
      id = parseInt(String(rec.id), 10);
      if (!id || isNaN(id)) throw new Error("[testWoo.repo.saveAiSql] invalid rec.id");
    } else {
      id = allocAiSqlId();
    }

    var hasExclusion = !!(rec.excluded_slots && String(rec.excluded_slots).length > 2);

    var doc = <testWooAiSql xtkschema={SQL_SCHEMA} _operation="insert"/>;
    doc.@id = id;
    doc.@title = rec.title || "";
    doc.@creator = rec.creator || "";
    doc.@nl_request = rec.nl_request || "";
    doc.@plan_json = rec.plan_json || "";
    doc.@used_fragments = rec.used_fragments;
    doc.@param_key = rec.param_key ? String(rec.param_key).substring(0, 200) : "";
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

  function _emptyDt(s) {
    var t = String(s == null ? "" : s);
    if (!t) return true;
    if (t === "0") return true;
    return false;
  }

  // 같은 WF에서 injected_at 최대 행만 is_current. 전원 빈값이면 creation_date 최대(구 데이터).
  function _stampCurrent(rows) {
    var bestId = 0;
    var bestAt = "";
    var i, at, id;
    for (i = 0; i < rows.length; i++) {
      at = String(rows[i].injected_at || "");
      if (_emptyDt(at)) {
        rows[i].is_current = false;
        continue;
      }
      id = Number(rows[i].id);
      if (!bestAt || at > bestAt || (at === bestAt && id > bestId)) {
        bestAt = at;
        bestId = id;
      }
    }
    if (!bestId) {
      var bestCd = "";
      for (i = 0; i < rows.length; i++) {
        at = String(rows[i].creation_date || "");
        if (_emptyDt(at)) continue;
        id = Number(rows[i].id);
        if (!bestCd || at > bestCd || (at === bestCd && id > bestId)) {
          bestCd = at;
          bestId = id;
        }
      }
      if (!bestId && rows.length) bestId = Number(rows[0].id);
    }
    for (i = 0; i < rows.length; i++) {
      rows[i].is_current = !!(bestId && Number(rows[i].id) === bestId);
    }
    return rows;
  }

  function _rowInjectFields(r) {
    return {
      injected_at: String(r.@injected_at || ""),
      injected_by: String(r.@injected_by || ""),
      inject_count: Number(r.@inject_count) || 0,
      activity_name: String(r.@activity_name || ""),
      prev_injected_id: Number(r.@prev_injected_id) || 0,
      injected_workflow_id: String(r.@injected_workflow_id || "")
    };
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
          <node expr="@injected_at"/><node expr="@injected_by"/>
          <node expr="@inject_count"/><node expr="@activity_name"/>
          <node expr="@prev_injected_id"/><node expr="@injected_workflow_id"/>
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
      var inj = _rowInjectFields(r);
      rows.push({
        id: Number(r.@id),
        title: String(r.@title || ""),
        status: String(r.@status || ""),
        summary_ko: String(r.@summary_ko || ""),
        target_count: Number(r.@target_count) || 0,
        workflow_name: String(r.@workflow_name || ""),
        creation_date: String(r.@creation_date || ""),
        creator: String(r.@creator || ""),
        impact_status: String(r.@impact_status || "ok"),
        injected_at: inj.injected_at,
        injected_by: inj.injected_by,
        inject_count: inj.inject_count,
        activity_name: inj.activity_name,
        prev_injected_id: inj.prev_injected_id,
        injected_workflow_id: inj.injected_workflow_id,
        is_current: false
      });
    }
    _stampCurrent(rows);
    var current = [];
    var rest = [];
    var i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i].is_current) current.push(rows[i]);
      else rest.push(rows[i]);
    }
    return current.concat(rest);
  }

  function hasInjectedAiSql(workflowName) {
    var rows = listAiSqlByWorkflow(workflowName, 50);
    var i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i].is_current) return true;
    }
    return false;
  }

  function markAiSqlInjected(id, meta) {
    meta = meta || {};
    var n = Number(id);
    if (!n || isNaN(n))
      throw new Error("[testWoo.repo.markAiSqlInjected] invalid id");
    var q = xtk.queryDef.create(
      <queryDef schema={SQL_SCHEMA} operation="getIfExists">
        <select>
          <node expr="@id"/><node expr="@inject_count"/>
          <node expr="@workflow_name"/>
        </select>
        <where><condition expr={"@id = " + n}/></where>
      </queryDef>);
    var res = q.ExecuteQuery();
    if (!res || String(res.@id || "") === "")
      throw new Error("[testWoo.repo.markAiSqlInjected] not found id=" + n);
    var prevId = 0;
    var wf = String(res.@workflow_name || "");
    if (wf) {
      var sibs = listAiSqlByWorkflow(wf, 50);
      var i;
      for (i = 0; i < sibs.length; i++) {
        if (sibs[i].is_current && Number(sibs[i].id) !== n) {
          prevId = Number(sibs[i].id);
          break;
        }
      }
    }
    var doc = <testWooAiSql xtkschema={SQL_SCHEMA} _operation="update"/>;
    doc.@id = n;
    doc.@injected_at = nowStr();
    doc.@injected_by = meta.operator ? String(meta.operator).substring(0, 64) : "";
    doc.@inject_count = (Number(res.@inject_count) || 0) + 1;
    if (meta.activityName)
      doc.@activity_name = String(meta.activityName).substring(0, 64);
    if (meta.workflowId)
      doc.@injected_workflow_id = String(meta.workflowId).substring(0, 16);
    if (prevId) doc.@prev_injected_id = prevId;
    try {
      xtk.session.Write(doc);
    } catch (eM) {
      throw new Error("[testWoo.repo.markAiSqlInjected] Write failed: id=" + n + " cause=" +
        (eM && eM.message != null ? eM.message : String(eM)));
    }
    return n;
  }

  // 3b. 최근 반영 SQL (ST1 기존 목록 · sql_query/plan 제외)
  function listRecentAiSql(limit) {
    var lim = limit != null ? Number(limit) : 10;
    if (isNaN(lim) || lim < 1) lim = 10;
    if (lim > 50) lim = 50;
    var q = xtk.queryDef.create(
      <queryDef schema={SQL_SCHEMA} operation="select" lineCount={String(lim)}>
        <select>
          <node expr="@id"/><node expr="@title"/><node expr="@status"/>
          <node expr="@nl_request"/><node expr="@workflow_name"/>
          <node expr="@used_fragments"/><node expr="@param_key"/>
          <node expr="@creation_date"/>
          <node expr="@injected_at"/><node expr="@inject_count"/>
        </select>
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
        nl_request: String(r.@nl_request || ""),
        workflow_name: String(r.@workflow_name || ""),
        used_fragments: String(r.@used_fragments || "[]"),
        param_key: String(r.@param_key || ""),
        creation_date: String(r.@creation_date || ""),
        injected_at: String(r.@injected_at || ""),
        inject_count: Number(r.@inject_count) || 0
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

  // 5a. 매칭용 등록 SQL (#154: sql_query 포함 — 동일 배지용 sqlContentHash)
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
          <node expr="@plan_json"/><node expr="@sql_query"/>
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
        sql_query: String(r.@sql_query || ""),
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
          <node expr="@param_key"/>
          <node expr="@injected_at"/><node expr="@injected_by"/>
          <node expr="@inject_count"/><node expr="@activity_name"/>
          <node expr="@prev_injected_id"/><node expr="@injected_workflow_id"/>
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
      has_exclusion: String(r.@has_exclusion) === "true" || Number(r.@has_exclusion) === 1,
      param_key: String(r.@param_key || ""),
      injected_at: String(r.@injected_at || ""),
      injected_by: String(r.@injected_by || ""),
      inject_count: Number(r.@inject_count) || 0,
      activity_name: String(r.@activity_name || ""),
      prev_injected_id: Number(r.@prev_injected_id) || 0,
      injected_workflow_id: String(r.@injected_workflow_id || "")
    };
  }

  return {
    allocAiSqlId: allocAiSqlId,
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
    listRecentAiSql: listRecentAiSql,
    listAiSqlForMatch: listAiSqlForMatch,
    findAiSqlBySqlHash: findAiSqlBySqlHash,
    deleteAiSql: deleteAiSql,
    getAiSqlById: getAiSqlById,
    hasInjectedAiSql: hasInjectedAiSql,
    markAiSqlInjected: markAiSqlInjected
  };
})();
testWoo.repo.__v = "163";
