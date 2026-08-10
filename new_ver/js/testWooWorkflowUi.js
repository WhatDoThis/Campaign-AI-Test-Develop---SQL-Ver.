/*
 * testWooWorkflowUi.js (WF 캔버스 ↔ Studio SOAP · server-side)
 * ============================================================
 * woo:testWooAiWorkflowUi — ShellProbe / ShellPick / ShellBind 만 사용.
 * 구 InspectAiTarget·BindAiSqlId·GetBindPick·ListAiActivities 는 제거
 * (콘솔에 남은 구 시그니처와 충돌 → SOP-330003 / Too many arguments).
 *
 * [Main Functions]
 * ===========
 * - woo_testWooAiWorkflowUi_ShellProbe — has / message / first @name (out×3)
 * - woo_testWooAiWorkflowUi_ShellPick — Studio bind-pick
 * - woo_testWooAiWorkflowUi_ShellBind — 첫 AI 액티비티에 ai-sql-id
 * - _twWfSetAiSqlId — 중복 ai-sql-id 정리
 *
 * [Dependencies]
 * =========
 * - 계약: ibankSqlDM (+ legacy customActivity) / ai-sql-id
 * Ref: https://experienceleague.adobe.com/en/docs/campaign-classic/using/configuring-campaign-classic/api/implementing-soap-methods
 */

var TESTWOO_AI_ACTIVITY_EL = "ibankSqlDM";
var TESTWOO_AI_ACTIVITY_EL_LEGACY = "customActivity";
var TESTWOO_AI_SQL_ID_EL = "ai-sql-id";

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
 * @returns {[aiSqlId, pickLabel]}
 */
function woo_testWooAiWorkflowUi_ShellPick(workflowName) {
  var id = _twWfReadBindPick(workflowName);
  var label;
  if (id) {
    label = "ai_sql_id=" + id;
  } else {
    label = "(미선택 — Studio SQL 이력 클릭 또는 등록)";
  }
  logInfo("[testWoo.WorkflowUi.ShellPick] wf=" + _twWfTrim(workflowName) + " id=" + id);
  return [id, label];
}

/**
 * SOAP: ShellBind — 첫 AI 액티비티에 ai-sql-id
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
  _twWfSetAiSqlId(target.node, idStr);
  logInfo(
    "[testWoo.WorkflowUi.ShellBind] el=" + target.elName +
    " name=" + target.name + " ai_sql_id=" + idStr
  );
  return acts;
}
