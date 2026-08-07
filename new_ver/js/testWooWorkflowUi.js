/*
 * testWooWorkflowUi.js (WF 캔버스 ↔ Studio SOAP · server-side)
 * ============================================================
 * woo:testWooAiWorkflowUi 스키마의 SOAP 구현.
 * 함수명 규약: <ns>_<schema>_<method> (Adobe Implementing SOAP methods).
 *
 * [Main Functions]
 * ===========
 * - woo_testWooAiWorkflowUi_BuildStudioUrl — Studio URL + iframe HTML
 * - woo_testWooAiWorkflowUi_InspectAiTarget — 캔버스 activities 에 customActivity 유무
 * - woo_testWooAiWorkflowUi_BindAiSqlId — ai-sql-id 만 기록 (SQL 주입 금지)
 *
 * [Dependencies]
 * =========
 * - getOption("testWooAiStudioBaseUrl") — 필수 호스트 (끝 / 없음)
 * - 계약 액티비티 요소명: customActivity · 자식 ai-sql-id
 *   (new_ver/workflow/testWooSampleCustomActivityContract.xml)
 * Ref: https://experienceleague.adobe.com/en/docs/campaign-classic/using/configuring-campaign-classic/api/implementing-soap-methods
 */

/** 계약: Test Woo AI Target 커스텀 액티비티 요소명 */
var TESTWOO_AI_ACTIVITY_EL = "customActivity";
/** 계약: Register id 를 담는 자식 요소명 */
var TESTWOO_AI_SQL_ID_EL = "ai-sql-id";

function _twWfTrim(s) {
  return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
}

function _twWfEncodeComp(s) {
  return encodeURIComponent(String(s || ""));
}

function _twWfStripSlash(base) {
  var b = _twWfTrim(base);
  while (b.length > 0 && b.charAt(b.length - 1) === "/") {
    b = b.substring(0, b.length - 1);
  }
  return b;
}

function _twWfEscAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function _twWfStudioBase() {
  var base = "";
  try {
    base = _twWfStripSlash(getOption("testWooAiStudioBaseUrl"));
  } catch (eOpt) {
    base = "";
  }
  if (!base) {
    logError("[testWoo.WorkflowUi] option testWooAiStudioBaseUrl empty");
    throw new Error(
      "Option testWooAiStudioBaseUrl is empty. Set it to the Campaign host " +
      "(e.g. https://__CAMPAIGN_SERVER_URL__) with no trailing slash."
    );
  }
  return base;
}

/**
 * activities DOM/E4X → XML
 */
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

/**
 * @returns {Array} { name, label, node }
 */
function _twWfListCustomActivities(activitiesXml) {
  var acts = _twWfActivitiesRoot(activitiesXml);
  var out = [];
  try {
    var children = acts.children();
    var n = children.length();
    for (var i = 0; i < n; i++) {
      var ch = children[i];
      if (String(ch.name()) !== TESTWOO_AI_ACTIVITY_EL) {
        continue;
      }
      out.push({
        name: _twWfTrim(String(ch.@name || "")),
        label: _twWfTrim(String(ch.@label || "")),
        node: ch
      });
    }
  } catch (eList) {
    logWarning("[testWoo.WorkflowUi._twWfListCustomActivities] " + eList);
  }
  return out;
}

function _twWfSetAiSqlId(node, aiSqlId) {
  var idStr = String(aiSqlId);
  try {
    if (node["ai-sql-id"] && node["ai-sql-id"].length() > 0) {
      node["ai-sql-id"] = idStr;
      return;
    }
  } catch (eChild) {}
  node.appendChild(<ai-sql-id>{idStr}</ai-sql-id>);
}

/**
 * SOAP: BuildStudioUrl
 * @returns {[studioUrl, studioFrameHtml]}
 */
