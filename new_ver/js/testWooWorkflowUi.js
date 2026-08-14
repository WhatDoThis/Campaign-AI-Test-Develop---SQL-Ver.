/*
 * testWooWorkflowUi.js (WF 캔버스 ↔ Studio SOAP · R6 주입)
 * ==================================================
 * litmus 동기 __v=162. E4X length/toXMLString 가드 제거. 이름 조회(PoC-2) 우선.
 * SOAP ShellProbe/Pick/Bind. Register 커밋은 commitInject — 락 밖에서 호출.
 * 본문은 SOAP 인자로 받지 않고 registered testWooAiSql.@sql_query 만 Write.
 *
 * [Main Functions]
 * ===========
 * - woo_testWooAiWorkflowUi_ShellProbe — AI 액티비티 존재·첫 @name
 * - woo_testWooAiWorkflowUi_ShellPick — bind-pick + tick 캐시버스트
 * - woo_testWooAiWorkflowUi_ShellBind — 첫 AI 액티비티에 ai-sql-id + script
 * - testWoo.workflowUi.probeOccupied — 첫 AI 액티비티에 본문/ID 있는지
 * - testWoo.workflowUi.commitInject — WF data Write (덮어쓰기 가드·백업)
 * - testWoo.workflowUi.restoreInject — 직전 스냅샷으로 본문+ID 복원
 *
 * [Dependencies]
 * =========
 * - testWooExtendWorkflow.xml — iframe·SOAP soapCall
 * - ibankSqlDM·customActivity — AI 액티비티 요소명
 * - ai-sql-id + script — OOTB sqlDM/ibankSqlDM2 JstEdit xpath=script
 * - testWoo.repo.getAiSqlById — 주입 SQL 출처 (status=registered)
 * - xtk:workflow data — commitInject queryDef+Write (Spawn 금지)
 * - XtkOption testWooAiInjectBackup — 마지막 본문+ID 스냅샷
 */

if (typeof testWoo === "undefined") testWoo = {};
if (!testWoo.workflowUi) testWoo.workflowUi = {};
testWoo.workflowUi.__v = "162";

var TESTWOO_AI_ACTIVITY_EL = "ibankSqlDM";
var TESTWOO_AI_ACTIVITY_EL_LEGACY = "customActivity";
var TESTWOO_AI_SQL_ID_EL = "ai-sql-id";
var TESTWOO_AI_SQL_SCRIPT_EL = "script";
var TESTWOO_AI_INJECT_BACKUP_OPT = "testWooAiInjectBackup";

var _twWfLastSnap = null;

function _twWfTrim(s) {
  return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
}

function _twWfIsAiActivityEl(elName) {
  var n = String(elName || "");
  return n === TESTWOO_AI_ACTIVITY_EL || n === TESTWOO_AI_ACTIVITY_EL_LEGACY;
}

function _twWfAsXml(node) {
  if (node == null || node === "") {
    return <activities/>;
  }
  try {
    if (typeof node === "xml") {
      return node;
    }
  } catch (eType) {}
  try {
    if (node.toXMLString) {
      return new XML(node.toXMLString());
    }
  } catch (e1) {}
  try {
    return new XML(String(node));
  } catch (e2) {
    logWarning("[testWoo.WorkflowUi] activities parse failed: " + e2);
    return <activities/>;
  }
}

function _twWfActivitiesRoot(activitiesXml) {
  var root = _twWfAsXml(activitiesXml);
  try {
    if (String(root.name()) === "activities") {
      return root;
    }
    if (root.activities && root.activities.length() > 0) {
      return root.activities[0];
    }
    if (root.data && root.data.activities && root.data.activities.length() > 0) {
      return root.data.activities[0];
    }
  } catch (e) {}
  return <activities/>;
}

