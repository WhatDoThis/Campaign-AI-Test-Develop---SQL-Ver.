/*
 * testWooWorkflowClone.js (Campaign·WKF 템플릿·잠금)
 * ==================================================
 * litmus 동기 __v=172. createWkf 단일 CreateInstanceFromModel+patch · ref clone Studio 제외.
 *
 * [Main Functions]
 * ===========
 * - getTemplateName — WKF 템플릿 internalName (wfEmptyTemplate_AI)
 * - getCampaignTemplateName — 캠페인 템플릿 internalName (OPEmptyTemplate_AI)
 * - getCampaignTemplateId — 캠페인 템플릿 id (Option·Env internalName 검증)
 * - getWkfTemplateId — WKF 템플릿 id (Option·Env internalName 검증)
 * - getTemplateDiagnostics — Option/Env/resolved source·mismatch 진단
 * - getMaxWkfPerCampaign — 캠페인당 WKF 상한
 * - getProgramFullName — Program id→fullName
 * - listCampaignsByProgram — Program 하위 Campaign 목록
 * - createCampaign — CreateOperationFromModelId+program-id·default WKF ensure
 * - listWkfsByCampaign — Campaign 하위 WKF 목록
 * - listWkfsByProgram — Program 하위 WKF 목록
 * - createWkfFromTemplate — CreateInstanceFromModel 1회 + bundled canvas patch · getLastWkfCreateDiag
 * - resolveWorkflowsByName — 전역 WKF·캠페인·Program 메타
 * - acquireLock — WKF soft-lock 획득
 * - releaseLock — soft-lock 해제
 * - getLock — 현재 lock 조회
 *
 * [Dependencies]
 * =========
 * - nms:operation·xtk:workflow·woo:testWooAiWkfLock — schema·Write
 * - testWoo.cfg.getConfig — Option id 정본(Config 선로드 필수)
 * - testWoo.env.getEnv — nms contract·fallback id
 * - new_ver/workflow/AI_Studio_Tamplate.xml — OPEmptyTemplate_AI(30030)+wfEmptyTemplate_AI(42102) canvas 정본
 * - twSanitizeXmlText — planning label(XML 1.0)
 */

if (typeof testWoo === "undefined") testWoo = {};