function woo_testWooAiWorkflowUi_BuildStudioUrl(workflowName) {
  var name = _twWfTrim(workflowName);
  if (!name) {
    logError("[testWoo.WorkflowUi.BuildStudioUrl] workflowName empty");
    throw new Error("Workflow internal name is empty. Save the workflow, then retry AI Studio.");
  }
  if (name.length > 64) {
    logWarning("[testWoo.WorkflowUi.BuildStudioUrl] workflowName truncated to 64");
    name = name.substring(0, 64);
  }

  var base = _twWfStudioBase();
  var url = base + "/woo/testWooAiStudio.jssp?workflowName=" + _twWfEncodeComp(name) + "&embed=1";
  var html =
    '<div style="border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#fff;">' +
    '<iframe src="' + _twWfEscAttr(url) + '" title="Test Woo AI Studio" ' +
    'style="width:100%;height:520px;border:0;display:block;" ' +
    'referrerpolicy="same-origin"></iframe></div>';

  logInfo("[testWoo.WorkflowUi.BuildStudioUrl] wf=" + name + " url=" + url);
  return [url, html];
}

/**
 * SOAP: InspectAiTarget
 * @returns {[hasActivity, activityCount, namesCsv, message]} all strings (form soapCall safe)
 */
function woo_testWooAiWorkflowUi_InspectAiTarget(activitiesXml) {
  var list = _twWfListCustomActivities(activitiesXml);
  var count = list.length;
  var names = [];
  for (var i = 0; i < count; i++) {
    names.push(list[i].name || ("#" + i));
  }
  var namesCsv = names.join(", ");
  var hasStr = count > 0 ? "true" : "false";
  var countStr = String(count);
  var message;
  if (count === 0) {
    message =
      "No Test Woo AI Target (customActivity) on this canvas. " +
      "Add the activity from the palette, then Refresh status. Auto-create is disabled.";
  } else if (count === 1) {
    message =
      "Found 1 customActivity (" + namesCsv + "). " +
      "Register SQL in Studio, enter ai_sql_id below, then Apply to canvas.";
  } else {
    message =
      "Found " + count + " customActivity nodes (" + namesCsv + "). " +
      "Enter the activity @name to bind, then Apply.";
  }
  logInfo("[testWoo.WorkflowUi.InspectAiTarget] count=" + countStr + " names=" + namesCsv);
  return [hasStr, countStr, namesCsv, message];
}

/**
 * SOAP: BindAiSqlId — activities 에 ai-sql-id 만 기록
 * @returns {XML} activities
 */
function woo_testWooAiWorkflowUi_BindAiSqlId(activitiesXml, aiSqlId, activityNameOpt) {
  var idStr = _twWfTrim(aiSqlId);
  if (!idStr || idStr === "0") {
    throw new Error("ai_sql_id is empty. Register in Studio first, then paste the id.");
  }
  if (!/^[0-9]+$/.test(idStr)) {
    throw new Error("ai_sql_id must be a positive integer.");
  }

  var acts = _twWfActivitiesRoot(activitiesXml);
  var list = _twWfListCustomActivities(acts);
  if (list.length === 0) {
    throw new Error(
      "No customActivity on this canvas. Add Test Woo AI Target activity before Apply."
    );
  }

  var want = _twWfTrim(activityNameOpt);
  var target = null;
  if (want) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === want) {
        target = list[i];
        break;
      }
    }
    if (!target) {
      throw new Error("customActivity @name not found: " + want);
    }
  } else if (list.length === 1) {
    target = list[0];
  } else {
    throw new Error(
      "Multiple customActivity nodes. Set Activity name to one of: " +
      (function () {
        var s = [];
        for (var j = 0; j < list.length; j++) s.push(list[j].name);
        return s.join(", ");
      })()
    );
  }

  _twWfSetAiSqlId(target.node, idStr);
  logInfo(
    "[testWoo.WorkflowUi.BindAiSqlId] name=" + target.name + " ai_sql_id=" + idStr
  );
  return acts;
}