/** @returns {Array} { name, label, elName, node } */
function _twWfListAiActivities(activitiesXml) {
  var acts = _twWfActivitiesRoot(activitiesXml);
  var out = [];
  try {
    var children = acts.children();
    var n = children.length();
    for (var i = 0; i < n; i++) {
      var ch = children[i];
      var elName = String(ch.name());
      if (!_twWfIsAiActivityEl(elName)) {
        continue;
      }
      out.push({
        name: _twWfTrim(String(ch.@name || "")),
        label: _twWfTrim(String(ch.@label || "")),
        elName: elName,
        node: ch
      });
    }
  } catch (eList) {
    logWarning("[testWoo.WorkflowUi._twWfListAiActivities] " + eList);
  }
  return out;
}

function _twWfSetAiSqlId(node, aiSqlId) {
  var idStr = String(aiSqlId);
  var before = 0;
  try {
    if (node[TESTWOO_AI_SQL_ID_EL]) {
      before = node[TESTWOO_AI_SQL_ID_EL].length();
    }
  } catch (eLen) {
    before = 0;
  }

  if (before > 1) {
    logWarning(
      "[testWoo.WorkflowUi._twWfSetAiSqlId] duplicate ai-sql-id count=" +
      before + " — remove all then re-insert one"
    );
    try {
      delete node[TESTWOO_AI_SQL_ID_EL];
    } catch (eDel) {
      try {
        var kids = node.children();
        for (var i = kids.length() - 1; i >= 0; i--) {
          if (String(kids[i].name()) === TESTWOO_AI_SQL_ID_EL) {
            delete kids[i];
          }
        }
      } catch (eDel2) {
        logWarning("[testWoo.WorkflowUi._twWfSetAiSqlId] sweep failed: " + eDel2);
      }
    }
    node.appendChild(<ai-sql-id>{idStr}</ai-sql-id>);
  } else if (before === 1) {
    node[TESTWOO_AI_SQL_ID_EL] = idStr;
  } else {
    node.appendChild(<ai-sql-id>{idStr}</ai-sql-id>);
  }
}

function _twWfReadAiSqlId(node) {
  try {
    if (node[TESTWOO_AI_SQL_ID_EL] && node[TESTWOO_AI_SQL_ID_EL].length() > 0) {
      return _twWfTrim(String(node[TESTWOO_AI_SQL_ID_EL][0]));
    }
  } catch (e1) {}
  return "";
}

function _twWfReadScript(node) {
  try {
    if (node[TESTWOO_AI_SQL_SCRIPT_EL] && node[TESTWOO_AI_SQL_SCRIPT_EL].length() > 0) {
      return _twWfTrim(String(node[TESTWOO_AI_SQL_SCRIPT_EL][0]));
    }
  } catch (e1) {}
  return "";
}

function _twWfSetScript(node, sqlText) {
  var body = String(sqlText == null ? "" : sqlText);
  try {
    if (node[TESTWOO_AI_SQL_SCRIPT_EL] && node[TESTWOO_AI_SQL_SCRIPT_EL].length() > 0) {
      delete node[TESTWOO_AI_SQL_SCRIPT_EL];
    }
  } catch (eDel) {}
  var safe = body.split("]]>").join("]]]]><![CDATA[>");
  try {
    node.appendChild(new XML("<script><![CDATA[" + safe + "]]></script>"));
  } catch (eCdata) {
    node[TESTWOO_AI_SQL_SCRIPT_EL] = body;
  }
}

function _twWfOccupied(node) {
  var id = _twWfReadAiSqlId(node);
  if (id && id !== "0") return true;
  return _twWfReadScript(node).length > 0;
}

function _twWfEnsureRepo() {
  if (typeof testWoo !== "undefined" && testWoo.repo && testWoo.repo.getAiSqlById) {
    return true;
  }
  try {
    loadLibrary("woo:testWooRepository.js");
  } catch (eL) {
    logWarning("[testWoo.WorkflowUi] repo load: " + eL);
    return false;
  }
  return !!(typeof testWoo !== "undefined" && testWoo.repo && testWoo.repo.getAiSqlById);
}

