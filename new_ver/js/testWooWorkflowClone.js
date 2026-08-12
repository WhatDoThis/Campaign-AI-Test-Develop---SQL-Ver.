/*
 * testWooWorkflowClone.js (Campaign·WKF 템플릿·잠금)
 * ==================================================
 * litmus 동기 __v=159 (#160 배포정합).
 * Program(@isAiFolder)→Campaign→WKF 계층 생성·목록·soft-lock.
 * Spawn/Start 금지. 캠페인당 WKF Max=15.
 *
 * [Main Functions]
 * ===========
 * - getTemplateName — WKF 템플릿 표시명
 * - getCampaignTemplateId — 캠페인 템플릿 id
 * - getWkfTemplateId — WKF 템플릿 id
 * - getMaxWkfPerCampaign — 캠페인당 WKF 상한
 * - getProgramFullName — Program id→fullName
 * - listCampaignsByProgram — Program 하위 Campaign 목록
 * - createCampaign — CreateOperationFromModelId+Write
 * - listWkfsByCampaign — Campaign 하위 WKF 목록
 * - listWkfsByProgram — Program 하위 WKF 목록
 * - createWkfFromTemplate — CreateInstanceFromModel
 * - resolveWorkflowsByName — 전역 WKF·캠페인·Program 메타
 * - acquireLock — WKF soft-lock 획득
 * - releaseLock — soft-lock 해제
 * - getLock — 현재 lock 조회
 *
 * [Dependencies]
 * =========
 * - nms:operation·xtk:workflow·woo:testWooAiWkfLock — schema·Write
 * - testWooAiCampaignTemplateId·testWooAiWkfTemplateId·testWooAiWkfTemplateName·testWooAiWkfMaxPerCampaign Option
 */

if (typeof testWoo === "undefined") testWoo = {};