testWoo.wfClone = (function () {
  var WF_SCHEMA = "xtk:workflow";
  var OP_SCHEMA = "nms:operation";
  var FOLDER_SCHEMA = "xtk:folder";
  var LOCK_SCHEMA = "woo:testWooAiWkfLock";
  var DEFAULT_LIMIT = 200;
  var MAX_LIMIT = 500;
  var _lastWkfCreateDiag = null;

  function _listLimits() {
    try {
      if (testWoo.cfg && testWoo.cfg.getConfig) return testWoo.cfg.getConfig().ui;
    } catch (eC) {}
    try {
      if (testWoo.env && testWoo.env.getEnv) return testWoo.env.getEnv().ui;
    } catch (eE) {}
    return { listLimit: DEFAULT_LIMIT, listLimitMax: MAX_LIMIT };
  }

  function _trim(s) {
    return twTrim
      ? twTrim(s)
      : String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  function _nms() {
    try {
      if (testWoo.cfg && testWoo.cfg.getConfig) return testWoo.cfg.getConfig().nms;
    } catch (eC) {}
    try {
      if (testWoo.env && testWoo.env.getEnv) return testWoo.env.getEnv().nms;
    } catch (eE) {}
    return {};
  }

  function _opts() {
    try {
      if (testWoo.cfg && testWoo.cfg.getConfig) return testWoo.cfg.getConfig().options;
    } catch (eO) {}
    return {};
  }

  function _optStr(key) {
    if (!key) return "";
    if (testWoo.cfg && testWoo.cfg.getStr) return testWoo.cfg.getStr(key);
    return "";
  }

  function _optKeys() {
    try {
      if (testWoo.env && testWoo.env.getEnv) {
        var k = testWoo.env.getEnv().options;
        if (k && k.keys) return k.keys;
      }
    } catch (eK) {}
    return {};
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
    var ui = _listLimits();
    var defLim = Number(ui.listLimit) || DEFAULT_LIMIT;
    var maxLim = Number(ui.listLimitMax) || MAX_LIMIT;
    var lim = parseInt(limit, 10);
    if (isNaN(lim) || lim <= 0) lim = defLim;
    if (lim > maxLim) lim = maxLim;
    return lim;
  }

  // 1a. WKF 템플릿 이름 (표시·이름 해석용)
  function getTemplateName() {
    var N = _nms();
    var O = _opts();
    var n = _trim(O.wkfTemplateName || "");
    if (!n) {
      var K = _optKeys();
      n = _trim(_optStr(K.wkfTemplateName));
    }
    if (!n) {
      return String(N.wkfTemplateName || "wfEmptyTemplate_AI");
    }
    return n;
  }

  function _idFromOption(optKey) {
    var id = 0;
    var raw = _optStr(optKey);
    if (raw !== "") id = parseInt(raw, 10);
    if (isNaN(id) || id <= 0) return 0;
    return id;
  }

  function _resolveModelId(schema, internalName) {
    var nm = _trim(internalName);
    if (!nm) return 0;
    try {
      var q = xtk.queryDef.create(
        <queryDef schema={schema} operation="get">
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
        logWarning("[testWoo.wfClone._resolveModelId] " + schema + " " + nm + ": " + eR);
      } catch (eL) {}
    }
    return 0;
  }

  function _ensureCfgLoaded() {
    try {
      if (!testWoo.env || !testWoo.env.getEnv) loadLibrary("woo:testWooEnv.js");
    } catch (eE) {}
    try {
      if (!testWoo.cfg || !testWoo.cfg.getConfig) loadLibrary("woo:testWooConfig.js");
    } catch (eC) {}
  }

  function _modelMetaById(schema, modelId) {
    var meta = { id: 0, internalName: "", label: "", isModel: 0 };
    var nid = parseInt(String(modelId || 0), 10);
    if (isNaN(nid) || nid <= 0) return meta;
    try {
      var q = xtk.queryDef.create(
        <queryDef schema={schema} operation="get">
          <select>
            <node expr="@id"/>
            <node expr="@internalName"/>
            <node expr="@label"/>
            <node expr="@isModel"/>
          </select>
          <where>
            <condition expr={"@id = " + nid}/>
          </where>
        </queryDef>
      );
      var r = q.ExecuteQuery();
      if (r && r.@id) {
        meta.id = nid;
        meta.internalName = String(r.@internalName || "");
        meta.label = String(r.@label || "");
        meta.isModel = parseInt(String(r.@isModel || "0"), 10) || 0;
      }
    } catch (eM) {
      try {
        logWarning(
          "[testWoo.wfClone._modelMetaById] " + schema + " id=" + modelId + ": " + eM
        );
      } catch (eL) {}
    }
    return meta;
  }

  function _modelInternalNameById(schema, modelId) {
    var nid = parseInt(String(modelId || 0), 10);
    if (isNaN(nid) || nid <= 0) return "";
    try {
      var q = xtk.queryDef.create(
        <queryDef schema={schema} operation="get">
          <select>
            <node expr="@internalName"/>
            <node expr="@isModel"/>
          </select>
          <where>
            <condition expr={"@id = " + nid}/>
          </where>
        </queryDef>
      );
      var r = q.ExecuteQuery();
      if (r && r.@internalName) return String(r.@internalName);
    } catch (eM) {
      try {
        logWarning(
          "[testWoo.wfClone._modelInternalNameById] " + schema + " id=" + modelId + ": " + eM
        );
      } catch (eL) {}
    }
    return "";
  }

  /** Option id 정본 → contract internalName 검증 → lookup → Env fallback */
  function _pickTemplateId(schema, expectedInternalName, optId, envId, optKeyLabel) {
    expectedInternalName = _trim(expectedInternalName);
    var byNameId = _resolveModelId(schema, expectedInternalName);
    var oid = parseInt(String(optId || 0), 10);
    var eid = parseInt(String(envId || 0), 10);
    if (!isNaN(oid) && oid > 0) {
      var optNm = _modelInternalNameById(schema, oid);
      if (expectedInternalName && optNm && optNm !== expectedInternalName) {
        var useId = 0;
        var useSource = "option_corrected";
        if (byNameId) {
          useId = byNameId;
          useSource = "lookup";
        } else if (!isNaN(eid) && eid > 0) {
          var envNm = _modelInternalNameById(schema, eid);
          if (envNm === expectedInternalName) {
            useId = eid;
            useSource = "env_fallback";
          }
        }
        if (useId) {
          try {
            logWarning(
              "[testWoo.wfClone] " + optKeyLabel + " Option id=" + oid +
              " (" + optNm + ") != contract " + expectedInternalName +
              " — using id=" + useId + " source=" + useSource
            );
          } catch (eW) {}
          return {
            id: useId,
            source: useSource,
            warning:
              optKeyLabel + " Option id=" + oid + " (" + optNm +
              ") != contract " + expectedInternalName
          };
        }
        throw new Error(
          "[testWoo.wfClone] " + optKeyLabel + " template mismatch: ACC Option id=" + oid +
          " internalName='" + optNm + "' but contract expects '" + expectedInternalName + "'. " +
          "콘솔에서 " + optKeyLabel + " 를 contract에 맞는 id로 수정하거나 비우세요. " +
          "가이드: docs/report/16_ACC_Option_설정가이드.md"
        );
      }
      return { id: oid, source: "option", warning: "" };
    }
    if (byNameId) {
      return { id: byNameId, source: "lookup", warning: "" };
    }
    if (!isNaN(eid) && eid > 0) {
      return { id: eid, source: "env_fallback", warning: "" };
    }
    if (expectedInternalName) {
      throw new Error(
        "[testWoo.wfClone] " + optKeyLabel + " template not found: internalName=" +
          expectedInternalName
      );
    }
    return { id: 0, source: "none", warning: "" };
  }

  function _pickTemplateIdValue(schema, expectedInternalName, optId, envId, optKeyLabel) {
    return _pickTemplateId(schema, expectedInternalName, optId, envId, optKeyLabel).id;
  }

  function _templateResolveMeta(kind, schema, expectedName, optId, envId, optKeyLabel) {
    var meta = {
      kind: kind,
      contract_name: expectedName,
      env_fallback_id: envId || 0,
      option_id: optId || 0,
      option_internalName: "",
      resolved_id: 0,
      resolved_source: "none",
      warning: "",
      error: ""
    };
    if (meta.option_id) {
      meta.option_internalName = _modelInternalNameById(schema, meta.option_id);
    }
    try {
      var picked = _pickTemplateId(schema, expectedName, optId, envId, optKeyLabel);
      meta.resolved_id = picked.id;
      meta.resolved_source = picked.source;
      meta.warning = picked.warning || "";
      meta.mismatch = !!(
        meta.option_id &&
        meta.option_internalName &&
        expectedName &&
        meta.option_internalName !== expectedName
      );
    } catch (eMeta) {
      meta.error = String(eMeta && eMeta.message != null ? eMeta.message : eMeta);
      meta.mismatch = !!(
        meta.option_id &&
        meta.option_internalName &&
        expectedName &&
        meta.option_internalName !== expectedName
      );
    }
    return meta;
  }

  function _aiActivityName() {
    var N = _nms();
    return String(N.aiActivityName || "aiStudioSql");
  }

  function _wfFindChild(xml, elName) {
    if (!xml) return null;
    try {
      var kids = xml.children();
      var n = kids.length();
      var i;
      for (i = 0; i < n; i++) {
        if (String(kids[i].name()) === elName) return kids[i];
      }
    } catch (eF) {}
    return null;
  }

  function _wfEntityRaw(wf) {
    if (!wf) return "";
    try {
      if (wf.toXMLString) return String(wf.toXMLString());
    } catch (e0) {}
    try {
      return String(wf);
    } catch (e1) {}
    return "";
  }

  function _wfEntityHasBody(wf) {
    if (!wf) return false;
    if (_wfFindChild(wf, "activities")) return true;
    if (_wfFindChild(wf, "data")) return true;
    try {
      if (wf.data != null) return true;
    } catch (eD) {}
    return false;
  }

  function _loadWfEntity(wfId, wfName) {
    var wid = _trim(wfId);
    var nId = parseInt(wid || "0", 10);
    var best = null;
    if (isNaN(nId) || nId <= 0) {
      throw new Error("[testWoo.wfClone._loadWfEntity] id required");
    }
    try {
      var loaded = xtk.workflow.load(nId);
      if (loaded && loaded.@id) best = loaded;
    } catch (eLd) {}
    if (_wfEntityHasBody(best)) return best;
    try {
      var loaded2 = xtk.workflow.Load(nId);
      if (loaded2 && loaded2.@id) best = loaded2;
    } catch (eLd2) {}
    if (_wfEntityHasBody(best)) return best;
    try {
      var got = xtk.session.GetEntityIfMoreRecent(WF_SCHEMA, String(nId), "");
      if (got && got.@id) best = got;
    } catch (eGe) {}
    if (_wfEntityHasBody(best)) return best;
    try {
      var q = xtk.queryDef.create(
        <queryDef schema={WF_SCHEMA} operation="get">
          <select>
            <node expr="@id"/>
            <node expr="@internalName"/>
            <node expr="@label"/>
            <node expr="data"/>
          </select>
          <where>
            <condition expr={"@id = " + nId}/>
          </where>
        </queryDef>
      );
      var byId = q.ExecuteQuery();
      if (byId && byId.@id) best = byId;
    } catch (eQ) {}
    if (!best || !best.@id) {
      throw new Error(
        "[testWoo.wfClone._loadWfEntity] not found id=" + wid +
          (wfName ? (" name=" + wfName) : "")
      );
    }
    return best;
  }

  function _wfEntityHasAiActivity(wf) {
    var target = _aiActivityName();
    var raw = _wfEntityRaw(wf);
    if (!raw) return false;
    if (raw.indexOf('name="' + target + '"') >= 0) return true;
    if (raw.indexOf("name='" + target + "'") >= 0) return true;
    return false;
  }

  function _probeWfAi(wfId) {
    var sid = String(wfId || "");
    if (!sid) return "id=?";
    try {
      var wf = _loadWfEntity(sid, "");
      var raw = _wfEntityRaw(wf);
      return "id=" + sid +
        " load=ok rawLen=" + String(raw.length) +
        " hasAi=" + (_wfEntityHasAiActivity(wf) ? "1" : "0");
    } catch (eP) {
      var em = String(eP && eP.message != null ? eP.message : eP);
      if (em.length > 80) em = em.substring(0, 80) + "...";
      return "id=" + sid + " load=fail:" + em;
    }
  }

  function _wfExtractDataNode(wf) {
    if (!wf) return null;
    var acts = _wfFindChild(wf, "activities");
    if (acts) {
      var copied = _wfCopyXmlNode(acts);
      if (!copied) return null;
      var wrapActs = <data/>;
      wrapActs.appendChild(copied);
      return wrapActs;
    }
    var dataEl = _wfFindChild(wf, "data");
    if (!dataEl) {
      try {
        if (wf.data != null) dataEl = wf.data;
      } catch (eD) {}
    }
    if (dataEl) return _wfCopyXmlNode(dataEl) || dataEl;
    return null;
  }

  function _wfCanvasHasAiActivity(wfId) {
    try {
      var wf = _loadWfEntity(wfId, "");
      return _wfEntityHasAiActivity(wf);
    } catch (eLoad) {
      var target = _aiActivityName();
      var nid = parseInt(String(wfId || 0), 10);
      if (isNaN(nid) || nid <= 0) return false;
      try {
        var q = xtk.queryDef.create(
          <queryDef schema={WF_SCHEMA} operation="get">
            <select>
              <node expr="data"/>
            </select>
            <where>
              <condition expr={"@id = " + nid}/>
            </where>
          </queryDef>
        );
        var wfQ = q.ExecuteQuery();
        if (!wfQ || wfQ.data == null) return false;
        var raw = _wfEntityRaw(wfQ.data);
        if (raw.indexOf('name="' + target + '"') >= 0) return true;
        if (raw.indexOf("name='" + target + "'") >= 0) return true;
      } catch (eH) {
        try {
          logWarning("[testWoo.wfClone._wfCanvasHasAiActivity] " + eH);
        } catch (eL) {}
      }
    }
    return false;
  }

  // 1a2. 캠페인 템플릿 id (CreateOperationFromModelId)
  function getCampaignTemplateId() {
    var N = _nms();
    var O = _opts();
    var K = _optKeys();
    var optId = O.campaignTemplateId || 0;
    if (!optId) optId = _idFromOption(K.campaignTemplateId);
    return _pickTemplateIdValue(
      OP_SCHEMA,
      String(N.campaignTemplateName || ""),
      optId,
      Number(N.campaignTemplateId) || 0,
      "testWooAiCampaignTemplateId"
    );
  }

  // 1a3. WKF 템플릿 id (CreateInstanceFromModel)
  function getWkfTemplateId() {
    var N = _nms();
    var O = _opts();
    var K = _optKeys();
    var optId = O.wkfTemplateId || 0;
    if (!optId) optId = _idFromOption(K.wkfTemplateId);
    return _pickTemplateIdValue(
      WF_SCHEMA,
      getTemplateName(),
      optId,
      Number(N.wkfTemplateId) || 0,
      "testWooAiWkfTemplateId"
    );
  }

  function getTemplateDiagnostics() {
    var N = _nms();
    var O = _opts();
    var K = _optKeys();
    var campOptId = O.campaignTemplateId || _idFromOption(K.campaignTemplateId);
    var wkfOptId = O.wkfTemplateId || _idFromOption(K.wkfTemplateId);
    var campName = getCampaignTemplateName();
    var wkfName = getTemplateName();
    var campMeta = _templateResolveMeta(
      "campaign",
      OP_SCHEMA,
      campName,
      campOptId,
      Number(N.campaignTemplateId) || 0,
      "testWooAiCampaignTemplateId"
    );
    var wkfMeta = _templateResolveMeta(
      "wkf",
      WF_SCHEMA,
      wkfName,
      wkfOptId,
      Number(N.wkfTemplateId) || 0,
      "testWooAiWkfTemplateId"
    );
    wkfMeta.ai_activity = _aiActivityName();
    return {
      priority:
        "Option id -> contract internalName verify -> DB lookup -> Env fallback id",
      guide: "docs/report/16_ACC_Option_설정가이드.md",
      campaign: campMeta,
      wkf: wkfMeta
    };
  }

  function getCampaignTemplateName() {
    var N = _nms();
    return String(N.campaignTemplateName || "OPEmptyTemplate_AI");
  }

  // 1b. 캠페인당 WKF 상한 (기본 15)
  function getMaxWkfPerCampaign() {
    var N = _nms();
    var O = _opts();
    var K = _optKeys();
    var n = Number(N.wkfMaxPerCampaign) || 15;
    var raw = _trim(O.wkfMaxPerCampaign || "");
    if (!raw) raw = _trim(_optStr(K.wkfMaxPerCampaign));
    if (raw !== "") n = parseInt(raw, 10);
    if (isNaN(n) || n <= 0) n = Number(N.wkfMaxPerCampaign) || 15;
    var hard = Number(N.wkfMaxHardCap) || 20;
    if (n > hard) n = hard;
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

  function _listWkfsOnOperation(operationId, limit) {
    var oid = String(operationId || "");
    if (!oid) return [];
    var items = [];
    try {
      var q = xtk.queryDef.create(
        <queryDef schema={WF_SCHEMA} operation="select" lineCount={String(_lim(limit))}>
          <select>
            <node expr="@id"/>
            <node expr="@internalName"/>
            <node expr="@label"/>
            <node expr="@modelName"/>
          </select>
          <where>
            <condition expr={"[@operation-id] = " + oid}/>
          </where>
          <orderBy>
            <node expr="@id" sortDesc="false"/>
          </orderBy>
        </queryDef>
      );
      var res = q.ExecuteQuery();
      if (res && res.workflow) {
        for each (var wf in res.workflow) {
          items.push({
            id: String(wf.@id || ""),
            name: String(wf.@internalName || ""),
            label: String(wf.@label || wf.@internalName || ""),
            modelName: String(wf.@modelName || "")
          });
        }
      }
    } catch (eL) {
      try {
        logWarning("[testWoo.wfClone._listWkfsOnOperation] op=" + oid + ": " + eL);
      } catch (eLog) {}
    }
    return items;
  }

  function _findWkfWithAiActivityOnOperation(operationId, limit) {
    var items = _listWkfsOnOperation(operationId, limit);
    var i;
    for (i = 0; i < items.length; i++) {
      if (items[i].id && _wfCanvasHasAiActivity(items[i].id)) return items[i];
    }
    return null;
  }

  /** aiStudioSql canvas가 있는 clone reference 후보 (중복 제거·canvas 검증) */
  function _listWkfCloneReferenceCandidates(campaignId) {
    var out = [];
    var seen = {};
    var i;

    function _pushRef(id, source) {
      var sid = String(id || "");
      if (!sid || seen[sid]) return;
      if (!_wfCanvasHasAiActivity(sid)) return;
      seen[sid] = 1;
      out.push({ id: sid, source: source });
    }

    var cid = String(campaignId || "");
    if (cid) {
      var sibs = _listWkfsOnOperation(cid, 20);
      for (i = 0; i < sibs.length; i++) {
        _pushRef(sibs[i].id, "campaign_sibling");
      }
    }
    try {
      var tplId = getCampaignTemplateId();
      if (tplId) {
        var tplItems = _listWkfsOnOperation(String(tplId), 8);
        for (i = 0; i < tplItems.length; i++) {
          _pushRef(tplItems[i].id, "campaign_template");
        }
      }
    } catch (eTpl) {
      try {
        logWarning("[testWoo.wfClone._listWkfCloneReferenceCandidates] tpl: " + eTpl);
      } catch (eL) {}
    }

    var modelId = getWkfTemplateId();
    _pushRef(modelId, "wkf_model_id");
    var byName = _resolveModelId(WF_SCHEMA, getTemplateName());
    if (byName && String(byName) !== String(modelId)) {
      _pushRef(byName, "wkf_model_name");
    }
    return out;
  }

  /** canvas 사전검증 없이 clone 시도할 id (queryDef만으로는 hasAi=false인 경우) */
  function _listWkfCloneBlindTry(campaignId, verified) {
    var out = [];
    var seen = {};
    var i;

    function _pushTry(id, source) {
      var sid = String(id || "");
      if (!sid || seen[sid]) return;
      seen[sid] = 1;
      out.push({ id: sid, source: source });
    }

    if (verified) {
      for (i = 0; i < verified.length; i++) {
        seen[String(verified[i].id || "")] = 1;
      }
    }

    var modelId = getWkfTemplateId();
    _pushTry(modelId, "wkf_model_id_blind");
    var byName = _resolveModelId(WF_SCHEMA, getTemplateName());
    if (byName && String(byName) !== String(modelId)) {
      _pushTry(byName, "wkf_model_name_blind");
    }

    /* campaign sibling/template blind 제거 — default WKF 등 ai 없는 ref clone orphan (#448) */
    return out;
  }

  function _beginWkfCreateDiag(cid, label, cntBefore) {
    _lastWkfCreateDiag = {
      campaign_id: String(cid || ""),
      label: String(label || ""),
      wkf_count_before: cntBefore,
      wkf_count_after: cntBefore,
      verified_count: 0,
      blind_count: 0,
      attempts: [],
      orphans_deleted: [],
      success: false,
      result_id: "",
      result_source: ""
    };
  }

  function _pushWkfCreateAttempt(row) {
    if (!_lastWkfCreateDiag || !row) return;
    _lastWkfCreateDiag.attempts.push(row);
  }

  function getLastWkfCreateDiag() {
    return _lastWkfCreateDiag;
  }

  function _rollbackWkf(wfId, reason) {
    var wid = parseInt(String(wfId || 0), 10);
    if (isNaN(wid) || wid <= 0) return false;
    try {
      xtk.session.Write(
        <workflow xtkschema={WF_SCHEMA} _operation="delete" id={String(wid)}/>
      );
      try {
        logInfo(
          "[testWoo.wfClone._rollbackWkf] id=" + wid +
          " reason=" + String(reason || "")
        );
      } catch (eLi) {}
      if (_lastWkfCreateDiag) {
        _lastWkfCreateDiag.orphans_deleted.push(String(wid));
      }
      return true;
    } catch (eDel) {
      try {
        logWarning(
          "[testWoo.wfClone._rollbackWkf] id=" + wid + " failed: " + eDel
        );
      } catch (eLw) {}
      return false;
    }
  }

  /** insert 전 reference canvas clone 가능 여부 (DB insert 없음) */
  function _refEntityCloneable(refWfId) {
    var rid = parseInt(String(refWfId || 0), 10);
    if (isNaN(rid) || rid <= 0) {
      return { ok: false, reason: "invalid_ref_id" };
    }
    try {
      var src = _loadWfEntity(String(rid), "");
      if (_wfEntityHasAiActivity(src)) {
        return { ok: true, reason: "ref_has_ai" };
      }
      return {
        ok: false,
        reason: "ref_no_ai rawLen=" + String(_wfEntityRaw(src).length)
      };
    } catch (eRef) {
      return {
        ok: false,
        reason: "ref_load_fail:" +
          String(eRef && eRef.message != null ? eRef.message : eRef)
      };
    }
  }

  function _buildWkfInsertDataNode(dataNode) {
    if (!dataNode) return null;
    var name = "";
    try {
      name = String(dataNode.name() || "");
    } catch (eN) {
      name = "";
    }
    if (name === "data") {
      return _wfCopyXmlNode(dataNode);
    }
    var wrap = <data/>;
    var copied = _wfCopyXmlNode(dataNode);
    if (!copied) return null;
    wrap.appendChild(copied);
    return wrap;
  }

  function _appendWkfVisualState(ins, src) {
    if (!ins) return;
    /* 손상된 sibling visualState 복사 금지 — Explorer memo XML-110018 (#449) */
    try {
      ins.appendChild(<visualState><![CDATA[]]></visualState>);
    } catch (eEmpty) {}
  }

  /** @deprecated — _listWkfCloneReferenceCandidates 사용 */
  function _resolveWkfCloneReferenceId(campaignId) {
    var cands = _listWkfCloneReferenceCandidates(campaignId);
    return cands.length ? String(cands[0].id) : "";
  }

  function _wfCopyXmlNode(node) {
    if (!node) return null;
    try {
      if (node.copy) return node.copy();
    } catch (eC) {}
    try {
      var raw = node.toXMLString ? String(node.toXMLString()) : String(node);
      if (raw) return new XML(raw);
    } catch (eX) {}
    return null;
  }

  /** new_ver/workflow/AI_Studio_Tamplate.xml — bundled wfEmptyTemplate_AI canvas 정본 */
  function _templateActivitiesXml() {
    var actName = _aiActivityName();
    return <activities>
      <start collision="0" img="xtk:activities/start.png" label="Start" mask="0"
             name="start" onError="0" runOnSimulation="true" timezone="_inherit_"
             x="76" y="100">
        <transitions>
          <initial enabled="true" name="initial" target={actName}/>
        </transitions>
      </start>
      <sqlDM andJoin="true" autoCreate="false" collision="0" defaultExtAccountName="fda"
             extAccount-id="16600" img="xtk:activities/execsql.png"
             joinPk="sCustomer_id" joinTable="testWooSampleCustomer" label="AI Studio SQL"
             mask="0" name={actName} onError="0" schema="woo:testWooSampleCustomer"
             timezone="_inherit_" useEntity="false" x="240" y="96">
        <initScript>logInfo("[aiStudioSql] tableName=" + activity.tableName);</initScript>
        <transitions>
          <done enabled="true" label="Ok" name="done"/>
        </transitions>
        <extAccount/>
        <script><![CDATA[CREATE TABLE <%= activity.tableName %> AS SELECT c.iTestWooSampleCustomerId AS iId, c.sCustomer_id, c.sName, c.iAge, c.sGender, c.tsBirth_date, c.sRegion, c.iMarketing_consent, c.iSms_consent, c.sEmail, c.sStatus, c.tsCreated_date FROM (<%= activity.userScript %>) t JOIN <%= activity.joinTable %> c ON c.<%= activity.joinPk %> = t.<%= activity.joinPk %>]]></script>
        <userScript><![CDATA[]]></userScript>
        <ai-sql-id>0</ai-sql-id>
      </sqlDM>
    </activities>;
  }

  function _minimalAiActivitiesXml() {
    return _templateActivitiesXml();
  }

  function _wfActivitiesFromTemplateModel() {
    return _templateActivitiesXml();
  }

  function _wfApplyCanvas(wfId, acts) {
    if (!acts) return false;
    var actsCopy = _wfCopyXmlNode(acts);
    if (!actsCopy) return false;
    var nid = parseInt(String(wfId || 0), 10);
    if (isNaN(nid) || nid <= 0) return false;
    try {
      var dataWrap = <data/>;
      dataWrap.appendChild(actsCopy);
      var patch = <workflow xtkschema={WF_SCHEMA} _operation="update" id={String(nid)}/>;
      patch.appendChild(dataWrap);
      xtk.session.Write(patch);
      return true;
    } catch (eData) {
      try {
        logWarning("[testWoo.wfClone._wfApplyCanvas] id=" + wfId + ": " + eData);
      } catch (eL1) {}
    }
    return false;
  }

  /** data memo만 surgical update — full workflow Write(memo 손상) 금지 */
  function _patchAiActivityCanvas(wfId) {
    var out = { ok: false, error: "" };
    var nid = parseInt(String(wfId || 0), 10);
    if (isNaN(nid) || nid <= 0) {
      out.error = "invalid wfId";
      return out;
    }
    try {
      var wf = _loadWfEntity(String(nid), "");
      if (_wfEntityHasAiActivity(wf)) {
        out.ok = true;
        return out;
      }

      var acts = _wfActivitiesFromTemplateModel();
      if (!acts) {
        out.error = "template activities missing";
        return out;
      }
      if (!_wfApplyCanvas(nid, acts)) {
        out.error = "apply canvas failed";
        return out;
      }

      var wf2 = _loadWfEntity(String(nid), "");
      if (_wfEntityHasAiActivity(wf2)) {
        out.ok = true;
        return out;
      }
      out.error = "Write ok but hasAi=0 after reload rawLen=" + String(_wfEntityRaw(wf2).length);
    } catch (eP) {
      out.error = String(eP && eP.message != null ? eP.message : eP);
      try {
        logWarning("[testWoo.wfClone._patchAiActivityCanvas] id=" + wfId + ": " + eP);
      } catch (eL) {}
    }
    return out;
  }

  function _getWkfMetaById(wfId, cid, labelFallback) {
    var nid = parseInt(String(wfId || 0), 10);
    if (isNaN(nid) || nid <= 0) return null;
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
          <condition expr={"@id = " + nid}/>
        </where>
      </queryDef>
    );
    var created = qd2.ExecuteQuery();
    if (!created || !created.@id) return null;
    return {
      id: String(created.@id || nid),
      name: String(created.@internalName || ""),
      label: String(created.@label || labelFallback || ""),
      state: String(created.@state || "0"),
      status: String(created.@status || "0"),
      inProcess: String(created.@inProcess || "0"),
      operation_id: String(created.@["operation-id"] || cid || ""),
      modelName: String(created.@modelName || "")
    };
  }

  /** queryDef data + Write insert — createCampaign default WKF 전용 (Studio createWkf 미사용) */
  function _createWkfFromReference(refWfId, campaignId, labelOpt, createSource) {
    var rid = parseInt(String(refWfId || 0), 10);
    var cid = String(campaignId || "");
    if (isNaN(rid) || rid <= 0) {
      throw new Error("[testWoo.wfClone._createWkfFromReference] refWfId required");
    }
    var pre = _refEntityCloneable(rid);
    if (!pre.ok) {
      throw new Error(
        "[testWoo.wfClone._createWkfFromReference] ref skip id=" + rid + " " + pre.reason
      );
    }
    var newLabel = _trim(labelOpt);
    if (!newLabel) newLabel = "AI WKF";
    if (twSanitizeXmlText) newLabel = twSanitizeXmlText(newLabel);

    var src = _loadWfEntity(String(rid), "");
    var acts = _wfFindChild(src, "activities");
    var dataNode = null;
    if (acts) {
      dataNode = _wfCopyXmlNode(acts);
    }
    if (!dataNode) {
      dataNode = _wfExtractDataNode(src);
    }
    if (!dataNode) {
      throw new Error(
        "[testWoo.wfClone._createWkfFromReference] ref workflow data missing id=" + rid +
          " rawLen=" + String(_wfEntityRaw(src).length)
      );
    }
    var insertData = _buildWkfInsertDataNode(dataNode);
    if (!insertData) {
      throw new Error(
        "[testWoo.wfClone._createWkfFromReference] data wrap failed id=" + rid
      );
    }

    var idList = xtk.session.GetNewIds(1);
    var newId = parseInt(String(idList).split(",")[0], 10);
    if (isNaN(newId) || newId <= 0) {
      throw new Error("[testWoo.wfClone._createWkfFromReference] GetNewIds failed");
    }

    var ins = <workflow xtkschema={WF_SCHEMA} _operation="insert"
                        id={String(newId)} label={newLabel} operation-id={cid}/>;
    if (src.@modelName) ins.@modelName = String(src.@modelName);
    try {
      ins.appendChild(insertData);
      _appendWkfVisualState(ins, src);
    } catch (eApp) {
      throw new Error(
        "[testWoo.wfClone._createWkfFromReference] data copy failed id=" + rid + ": " + eApp
      );
    }

    var inserted = false;
    var wfId = String(newId);
    try {
      xtk.session.Write(ins);
      inserted = true;

      if (!_wfCanvasHasAiActivity(wfId)) {
        var patchRes = _patchAiActivityCanvas(wfId);
        if (!patchRes || !patchRes.ok) {
          var pErr = patchRes && patchRes.error ? patchRes.error : "patch_failed";
          throw new Error(
            "[testWoo.wfClone._createWkfFromReference] clone missing " + _aiActivityName() +
              " ref=" + rid + " new=" + wfId + " patch=" + pErr
          );
        }
      }

      var meta = _getWkfMetaById(wfId, cid, newLabel);
      if (!meta) {
        throw new Error(
          "[testWoo.wfClone._createWkfFromReference] insert ok but get failed id=" + wfId
        );
      }
      meta.create_source = createSource || "reference_clone";
      meta.reference_id = String(rid);
      return meta;
    } catch (eIns) {
      if (inserted) {
        _rollbackWkf(wfId, "create_ref_fail:" +
          String(eIns && eIns.message != null ? eIns.message : eIns));
      }
      throw eIns;
    }
  }

  /** afterClone=1인데 default WKF에 aiStudioSql 없을 때 patch·template clone */
  function _repairCampaignWkfAi(campaignId) {
    var out = { repaired: false, source: "none", wkfId: "" };
    var cid = String(campaignId || "");
    if (!cid) return out;

    var items = _listWkfsOnOperation(cid, 20);
    var i;
    for (i = 0; i < items.length; i++) {
      if (items[i].id && _wfCanvasHasAiActivity(items[i].id)) {
        out.source = "already_ok";
        out.wkfId = String(items[i].id);
        return out;
      }
    }

    if (items.length > 0 && items[0].id) {
      var patchRes = _patchAiActivityCanvas(items[0].id);
      if (patchRes && patchRes.ok) {
        out.repaired = true;
        out.source = "patch_existing";
        out.wkfId = String(items[0].id);
        return out;
      }
    }

    try {
      var cloned = _createWkfFromReference(
        getWkfTemplateId(), cid, "Workflow", "repair_template_clone"
      );
      out.repaired = true;
      out.source = "repair_template_clone";
      out.wkfId = String(cloned.id || "");
      return out;
    } catch (eClone) {
      try {
        logWarning("[testWoo.wfClone._repairCampaignWkfAi] " + eClone);
      } catch (eL) {}
    }
    return out;
  }

  /** CreateOperationFromModelId가 default WKF를 안 만들었을 때 Explorer 동작 보정 */
  function _ensureDefaultWkf(campaignId, campaignTemplateId, labelOpt) {
    var out = { created: false, source: "none", wkfId: "", wkfModelId: 0 };
    var cid = String(campaignId || "");
    if (!cid) return out;
    if (_countWkfs(cid) > 0) {
      var rep = _repairCampaignWkfAi(cid);
      out.wkfId = rep.wkfId || "";
      out.source = rep.source || "existing";
      out.created = !!rep.repaired;
      return out;
    }

    var tplWkfs = _listWkfsOnOperation(campaignTemplateId, 5);
    var wkfModelId = 0;
    var wkfLabel = _trim(labelOpt);
    if (!wkfLabel) wkfLabel = "Workflow";
    var i;

    var tplRef = _findWkfWithAiActivityOnOperation(campaignTemplateId, 5);
    if (tplRef && tplRef.id) {
      try {
        var cloned = _createWkfFromReference(
          tplRef.id, cid, wkfLabel, "template_ref_clone"
        );
        out.created = true;
        out.wkfId = cloned.id;
        out.source = "template_ref_clone";
        out.reference_id = cloned.reference_id;
        return out;
      } catch (eRef) {
        try {
          logWarning("[testWoo.wfClone._ensureDefaultWkf] template ref clone: " + eRef);
        } catch (eLog) {}
      }
    }

    for (i = 0; i < tplWkfs.length; i++) {
      var tw = tplWkfs[i];
      if (!tw || !tw.modelName) continue;
      wkfModelId = _resolveModelId(WF_SCHEMA, tw.modelName);
      if (wkfModelId) {
        out.source = "template_bundled";
        if (tw.label) wkfLabel = String(tw.label);
        break;
      }
    }
    if (!wkfModelId) {
      wkfModelId = getWkfTemplateId();
      if (wkfModelId) out.source = "wkf_option";
    }
    if (!wkfModelId) {
      try {
        logWarning(
          "[testWoo.wfClone._ensureDefaultWkf] no wkf model campaign=" + cid +
            " template=" + campaignTemplateId
        );
      } catch (eWarn) {}
      return out;
    }

    wkfLabel = twSanitizeXmlText
      ? twSanitizeXmlText(wkfLabel)
      : wkfLabel;

    try {
      var diff = <workflow label={wkfLabel} operation-id={cid}/>;
      var wfId = xtk.queryDef.CreateInstanceFromModel(WF_SCHEMA, wkfModelId, diff);
      if (wfId && parseInt(String(wfId), 10) > 0) {
        out.created = true;
        out.wkfId = String(wfId);
        out.wkfModelId = wkfModelId;
        if (!_wfCanvasHasAiActivity(out.wkfId)) {
          try {
            logWarning(
              "[testWoo.wfClone._ensureDefaultWkf] default wkf missing " +
                _aiActivityName() + " id=" + out.wkfId + " modelId=" + wkfModelId
            );
          } catch (eAct) {}
        }
      }
    } catch (eCr) {
      try {
        logWarning("[testWoo.wfClone._ensureDefaultWkf] " + eCr);
      } catch (eLog) {}
    }
    return out;
  }

  // 2c. 캠페인 생성 (PoC-T2: CreateOperationFromModelId → program-id → default WKF)
  function createCampaign(programId, labelOpt) {
    _ensureCfgLoaded();
    var prog = getProgramFullName(programId);
    var K = _optKeys();
    var O = _opts();
    var N = _nms();
    var picked = _pickTemplateId(
      OP_SCHEMA,
      getCampaignTemplateName(),
      O.campaignTemplateId || _idFromOption(K.campaignTemplateId),
      Number(N.campaignTemplateId) || 0,
      "testWooAiCampaignTemplateId"
    );
    var modelId = picked.id;
    var tplMeta = _modelMetaById(OP_SCHEMA, modelId);
    if (!tplMeta.isModel) {
      throw new Error(
        "[testWoo.wfClone.createCampaign] testWooAiCampaignTemplateId=" + modelId +
          " is not a campaign template (@isModel=0, internalName='" +
          tplMeta.internalName + "'). Explorer Campaign templates에서 @isModel=1 id를 Option에 넣으세요."
      );
    }

    var newLabel = _trim(labelOpt);
    if (!newLabel) newLabel = "AI Campaign";
    if (twSanitizeXmlText) newLabel = twSanitizeXmlText(newLabel);

    var planning = <operation label={newLabel} program-id={prog.id}/>;
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

    var wkfAfterClone = _countWkfs(String(newId));

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

    var wkfAfterWrite = _countWkfs(String(newId));
    var defaultWkf = _ensureDefaultWkf(String(newId), modelId, "Workflow");

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
      template_id: modelId,
      template_name: tplMeta.internalName || getCampaignTemplateName(),
      template_isModel: tplMeta.isModel,
      template_source: picked.source,
      wkfCountAfterClone: wkfAfterClone,
      wkfCountAfterProgramWrite: wkfAfterWrite,
      default_wkf: defaultWkf
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

  // 3b. WKF 추가 — Studio: model clone 1회 + bundled canvas patch (reference loop 없음)
  function createWkfFromTemplate(campaignId, labelOpt) {
    _ensureCfgLoaded();
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

    var refAttempts = [];
    _beginWkfCreateDiag(cid, newLabel, cnt);
    if (_lastWkfCreateDiag) {
      _lastWkfCreateDiag.verified_count = 0;
      _lastWkfCreateDiag.blind_count = 0;
    }

    refAttempts.push("path=CreateInstanceFromModel_only modelId=" + String(modelId));
    _pushWkfCreateAttempt({
      source: "CreateInstanceFromModel",
      ref_id: String(modelId),
      status: "attempt",
      detail: "model=" + String(srcName || "")
    });

    var wfId = 0;
    try {
      var diff =
        <workflow label={newLabel} operation-id={cid}/>;
      wfId = xtk.queryDef.CreateInstanceFromModel(WF_SCHEMA, modelId, diff);
    } catch (eCr) {
      var crMsg = String(eCr && eCr.message != null ? eCr.message : eCr);
      _pushWkfCreateAttempt({
        source: "CreateInstanceFromModel",
        ref_id: String(modelId),
        status: "fail",
        detail: crMsg
      });
      throw new Error(
        "[testWoo.wfClone.createWkfFromTemplate] CreateInstanceFromModel(" +
          modelId +
          "): " + crMsg
      );
    }
    if (!wfId || parseInt(String(wfId), 10) <= 0) {
      _pushWkfCreateAttempt({
        source: "CreateInstanceFromModel",
        ref_id: String(modelId),
        status: "fail",
        detail: "returned 0"
      });
      throw new Error(
        "[testWoo.wfClone.createWkfFromTemplate] CreateInstanceFromModel returned 0 (modelId=" +
          modelId +
          ")"
      );
    }

    var out = _getWkfMetaById(wfId, cid, newLabel);
    if (!out) {
      _rollbackWkf(wfId, "get_after_create");
      _pushWkfCreateAttempt({
        source: "CreateInstanceFromModel",
        ref_id: String(modelId),
        status: "fail",
        detail: "get failed id=" + String(wfId)
      });
      throw new Error(
        "[testWoo.wfClone.createWkfFromTemplate] created but get failed id=" + wfId
      );
    }
    out.create_source = "CreateInstanceFromModel";
    refAttempts.push("CreateInstanceFromModel:" + modelId + "=id=" + String(out.id));

    if (!_wfCanvasHasAiActivity(out.id)) {
      refAttempts.push("patch_canvas:attempt");
      var patchRes = _patchAiActivityCanvas(out.id);
      if (patchRes && patchRes.ok) {
        out.create_source = "CreateInstanceFromModel+patch";
        refAttempts.push("patch_canvas=ok");
        _pushWkfCreateAttempt({
          source: "patch_canvas",
          ref_id: String(out.id),
          status: "ok",
          detail: "bundled_template",
          wkf_id: String(out.id)
        });
      } else {
        var pErr = patchRes && patchRes.error ? patchRes.error : "?";
        if (pErr.length > 120) pErr = pErr.substring(0, 120) + "...";
        refAttempts.push("patch_canvas=fail:" + pErr);
        _pushWkfCreateAttempt({
          source: "patch_canvas",
          ref_id: String(out.id),
          status: "fail",
          detail: pErr,
          wkf_id: String(out.id)
        });
      }
    } else {
      _pushWkfCreateAttempt({
        source: "CreateInstanceFromModel",
        ref_id: String(modelId),
        status: "ok",
        detail: "hasAi=1 id=" + String(out.id),
        wkf_id: String(out.id)
      });
    }

    out.template = srcName;
    out.template_id = modelId;
    out.open_fallback = true;
    out.wkfCount = cnt + 1;
    out.wkfMax = maxW;
    out.reference_attempts = refAttempts;

    if (!_wfCanvasHasAiActivity(out.id)) {
      _rollbackWkf(out.id, "final_no_ai_activity");
      var errNoAct = new Error(
        "WKF 생성됐으나 캔버스에 AI 대상자 추출(" + _aiActivityName() + ")이 없습니다. " +
          "template_id=" + modelId + " expected=" + srcName +
          " modelName=" + out.modelName +
          " create_source=" + String(out.create_source || "") +
          " reference_attempts=" + refAttempts.join(" | ") +
          " — CreateInstanceFromModel+patch 실패. ACC Option testWooAiWkfTemplateId/Name 확인."
      );
      errNoAct.code = "WKF_NO_AI_ACTIVITY";
      errNoAct.wkf_id = out.id;
      errNoAct.reference_attempts = refAttempts;
      if (_lastWkfCreateDiag) {
        _lastWkfCreateDiag.wkf_count_after = _countWkfs(cid);
      }
      throw errNoAct;
    }

    try {
      acquireLock(out.id, out.name);
      out.locked_by = _login();
    } catch (eLock) {
      try {
        logWarning("[testWoo.wfClone.createWkfFromTemplate] lock after create: " + eLock);
      } catch (eL2) {}
    }
    if (_lastWkfCreateDiag) {
      _lastWkfCreateDiag.success = true;
      _lastWkfCreateDiag.result_id = String(out.id || "");
      _lastWkfCreateDiag.result_source = String(out.create_source || "");
      _lastWkfCreateDiag.wkf_count_after = _countWkfs(cid);
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
    getCampaignTemplateName: getCampaignTemplateName,
    getCampaignTemplateId: getCampaignTemplateId,
    getWkfTemplateId: getWkfTemplateId,
    getTemplateDiagnostics: getTemplateDiagnostics,
    getMaxWkfPerCampaign: getMaxWkfPerCampaign,
    getProgramFullName: getProgramFullName,
    listCampaignsByProgram: listCampaignsByProgram,
    createCampaign: createCampaign,
    listWkfsByCampaign: listWkfsByCampaign,
    listWkfsByProgram: listWkfsByProgram,
    createWkfFromTemplate: createWkfFromTemplate,
    getLastWkfCreateDiag: getLastWkfCreateDiag,
    resolveWorkflowsByName: resolveWorkflowsByName,
    acquireLock: acquireLock,
    releaseLock: releaseLock,
    getLock: getLock
  };
})();
testWoo.wfClone.__v = "172";