function _twWfLoadRegisteredSql(aiSqlId) {
  if (!_twWfEnsureRepo()) return "";
  var row = null;
  try {
    row = testWoo.repo.getAiSqlById(aiSqlId);
  } catch (eG) {
    logWarning("[testWoo.WorkflowUi] getAiSqlById: " + eG);
    return "";
  }
  if (!row || !row.sql_query) return "";
  var st = _twWfTrim(row.status);
  if (st && st !== "registered") {
    logWarning("[testWoo.WorkflowUi] skip script inject status=" + st + " id=" + aiSqlId);
    return "";
  }
  return String(row.sql_query);
}

function _twWfOperatorLogin() {
  try {
    if (application.operator && application.operator.login) {
      return String(application.operator.login);
    }
  } catch (eOp) {}
  return "anon";
}

function _twWfBindPickKey() {
  return "testWooAiBindPick_" + _twWfOperatorLogin();
}

function _twWfReadBindPick(workflowName) {
  var wf = _twWfTrim(workflowName);
  var raw = "";
  try {
    raw = String(getOption(_twWfBindPickKey()) || "");
  } catch (eGet) {
    raw = "";
  }
  if (!raw) return "";
  var tab = raw.indexOf("\t");
  if (tab < 0) return "";
  var storedWf = raw.substring(0, tab);
  var id = raw.substring(tab + 1);
  if (wf && storedWf && storedWf !== wf) return "";
  if (!/^[0-9]+$/.test(id) || id === "0") return "";
  return id;
}

function _twWfSaveBackup(snap) {
  _twWfLastSnap = snap;
  if (!snap) return;
  var payload =
    String(snap.workflowName || "") + "\t" +
    String(snap.activityName || "") + "\t" +
    String(snap.aiSqlId || "") + "\t" +
    String(snap.script || "");
  try {
    setOption(TESTWOO_AI_INJECT_BACKUP_OPT, payload);
  } catch (eOpt) {
    logWarning("[testWoo.WorkflowUi] backup option: " + eOpt);
  }
}

function _twWfReadBackup() {
  if (_twWfLastSnap) return _twWfLastSnap;
  var raw = "";
  try {
    raw = String(getOption(TESTWOO_AI_INJECT_BACKUP_OPT) || "");
  } catch (eG) {
    raw = "";
  }
  if (!raw) return null;
  var p1 = raw.indexOf("\t");
  if (p1 < 0) return null;
  var p2 = raw.indexOf("\t", p1 + 1);
  if (p2 < 0) return null;
  var p3 = raw.indexOf("\t", p2 + 1);
  if (p3 < 0) return null;
  return {
    workflowName: raw.substring(0, p1),
    activityName: raw.substring(p1 + 1, p2),
    aiSqlId: raw.substring(p2 + 1, p3),
    script: raw.substring(p3 + 1)
  };
}