testWoo.wfClone = (function () {
  var WF_SCHEMA = "xtk:workflow";
  var OP_SCHEMA = "nms:operation";
  var FOLDER_SCHEMA = "xtk:folder";
  var LOCK_SCHEMA = "woo:testWooAiWkfLock";
  var OPT_CAMP_TPL_ID = "testWooAiCampaignTemplateId";
  var OPT_WKF_TPL_ID = "testWooAiWkfTemplateId";
  var OPT_TEMPLATE = "testWooAiWkfTemplateName";
  var OPT_MAX_WKF = "testWooAiWkfMaxPerCampaign";
  var DEFAULT_CAMP_TPL_ID = 10002;
  var DEFAULT_WKF_TPL_ID = 17234;
  var DEFAULT_TEMPLATE = "wfEmptyTemplate_CUSTOM";
  var DEFAULT_MAX_WKF = 15;
  var HARD_MAX_WKF = 20;
  var DEFAULT_LIMIT = 200;
  var MAX_LIMIT = 500;

  function _trim(s) {
    return twTrim
      ? twTrim(s)
      : String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  function _esc(s) {
    return String(s == null ? "" : s).replace(/'/g, "''");
  }

  function _login() {
    if (typeof currentLogin === "function") return String(currentLogin() || "");
    try {
      return String(application.operator.login || "");
    } catch (e) {
      return "";
    }
  }

  function _lim(limit) {
    var lim = parseInt(limit, 10);
    if (isNaN(lim) || lim <= 0) lim = DEFAULT_LIMIT;
    if (lim > MAX_LIMIT) lim = MAX_LIMIT;
    return lim;
  }

  // 1a. WKF 템플릿 이름 (표시·이름 해석용)
  function getTemplateName() {
    var n = "";
    try {
      n = String(getOption(OPT_TEMPLATE) || "");
    } catch (eO) {
      n = "";
    }
    return _trim(n) || DEFAULT_TEMPLATE;
  }

  // 1a2. 캠페인 템플릿 id (CreateOperationFromModelId)
  function getCampaignTemplateId() {
    var id = 0;
    try {
      var raw = getOption(OPT_CAMP_TPL_ID);
      if (raw != null && String(raw) !== "") id = parseInt(raw, 10);
    } catch (eO) {}
    if (!isNaN(id) && id > 0) return id;
    return DEFAULT_CAMP_TPL_ID;
  }

  // 1a3. WKF 템플릿 id (CreateInstanceFromModel)
  function getWkfTemplateId() {
    var id = 0;
    try {
      var raw = getOption(OPT_WKF_TPL_ID);
      if (raw != null && String(raw) !== "") id = parseInt(raw, 10);
    } catch (eO) {}
    if (!isNaN(id) && id > 0) return id;
    try {
      var nm = getTemplateName();
      var q = xtk.queryDef.create(
        <queryDef schema={WF_SCHEMA} operation="get">
          <select>
            <node expr="@id"/>
            <node expr="@internalName"/>
          </select>
          <where>
            <condition expr={"@internalName = '" + _esc(nm) + "'"}/>
            <condition expr="@isModel = 1"/>
          </where>
        </queryDef>
      );
      var r = q.ExecuteQuery();
      if (r && r.@id) {
        var parsed = parseInt(String(r.@id), 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch (eR) {
      try {
        logWarning("[testWoo.wfClone.getWkfTemplateId] resolve by name: " + eR);
      } catch (eL) {}
    }
    return DEFAULT_WKF_TPL_ID;
  }

  // 1b. 캠페인당 WKF 상한 (기본 15)
  function getMaxWkfPerCampaign() {
    var n = DEFAULT_MAX_WKF;
    try {
      var raw = getOption(OPT_MAX_WKF);
      if (raw != null && String(raw) !== "") n = parseInt(raw, 10);
    } catch (eO) {}
    if (isNaN(n) || n <= 0) n = DEFAULT_MAX_WKF;
    if (n > HARD_MAX_WKF) n = HARD_MAX_WKF;
    return n;
  }

  // 2a. Program fullName
  function getProgramFullName(programId) {
    var pid = String(programId || "");
    if (!pid) throw new Error("[testWoo.wfClone.getProgramFullName] programId required");
    var q = xtk.queryDef.create(
      <queryDef schema={FOLDER_SCHEMA} operation="get">
        <select>
          <node expr="@id"/>
          <node expr="@name"/>
          <node expr="@label"/>
          <node expr="@fullName"/>
        </select>
        <where>
          <condition expr={"@id = " + pid}/>
        </where>
      </queryDef>
    );
    var prog = q.ExecuteQuery();
    if (!prog || !prog.@id) {
      throw new Error("[testWoo.wfClone.getProgramFullName] not found id=" + pid);
    }
    var fullName = String(prog.@fullName || "");
    if (!fullName) {
      throw new Error("[testWoo.wfClone.getProgramFullName] empty fullName id=" + pid);
    }
    return {
      id: String(prog.@id || pid),
      name: String(prog.@name || ""),
      label: String(prog.@label || prog.@name || ""),
      fullName: fullName
    };
  }

  function _countWkfs(campaignId) {
    var cid = String(campaignId || "");
    if (!cid) return 0;
    try {
      var q = xtk.queryDef.create(
        <queryDef schema={WF_SCHEMA} operation="count">
          <where>
            <condition expr={"[@operation-id] = " + cid}/>
          </where>
        </queryDef>
      );
      var res = q.ExecuteQuery();
      var n = 0;
      if (res != null) {
        if (res.@count != null && String(res.@count) !== "")
          n = parseInt(String(res.@count), 10);
        else if (typeof res == "number") n = res;
        else n = parseInt(String(res), 10);
      }
      if (isNaN(n) || n < 0) n = 0;
      return n;
    } catch (eC) {
      try {
        logWarning("[testWoo.wfClone._countWkfs] " + eC);
      } catch (eL) {}
      return 0;
    }
  }

  // 2b. Program 아래 캠페인 목록 (+ wkfCount)
  function listCampaignsByProgram(programId, limit) {
    var prog = getProgramFullName(programId);
    var lim = _lim(limit);
    var maxW = getMaxWkfPerCampaign();
    var items = [];
    try {
      var q = xtk.queryDef.create(
        <queryDef schema={OP_SCHEMA} operation="select" lineCount={String(lim)}>
          <select>
            <node expr="@id"/>
            <node expr="@internalName"/>
            <node expr="@label"/>
            <node expr="[program/@fullName]"/>
          </select>
          <where>
            <condition expr={"[program/@fullName] = '" + _esc(prog.fullName) + "'"}/>
          </where>
          <orderBy>
            <node expr="@id" sortDesc="true"/>
          </orderBy>
        </queryDef>
      );
      var res = q.ExecuteQuery();
      if (res && res.operation) {
        for each (var op in res.operation) {
          var id = String(op.@id || "");
          var name = String(op.@internalName || "");
          var wkfCount = _countWkfs(id);
          items.push({
            id: id,
            name: name,
            label: String(op.@label || name),
            program_id: prog.id,
            program_fullName: prog.fullName,
            wkfCount: wkfCount,
            wkfMax: maxW,
            canCreateWkf: wkfCount < maxW
          });
        }
      }
    } catch (eQ) {
      try {
        logWarning("[testWoo.wfClone.listCampaignsByProgram] " + eQ);
      } catch (eL) {}
      throw new Error(
        "[testWoo.wfClone.listCampaignsByProgram] " +
          (eQ && eQ.message != null ? eQ.message : eQ)
      );
    }
    return { items: items, program: prog, wkfMax: maxW };
  }

  // 2c. 캠페인 생성 (PoC-T2: CreateOperationFromModelId → program-id)
  function createCampaign(programId, labelOpt) {
    var prog = getProgramFullName(programId);
    var modelId = getCampaignTemplateId();
    var newLabel = _trim(labelOpt);
    if (!newLabel) newLabel = "AI Campaign";

    var planning = <operation label={newLabel}/>;
    var newId = 0;
    try {
      newId = nms.operation.CreateOperationFromModelId(modelId, planning);
    } catch (eC) {
      throw new Error(
        "[testWoo.wfClone.createCampaign] CreateOperationFromModelId(" +
          modelId +
          "): " +
          (eC && eC.message != null ? eC.message : eC)
      );
    }
    if (!newId || parseInt(String(newId), 10) <= 0) {
      throw new Error(
        "[testWoo.wfClone.createCampaign] CreateOperationFromModelId returned 0 (modelId=" +
          modelId +
          ")"
      );
    }

    try {
      xtk.session.Write(
        <operation xtkschema={OP_SCHEMA} _operation="update"
                   id={String(newId)} program-id={prog.id} label={newLabel}/>
      );
    } catch (eU1) {
      try {
        xtk.session.Write(
          <operation xtkschema={OP_SCHEMA} _operation="update" id={String(newId)}
                     label={newLabel}>
            <program id={prog.id}/>
          </operation>
        );
      } catch (eU2) {
        throw new Error(
          "[testWoo.wfClone.createCampaign] program-id link failed id=" +
            newId +
            ": " +
            (eU2 && eU2.message != null ? eU2.message : eU2)
        );
      }
    }

    var qd = xtk.queryDef.create(
      <queryDef schema={OP_SCHEMA} operation="get">
        <select>
          <node expr="@id"/>
          <node expr="@internalName"/>
          <node expr="@label"/>
          <node expr="[@program-id]"/>
          <node expr="[program/@fullName]"/>
        </select>
        <where>
          <condition expr={"@id = " + newId}/>
        </where>
      </queryDef>
    );
    var created = qd.ExecuteQuery();
    if (!created || !created.@id) {
      throw new Error(
        "[testWoo.wfClone.createCampaign] created but get failed id=" + newId
      );
    }
    var maxW = getMaxWkfPerCampaign();
    var wkfCount = _countWkfs(String(created.@id || newId));
    return {
      id: String(created.@id || newId),
      name: String(created.@internalName || ""),
      label: String(created.@label || newLabel),
      program_id: String(created.@["program-id"] || prog.id),
      program_fullName: String(
        (created.program && created.program.@fullName) || prog.fullName
      ),
      wkfCount: wkfCount,
      wkfMax: maxW,
      canCreateWkf: wkfCount < maxW,
      template_id: modelId
    };
  }

  // 4. locks
  function getLock(workflowId) {
    var wid = String(workflowId || "");
    if (!wid) return null;
    try {
      var q = xtk.queryDef.create(
        <queryDef schema={LOCK_SCHEMA} operation="getIfExists">
          <select>
            <node expr="@id"/>
            <node expr="@workflow_id"/>
            <node expr="@workflow_name"/>
            <node expr="@locked_by"/>
            <node expr="@locked_at"/>
          </select>
          <where>
            <condition expr={"@workflow_id = '" + _esc(wid) + "'"}/>
          </where>
        </queryDef>
      );
      var r = q.ExecuteQuery();
      if (!r || String(r.@id || "") === "") return null;
      return {
        id: String(r.@id || ""),
        workflow_id: String(r.@workflow_id || ""),
        workflow_name: String(r.@workflow_name || ""),
        locked_by: String(r.@locked_by || ""),
        locked_at: String(r.@locked_at || "")
      };
    } catch (eG) {
      try {
        logWarning("[testWoo.wfClone.getLock] " + eG);
      } catch (eL) {}
      return null;
    }
  }

  function acquireLock(workflowId, workflowName) {
    var wid = String(workflowId || "");
    var wname = String(workflowName || "");
    var login = _login();
    if (!wid) throw new Error("[testWoo.wfClone.acquireLock] workflow_id required");
    if (!login) throw new Error("[testWoo.wfClone.acquireLock] not authenticated");

    var cur = getLock(wid);
    if (cur && cur.locked_by && cur.locked_by !== login) {
      var err = new Error(
        "WKF locked by " + cur.locked_by + " (workflow " + (wname || wid) + ")"
      );
      err.code = "LOCKED";
      err.locked_by = cur.locked_by;
      throw err;
    }

    var now = formatDate(new Date(), "%4Y/%2M/%2D %02H:%02N:%02S");
    if (cur && cur.id) {
      xtk.session.Write(
        <testWooAiWkfLock xtkschema={LOCK_SCHEMA} _operation="update"
          id={cur.id}
          workflow_id={wid}
          workflow_name={wname || cur.workflow_name}
          locked_by={login}
          locked_at={now}
        />
      );
    } else {
      xtk.session.Write(
        <testWooAiWkfLock xtkschema={LOCK_SCHEMA} _operation="insert"
          workflow_id={wid}
          workflow_name={wname}
          locked_by={login}
          locked_at={now}
        />
      );
    }
    return getLock(wid);
  }

  function releaseLock(workflowId) {
    var wid = String(workflowId || "");
    var login = _login();
    if (!wid) return false;
    var cur = getLock(wid);
    if (!cur || !cur.id) return true;
    if (cur.locked_by && login && cur.locked_by !== login) {
      var err = new Error("cannot release lock owned by " + cur.locked_by);
      err.code = "LOCKED";
      throw err;
    }
    xtk.session.Write(
      <testWooAiWkfLock xtkschema={LOCK_SCHEMA} _operation="delete" id={cur.id}/>
    );
    return true;
  }

  // 3a. 캠페인 아래 WKF 목록
  function listWkfsByCampaign(campaignId, limit) {
    var cid = String(campaignId || "");
    if (!cid) throw new Error("[testWoo.wfClone.listWkfsByCampaign] campaignId required");
    var lim = _lim(limit);
    var maxW = getMaxWkfPerCampaign();
    var login = _login();
    var items = [];
    try {
      var q = xtk.queryDef.create(
        <queryDef schema={WF_SCHEMA} operation="select" lineCount={String(lim)}>
          <select>
            <node expr="@id"/>
            <node expr="@internalName"/>
            <node expr="@label"/>
            <node expr="@state"/>
            <node expr="@status"/>
            <node expr="@inProcess"/>
            <node expr="[@operation-id]"/>
          </select>
          <where>
            <condition expr={"[@operation-id] = " + cid}/>
          </where>
          <orderBy>
            <node expr="@id" sortDesc="true"/>
          </orderBy>
        </queryDef>
      );
      var res = q.ExecuteQuery();
      if (res && res.workflow) {
        for each (var w in res.workflow) {
          var id = String(w.@id || "");
          var name = String(w.@internalName || "");
          var lock = getLock(id);
          var lockedBy = lock ? String(lock.locked_by || "") : "";
          var lockedByOther = !!(lockedBy && login && lockedBy !== login);
          items.push({
            id: id,
            name: name,
            label: String(w.@label || name),
            state: String(w.@state || ""),
            status: String(w.@status || ""),
            inProcess: String(w.@inProcess || "0"),
            operation_id: String(w.@["operation-id"] || cid),
            locked_by: lockedBy,
            locked: lockedByOther,
            selectable: !lockedByOther
          });
        }
      }
    } catch (eQ) {
      try {
        logWarning("[testWoo.wfClone.listWkfsByCampaign] " + eQ);
      } catch (eL) {}
      throw new Error(
        "[testWoo.wfClone.listWkfsByCampaign] " +
          (eQ && eQ.message != null ? eQ.message : eQ)
      );
    }
    return {
      items: items,
      wkfCount: items.length,
      wkfMax: maxW,
      canCreateWkf: items.length < maxW
    };
  }

  // 3b. WKF 추가 (PoC-T3b: CreateInstanceFromModel → operation-id)
  function createWkfFromTemplate(campaignId, labelOpt) {
    var cid = String(campaignId || "");
    if (!cid) throw new Error("[testWoo.wfClone.createWkfFromTemplate] campaignId required");

    var maxW = getMaxWkfPerCampaign();
    var cnt = _countWkfs(cid);
    if (cnt >= maxW) {
      var errMax = new Error(
        "WKF limit reached for campaign (" + cnt + "/" + maxW + ")"
      );
      errMax.code = "WKF_MAX";
      errMax.wkfCount = cnt;
      errMax.wkfMax = maxW;
      throw errMax;
    }

    var modelId = getWkfTemplateId();
    var srcName = getTemplateName();
    var newLabel = _trim(labelOpt);
    if (!newLabel) newLabel = "AI WKF";

    var wfId = 0;
    try {
      var diff =
        <workflow label={newLabel} operation-id={cid}/>;
      wfId = xtk.queryDef.CreateInstanceFromModel(WF_SCHEMA, modelId, diff);
    } catch (eCr) {
      throw new Error(
        "[testWoo.wfClone.createWkfFromTemplate] CreateInstanceFromModel(" +
          modelId +
          "): " +
          (eCr && eCr.message != null ? eCr.message : eCr)
      );
    }
    if (!wfId || parseInt(String(wfId), 10) <= 0) {
      throw new Error(
        "[testWoo.wfClone.createWkfFromTemplate] CreateInstanceFromModel returned 0 (modelId=" +
          modelId +
          ")"
      );
    }

    var qd2 = xtk.queryDef.create(
      <queryDef schema={WF_SCHEMA} operation="get">
        <select>
          <node expr="@id"/>
          <node expr="@internalName"/>
          <node expr="@label"/>
          <node expr="@state"/>
          <node expr="@status"/>
          <node expr="@inProcess"/>
          <node expr="[@operation-id]"/>
          <node expr="@modelName"/>
        </select>
        <where>
          <condition expr={"@id = " + wfId}/>
        </where>
      </queryDef>
    );
    var created = qd2.ExecuteQuery();
    if (!created || !created.@id) {
      throw new Error(
        "[testWoo.wfClone.createWkfFromTemplate] created but get failed id=" + wfId
      );
    }

    var out = {
      id: String(created.@id || wfId),
      name: String(created.@internalName || ""),
      label: String(created.@label || newLabel),
      state: String(created.@state || "0"),
      status: String(created.@status || "0"),
      inProcess: String(created.@inProcess || "0"),
      operation_id: String(created.@["operation-id"] || cid),
      template: srcName,
      template_id: modelId,
      modelName: String(created.@modelName || ""),
      open_fallback: true,
      wkfCount: cnt + 1,
      wkfMax: maxW
    };

    try {
      acquireLock(out.id, out.name);
      out.locked_by = _login();
    } catch (eLock) {
      try {
        logWarning("[testWoo.wfClone.createWkfFromTemplate] lock after create: " + eLock);
      } catch (eL2) {}
    }
    return out;
  }

  // 하위 호환 이름 (잘못 쓰이던 program → campaign)
  function listWkfsByProgram(campaignId, limit) {
    var r = listWkfsByCampaign(campaignId, limit);
    return r.items;
  }

  // 5. internalName[] → WKF·캠페인·Program·잠금 맵 (전역 매칭 enrichment)
  function resolveWorkflowsByName(names) {
    var map = {};
    if (!names || !names.length) return map;
    var login = _login();
    var uniq = [];
    var seenN = {};
    for (var i = 0; i < names.length; i++) {
      var n0 = _trim(names[i]);
      if (!n0 || seenN[n0]) continue;
      seenN[n0] = true;
      uniq.push(n0);
      if (uniq.length >= 100) break;
    }
    if (!uniq.length) return map;

    var opIds = {};
    for (var ui = 0; ui < uniq.length; ui++) {
      var wname = uniq[ui];
      try {
        var qw = xtk.queryDef.create(
          <queryDef schema={WF_SCHEMA} operation="getIfExists">
            <select>
              <node expr="@id"/>
              <node expr="@internalName"/>
              <node expr="@label"/>
              <node expr="[@operation-id]"/>
            </select>
            <where>
              <condition expr={"@internalName = '" + _esc(wname) + "'"}/>
            </where>
          </queryDef>
        );
        var w = qw.ExecuteQuery();
        if (!w || String(w.@id || "") === "") continue;
        var wid = String(w.@id || "");
        var oid = String(w.@["operation-id"] || "");
        var lock = getLock(wid);
        var lockedBy = lock ? String(lock.locked_by || "") : "";
        var lockedByOther = !!(lockedBy && login && lockedBy !== login);
        map[wname] = {
          id: wid,
          name: String(w.@internalName || wname),
          label: String(w.@label || wname),
          operation_id: oid,
          locked_by: lockedBy,
          locked: lockedByOther,
          campaign_id: oid,
          campaign_name: "",
          campaign_label: "",
          program_id: "",
          program_name: "",
          program_label: ""
        };
        if (oid) opIds[oid] = true;
      } catch (eW) {
        try {
          logWarning(
            "[testWoo.wfClone.resolveWorkflowsByName] wf " + wname + ": " + eW
          );
        } catch (eL) {}
      }
    }

    var opMap = {};
    for (var oidK in opIds) {
      if (!opIds.hasOwnProperty(oidK)) continue;
      try {
        var qo = xtk.queryDef.create(
          <queryDef schema={OP_SCHEMA} operation="getIfExists">
            <select>
              <node expr="@id"/>
              <node expr="@internalName"/>
              <node expr="@label"/>
              <node expr="[@program-id]"/>
              <node expr="[program/@id]"/>
              <node expr="[program/@name]"/>
              <node expr="[program/@label]"/>
              <node expr="[program/@fullName]"/>
            </select>
            <where>
              <condition expr={"@id = " + oidK}/>
            </where>
          </queryDef>
        );
        var op = qo.ExecuteQuery();
        if (!op || String(op.@id || "") === "") continue;
        var pid = String(
          op.@["program-id"] ||
            (op.program && op.program.@id) ||
            ""
        );
        var pName = String((op.program && op.program.@name) || "");
        var pLabel = String(
          (op.program && (op.program.@label || op.program.@name)) || ""
        );
        if ((!pName || !pLabel) && pid) {
          try {
            var prog = getProgramFullName(pid);
            pName = prog.name || pName;
            pLabel = prog.label || pLabel;
          } catch (eP) {}
        }
        opMap[oidK] = {
          campaign_id: String(op.@id || oidK),
          campaign_name: String(op.@internalName || ""),
          campaign_label: String(op.@label || op.@internalName || ""),
          program_id: pid,
          program_name: pName,
          program_label: pLabel || pName
        };
      } catch (eO) {
        try {
          logWarning(
            "[testWoo.wfClone.resolveWorkflowsByName] op " + oidK + ": " + eO
          );
        } catch (eL2) {}
      }
    }

    for (var wn in map) {
      if (!map.hasOwnProperty(wn)) continue;
      var meta = map[wn];
      var om = opMap[meta.operation_id];
      if (!om) continue;
      meta.campaign_id = om.campaign_id;
      meta.campaign_name = om.campaign_name;
      meta.campaign_label = om.campaign_label;
      meta.program_id = om.program_id;
      meta.program_name = om.program_name;
      meta.program_label = om.program_label;
    }
    return map;
  }

  return {
    getTemplateName: getTemplateName,
    getCampaignTemplateId: getCampaignTemplateId,
    getWkfTemplateId: getWkfTemplateId,
    getMaxWkfPerCampaign: getMaxWkfPerCampaign,
    getProgramFullName: getProgramFullName,
    listCampaignsByProgram: listCampaignsByProgram,
    createCampaign: createCampaign,
    listWkfsByCampaign: listWkfsByCampaign,
    listWkfsByProgram: listWkfsByProgram,
    createWkfFromTemplate: createWkfFromTemplate,
    resolveWorkflowsByName: resolveWorkflowsByName,
    acquireLock: acquireLock,
    releaseLock: releaseLock,
    getLock: getLock
  };
})();
testWoo.wfClone.__v = "159";
