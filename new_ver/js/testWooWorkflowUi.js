/*
 * testWooWorkflowUi.js (WF 캔버스 ↔ Studio SOAP · R6 주입)
 * ==================================================
 * litmus 동기 __v=166 (inject backup → testWoo.opPrefs.saveInjectBackup).
 * 구 WKF customActivity 는 script. SOAP ShellProbe/Pick/Bind.
 * 본문은 SOAP 인자로 받지 않고 registered testWooAiSql.@sql_query 만 Write.
 *
 * [Main Functions]
 * ===========
 * - woo_testWooAiWorkflowUi_ShellProbe — AI 액티비티 존재·첫 @name
 * - woo_testWooAiWorkflowUi_ShellPick — bind-pick + tick 캐시버스트
 * - woo_testWooAiWorkflowUi_ShellBind — sqlDM userScript+ai-sql-id
 * - testWoo.workflowUi.probeOccupied — 대상 액티비티에 본문/ID 있는지
 * - testWoo.workflowUi.commitInject — WF data Write (덮어쓰기 가드·백업)
 * - testWoo.workflowUi.restoreInject — 직전 스냅샷으로 본문+ID 복원
 * - testWoo.workflowUi.normalizeAiActivity — 구 @name customActivity→aiStudioSql + Start target
 *
 * [Dependencies]
 * =========
 * - testWooExtendWorkflow.xml — iframe·SOAP soapCall
 * - sqlDM @name=aiStudioSql · 스키마 자식 userScript (AI Studio SQL)
 * - 구 customActivity 는 script. ai-sql-id 병행
 * - testWoo.repo.getAiSqlById — 주입 SQL 출처 (status=registered)
 * - xtk:workflow data — commitInject queryDef+Write (Spawn 금지)
 * - testWoo.opPrefs.saveInjectBackup — inject 롤백 스냅샷(스키마)
 * - XtkOption testWooAiInjectBackup — 레거시 폴백
 */

if (typeof testWoo === "undefined") testWoo = {};
if (!testWoo.workflowUi) testWoo.workflowUi = {};
testWoo.workflowUi.__v = "166";

var TESTWOO_AI_ACTIVITY_NAME = "aiStudioSql";
var TESTWOO_AI_ACTIVITY_NAME_OLD = "customActivity";
var TESTWOO_AI_SQL_ID_EL = "ai-sql-id";
var TESTWOO_AI_SQL_BODY_EL = "userScript";
var TESTWOO_AI_SQL_BODY_EL_LEGACY = "script";
var TESTWOO_AI_INJECT_BACKUP_OPT = "testWooAiInjectBackup";

var _twWfLastSnap = null;

function _twWfTrim(s) {
  return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
}

function _twWfIsAiActivity(elName, actName) {
  var nm = String(actName || "");
  var el = String(elName || "");
  if (nm === TESTWOO_AI_ACTIVITY_NAME || nm === TESTWOO_AI_ACTIVITY_NAME_OLD) return true;
  return el === TESTWOO_AI_ACTIVITY_NAME || el === TESTWOO_AI_ACTIVITY_NAME_OLD;
}

function _twWfAiRank(item) {
  var nm = String(item.name || "");
  if (nm === TESTWOO_AI_ACTIVITY_NAME) return 0;
  if (nm === TESTWOO_AI_ACTIVITY_NAME_OLD) return 1;
  var el = String(item.elName || "");
  if (el === TESTWOO_AI_ACTIVITY_NAME) return 0;
  if (el === TESTWOO_AI_ACTIVITY_NAME_OLD) return 1;
  return 2;
}

function _twWfPickAiActivity(list) {
  if (!list || list.length === 0) return null;
  var best = list[0];
  var bestRank = _twWfAiRank(best);
  var i;
  for (i = 1; i < list.length; i++) {
    var r = _twWfAiRank(list[i]);
    if (r < bestRank) {
      best = list[i];
      bestRank = r;
    }
  }
  return best;
}

function _twWfNeedsAiNameNormalize(actName) {
  var n = _twWfTrim(actName);
  return !n || n === TESTWOO_AI_ACTIVITY_NAME_OLD;
}