function _twWfLookupIdByName(workflowName) {
  var name = _twWfTrim(workflowName);
  if (!name) return "";
  var esc = name.replace(/'/g, "''");
  try {
    var q = xtk.queryDef.create(
      <queryDef schema="xtk:workflow" operation="getIfExists">
        <select>
          <node expr="@id"/>
          <node expr="@internalName"/>
        </select>
        <where>
          <condition expr={"@internalName = '" + esc + "'"}/>
        </where>
      </queryDef>
    );
    var res = q.ExecuteQuery();
    if (!res || !res.@id) return "";
    return String(res.@id);
  } catch (eQ) {
    logWarning("[testWoo.WorkflowUi] lookup id: " + eQ);
    return "";
  }
}

function _twWfHasLen(xml) {
  if (xml == null) return false;
  try {
    return xml.length() > 0;
  } catch (e1) {}
  return false;
}

function _twWfXmlText(node) {
  if (node == null) return "";
  try {
    return String(node.toXMLString());
  } catch (e1) {}
  try {
    return String(node);
  } catch (e2) {}
  return "";
}

function _twWfParseXml(raw) {
  var s = _twWfTrim(String(raw || ""));
  var lt = s.indexOf("<");
  if (lt < 0) return null;
  if (lt > 0) s = s.substring(lt);
  try {
    return new XML(s);
  } catch (eP) {
    return null;
  }
}

function _twWfChildNames(xml) {
  var names = [];
  try {
    var kids = xml.children();
    var n = kids.length();
    var i;
    for (i = 0; i < n; i++) {
      names.push(String(kids[i].name()));
    }
  } catch (e) {}
  return names;
}

function _twWfFindChild(xml, elName) {
  try {
    var kids = xml.children();
    var n = kids.length();
    var i;
    for (i = 0; i < n; i++) {
      if (String(kids[i].name()) === elName) return kids[i];
    }
  } catch (e) {}
  return null;
}

function _twWfQueryWorkflow(whereExpr) {
  var q = xtk.queryDef.create(
    <queryDef schema="xtk:workflow" operation="get">
      <select>
        <node expr="@id"/>
        <node expr="@internalName"/>
        <node expr="@label"/>
        <node expr="data"/>
      </select>
      <where>
        <condition expr={whereExpr}/>
      </where>
    </queryDef>
  );
  return q.ExecuteQuery();
}

function _twWfEntityHasBody(wf) {
  if (!wf) return false;
  if (_twWfFindChild(wf, "activities")) return true;
  if (_twWfFindChild(wf, "data")) return true;
  try {
    if (wf.data != null && _twWfXmlText(wf.data).indexOf("<") >= 0) return true;
  } catch (e) {}
  return false;
}

function _twWfLoadWorkflow(workflowId, workflowName) {
  var wid = _twWfTrim(workflowId);
  var wname = _twWfTrim(workflowName);
  if (!wid && wname) wid = _twWfLookupIdByName(wname);
  if (!wid && !wname) {
    throw new Error("[testWoo.workflowUi] workflow_id or workflow_name required");
  }
  var nId = parseInt(wid || "0", 10);
  var best = null;

  try {
    var loaded = xtk.workflow.load(nId);
    if (loaded && loaded.@id) best = loaded;
  } catch (eLd) {
    logWarning("[testWoo.WorkflowUi] xtk.workflow.load: " + eLd);
  }
  if (_twWfEntityHasBody(best)) return best;

  try {
    var loaded2 = xtk.workflow.Load(nId);
    if (loaded2 && loaded2.@id) best = loaded2;
  } catch (eLd2) {}
  if (_twWfEntityHasBody(best)) return best;

  try {
    var got = xtk.session.GetEntityIfMoreRecent("xtk:workflow", String(nId), "");
    if (got && got.@id) best = got;
  } catch (eGe) {
    logWarning("[testWoo.WorkflowUi] GetEntityIfMoreRecent: " + eGe);
  }
  if (_twWfEntityHasBody(best)) return best;

  if (wname) {
    try {
      var byName = _twWfQueryWorkflow("@internalName = '" + wname.replace(/'/g, "''") + "'");
      if (byName && byName.@id) best = byName;
    } catch (eN) {
      logWarning("[testWoo.WorkflowUi] query by name: " + eN);
    }
    if (_twWfEntityHasBody(best)) return best;
  }

  if (nId) {
    try {
      var byId = _twWfQueryWorkflow("@id = " + nId);
      if (byId && byId.@id) best = byId;
    } catch (eI) {
      logWarning("[testWoo.WorkflowUi] query by id: " + eI);
    }
  }

  if (!best || !best.@id) {
    throw new Error("[testWoo.workflowUi] workflow not found id=" + wid + " name=" + wname);
  }
  return best;
}

function _twWfDataNode(wf) {
  if (!wf) return null;

  var acts = _twWfFindChild(wf, "activities");
  if (acts) return wf;

  var dataEl = _twWfFindChild(wf, "data");
  if (!dataEl) {
    try {
      if (wf.data != null) dataEl = _twWfHasLen(wf.data) ? wf.data[0] : wf.data;
    } catch (eD) {}
  }

  if (dataEl) {
    if (_twWfFindChild(dataEl, "activities")) return dataEl;
    if (_twWfFindChild(dataEl, "workflow")) {
      var innerWf = _twWfFindChild(dataEl, "workflow");
      if (innerWf && _twWfFindChild(innerWf, "activities")) return innerWf;
    }
    var parsed = _twWfParseXml(_twWfXmlText(dataEl));
    if (parsed) {
      if (_twWfFindChild(parsed, "activities")) return parsed;
      if (String(parsed.name()) === "activities") {
        var wrap = <data/>;
        wrap.appendChild(parsed);
        return wrap;
      }
      if (String(parsed.name()) === "data") return parsed;
      var pData = _twWfFindChild(parsed, "data");
      if (pData) return pData;
    }
  }

  var all = _twWfParseXml(_twWfXmlText(wf));
  if (all) {
    if (_twWfFindChild(all, "activities")) return all;
    var allData = _twWfFindChild(all, "data");
    if (allData) return allData;
  }

  try {
    logWarning(
      "[testWoo.WorkflowUi] data XML missing id=" +
      String(wf.@id || "") +
      " children=" +
      _twWfChildNames(wf).join(",") +
      " preview=" +
      _twWfXmlText(wf).substring(0, 180)
    );
  } catch (eLog) {}
  return null;
}

function _twWfInjectOnNode(node, aiSqlId, sqlText) {
  _twWfSetAiSqlId(node, aiSqlId);
  if (sqlText) _twWfSetScript(node, sqlText);
}

/**
 * SOAP: ShellProbe
 * @returns {[hasActivity, message, activityName]}
 */
function woo_testWooAiWorkflowUi_ShellProbe(activitiesXml) {
  var list = _twWfListAiActivities(activitiesXml);
  var count = list.length;
  var firstName = count > 0 ? (list[0].name || "#0") : "";
  var hasStr = count > 0 ? "true" : "false";
  var message;
  if (count === 0) {
    message =
      "[안내] 캔버스에 AI 대상자 추출(ibankSqlDM)이 없습니다. " +
      "팔레트에서 추가한 뒤 이 창을 다시 여세요. " +
      "(OOTB SQL Data Management 는 대상이 아닙니다)";
  } else if (count === 1) {
    message =
      "Apply 대상: " + firstName +
      ". Studio에서 SQL을 선택한 뒤 Apply 하세요.";
  } else {
    message =
      "Apply 대상(첫 액티비티): " + firstName +
      " — 캔버스에 AI 액티비티 " + count + "개. 첫 것만 사용합니다.";
  }
  logInfo(
    "[testWoo.WorkflowUi.ShellProbe] count=" + count + " first=" + firstName
  );
  return [hasStr, message, firstName];
}

/**
 * SOAP: ShellPick
 * @returns {[aiSqlId, pickLabel, tick]} tick = urlViewer 캐시버스트 (폼 FormatDate 금지 · XTK-170016)
 */
function woo_testWooAiWorkflowUi_ShellPick(workflowName) {
  var id = _twWfReadBindPick(workflowName);
  var label;
  if (id) {
    label = "ai_sql_id=" + id;
  } else {
    label = "(미선택 — Studio SQL 이력 클릭 또는 등록)";
  }
  var tick = "0";
  try {
    tick = String(new Date().getTime());
  } catch (eTick) {
    tick = String(Math.floor(Math.random() * 1000000000));
  }
  logInfo("[testWoo.WorkflowUi.ShellPick] wf=" + _twWfTrim(workflowName) + " id=" + id + " tick=" + tick);
  return [id, label, tick];
}

/**
 * SOAP: ShellBind — 첫 AI 액티비티에 ai-sql-id + registered SQL script
 * @returns {XML} activities
 */
function woo_testWooAiWorkflowUi_ShellBind(activitiesXml, aiSqlId, workflowName) {
  var idStr = _twWfTrim(aiSqlId);
  if (!idStr || idStr === "0") {
    idStr = _twWfReadBindPick(workflowName);
  }
  if (!idStr || idStr === "0") {
    throw new Error(
      "SQL not selected. Click a SQL row in Studio history (or Register), then Apply."
    );
  }
  if (!/^[0-9]+$/.test(idStr)) {
    throw new Error("ai_sql_id must be a positive integer.");
  }

  var acts = _twWfActivitiesRoot(activitiesXml);
  var list = _twWfListAiActivities(acts);
  if (list.length === 0) {
    throw new Error(
      "No ibankSqlDM on canvas. Add 'AI 대상자 추출' from the palette, then reopen AI Studio."
    );
  }
  if (list.length > 1) {
    logWarning(
      "[testWoo.WorkflowUi.ShellBind] multiple=" + list.length +
      " — first only: " + (list[0].name || "#0")
    );
  }

  var target = list[0];
  var sqlText = _twWfLoadRegisteredSql(idStr);
  _twWfInjectOnNode(target.node, idStr, sqlText);
  logInfo(
    "[testWoo.WorkflowUi.ShellBind] el=" + target.elName +
    " name=" + target.name + " ai_sql_id=" + idStr +
    " scriptChars=" + String(sqlText).length
  );
  return acts;
}

function _twWfProbeOccupied(workflowId, workflowName) {
  var wf;
  try {
    wf = _twWfLoadWorkflow(workflowId, workflowName);
  } catch (eLoad) {
    return {
      ok: false,
      occupied: false,
      error: String(eLoad && eLoad.message ? eLoad.message : eLoad)
    };
  }
  var dataNode = _twWfDataNode(wf);
  if (!dataNode) {
    return {
      ok: false,
      occupied: false,
      error:
        "workflow data XML missing (id=" +
        String(wf.@id || "") +
        " children=" +
        _twWfChildNames(wf).join(",") +
        ")"
    };
  }
  var list = _twWfListAiActivities(dataNode);
  if (list.length === 0) {
    return {
      ok: false,
      occupied: false,
      error:
        "캔버스에 AI 대상자 추출(ibankSqlDM)이 없습니다. 팔레트에서 추가한 뒤 다시 반영하세요."
    };
  }
  return {
    ok: true,
    occupied: _twWfOccupied(list[0].node),
    activityName: list[0].name || "#0",
    workflowId: String(wf.@id || workflowId),
    workflowName: _twWfTrim(String(wf.@internalName || workflowName))
  };
}

function _twWfCommitInject(opts) {
  opts = opts || {};
  var wfId = _twWfTrim(opts.workflowId);
  var wfName = _twWfTrim(opts.workflowName);
  var idStr = _twWfTrim(opts.aiSqlId);
  var sqlText = String(opts.sqlText == null ? "" : opts.sqlText);
  var confirmOw = opts.confirmOverwrite === true;

  if (!idStr || idStr === "0" || !/^[0-9]+$/.test(idStr)) {
    return { ok: false, needsOverwrite: false, error: "ai_sql_id required" };
  }
  if (!_twWfTrim(sqlText)) {
    return { ok: false, needsOverwrite: false, error: "sql_query empty — inject aborted" };
  }

  var wf;
  try {
    wf = _twWfLoadWorkflow(wfId, wfName);
  } catch (eLoad) {
    return {
      ok: false,
      needsOverwrite: false,
      error: String(eLoad && eLoad.message ? eLoad.message : eLoad)
    };
  }
  wfId = String(wf.@id || wfId);
  wfName = _twWfTrim(String(wf.@internalName || wfName));

  var dataNode = _twWfDataNode(wf);
  if (!dataNode) {
    return {
      ok: false,
      needsOverwrite: false,
      error:
        "workflow data XML missing (id=" +
        String(wf.@id || "") +
        " children=" +
        _twWfChildNames(wf).join(",") +
        ")"
    };
  }
  var acts = _twWfActivitiesRoot(dataNode);
  if (!acts || String(acts.name()) !== "activities") {
    return { ok: false, needsOverwrite: false, error: "workflow data.activities missing" };
  }
  var list = _twWfListAiActivities(acts);
  if (list.length === 0) {
    return {
      ok: false,
      needsOverwrite: false,
      error:
        "캔버스에 AI 대상자 추출(ibankSqlDM)이 없습니다. 팔레트에서 추가한 뒤 다시 반영하세요."
    };
  }
  if (list.length > 1) {
    logWarning(
      "[testWoo.WorkflowUi.commitInject] multiple=" + list.length +
      " — first only: " + (list[0].name || "#0")
    );
  }

  var target = list[0];
  var occupied = _twWfOccupied(target.node);
  if (occupied && !confirmOw) {
    return {
      ok: false,
      needsOverwrite: true,
      error: "",
      activityName: target.name || "#0",
      occupied: true
    };
  }

  var snap = {
    workflowId: wfId,
    workflowName: wfName,
    activityName: target.name || "#0",
    aiSqlId: _twWfReadAiSqlId(target.node),
    script: _twWfReadScript(target.node)
  };
  _twWfSaveBackup(snap);

  _twWfInjectOnNode(target.node, idStr, sqlText);
  try {
    if (dataNode && dataNode !== wf) wf.data = dataNode;
  } catch (ePut) {}

  try {
    wf.@xtkschema = "xtk:workflow";
    wf.@_operation = "update";
    xtk.session.Write(wf);
  } catch (eW) {
    return {
      ok: false,
      needsOverwrite: false,
      error: "workflow Write failed: " + String(eW && eW.message ? eW.message : eW)
    };
  }

  logInfo(
    "[testWoo.WorkflowUi.commitInject] wf=" + wfName +
    " act=" + (target.name || "#0") +
    " ai_sql_id=" + idStr +
    " overwrite=" + (occupied ? "1" : "0")
  );
  return {
    ok: true,
    needsOverwrite: false,
    activityName: target.name || "#0",
    occupied: occupied,
    workflowId: wfId,
    workflowName: wfName
  };
}

function _twWfRestoreInject(workflowId, workflowName) {
  var snap = _twWfReadBackup();
  if (!snap) return false;
  var wf;
  try {
    wf = _twWfLoadWorkflow(workflowId || snap.workflowId, workflowName || snap.workflowName);
  } catch (eL) {
    logWarning("[testWoo.WorkflowUi.restoreInject] load: " + eL);
    return false;
  }
  var dataNode = _twWfDataNode(wf);
  if (!dataNode) return false;
  var list = _twWfListAiActivities(dataNode);
  if (list.length === 0) return false;
  var target = list[0];
  var i;
  if (snap.activityName) {
    for (i = 0; i < list.length; i++) {
      if (list[i].name === snap.activityName) {
        target = list[i];
        break;
      }
    }
  }
  _twWfInjectOnNode(target.node, snap.aiSqlId || "0", snap.script || "");
  try {
    wf.@xtkschema = "xtk:workflow";
    wf.@_operation = "update";
    xtk.session.Write(wf);
    logInfo("[testWoo.WorkflowUi.restoreInject] wf=" + String(wf.@internalName || ""));
    return true;
  } catch (eW) {
    logWarning("[testWoo.WorkflowUi.restoreInject] Write: " + eW);
    return false;
  }
}

testWoo.workflowUi.commitInject = _twWfCommitInject;
testWoo.workflowUi.restoreInject = _twWfRestoreInject;
testWoo.workflowUi.probeOccupied = _twWfProbeOccupied;
testWoo.workflowUi.lookupIdByName = _twWfLookupIdByName;