function _twWfRetargetTransitions(acts, oldName, newName) {
  var from = _twWfTrim(oldName);
  var to = _twWfTrim(newName);
  if (!from || !to || from === to) return;
  try {
    var children = acts.children();
    var n = children.length();
    var i;
    var j;
    for (i = 0; i < n; i++) {
      var ch = children[i];
      var transRoot = null;
      try {
        if (ch.transitions && ch.transitions.length() > 0) {
          transRoot = ch.transitions[0];
        }
      } catch (eT) {}
      if (!transRoot) continue;
      var trs = transRoot.children();
      var m = trs.length();
      for (j = 0; j < m; j++) {
        var tr = trs[j];
        if (_twWfTrim(String(tr.@target || "")) === from) {
          tr.@target = to;
        }
      }
    }
  } catch (eR) {
    logWarning("[testWoo.WorkflowUi._twWfRetargetTransitions] " + eR);
  }
}

function _twWfNormalizeAiName(acts, target) {
  if (!target || !target.node) return target;
  var oldName = _twWfTrim(target.name);
  if (!_twWfNeedsAiNameNormalize(oldName)) return target;
  var newName = TESTWOO_AI_ACTIVITY_NAME;
  try {
    target.node.@name = newName;
  } catch (eN) {
    logWarning("[testWoo.WorkflowUi._twWfNormalizeAiName] set @name: " + eN);
    return target;
  }
  _twWfRetargetTransitions(acts, oldName || TESTWOO_AI_ACTIVITY_NAME_OLD, newName);
  target.name = newName;
  logInfo(
    "[testWoo.WorkflowUi] rename activity @name " +
    (oldName || "(empty)") + " -> " + newName
  );
  return target;
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
      var actName = _twWfTrim(String(ch.@name || ""));
      if (!_twWfIsAiActivity(elName, actName)) {
        continue;
      }
      out.push({
        name: actName,
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

function _twWfSqlBodyEl(elName) {
  if (String(elName || "") === "sqlDM") return TESTWOO_AI_SQL_BODY_EL;
  return TESTWOO_AI_SQL_BODY_EL_LEGACY;
}

function _twWfReadChildText(node, elName) {
  try {
    if (node[elName] && node[elName].length() > 0) {
      return _twWfTrim(String(node[elName][0]));
    }
  } catch (e1) {}
  return "";
}

function _twWfReadScript(node) {
  var body = _twWfReadChildText(node, TESTWOO_AI_SQL_BODY_EL);
  if (body) return body;
  return _twWfReadChildText(node, TESTWOO_AI_SQL_BODY_EL_LEGACY);
}

function _twWfSetSqlBody(node, elName, sqlText) {
  var tag = _twWfSqlBodyEl(elName);
  var body = String(sqlText == null ? "" : sqlText);
  try {
    if (node[tag] && node[tag].length() > 0) {
      delete node[tag];
    }
  } catch (eDel) {}
  var safe = body.split("]]>").join("]]]]><![CDATA[>");
  try {
    node.appendChild(new XML("<" + tag + "><![CDATA[" + safe + "]]></" + tag + ">"));
  } catch (eCdata) {
    node[tag] = body;
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
  if (typeof testWoo !== "undefined" && testWoo.opPrefs &&
      testWoo.opPrefs.saveInjectBackup) {
    try {
      var opRes = testWoo.opPrefs.saveInjectBackup({
        workflowName: snap.workflowName,
        activityName: snap.activityName,
        aiSqlId: snap.aiSqlId,
        script: snap.script
      });
      if (!opRes || !opRes.ok) {
        logWarning("[testWoo.WorkflowUi] opPrefs backup: " +
          String(opRes && opRes.error ? opRes.error : "unknown"));
      }
    } catch (eOp) {
      logWarning("[testWoo.WorkflowUi] opPrefs backup: " +
        String(eOp.message || eOp));
    }
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

function _twWfInjectOnNode(node, aiSqlId, sqlText, elName) {
  _twWfSetAiSqlId(node, aiSqlId);
  if (sqlText) _twWfSetSqlBody(node, elName, sqlText);
}

/**
 * SOAP: ShellProbe
 * @returns {[hasActivity, message, activityName]}
 */
function woo_testWooAiWorkflowUi_ShellProbe(activitiesXml) {
  var list = _twWfListAiActivities(activitiesXml);
  var count = list.length;
  var picked = _twWfPickAiActivity(list);
  var firstName = picked ? (picked.name || "#0") : "";
  var hasStr = count > 0 ? "true" : "false";
  var message;
  if (count === 0) {
    message =
      "[안내] 캔버스에 AI 대상자 추출(aiStudioSql)이 없습니다. " +
      "팔레트에서 추가한 뒤 이 창을 다시 여세요. " +
      "(OOTB SQL Data Management 는 대상이 아닙니다)";
  } else if (count === 1) {
    message =
      "Apply 대상: " + firstName +
      ". Studio에서 SQL을 선택한 뒤 Apply 하세요.";
  } else {
    message =
      "Apply 대상: " + firstName +
      " — 캔버스에 AI 액티비티 " + count + "개. aiStudioSql 우선.";
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
      "No aiStudioSql on canvas. Add 'AI 대상자 추출' from the palette, then reopen AI Studio."
    );
  }
  if (list.length > 1) {
    logWarning(
      "[testWoo.WorkflowUi.ShellBind] multiple=" + list.length +
      " — prefer aiStudioSql"
    );
  }

  var target = _twWfNormalizeAiName(acts, _twWfPickAiActivity(list));
  var sqlText = _twWfLoadRegisteredSql(idStr);
  _twWfInjectOnNode(target.node, idStr, sqlText, target.elName);
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
        "캔버스에 AI 대상자 추출(aiStudioSql)이 없습니다. 팔레트에서 추가한 뒤 다시 반영하세요."
    };
  }
  var probed = _twWfPickAiActivity(list);
  return {
    ok: true,
    occupied: _twWfOccupied(probed.node),
    activityName: probed.name || "#0",
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
        "캔버스에 AI 대상자 추출(aiStudioSql)이 없습니다. 팔레트에서 추가한 뒤 다시 반영하세요."
    };
  }
  if (list.length > 1) {
    logWarning(
      "[testWoo.WorkflowUi.commitInject] multiple=" + list.length +
      " — prefer aiStudioSql"
    );
  }

  var target = _twWfNormalizeAiName(acts, _twWfPickAiActivity(list));
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

  _twWfInjectOnNode(target.node, idStr, sqlText, target.elName);
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
  var target = _twWfPickAiActivity(list);
  var i;
  if (snap.activityName) {
    for (i = 0; i < list.length; i++) {
      if (list[i].name === snap.activityName) {
        target = list[i];
        break;
      }
    }
  }
  _twWfInjectOnNode(target.node, snap.aiSqlId || "0", snap.script || "", target.elName);
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

function _twWfNormalizeAiActivity(workflowId, workflowName) {
  var wf;
  try {
    wf = _twWfLoadWorkflow(workflowId, workflowName);
  } catch (eL) {
    return { ok: false, changed: false, error: String(eL && eL.message ? eL.message : eL) };
  }
  var dataNode = _twWfDataNode(wf);
  if (!dataNode) {
    return { ok: false, changed: false, error: "workflow data XML missing" };
  }
  var acts = _twWfActivitiesRoot(dataNode);
  if (!acts || String(acts.name()) !== "activities") {
    return { ok: false, changed: false, error: "workflow data.activities missing" };
  }
  var list = _twWfListAiActivities(acts);
  if (list.length === 0) {
    return {
      ok: false,
      changed: false,
      error: "캔버스에 AI 대상자 추출(aiStudioSql)이 없습니다. 팔레트에서 추가한 뒤 다시 반영하세요."
    };
  }
  var target = _twWfPickAiActivity(list);
  var before = target.name;
  target = _twWfNormalizeAiName(acts, target);
  if (before === target.name) {
    return {
      ok: true,
      changed: false,
      activityName: target.name || "#0",
      workflowId: String(wf.@id || workflowId)
    };
  }
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
      changed: false,
      error: "workflow Write failed: " + String(eW && eW.message ? eW.message : eW)
    };
  }
  logInfo(
    "[testWoo.WorkflowUi.normalizeAiActivity] wf=" +
    String(wf.@internalName || workflowName) +
    " name=" + (target.name || TESTWOO_AI_ACTIVITY_NAME)
  );
  return {
    ok: true,
    changed: true,
    activityName: target.name || TESTWOO_AI_ACTIVITY_NAME,
    workflowId: String(wf.@id || workflowId)
  };
}

testWoo.workflowUi.commitInject = _twWfCommitInject;
testWoo.workflowUi.restoreInject = _twWfRestoreInject;
testWoo.workflowUi.probeOccupied = _twWfProbeOccupied;
testWoo.workflowUi.lookupIdByName = _twWfLookupIdByName;
testWoo.workflowUi.normalizeAiActivity = _twWfNormalizeAiActivity;
