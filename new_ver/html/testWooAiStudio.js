/*
 * testWooAiStudio.js (Test Woo AI Studio 클라이언트)
 * ==================================================
 * HTML ↔ 서버 JSSP. LLM/SQL은 서버만. CNF plan 기반 UI.
 * SQL-First ctx.phase ST0~ST6 · Foundry 후 after_foundry 재큐잉 차단.
 *
 * [Main Functions]
 * ===========
 * - generate / discoverFind / validate / register / runMatch
 * - putDraft / _cacheListDrafts — R2 미반영 SQL 캐시
 * - renderBreadcrumb / _matchDisabledMsg
 * - loadAiFolders / selectFolder / loadCampaigns / selectCampaign / createCampaign
 * - createWkf / selectWkf / showOpenHint
 * - goBack / resetCtx / renderListPane / setInputEnabled
 * - _xhrPost / _diag — IE XHR + 인페이지 진단 패널
 *
 * [Dependencies]
 * =========
 * - /woo/testWooAiGenerate|Validate|Register|Match|StudioContext.jssp
 * - Cookie credentials + X-Requested-With / payload.csrf + pageHost
 * - window.__TW_MATCH_ENABLED__ (Studio.jssp Option 주입 · 기본 false)
 * - Mirror of /woo/testWooAiStudioJs.jssp?v=159
 * - ES5 only: no fetch/Promise/classList/forEach/URLSearchParams/const/let/=>
 *
 * [Invariants]
 * ===========
 * - ST0 NL 즉시 활성 · Foundry done 자동재시도는 after_foundry(재큐잉 금지)
 * - MATCH_ENABLED 기본 false
 */(function () {
  "use strict";

  var TITLE_MAX = 200; // schema woo:testWooAiSql @title length
  // Foundry 배치가 5분 주기이므로 5초 폴링은 저널에 인증 로그만 쌓는다(JST-310036 노이즈).
  // 20초 × 30회 = 10분 대기 (총 대기 시간은 기존과 동일).
  var QUEUE_POLL_MS = 20000;
  var QUEUE_POLL_MAX = 30;
  var BASE = "/woo/";
  var DEL_CONFIRM_MS = 3000;

  // ACC urlViewer 구엔진에 URLSearchParams 없을 수 있음 — 수동 파싱
  function _qs(name) {
    var s = String(location.search || "");
    if (s.charAt(0) === "?") s = s.substring(1);
    var parts = s.split("&");
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf("=");
      var k = eq < 0 ? parts[i] : parts[i].substring(0, eq);
      var v = eq < 0 ? "" : parts[i].substring(eq + 1);
      try { k = decodeURIComponent(k.replace(/\+/g, " ")); } catch (e1) {}
      try { v = decodeURIComponent(v.replace(/\+/g, " ")); } catch (e2) {}
      if (k === name) return v;
    }
    return "";
  }

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  var WORKFLOW_NAME = _qs("workflowName") || "";
  var EMBED = _qs("embed") === "1" || window.__TW_EMBED__ === true;
  /* #152: Option testWooAiMatchEnabled — 미주입·false 이면 유사 목록 완전 차단 */
  var MATCH_ENABLED = window.__TW_MATCH_ENABLED__ === true;

  var MATCH_DISABLED_MSG =
    "\uC870\uAC74 \uB9E4\uCE6D \uAE30\uB2A5\uC740 \uC815\uD655\uB3C4 \uAC1C\uC120 \uC911\uC785\uB2C8\uB2E4. \uC0C8 \uC870\uAC74\uC73C\uB85C \uC0DD\uC131\uD574 \uC8FC\uC138\uC694.";

  function _matchDisabledMsg() {
    return MATCH_DISABLED_MSG;
  }

  /* #148R R2: draft SQL cache — runtime sessionStorage probe, memory fallback */
  var CACHE_STORE_KEY = "twStudioCache";
  var CACHE_SCHEMA_V = 1;
  var CACHE_MEM_WARN =
    "\uC0C8\uB85C\uACE0\uCE68 \uC2DC \uC784\uC2DC SQL\uC774 \uC0AC\uB77C\uC9C8 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
  var _cacheBackend = "memory";
  var _cacheMemRoot = null;

  function _probeCacheBackend() {
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage) {
        var pk = "_twProbe_" + String(new Date().getTime());
        sessionStorage.setItem(pk, "1");
        var gv = sessionStorage.getItem(pk);
        sessionStorage.removeItem(pk);
        if (gv === "1") return "session";
      }
    } catch (eProbe) {}
    return "memory";
  }

  function _cacheEmptyRoot() {
    return { v: CACHE_SCHEMA_V, drafts: [] };
  }

  function _cacheReadRoot() {
    if (_cacheBackend === "session") {
      try {
        var raw = sessionStorage.getItem(CACHE_STORE_KEY);
        if (!raw) return _cacheEmptyRoot();
        var obj = JSON.parse(raw);
        if (!obj || obj.v !== CACHE_SCHEMA_V || !obj.drafts) return _cacheEmptyRoot();
        return obj;
      } catch (eR) {
        return _cacheEmptyRoot();
      }
    }
    if (!_cacheMemRoot) _cacheMemRoot = _cacheEmptyRoot();
    return _cacheMemRoot;
  }

  function _cacheWriteRoot(root) {
    if (!root || root.v !== CACHE_SCHEMA_V) root = _cacheEmptyRoot();
    if (_cacheBackend === "session") {
      try {
        sessionStorage.setItem(CACHE_STORE_KEY, JSON.stringify(root));
      } catch (eW) {}
      return;
    }
    _cacheMemRoot = root;
  }

  function _cacheListDrafts() {
    var root = _cacheReadRoot();
    var list = root.drafts || [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].status === "draft") out.push(list[i]);
    }
    out.sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return out;
  }

  function _cacheUpsertDraft(rec) {
    if (!rec || !rec.cacheId) return;
    var root = _cacheReadRoot();
    var drafts = root.drafts || [];
    var found = -1;
    for (var i = 0; i < drafts.length; i++) {
      if (drafts[i] && drafts[i].cacheId === rec.cacheId) {
        found = i;
        break;
      }
    }
    if (found >= 0) drafts[found] = rec;
    else drafts.push(rec);
    root.drafts = drafts;
    _cacheWriteRoot(root);
  }

  function _cacheRemoveDraft(cacheId) {
    if (!cacheId) return;
    var root = _cacheReadRoot();
    var drafts = root.drafts || [];
    var next = [];
    for (var i = 0; i < drafts.length; i++) {
      if (!drafts[i] || drafts[i].cacheId !== cacheId) next.push(drafts[i]);
    }
    root.drafts = next;
    _cacheWriteRoot(root);
  }

  function _cacheClearAll() {
    _cacheWriteRoot(_cacheEmptyRoot());
  }

  function _djb2Hex(str) {
    var h = 5381;
    var s = String(str || "");
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) + h) + s.charCodeAt(i);
      h = h & 0xffffffff;
    }
    var hex = (h >>> 0).toString(16);
    while (hex.length < 8) hex = "0" + hex;
    return hex;
  }

  function _genCacheId() {
    return "twc_" + String(new Date().getTime()) + "_" +
      String(Math.floor(Math.random() * 100000));
  }

  function _extractUsedFragments(plan) {
    var out = [];
    var seen = {};
    function addItem(item) {
      if (!item || !item.fragment) return;
      var name = String(item.fragment);
      if (seen[name]) return;
      seen[name] = true;
      out.push({ name: name, version: item.version || 1, fragmentId: item.fragmentId || 0 });
    }
    var inc = (plan && plan.include) || [];
    for (var i = 0; i < inc.length; i++) {
      var any = (inc[i] && inc[i].any) || [];
      for (var j = 0; j < any.length; j++) addItem(any[j]);
    }
    var ex = (plan && plan.exclude) || [];
    for (var k = 0; k < ex.length; k++) addItem(ex[k]);
    return out;
  }

  function _ensureCacheWarnEl() {
    if (_cacheBackend !== "memory") return;
    try {
      var bar = $("twInfoBar");
      if (!bar) return;
      var w = $("twCacheWarn");
      if (!w) {
        w = document.createElement("span");
        w.id = "twCacheWarn";
        bar.appendChild(w);
      }
      w.className = "cache-warn";
      w.textContent = " | " + CACHE_MEM_WARN;
    } catch (eW) {}
  }

  function putDraft() {
    if (!state.passed || !_trim(state.sql)) return;
    if (!state.plan) return;
    var cid = state.cacheId || _genCacheId();
    var rec = {
      cacheId: cid,
      createdAt: new Date().getTime(),
      nl_request: state.nl || "",
      plan: state.plan,
      sql: state.sql,
      usedFragments: _extractUsedFragments(state.plan),
      sqlHash: _djb2Hex(state.sql),
      status: "draft"
    };
    state.cacheId = cid;
    _cacheUpsertDraft(rec);
    _diag("putDraft cacheId=" + cid);
    if (SHELL_MODE && ctx.listMode === "WKF" && !ctx.workflow) renderListPane();
  }

  function _restoreDraft(draft) {
    if (!draft) return;
    state.cacheId = draft.cacheId;
    state.nl = draft.nl_request || "";
    state.plan = draft.plan || null;
    state.sql = draft.sql || "";
    state.summary = "";
    state.passed = !!(_trim(state.sql) && state.plan);
    state.aiSqlId = null;
    try {
      var nlEl = $("nl");
      if (nlEl) nlEl.value = state.nl;
    } catch (eNl) {}
    if (state.plan) {
      _rmCls($("cardCode"), "hidden");
      renderSql(state.sql);
      _addCls($("cardChips"), "hidden");
      _addCls($("cardGates"), "hidden");
      _addCls($("cardFunnel"), "hidden");
      _addCls($("cardSlotResults"), "hidden");
    }
    $("btnReg").disabled = !state.passed;
    clearErr();
    renderSummaryHint(
      "\uC784\uC2DC SQL \uBCF5\uC6D0 \u2014 " + String(draft.cacheId || ""),
      state.passed
    );
  }

  function _renderDraftRows(box) {
    var drafts = _cacheListDrafts();
    for (var d = 0; d < drafts.length; d++) {
      (function (draft) {
        var el = document.createElement("div");
        el.className = "shell-item draft-cache";
        var label = _trim(draft.nl_request || draft.cacheId || "");
        if (label.length > 48) label = label.substring(0, 45) + "...";
        el.appendChild(document.createTextNode(
          label + " [\uBBF8\uBC18\uC601(\uC784\uC2DC)]"
        ));
        el.onclick = function () {
          _restoreDraft(draft);
          return false;
        };
        box.appendChild(el);
      })(drafts[d]);
    }
  }

  var state = {
    plan: null,
    sql: "",
    summary: "",
    passed: false,
    nl: "",
    aiSqlId: null,
    cacheId: null,
    queuePoll: null,
    foundryDoneQid: null
  };
  var _delPending = { id: null, timer: null, btn: null };
  /* SQL-First: phase=ST0~ST6 · listMode=FOLDER|CAMPAIGN|WKF (셸 패널은 R4) */
  var ctx = {
    phase: "ST0",
    listMode: "FOLDER",
    folder: null,
    folders: [],
    campaigns: [],
    campaign: null,
    wkfs: [],
    workflow: null,
    canCreateWkf: true,
    wkfMax: 15,
    openHint: "",
    matchShown: false,
    matchMode: "",
    stack: []
  };
  var SHELL_MODE = !(WORKFLOW_NAME && EMBED);
  var $ = function (id) { return document.getElementById(id); };

  function _activeWorkflowName() {
    if (WORKFLOW_NAME) return WORKFLOW_NAME;
    if (ctx.workflow && ctx.workflow.name) return String(ctx.workflow.name);
    return "";
  }

  // ---- className helpers (classList 없음 / IE \b 이슈 회피: 공백 패딩) ----
  function _hasCls(el, c) {
    if (!el) return false;
    return (" " + String(el.className || "") + " ").indexOf(" " + c + " ") >= 0;
  }
  function _addCls(el, c) {
    if (!el || !c || _hasCls(el, c)) return;
    var cur = _trim(el.className || "");
    el.className = cur ? (cur + " " + c) : c;
  }
  function _rmCls(el, c) {
    if (!el || !c) return;
    var s = " " + _trim(String(el.className || "").replace(/\s+/g, " ")) + " ";
    s = s.split(" " + c + " ").join(" ");
    el.className = _trim(s.replace(/\s+/g, " "));
  }

  // ---- 인페이지 진단 (urlViewer 에서 console 없음) ----
  function _diag(msg) {
    try {
      var el = $("twDiagLog");
      if (!el) return;
      var line = document.createElement("div");
      var d = new Date();
      var hh = d.getHours();
      var mm = d.getMinutes();
      var ss = d.getSeconds();
      var ts =
        (hh < 10 ? "0" : "") + hh + ":" +
        (mm < 10 ? "0" : "") + mm + ":" +
        (ss < 10 ? "0" : "") + ss;
      line.appendChild(document.createTextNode(ts + " " + String(msg)));
      el.appendChild(line);
      if (el.childNodes.length > 200) {
        el.removeChild(el.firstChild);
      }
    } catch (eD) {}
  }

  function _installOnError() {
    window.onerror = function (msg, url, line, col, errObj) {
      var parts = [];
      parts.push(String(msg));
      if (url) parts.push("url=" + url);
      if (line != null) parts.push("line=" + line);
      if (col != null) parts.push("col=" + col);
      if (errObj && errObj.stack) parts.push("stack=" + String(errObj.stack).substring(0, 400));
      var text = "onerror: " + parts.join(" | ");
      _diag(text);
      try {
        var h = $("hint");
        if (h) {
          h.className = "banner err";
          h.textContent = "Studio JS error: " + String(msg) + " @" + String(line);
        }
      } catch (e0) {}
      return false;
    };
  }

  function _createXhr() {
    if (typeof window.XMLHttpRequest !== "undefined") {
      try { return new XMLHttpRequest(); } catch (e0) {}
    }
    try { return new ActiveXObject("Microsoft.XMLHTTP"); } catch (e1) {}
    try { return new ActiveXObject("Msxml2.XMLHTTP"); } catch (e2) {}
    return null;
  }

  // IE/MSHTML: fetch/Promise 없음 → XHR + 콜백. withCredentials 설정 금지.
  function _xhrPost(endpoint, payload, onOk, onErr) {
    var p = payload || {};
    if (!p.csrf) p.csrf = "TestWooStudio";
    if (!p.pageHost) {
      try { p.pageHost = String(location.host || ""); } catch (eH) { p.pageHost = ""; }
    }
    var body = "payload=" + encodeURIComponent(JSON.stringify(p));
    var xhr = _createXhr();
    if (!xhr) {
      _diag("XHR unavailable");
      if (onErr) onErr(new Error("XMLHttpRequest unavailable"));
      return;
    }
    _diag("XHR request " + endpoint);
    try {
      xhr.open("POST", BASE + endpoint, true);
      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
      xhr.setRequestHeader("X-Requested-With", "TestWooStudio");
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        _diag("XHR status " + endpoint + " → " + xhr.status);
        var t = _trim(String(xhr.responseText || "").replace(/^\uFEFF/, ""));
        if (!t) {
          if (onErr) onErr(new Error(endpoint + " empty response (HTTP " + xhr.status + ")"));
          return;
        }
        var data;
        try {
          data = JSON.parse(t);
          _diag("JSON parse ok " + endpoint);
        } catch (eParse) {
          _diag("JSON parse fail " + endpoint);
          var preview = t.length > 800 ? t.substring(0, 800) + "..." : t;
          if (onErr) onErr(new Error(endpoint + " non-JSON (HTTP " + xhr.status + "): " + preview));
          return;
        }
        if (data && data.code === "AUTH" && data.logonUrl) {
          location.href = data.logonUrl;
          if (onErr) onErr(new Error("NOT_AUTHENTICATED"));
          return;
        }
        if (onOk) onOk(data);
      };
      xhr.send(body);
    } catch (eSend) {
      _diag("XHR send fail " + endpoint + ": " + String(eSend && eSend.message ? eSend.message : eSend));
      if (onErr) onErr(eSend);
    }
  }

  function post(endpoint, payload, onOk, onErr) {
    _xhrPost(endpoint, payload, onOk, onErr);
  }

  function showErr(msg) {
    var e = $("err");
    if (!e) return;
    e.textContent = msg;
    _rmCls(e, "hidden");
  }
  function clearErr() {
    var e = $("err");
    if (!e) return;
    _addCls(e, "hidden");
  }
  function _errText(res) {
    if (!res) return "error";
    var m = res.error || "failed";
    if (res.detail && String(res.detail) !== String(m)) m += " | " + res.detail;
    if (res.errId) m += " [" + res.errId + "]";
    return m;
  }

  function _queueStatusLabel(status) {
    var map = {
      queued: "\uB300\uAE30 \uC911 (WF\uAC00 \uC791\uC5C5 \uC608\uC815)",
      processing: "fragment \uC0DD\uC131 \uC9C4\uD589 \uC911",
      awaiting_approval: "\uC0DD\uC131 \uC644\uB8CC \u2014 \uC6B4\uC601 \uB2F4\uB2F9\uC790 \uC2B9\uC778 \uB300\uAE30",
      infeasible: "\uC694\uCCAD \uC870\uAC74 \uC2E4\uD604 \uBD88\uAC00",
      partially_infeasible: "\uC77C\uBD80 \uC870\uAC74\uB9CC \uAC00\uB2A5",
      failed: "\uC0DD\uC131 \uC2E4\uD328",
      needs_human_design: "\uC6B4\uC601 \uAC80\uD1A0 \uD544\uC694",
      throttled: "LLM \uC6A9\uB7C9 \uC81C\uD55C",
      done: "\uC644\uB8CC"
    };
    return map[status] || status;
  }

  function _renderQueueHint(status, queueId, reviewUrl, lastError) {
    var el = $("hint");
    var idPart = queueId ? " (queueId=" + queueId + ")" : "";
    if (status === "queued" || status === "processing") {
      el.className = "banner warn";
      el.innerHTML =
        "<strong>[\uC9C4\uD589 \uC911]</strong> " + _queueStatusLabel(status) + idPart +
        "<br/>\uC774 \uD654\uBA74\uC744 \uB2EB\uC9C0 \uB9C8\uC138\uC694. \uC57D 20\uCD08 \uAC04\uACA9\uC73C\uB85C \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uBA70, fragment \uC0DD\uC131 \uBC30\uCE58\uB294 \uC57D 5\uBD84 \uC8FC\uAE30\uB85C \uB3D9\uC791\uD569\uB2C8\uB2E4." +
        (lastError ? "<br/>" + esc(lastError) : "");
      return;
    }
    if (status === "awaiting_approval") {
      el.className = "banner ok";
      el.innerHTML =
        "<strong>[\uC6B4\uC601 \uC2B9\uC778 \uD544\uC694]</strong> fragment \uC0DD\uC131\uC740 \uC774\uBBF8 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4." + idPart +
        "<br/>\uB9C8\uCF00\uD130\uAC00 \uC2B9\uC778\uD558\uB294 \uACBD\uB85C\uAC00 \uC544\uB2D9\uB2C8\uB2E4. <strong>\uC6B4\uC601 \uB2F4\uB2F9\uC790</strong>\uAC00 LibraryManage \uAD8C\uD55C\uC73C\uB85C \uC2B9\uC778\uD574\uC57C \uD569\uB2C8\uB2E4." +
        "<br/>\uC2B9\uC778 \uC644\uB8CC \uD6C4 <strong>\uAC19\uC740 \uC9C8\uBB38\uC744 \uB2E4\uC2DC [\uC0DD\uC131]</strong>\uD574 \uC8FC\uC138\uC694.";
      return;
    }
    if (status === "done") {
      el.className = "banner ok";
      el.innerHTML =
        "<strong>[fragment \uC900\uBE44 \uC644\uB8CC]</strong> Foundry\uAC00 fragment\uB97C \uB4F1\uB85D\uD588\uC2B5\uB2C8\uB2E4." + idPart +
        "<br/><strong>\uAC19\uC740 \uC9C8\uBB38\uC73C\uB85C [\uC0DD\uC131]\uC744 \uB2E4\uC2DC \uB204\uB974\uC138\uC694.</strong> " +
        "(\uC7A0\uC2DC \uD6C4 \uC790\uB3D9\uC73C\uB85C \uD55C \uBC88 \uB354 \uC2DC\uB3C4\uD569\uB2C8\uB2E4.)" +
        (lastError ? "<br/>" + esc(lastError) : "");
      return;
    }
    if (status === "infeasible" || status === "partially_infeasible") {
      el.className = "banner warn";
      el.textContent = _queueStatusLabel(status) + " \u2014 \uC544\uB798 \uC0C1\uC138\uB97C \uD655\uC778\uD558\uC138\uC694.";
      return;
    }
    if (status === "failed" || status === "needs_human_design" || status === "throttled") {
      el.className = "banner err";
      el.textContent = _queueStatusLabel(status) + idPart +
        (lastError ? " \u2014 " + lastError : "");
      return;
    }
    el.className = "banner warn";
    el.textContent = "Foundry \uD050: " + _queueStatusLabel(status) + idPart;
  }

  function pollQueue(queueId, reviewUrl) {
    var attempts = 0;
    var maxAttempts = QUEUE_POLL_MAX;
    if (state.queuePoll) clearInterval(state.queuePoll);
    state.queuePoll = setInterval(function () {
      attempts++;
      post("testWooAiQueueStatus.jssp", { queueId: queueId }, function (st) {
        if (!st.ok || !st.queue) return;
        var qs = st.queue.status;
        _renderQueueHint(qs, queueId, reviewUrl, st.queue.lastError);
        if (st.queue.slotResults && st.queue.slotResults.length)
          renderSlotResults(st.queue.slotResults, st.queue.partialPreview);
        if (qs === "awaiting_approval" || qs === "infeasible" || qs === "partially_infeasible" ||
            qs === "done" || qs === "failed" || qs === "needs_human_design" || qs === "throttled") {
          clearInterval(state.queuePoll);
          state.queuePoll = null;
          if (qs === "done") {
            var qidDone = String(queueId);
            if (state.foundryDoneQid !== qidDone) {
              state.foundryDoneQid = qidDone;
              setTimeout(function () {
                try {
                  /* 재큐잉 금지 — Stage A 미매칭 시 안내만 */
                  generate({ afterFoundry: true });
                } catch (eAuto) {
                  _diag("auto generate after foundry: " + eAuto);
                }
              }, 600);
            }
          }
        }
      }, function () {});
      if (attempts >= maxAttempts && state.queuePoll) {
        clearInterval(state.queuePoll);
        state.queuePoll = null;
        $("hint").className = "banner warn";
        $("hint").innerHTML =
          "<strong>[\uC2DC\uAC04 \uCD08\uACFC]</strong> \uC0C1\uD0DC \uC870\uD68C\uB97C \uC911\uB2E8\uD588\uC2B5\uB2C8\uB2E4 (queueId=" + queueId + "). " +
          "Foundry \uC644\uB8CC \uD6C4 <strong>\uAC19\uC740 \uC9C8\uBB38\uC73C\uB85C [\uC0DD\uC131]</strong>\uC744 \uB2E4\uC2DC \uB204\uB974\uC138\uC694.";
      }
    }, QUEUE_POLL_MS);
    _renderQueueHint("queued", queueId, reviewUrl, "");
  }

  function renderSlotResults(slots, partialPreview) {
    var box = $("slotResults");
    if (!box) return;
    box.innerHTML = "";
    var list = slots || [];
    for (var si = 0; si < list.length; si++) {
      var s = list[si];
      var el = document.createElement("div");
      el.className = "slot-card";
      var badgeCls = "badge badge-" + esc(s.verdict || "ambiguous");
      if (s.confidence === "low") badgeCls += " badge-low";
      el.innerHTML = "<strong>" + esc(s.slotText || s.slotId) + "</strong>" +
        "<span class='" + badgeCls + "'>" + esc(s.verdict) + " / " + esc(s.confidence) + "</span>" +
        "<p><em>AI \uC124\uBA85:</em> " + esc(s.narrative || "") + "</p>";
      if (s.evidence) {
        var det = document.createElement("div");
        det.innerHTML = "<div style='font-size:.78rem;color:#64748b;'>\uC2E4\uC81C \uC870\uD68C \uACB0\uACFC</div><pre class='code'>" +
          esc(JSON.stringify(s.evidence, null, 2)) + "</pre>";
        el.appendChild(det);
      }
      if (s.alternatives && s.alternatives.length) {
        var chips = document.createElement("div");
        chips.className = "alt-chips";
        for (var ai = 0; ai < s.alternatives.length; ai++) {
          (function (a) {
            var c = document.createElement("span");
            c.className = "alt-chip";
            c.textContent = a.label || a.detail || a.type;
            c.onclick = function () {
              if (a.detail) $("nl").value = a.detail;
              else if (a.label) $("nl").value = a.label;
            };
            chips.appendChild(c);
          })(s.alternatives[ai]);
        }
        el.appendChild(chips);
      }
      box.appendChild(el);
    }
    if (partialPreview && partialPreview.sql) {
      var warn = document.createElement("div");
      warn.className = "banner warn";
      warn.textContent = "\uBD80\uBD84 \uC2E4\uD589 \uBBF8\uB9AC\uBCF4\uAE30 — \uC81C\uC678\uB41C \uC870\uAC74\uC774 \uC788\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
      box.appendChild(warn);
      renderSql(partialPreview.sql);
    }
    _rmCls($("cardSlotResults"), "hidden");
  }

  function _planHasFragments(plan) {
    if (!plan) return false;
    var inc = plan.include || [];
    var exc = plan.exclude || [];
    return (inc.length + exc.length) > 0;
  }

  function generate(opt) {
    var afterFoundry = !!(opt && opt.afterFoundry);
    var nl = _trim($("nl").value);
    if (!nl) return;
    state.nl = nl; clearErr(); setBusy(true);
    _diag("generate start phase=" + ctx.phase + " afterFoundry=" + (afterFoundry ? "1" : "0"));
    var genPayload = {
      nl_request: nl,
      workflow_name: _activeWorkflowName()
    };
    if (afterFoundry) genPayload.after_foundry = true;
    post("testWooAiGenerate.jssp", genPayload, function (res) {
      try {
        if (res.status === "queued" && res.queueId) {
          if (afterFoundry) {
            showErr(
              "Foundry \uC644\uB8CC \uD6C4\uC5D0\uB3C4 \uB2E4\uC2DC \uD050\uC5D0 \uB4E4\uC5B4\uAC14\uC2B5\uB2C8\uB2E4. " +
                "Stage A/\uB77C\uC774\uBE0C\uB7EC\uB9AC\uB97C \uD655\uC778\uD55C \uB4A4 [\uC0DD\uC131]\uC744 \uB204\uB974\uC138\uC694."
            );
            return;
          }
          hideResultCards();
          pollQueue(res.queueId, res.reviewUrl);
          return;
        }
        if (!res.ok) {
          _diag(
            "generate !ok error=" +
              String(res.error || "") +
              " errId=" +
              String(res.errId || "") +
              " detail=" +
              String(res.detail || "").substring(0, 180)
          );
          if (res.unmatched && res.unmatched.length) {
            $("hint").className = "banner warn";
            // unmatched = Stage A \uD504\uB798\uADF8\uBA3C\uD2B8 \uBBF8\uBC1C\uACAC (\uCC3D\uC791 SQL/\uC870\uAC74 \uAE08\uC9C0)
            if (afterFoundry || res.afterFoundry) {
              $("hint").textContent =
                "Foundry fragment\uB294 \uC788\uC73C\uB098 Stage A\uAC00 \uC544\uC9C1 \uC5F0\uACB0\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. " +
                "\uC2AC\uB86F: " + res.unmatched.join(" | ") +
                " \u2014 JS(testWooFragments) \uBC30\uD3EC \uD6C4 [\uC0DD\uC131] \uC7AC\uC2DC\uB3C4.";
            } else {
              $("hint").textContent =
                "\uB9E4\uCE6D \uC2E4\uD328(\uCC3D\uC791 \uC5C6\uC74C): \uB77C\uC774\uBE0C\uB7EC\uB9AC\uC5D0 \uD574\uB2F9 fragment\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. " +
                "\uC2AC\uB86F: " + res.unmatched.join(" | ");
            }
            hideResultCards();
          } else {
            showErr("Generate: " + _errText(res));
            if (res.results) renderGates(res.results);
          }
          return;
        }
        state.plan = res.plan;
        state.sql = res.sql || "";
        state.summary = res.summary || "";
        state.passed = !!res.passed;
        /* ST0 제출 성공 → ST1 · SQL 확정(passed)이면 ST2 (목록 UI는 R4) */
        if (SHELL_MODE) {
          ctx.phase = state.passed && _trim(state.sql) ? "ST2" : "ST1";
        }
        renderChips(res.chips);
        renderSql(state.sql);
        renderGates(res.results || []);
        $("btnReg").disabled = !state.passed;
        if (!state.passed) {
          showErr(res.error || "validation failed");
          renderSummaryHint(res.summary, false);
        } else {
          renderSummaryHint(res.summary, true);
        }
        if (state.passed && _trim(state.sql)) putDraft();
        hideFunnel();
        if (SHELL_MODE && !ctx.workflow) {
          ctx.wkfs = [];
          ctx.matchShown = false;
          ctx.matchMode = "";
          _showSqlSide(false);
          renderListPane();
        }
      } finally {
        setBusy(false);
      }
    }, function (e) {
      showErr(String(e && e.message ? e.message : e));
      setBusy(false);
    });
  }

  /* #147 reuse: plan_only Generate → Match discover (SQL/Register/Foundry \uC5C6\uC74C) */
  function discoverFind() {
    if (!MATCH_ENABLED) {
      showErr(_matchDisabledMsg());
      ctx.wkfs = [];
      ctx.matchShown = false;
      ctx.matchMode = "";
      if (!ctx.workflow) renderListPane();
      return;
    }
    if (SHELL_MODE && (!ctx.campaign || !ctx.campaign.id)) {
      showErr("\uCEA0\uD398\uC778\uC744 \uBA3C\uC800 \uC120\uD0DD\uD558\uC138\uC694.");
      return;
    }
    var nl = _trim($("nl").value);
    if (!nl) return;
    state.nl = nl;
    clearErr();
    setBusy(true);
    _diag("discoverFind start");
    post(
      "testWooAiGenerate.jssp",
      {
        nl_request: nl,
        workflow_name: _activeWorkflowName(),
        plan_only: true
      },
      function (res) {
        try {
          if (res && res.status === "queued") {
            showErr(
              "\uD0D0\uC0C9 \uACBD\uB85C\uC5D0\uC11C\uB294 Foundry \uD050\uB97C \uC0AC\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC870\uAC74\uC744 \uB2E4\uC2DC \uC785\uB825\uD558\uC138\uC694."
            );
            hideResultCards();
            return;
          }
          if (!res || !res.plan || !_planHasFragments(res.plan)) {
            if (res && res.unmatched && res.unmatched.length) {
              $("hint").className = "banner warn";
              $("hint").textContent =
                "\uB9E4\uCE6D \uC2E4\uD328(\uD0D0\uC0C9 \uBD88\uAC00): \uB77C\uC774\uBE0C\uB7EC\uB9AC\uC5D0 \uD574\uB2F9 fragment\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. " +
                "\uC2AC\uB86F: " +
                res.unmatched.join(" | ");
            } else {
              showErr(_errText(res) || "plan_only failed");
            }
            hideResultCards();
            ctx.wkfs = [];
            ctx.matchShown = false;
            ctx.matchMode = "";
            if (!ctx.workflow) renderListPane();
            return;
          }
          state.plan = res.plan;
          state.sql = "";
          state.summary = res.summary || "";
          state.passed = false;
          if (res.chips) renderChips(res.chips);
          else hideResultCards();
          _addCls($("cardCode"), "hidden");
          _addCls($("cardGates"), "hidden");
          $("btnReg").disabled = true;
          if (res.unmatched && res.unmatched.length) {
            $("hint").className = "banner warn";
            $("hint").textContent =
              "\uC77C\uBD80 \uC870\uAC74\uB9CC\uC73C\uB85C \uD0D0\uC0C9\uD569\uB2C8\uB2E4. \uBBF8\uB9E4\uCE6D: " +
              res.unmatched.join(" | ");
          } else {
            clearErr();
            $("hint").className = "banner ok";
            $("hint").textContent =
              "\uC870\uAC74 \uACC4\uD68D \uC644\uB8CC \u2014 \uAC12 \uB300\uC870 WKF\uB97C \uCC3E\uB294 \uC911\u2026";
          }
          hideFunnel();
          runMatch(null, "discover");
        } finally {
          setBusy(false);
        }
      },
      function (e) {
        showErr(String(e && e.message ? e.message : e));
        setBusy(false);
      }
    );
  }

  function validate() {
    if (!state.plan || !fragmentCount(state.plan)) { hideResultCards(); return; }
    post("testWooAiValidate.jssp", { plan: state.plan }, function (v) {
      if (!v.ok) {
        showErr(_errText(v));
        return;
      }
      state.sql = v.sql || "";
      state.summary = v.summary || state.summary;
      state.passed = !!v.passed;
      if (v.chips) renderChips(v.chips);
      renderSql(state.sql);
      renderGates(v.results);
      $("btnReg").disabled = !v.passed;
      renderSummaryHint(v.summary || state.summary, !!v.passed);
      if (state.passed && _trim(state.sql)) putDraft();
    }, function (e) {
      showErr(String(e && e.message ? e.message : e));
    });
  }

  function register() {
    if (!state.passed) return;
    if (SHELL_MODE && !_activeWorkflowName()) {
      showErr(
        "\uBA3C\uC800 WKF\uB97C \uC120\uD0DD\uD558\uAC70\uB098 \uC0C8 WKF\uB97C \uC0DD\uC131\uD558\uC138\uC694."
      );
      return;
    }
    setBusy(true); clearErr();
    var title = String(state.nl || "").substring(0, TITLE_MAX);
    _diag("register start");
    post("testWooAiRegister.jssp", {
      plan: state.plan,
      workflow_name: _activeWorkflowName(),
      title: title,
      target_count: 0,
      nl_request: state.nl
    }, function (r) {
      try {
        if (!r.ok || r.passed === false) {
          showErr(_errText(r));
          if (r.results) renderGates(r.results);
          if (r.sql) { state.sql = r.sql; renderSql(r.sql); }
          return;
        }
        state.aiSqlId = r.ai_sql_id;
        if (r.sql) state.sql = r.sql;
        if (state.cacheId) {
          _cacheRemoveDraft(state.cacheId);
          state.cacheId = null;
        }
        if (SHELL_MODE) ctx.phase = "ST6";
        setInfoBar(_folderInfoText());
        if (r.created === false) {
          $("hint").className = "banner warn";
          $("hint").textContent =
            r.message ||
            ("\uB3D9\uC77C SQL \uAE30\uC874 \uB4F1\uB85D \u2014 ai_sql_id=" + r.ai_sql_id);
          $("btnReg").disabled = true;
          setBindPick(r.ai_sql_id);
          loadSqlList();
          return;
        }
        $("hint").className = "banner ok";
        $("hint").textContent = EMBED
          ? ("Registered. ai_sql_id=" + r.ai_sql_id +
            " \u2014 \uC544\uB798 Apply to canvas \uB97C \uB204\uB974\uC138\uC694.")
          : ("Registered. ai_sql_id=" + r.ai_sql_id +
            " \u2014 Apply on WF AI Studio form (ibankSqlDM ai-sql-id).");
        $("btnReg").disabled = true;
        setBindPick(r.ai_sql_id);
        loadSqlList();
      } finally {
        setBusy(false);
      }
    }, function (e) {
      showErr(String(e && e.message ? e.message : e));
      setBusy(false);
    });
  }

  // 5차/#146: plan → Match (mode: dedup|discover)
  function runMatch(done, mode) {
    if (!MATCH_ENABLED) {
      ctx.wkfs = [];
      ctx.matchShown = false;
      ctx.matchMode = "";
      if (!ctx.workflow) {
        _showSqlSide(false);
        renderListPane();
      }
      showErr(_matchDisabledMsg());
      if (done) done(false);
      return;
    }
    if (!SHELL_MODE || !ctx.campaign || !ctx.campaign.id || !state.plan) {
      if (done) done(false);
      return;
    }
    var m = mode === "discover" ? "discover" : "dedup";
    ctx.matchMode = m;
    _diag("runMatch start mode=" + m);
    post(
      "testWooAiMatch.jssp",
      {
        plan: state.plan,
        campaign_id: ctx.campaign.id,
        operation_id: ctx.campaign.id,
        mode: m
      },
      function (res) {
        if (!res || !res.ok) {
          ctx.wkfs = [];
          ctx.matchShown = false;
          if (!ctx.workflow) {
            _showSqlSide(false);
            renderListPane();
          }
          showErr(_errText(res) || "match failed");
          if (done) done(false);
          return;
        }
        clearErr();
        ctx.wkfs = res.items || [];
        ctx.matchShown = true;
        if (!ctx.workflow) {
          _showSqlSide(false);
          renderListPane();
          var h = $("hint");
          var n = ctx.wkfs.length;
          if (h && m === "discover") {
            h.className = "banner ok";
            h.textContent =
              "\uAC12 \uB300\uC870 \uD6C4\uBCF4 WKF " +
              n +
              "\uAC74. \uC120\uD0DD \uC2DC Program/\uCEA0\uD398\uC778\uC774 \uC790\uB3D9 \uBC18\uC601\uB429\uB2C8\uB2E4. (\uBD88\uC77C\uCE58 \uAC12\uC740 \uC81C\uC678)";
          } else if (h && state.passed) {
            h.className = "banner ok";
            h.textContent =
              (state.summary || "SQL\uC774 \uC900\uBE44\uB418\uC5C8\uC2B5\uB2C8\uB2E4.") +
              " \u2014 \uC804\uC5ED \uC720\uC0AC WKF " +
              n +
              "\uAC74. \uC120\uD0DD \uC2DC Program/\uCEA0\uD398\uC778\uC774 \uC790\uB3D9 \uBC18\uC601\uB429\uB2C8\uB2E4. \uC0C8 WKF\uB294 \uD604\uC7AC \uCEA0\uD398\uC778\uC5D0 \uC0DD\uC131\uB429\uB2C8\uB2E4.";
          }
        }
        if (done) done(true);
      },
      function (err) {
        ctx.wkfs = [];
        ctx.matchShown = false;
        if (!ctx.workflow) {
          _showSqlSide(false);
          renderListPane();
        }
        showErr(String(err && err.message ? err.message : err));
        if (done) done(false);
      }
    );
  }

  // 뒤로가기/초기화: 이전 Generate·매칭이 캠페인 재진입에 남지 않게 정리
  function _clearComposeState() {
    state.plan = null;
    state.sql = "";
    state.summary = "";
    state.passed = false;
    state.nl = "";
    state.aiSqlId = null;
    state.cacheId = null;
    state.foundryDoneQid = null;
    ctx.wkfs = [];
    ctx.matchShown = false;
    ctx.matchMode = "";
    try {
      var nlEl = $("nl");
      if (nlEl) nlEl.value = "";
    } catch (eNl) {}
    try {
      hideResultCards();
    } catch (eH) {}
    try {
      var sqlBox = $("sql");
      if (sqlBox) sqlBox.textContent = "";
    } catch (eS) {}
  }

  function setBindPick(aiSqlId) {
    var wf = _activeWorkflowName();
    if (!wf || aiSqlId == null || aiSqlId === "" || aiSqlId === 0) return;
    post("testWooAiValidate.jssp", {
      action: "setBindPick",
      workflow_name: wf,
      ai_sql_id: aiSqlId
    }, function () {}, function () {
      /* Apply 는 폼 ShellPick — pick 실패해도 Studio 사용은 유지 */
    });
  }

  function setInfoBar(text) {
    /* #147: text 인자는 호환용 — 실제는 breadcrumb DOM */
    renderBreadcrumb();
  }

  function renderBreadcrumb() {
    var el = $("twInfoText");
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);

    function addSep() {
      var s = document.createElement("span");
      s.className = "crumb-sep";
      s.appendChild(document.createTextNode(">"));
      el.appendChild(s);
    }
    function addCrumb(label, isCur, onClick) {
      var a = document.createElement("span");
      a.className = isCur ? "crumb cur" : "crumb";
      a.appendChild(document.createTextNode(label));
      if (!isCur && onClick) {
        a.onclick = function () {
          onClick();
          return false;
        };
      }
      el.appendChild(a);
    }

    if (!ctx.folder) {
      addCrumb("Program: (\uBBF8\uC120\uD0DD)", true, null);
    } else {
      addCrumb(
        ctx.folder.label || ctx.folder.name || "Program",
        !ctx.campaign,
        function () {
          navToProgram();
        }
      );
      if (ctx.campaign) {
        addSep();
        addCrumb(
          ctx.campaign.label || ctx.campaign.name || "Campaign",
          !ctx.workflow,
          function () {
            navToCampaignList();
          }
        );
      }
      if (ctx.workflow) {
        addSep();
        addCrumb(
          ctx.workflow.label || ctx.workflow.name || "WKF",
          true,
          null
        );
      }
    }
    if (state.aiSqlId) {
      var sqlSp = document.createElement("span");
      sqlSp.appendChild(
        document.createTextNode(" | SQL: ai_sql_id=" + state.aiSqlId)
      );
      el.appendChild(sqlSp);
    }
  }

  function navToProgram() {
    if (!SHELL_MODE) return;
    _releaseCurrentLock(function () {
      _clearComposeState();
      ctx.workflow = null;
      ctx.openHint = "";
      ctx.campaign = null;
      ctx.campaigns = [];
      ctx.stack = [];
      if (!EMBED) WORKFLOW_NAME = "";
      _showSqlSide(false);
      ctx.listMode = "FOLDER";
      ctx.phase = "ST3";
      setInputEnabled(true);
      _refreshOpenButtons();
      renderBreadcrumb();
      loadAiFolders();
    });
  }

  function navToCampaignList() {
    if (!SHELL_MODE || !ctx.folder) {
      navToProgram();
      return;
    }
    _releaseCurrentLock(function () {
      _clearComposeState();
      ctx.workflow = null;
      ctx.openHint = "";
      ctx.campaign = null;
      if (!EMBED) WORKFLOW_NAME = "";
      _showSqlSide(false);
      ctx.listMode = "CAMPAIGN";
      ctx.phase = "ST4";
      ctx.stack = [];
      setInputEnabled(true);
      _refreshOpenButtons();
      renderBreadcrumb();
      loadCampaigns();
    });
  }

  function _refreshOpenButtons() {
    var on = !!(ctx.workflow && ctx.workflow.id);
    var b1 = $("btnTwOpenWkf");
    var b2 = $("btnTwGotoWkf");
    if (b1) b1.disabled = !on;
    if (b2) b2.disabled = !on;
  }

  function showOpenHint() {
    if (!ctx.workflow || !ctx.workflow.id) {
      showErr("\uBA3C\uC800 WKF\uB97C \uC120\uD0DD\uD558\uC138\uC694.");
      return;
    }
    var hint =
      ctx.openHint ||
      ("Explorer\uC5D0\uC11C \uD574\uB2F9 WKF\uB97C \uC5F4\uC5B4 \uC8FC\uC138\uC694 (name=" +
        ctx.workflow.name +
        ", id=" +
        ctx.workflow.id +
        ")");
    var h = $("hint");
    if (h) {
      h.className = "banner warn";
      h.textContent = hint;
    }
    clearErr();
  }

  function setInputEnabled(on) {
    var nl = $("nl");
    var btn = $("btnGen");
    var hint = $("twNlHint");
    var allow = !!on;
    if (nl) nl.disabled = !allow;
    if (btn) btn.disabled = !allow;
    if (hint) {
      if (allow) _addCls(hint, "hidden");
      else {
        _rmCls(hint, "hidden");
        hint.textContent =
          "\uC870\uAC74\uC744 \uC785\uB825\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. (\uCC98\uB9AC \uC911)";
      }
    }
  }

  function _folderInfoText() {
    if (!ctx.folder) return "Program: (\uBBF8\uC120\uD0DD)";
    var t = "Program: " + ctx.folder.label + " / " + ctx.folder.name;
    if (ctx.campaign && ctx.campaign.name) {
      t +=
        " | \uCEA0\uD398\uC778: " +
        (ctx.campaign.label || ctx.campaign.name) +
        " / " +
        ctx.campaign.name;
    }
    if (ctx.workflow && ctx.workflow.name) {
      t +=
        " | WKF: " +
        (ctx.workflow.label || ctx.workflow.name) +
        " / " +
        ctx.workflow.name +
        " (id=" +
        ctx.workflow.id +
        ")";
    }
    if (state.aiSqlId) {
      t += " | SQL: ai_sql_id=" + state.aiSqlId;
    }
    return t;
  }

  function _pushStack() {
    ctx.stack.push({
      phase: ctx.phase,
      listMode: ctx.listMode,
      folder: ctx.folder
        ? { id: ctx.folder.id, name: ctx.folder.name, label: ctx.folder.label }
        : null,
      campaign: ctx.campaign
        ? {
            id: ctx.campaign.id,
            name: ctx.campaign.name,
            label: ctx.campaign.label
          }
        : null,
      workflow: ctx.workflow
        ? {
            id: ctx.workflow.id,
            name: ctx.workflow.name,
            label: ctx.workflow.label
          }
        : null
    });
  }

  function _releaseCurrentLock(done) {
    if (!ctx.workflow || !ctx.workflow.id) {
      if (done) done();
      return;
    }
    var wid = ctx.workflow.id;
    post(
      "testWooAiStudioContext.jssp",
      { action: "releaseLock", workflow_id: wid },
      function () {
        if (done) done();
      },
      function () {
        if (done) done();
      }
    );
  }

  function renderListPane() {
    var box = $("twDummyList");
    var title = $("twListTitle");
    var side = $("sideSql");
    if (!box) return;
    if (side) side.style.display = "none";
    box.style.display = "block";
    box.innerHTML = "";

    if (ctx.listMode === "FOLDER") {
      if (title) title.textContent = "AI Program";
      if (!ctx.folders.length) {
        var empty = document.createElement("div");
        empty.className = "side-empty";
        empty.appendChild(document.createTextNode(
          "AI Program\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. isAiFolder=\uCC38 \uD3F4\uB354\uB97C \uBA3C\uC800 \uC900\uBE44\uD558\uC138\uC694."
        ));
        box.appendChild(empty);
        return;
      }
      for (var i = 0; i < ctx.folders.length; i++) {
        (function (row) {
          var el = document.createElement("div");
          el.className = "shell-item";
          el.appendChild(document.createTextNode(
            (row.label || row.name) + " (" + row.name + ")"
          ));
          el.onclick = function () {
            selectFolder(row);
            return false;
          };
          box.appendChild(el);
        })(ctx.folders[i]);
      }
      return;
    }

    if (ctx.listMode === "CAMPAIGN") {
      if (title) title.textContent = "\uCEA0\uD398\uC778 \uBAA9\uB85D";
      var createCamp = document.createElement("div");
      createCamp.className = "shell-item";
      createCamp.appendChild(
        document.createTextNode("\uC0C8 \uCEA0\uD398\uC778 \uC0DD\uC131")
      );
      createCamp.onclick = function () {
        createCampaign();
        return false;
      };
      box.appendChild(createCamp);

      if (!ctx.campaigns.length) {
        var emptyC = document.createElement("div");
        emptyC.className = "side-empty";
        emptyC.appendChild(
          document.createTextNode(
            "\uCEA0\uD398\uC778\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC704\uC5D0\uC11C \uC0C8 \uCEA0\uD398\uC778\uC744 \uC0DD\uC131\uD558\uC138\uC694."
          )
        );
        box.appendChild(emptyC);
        return;
      }
      for (var c = 0; c < ctx.campaigns.length; c++) {
        (function (row) {
          var el = document.createElement("div");
          el.className = "shell-item";
          var cnt = row.wkfCount != null ? row.wkfCount : 0;
          var mx = row.wkfMax != null ? row.wkfMax : ctx.wkfMax;
          el.appendChild(
            document.createTextNode(
              (row.label || row.name) +
                " (" +
                row.name +
                ") \u2014 WKF " +
                cnt +
                "/" +
                mx
            )
          );
          el.onclick = function () {
            selectCampaign(row);
            return false;
          };
          box.appendChild(el);
        })(ctx.campaigns[c]);
      }
      return;
    }

    if (ctx.listMode === "WKF") {
      var isDiscover = MATCH_ENABLED && ctx.matchMode === "discover";
      if (title) {
        if (ctx.matchShown && isDiscover) {
          title.textContent = "\uAC12 \uB300\uC870 WKF";
        } else {
          title.textContent = "WKF";
        }
      }
      var createRow = document.createElement("div");
      if (ctx.canCreateWkf) {
        createRow.className = "shell-item";
        createRow.appendChild(
          document.createTextNode("\uC0C8 WKF \uC0DD\uC131")
        );
        createRow.onclick = function () {
          createWkf();
          return false;
        };
      } else {
        createRow.className = "shell-item locked";
        createRow.appendChild(
          document.createTextNode(
            "\uC0C8 WKF \uC0DD\uC131 \uBD88\uAC00 (Max " + ctx.wkfMax + ")"
          )
        );
        createRow.onclick = function () {
          showErr(
            "\uC774 \uCEA0\uD398\uC778\uC758 WKF\uAC00 \uC0C1\uD55C(" +
              ctx.wkfMax +
              ")\uC5D0 \uB3C4\uB2EC\uD588\uC2B5\uB2C8\uB2E4."
          );
          return false;
        };
      }
      box.appendChild(createRow);

      _renderDraftRows(box);

      /* #152: Match OFF — 유사 목록 자리 안내만 (오탐 카드 금지) · draft는 위에 표시 */
      if (!MATCH_ENABLED) {
        ctx.wkfs = [];
        ctx.matchShown = false;
        var offMsg = document.createElement("div");
        offMsg.className = "side-empty";
        offMsg.appendChild(document.createTextNode(_matchDisabledMsg()));
        box.appendChild(offMsg);
        return;
      }

      if (!ctx.wkfs.length) {
        var emptyW = document.createElement("div");
        emptyW.className = "side-empty";
        var emptyMsg = "";
        if (!ctx.matchShown) {
          if (isDiscover) {
            emptyMsg =
              "\uC870\uAC74\uC744 \uC785\uB825\uD55C \uB4A4 [\uC0DD\uC131]\uC744 \uB204\uB974\uC138\uC694. (\uAC12\uC774 \uC77C\uCE58\uD558\uB294 \uD6C4\uBCF4\uB9CC \uD45C\uC2DC \u00B7 CONFLICT \uC81C\uC678)";
          } else {
            emptyMsg = ctx.canCreateWkf
              ? "\uC67C\uCABD\uC5D0\uC11C \uC870\uAC74\uC744 [\uC0DD\uC131]\uD55C \uB4A4 WKF\uB97C \uB9CC\uB4E0 \uB4A4 [\uB4F1\uB85D]\uD558\uC138\uC694."
              : "\uC870\uAC74 [\uC0DD\uC131] \uD6C4 WKF\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4. (\uC774 \uCEA0\uD398\uC778\uC740 WKF Max " +
                ctx.wkfMax +
                " \u2014 \uC0C8 WKF \uBD88\uAC00)";
          }
        } else if (isDiscover) {
          emptyMsg =
            "\uAC12\uC774 \uC77C\uCE58\uD558\uB294 \uD6C4\uBCF4 WKF\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC0C8 WKF\uB97C \uC0DD\uC131\uD558\uAC70\uB098 \uC870\uAC74\uC744 \uBC14\uAFB8\uC138\uC694.";
        } else {
          emptyMsg =
            "WKF\uB97C \uB9CC\uB4E0 \uB4A4 [\uB4F1\uB85D]\uD558\uC138\uC694.";
        }
        emptyW.appendChild(document.createTextNode(emptyMsg));
        box.appendChild(emptyW);
        return;
      }
      for (var j = 0; j < ctx.wkfs.length; j++) {
        (function (row) {
          var el = document.createElement("div");
          el.className = row.locked ? "sql-item locked" : "sql-item";

          var wfLabel = row.label || row.name || "";
          var wfName = row.name || "";
          var campLabel = row.campaign_label || row.campaign_name || "?";
          var campName = row.campaign_name || "?";
          var progLabel =
            row.program_label || row.program_name || "?";
          var nlTxt = row.nl_request || "(NL \uC5C6\uC74C)";

          if (isDiscover) {
            var d1 = document.createElement("div");
            d1.className = "nl-line";
            d1.textContent = nlTxt;
            d1.title = nlTxt + " | " + wfLabel + " / " + wfName;
            el.appendChild(d1);

            if (row.isIdentical) {
              var sameBadge = document.createElement("div");
              sameBadge.className = "sid";
              sameBadge.textContent = "\uB3D9\uC77C";
              el.appendChild(sameBadge);
            }

            /* #154: 단정형 "포함" 금지 — 조건별 대조표 */
            var cmp = row.compare;
            if (cmp && cmp.length) {
              for (var ci = 0; ci < cmp.length; ci++) {
                var line = cmp[ci];
                var dCmp = document.createElement("div");
                dCmp.className = "meta";
                var st = String(line.status || "");
                var lab = line.label || line.name || "";
                var qv = line.queryValue || "";
                var cv = line.candidateValue || "";
                var tip = "";
                if (st === "SAME") {
                  tip = lab + "  " + qv + "  =  " + cv + "  (\uC77C\uCE58)";
                } else if (st === "MISSING") {
                  tip =
                    lab +
                    "  " +
                    qv +
                    "  =  (\uC5C6\uC74C)  (\uC774 \uC870\uAC74\uC740 \uD6C4\uBCF4\uC5D0 \uC5C6\uC74C)";
                } else if (st === "CONFLICT") {
                  tip =
                    lab +
                    "  " +
                    qv +
                    "  vs  " +
                    cv +
                    "  (\uBD88\uC77C\uCE58)";
                } else {
                  tip = lab + "  " + qv;
                }
                dCmp.textContent = tip;
                dCmp.title = tip;
                el.appendChild(dCmp);
              }
            } else {
              var d2 = document.createElement("div");
              d2.className = "sid";
              d2.textContent = row.matchLabel || "\uAC12 \uB300\uC870 \uC815\uBCF4 \uC5C6\uC74C";
              el.appendChild(d2);
            }

            var extra = row.extraCount != null ? row.extraCount : 0;
            if (extra > 0) {
              var d3 = document.createElement("div");
              d3.className = "meta";
              d3.textContent =
                "\uC774 \uC6CC\uD06C\uD50C\uB85C\uC6B0\uC5D4 \uC870\uAC74 " +
                extra +
                "\uAC1C\uAC00 \uB354 \uC788\uC74C";
              el.appendChild(d3);
            }

            var d4 = document.createElement("div");
            d4.className = "meta";
            d4.textContent =
              campLabel + " / " + campName + " | " + progLabel;
            d4.title = d4.textContent;
            el.appendChild(d4);

            if (row.locked) {
              var badge = document.createElement("span");
              badge.className = "badge-lock";
              badge.textContent =
                (row.locked_by || "?") + " \uD3B8\uC9D1 \uC911";
              el.appendChild(badge);
            }
          } else {
            var line1 = document.createElement("div");
            line1.className = "sid";
            var l1 = wfLabel + " / " + wfName;
            if (row.exact) l1 += " \u2014 \uB3D9\uC77C\uC870\uAC74";
            else if (row.matchLabel) l1 += " \u2014 " + row.matchLabel;
            if (row.locked) l1 += " \u2014 \uC7A0\uAE08: " + (row.locked_by || "?");
            line1.textContent = l1;
            line1.title = wfLabel + " / " + wfName;

            var line2 = document.createElement("div");
            line2.className = "meta";
            var l2 =
              campLabel +
              " / " +
              campName +
              " | " +
              progLabel;
            line2.textContent = l2;
            line2.title = l2;

            var line3 = document.createElement("div");
            line3.className = "meta";
            line3.textContent = nlTxt;
            line3.title = nlTxt;

            el.appendChild(line1);
            el.appendChild(line2);
            el.appendChild(line3);
          }
          el.onclick = function () {
            if (row.locked) {
              showErr(
                "\uB2E4\uB978 \uC0AC\uC6A9\uC790\uAC00 \uC810\uC720 \uC911\uC785\uB2C8\uB2E4: " +
                  (row.locked_by || "?")
              );
              return false;
            }
            selectWkf(row);
            return false;
          };
          box.appendChild(el);
        })(ctx.wkfs[j]);
      }
      return;
    }

    if (title) title.textContent = "\uBAA9\uB85D";
  }

  function selectFolder(row) {
    if (!row) return;
    _pushStack();
    ctx.folder = {
      id: String(row.id || ""),
      name: String(row.name || ""),
      label: String(row.label || row.name || "")
    };
    ctx.campaign = null;
    ctx.campaigns = [];
    ctx.workflow = null;
    ctx.openHint = "";
    ctx.wkfs = [];
    ctx.phase = "ST4";
    ctx.listMode = "CAMPAIGN";
    setInfoBar(_folderInfoText());
    setInputEnabled(true);
    _refreshOpenButtons();
    renderListPane();
    loadCampaigns();
  }

  function loadCampaigns() {
    if (!SHELL_MODE || !ctx.folder || !ctx.folder.id) return;
    post(
      "testWooAiStudioContext.jssp",
      {
        action: "listCampaigns",
        program_id: ctx.folder.id,
        folder_id: ctx.folder.id,
        limit: 200
      },
      function (res) {
        if (!res || !res.ok) {
          ctx.campaigns = [];
          renderListPane();
          showErr(_errText(res) || "listCampaigns failed");
          return;
        }
        clearErr();
        ctx.campaigns = res.items || [];
        if (res.wkfMax != null) ctx.wkfMax = res.wkfMax;
        renderListPane();
      },
      function (err) {
        ctx.campaigns = [];
        renderListPane();
        showErr(String(err && err.message ? err.message : err));
      }
    );
  }

  function createCampaign() {
    if (!ctx.folder || !ctx.folder.id) {
      showErr("AI Program\uC744 \uBA3C\uC800 \uC120\uD0DD\uD558\uC138\uC694.");
      return;
    }
    setBusy(true);
    post(
      "testWooAiStudioContext.jssp",
      {
        action: "createCampaign",
        program_id: ctx.folder.id,
        folder_id: ctx.folder.id,
        label: "AI Campaign / " + (ctx.folder.label || ctx.folder.name)
      },
      function (res) {
        setBusy(false);
        if (!res || !res.ok || !res.campaign) {
          showErr(_errText(res) || "createCampaign failed");
          return;
        }
        clearErr();
        _enterCampaign(res.campaign, false);
      },
      function (err) {
        setBusy(false);
        showErr(String(err && err.message ? err.message : err));
      }
    );
  }

  function _enterCampaign(row, push) {
    if (!row || !row.id) return;
    if (push) _pushStack();
    ctx.campaign = {
      id: String(row.id || ""),
      name: String(row.name || ""),
      label: String(row.label || row.name || "")
    };
    ctx.workflow = null;
    ctx.openHint = "";
    ctx.wkfs = [];
    ctx.canCreateWkf = row.canCreateWkf !== false;
    if (row.wkfMax != null) ctx.wkfMax = row.wkfMax;
    ctx.phase = "ST5";
    ctx.listMode = "WKF";
    /* 매칭은 Generate 성공 후에만. 재진입 시 이전 plan으로 자동 Match 금지 */
    _clearComposeState();
    setInfoBar(_folderInfoText());
    setInputEnabled(true);
    _refreshOpenButtons();
    renderListPane();
  }

  function selectCampaign(row) {
    _enterCampaign(row, true);
  }

  function createWkf() {
    if (!ctx.campaign || !ctx.campaign.id) {
      showErr("\uCEA0\uD398\uC778\uC744 \uBA3C\uC800 \uC120\uD0DD\uD558\uC138\uC694.");
      return;
    }
    if (!ctx.canCreateWkf) {
      showErr(
        "\uC774 \uCEA0\uD398\uC778\uC758 WKF\uAC00 \uC0C1\uD55C(" +
          ctx.wkfMax +
          ")\uC5D0 \uB3C4\uB2EC\uD588\uC2B5\uB2C8\uB2E4."
      );
      return;
    }
    setBusy(true);
    post(
      "testWooAiStudioContext.jssp",
      {
        action: "createWkf",
        campaign_id: ctx.campaign.id,
        operation_id: ctx.campaign.id,
        label: "AI WKF / " + (ctx.campaign.label || ctx.campaign.name)
      },
      function (res) {
        setBusy(false);
        if (!res || !res.ok || !res.workflow) {
          showErr(_errText(res) || "createWkf failed");
          _refreshMatchOrList();
          return;
        }
        clearErr();
        ctx.workflow = {
          id: String(res.workflow.id || ""),
          name: String(res.workflow.name || ""),
          label: String(res.workflow.label || "")
        };
        if (!EMBED) WORKFLOW_NAME = String(res.workflow.name || "");
        ctx.openHint = String(res.open_hint || "");
        state.aiSqlId = null;
        ctx.phase = "ST5";
        setInfoBar(_folderInfoText());
        _refreshOpenButtons();
        loadSqlList();
        showOpenHint();
      },
      function (err) {
        setBusy(false);
        showErr(String(err && err.message ? err.message : err));
        _refreshMatchOrList();
      }
    );
  }

  /* discover 모드만 Match 재조회 · #152 Match OFF 시 항상 비움 */
  function _refreshMatchOrList() {
    if (MATCH_ENABLED && ctx.matchMode === "discover" && state.plan) {
      runMatch(null, "discover");
      return;
    }
    ctx.wkfs = [];
    ctx.matchShown = false;
    ctx.matchMode = "";
    if (!ctx.workflow) {
      _showSqlSide(false);
      renderListPane();
    }
  }

  // 전역 매칭 행 선택 시 Program·Campaign 정보바/생성 대상 반영
  function _applyMatchContext(row) {
    if (!row) return;
    if (row.program_id) {
      ctx.folder = {
        id: String(row.program_id),
        name: String(row.program_name || ""),
        label: String(row.program_label || row.program_name || "")
      };
    }
    if (row.campaign_id) {
      ctx.campaign = {
        id: String(row.campaign_id),
        name: String(row.campaign_name || ""),
        label: String(row.campaign_label || row.campaign_name || "")
      };
    }
  }

  function selectWkf(row) {
    if (!row || !row.id) return;
    setBusy(true);
    post(
      "testWooAiStudioContext.jssp",
      {
        action: "selectWkf",
        workflow_id: String(row.id),
        workflow_name: String(row.name || "")
      },
      function (res) {
        setBusy(false);
        if (!res || !res.ok) {
          showErr(_errText(res) || "selectWkf failed");
          _refreshMatchOrList();
          return;
        }
        clearErr();
        _applyMatchContext(row);
        ctx.workflow = {
          id: String(row.id),
          name: String(row.name || ""),
          label: String(row.label || row.name || "")
        };
        // Tools Studio(embed=0)는 URL workflowName 이 없음 → 선택 WKF 로 바인딩
        if (!EMBED) WORKFLOW_NAME = String(row.name || "");
        ctx.openHint = String(res.open_hint || "");
        state.aiSqlId = null;
        ctx.phase = "ST5";
        setInfoBar(_folderInfoText());
        _refreshOpenButtons();
        if (res.lock_warning) {
          $("hint").className = "banner warn";
          $("hint").textContent =
            "WKF \uC120\uD0DD\uB428 (\uC7A0\uAE08 \uACBD\uACE0: " + res.lock_warning + ")";
        }
        loadSqlList();
      },
      function (err) {
        setBusy(false);
        showErr(String(err && err.message ? err.message : err));
        _refreshMatchOrList();
      }
    );
  }

  function goBack() {
    if (!SHELL_MODE) return;
    _releaseCurrentLock(function () {
      ctx.workflow = null;
      ctx.openHint = "";
      if (!EMBED) WORKFLOW_NAME = "";
      _showSqlSide(false);
      _refreshOpenButtons();
      if (!ctx.stack.length) {
        resetCtx();
        return;
      }
      var prev = ctx.stack.pop();
      ctx.phase = prev.phase;
      ctx.listMode = prev.listMode;
      ctx.folder = prev.folder;
      ctx.campaign = prev.campaign || null;
      ctx.workflow = null;
      /* WKF 뎁스를 벗어나면 이전 조건·매칭 폐기 (재진입 시 잔상 방지) */
      if (ctx.listMode !== "WKF") {
        _clearComposeState();
      }
      if (ctx.listMode === "WKF" && ctx.campaign) {
        _clearComposeState();
        if (ctx.phase !== "ST5") ctx.phase = "ST5";
        setInfoBar(_folderInfoText());
        setInputEnabled(true);
        renderListPane();
      } else if (ctx.listMode === "CAMPAIGN" && ctx.folder) {
        ctx.campaign = null;
        if (ctx.phase !== "ST4") ctx.phase = "ST4";
        setInfoBar(_folderInfoText());
        setInputEnabled(true);
        loadCampaigns();
      } else if (ctx.folder) {
        if (ctx.phase !== "ST3") ctx.phase = "ST3";
        setInfoBar(_folderInfoText());
        setInputEnabled(true);
        renderListPane();
      } else {
        ctx.phase = "ST0";
        setInfoBar("Program: (\uBBF8\uC120\uD0DD)");
        setInputEnabled(true);
        renderListPane();
      }
    });
  }

  function resetCtx() {
    if (!SHELL_MODE) return;
    _releaseCurrentLock(function () {
      ctx.phase = "ST0";
      ctx.listMode = "FOLDER";
      ctx.folder = null;
      ctx.campaigns = [];
      ctx.campaign = null;
      ctx.wkfs = [];
      ctx.workflow = null;
      ctx.openHint = "";
      ctx.matchShown = false;
      ctx.matchMode = "";
      ctx.stack = [];
      _cacheClearAll();
      state.cacheId = null;
      _clearComposeState();
      setInfoBar("Program: (\uBBF8\uC120\uD0DD)");
      setInputEnabled(true);
      _refreshOpenButtons();
      var hintR = $("hint");
      if (hintR) {
        hintR.className = "banner warn";
        hintR.textContent =
          "\uC870\uAC74\uC744 \uC785\uB825\uD55C \uB4A4 [\uC0DD\uC131]\uC744 \uB204\uB974\uC138\uC694. (\uD504\uB85C\uADF8\uB7A8/\uCEA0\uD398\uC778/\uC6CC\uD06C\uD50C\uB85C\uC6B0\uB294 SQL \uD6C4\uC5D0 \uC120\uD0DD \u00B7 WKF Max 15)";
      }
      loadAiFolders();
    });
  }

  function loadAiFolders() {
    if (!SHELL_MODE) return;
    /* ST0 부트는 phase 유지 · 브레드크럼 프로그램 선택만 ST3 */
    if (ctx.phase !== "ST0" && ctx.phase !== "ST1" && ctx.phase !== "ST2") {
      ctx.phase = "ST3";
    }
    ctx.listMode = "FOLDER";
    post("testWooAiStudioContext.jssp", {
      action: "listAiFolders",
      limit: 200
    }, function (res) {
      if (!res || !res.ok) {
        ctx.folders = [];
        renderListPane();
        showErr(_errText(res) || "listAiFolders failed");
        return;
      }
      clearErr();
      ctx.folders = res.items || [];
      renderListPane();
    }, function (err) {
      ctx.folders = [];
      renderListPane();
      showErr(String(err && err.message ? err.message : err));
    });
  }

  function _showSqlSide(on) {
    try {
      if (on) _addCls(document.body, "has-sql-side");
      else _rmCls(document.body, "has-sql-side");
    } catch (eCls) {}
    var side = $("sideSql");
    var dummy = $("twDummyList");
    if (side) side.style.display = on ? "block" : "none";
    if (dummy) dummy.style.display = on ? "none" : "block";
    var title = $("twListTitle");
    if (title) {
      title.textContent = on
        ? "\uC774 WF SQL \uC774\uB825"
        : "\uBAA9\uB85D";
    }
  }

  function _clearDelPending() {
    if (_delPending.timer) {
      clearTimeout(_delPending.timer);
      _delPending.timer = null;
    }
    if (_delPending.btn) {
      try {
        _delPending.btn.textContent = "\uC0AD\uC81C";
        _rmCls(_delPending.btn, "confirm");
      } catch (e1) {}
    }
    _delPending.id = null;
    _delPending.btn = null;
  }

  function loadSqlList() {
    var side = $("sideSql");
    if (!side) return;
    var wf = _activeWorkflowName();
    if (!wf) {
      _showSqlSide(false);
      return;
    }
    _diag("loadSqlList start wf=" + wf);
    _showSqlSide(true);
    post("testWooAiValidate.jssp", {
      action: "listSql",
      workflow_name: wf,
      limit: 50
    }, function (res) {
      _clearDelPending();
      var box = $("sqlList");
      var empty = $("sqlListEmpty");
      if (!box) return;
      box.innerHTML = "";
      var items = (res && res.items) || [];
      if (!res || !res.ok) {
        if (empty) {
          empty.style.display = "";
          empty.textContent = _errText(res) || "list failed";
        }
        return;
      }
      if (!items.length) {
        if (empty) {
          empty.style.display = "";
          empty.textContent =
            "SQL \uC774\uB825\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4. " +
            "\uC67C\uCABD\uC5D0\uC11C [\uC0DD\uC131] \uD6C4 \uBC18\uB4DC\uC2DC [\uB4F1\uB85D]\uC744 \uB204\uB974\uC138\uC694. " +
            "\uC0DD\uC131\uB9CC\uC73C\uB85C\uB294 \uC5EC\uAE30\uC5D0 \uC548 \uB0A9\uB2C8\uB2E4.";
        }
        _diag("loadSqlList items=0");
        return;
      }
      if (empty) empty.style.display = "none";
      _diag("loadSqlList items=" + items.length);
      for (var i = 0; i < items.length; i++) {
        (function (it) {
          var el = document.createElement("div");
          el.className = "sql-item";
          if (state.aiSqlId && Number(state.aiSqlId) === Number(it.id)) el.className += " active";
          var row = document.createElement("div");
          row.className = "sid";
          row.textContent = "ai_sql_id=" + String(it.id);
          var title = document.createElement("div");
          title.textContent = it.title || "(no title)";
          var meta = document.createElement("div");
          meta.className = "meta";
          meta.textContent = String(it.status || "") + " | " + String(it.creation_date || "");
          var del = document.createElement("button");
          del.type = "button";
          del.className = "sql-del";
          del.textContent = "\uC0AD\uC81C";
          del.title = "delete (click twice)";
          del.onclick = function (ev) {
            if (ev && ev.stopPropagation) ev.stopPropagation();
            deleteSqlItem(it.id, it.title, del);
            return false;
          };
          el.appendChild(row);
          el.appendChild(title);
          el.appendChild(meta);
          el.appendChild(del);
          el.onclick = function () {
            _clearDelPending();
            loadSqlItem(it.id);
          };
          box.appendChild(el);
        })(items[i]);
      }
    }, function (e) {
      var empty = $("sqlListEmpty");
      if (empty) {
        empty.style.display = "";
        empty.textContent = String(e && e.message ? e.message : e);
      }
      try {
        var h = $("hint");
        if (h) {
          h.className = "banner err";
          h.textContent = "SQL list error: " + String(e && e.message ? e.message : e);
        }
      } catch (e2) {}
      _diag("loadSqlList err: " + String(e && e.message ? e.message : e));
    });
  }

  // urlViewer 는 window.confirm 억제 → 2단계 클릭 (3초 내 재클릭)
  function deleteSqlItem(id, title, btn) {
    if (_delPending.id != null && Number(_delPending.id) === Number(id) && _delPending.btn === btn) {
      _clearDelPending();
      clearErr();
      _diag("deleteSql execute id=" + id);
      post("testWooAiValidate.jssp", {
        action: "deleteSql",
        ai_sql_id: id
      }, function (res) {
        if (!res || !res.ok) {
          showErr(_errText(res) || "delete failed");
          return;
        }
        if (state.aiSqlId && Number(state.aiSqlId) === Number(id)) {
          state.aiSqlId = null;
          state.sql = "";
          state.plan = null;
          $("btnReg").disabled = true;
        }
        var h = $("hint");
        if (h) {
          h.className = "banner ok";
          h.textContent =
            "Deleted ai_sql_id=" + id +
            (title ? (" (" + title + ")") : "");
        }
        loadSqlList();
      }, function (e) {
        showErr(String(e && e.message ? e.message : e));
      });
      return;
    }
    _clearDelPending();
    _delPending.id = id;
    _delPending.btn = btn;
    if (btn) {
      btn.textContent = "\uC0AD\uC81C?";
      _addCls(btn, "confirm");
    }
    _delPending.timer = setTimeout(function () {
      _clearDelPending();
    }, DEL_CONFIRM_MS);
  }

  function loadSqlItem(id) {
    clearErr();
    _diag("loadSqlItem id=" + id);
    post("testWooAiValidate.jssp", { action: "getSql", ai_sql_id: id }, function (res) {
      if (!res || !res.ok || !res.item) {
        showErr(_errText(res) || "load failed");
        return;
      }
      var it = res.item;
      state.aiSqlId = it.id;
      state.sql = it.sql_query || "";
      state.summary = it.summary_ko || "";
      state.nl = it.nl_request || "";
      state.passed = false;
      state.plan = null;
      setInfoBar(_folderInfoText());
      setBindPick(it.id);
      if (it.nl_request) $("nl").value = it.nl_request;
      try {
        if (it.plan_json) state.plan = JSON.parse(it.plan_json);
      } catch (eParse) { state.plan = null; }
      if (state.plan) {
        post("testWooAiValidate.jssp", { plan: state.plan }, function (v) {
          if (v && v.ok) {
            state.sql = v.sql || state.sql;
            state.summary = v.summary || state.summary;
            state.passed = !!v.passed;
            if (v.chips) renderChips(v.chips);
            renderGates(v.results || []);
            $("btnReg").disabled = !v.passed;
          }
          renderSql(state.sql);
          renderSummaryHint(
            "Loaded ai_sql_id=" + it.id +
            " \u2014 ibankSqlDM ai_sql-id=" + it.id +
            (state.summary ? (" · " + state.summary) : "")
          );
          loadSqlList();
        }, function (e) {
          showErr(String(e && e.message ? e.message : e));
          renderSql(state.sql);
          loadSqlList();
        });
        return;
      }
      renderSql(state.sql);
      $("btnReg").disabled = true;
      $("hint").className = "banner ok";
      $("hint").textContent =
        "Loaded ai_sql_id=" + it.id +
        " \u2014 ibankSqlDM \uC758 ai-sql-id \uC5D0 \uC774 \uAC12\uC744 \uB123\uC73C\uC138\uC694 (script SQL \uAE08\uC9C0).";
      loadSqlList();
    }, function (e) {
      showErr(String(e && e.message ? e.message : e));
    });
  }

  function renderChips(chips) {
    var box = $("chips"); box.innerHTML = "";
    var list = chips || [];
    for (var i = 0; i < list.length; i++) {
      (function (c) {
        var el = document.createElement("span"); el.className = "chip";
        el.innerHTML = "<span></span><button type='button' title='remove'>×</button>";
        var tag = c.role === "exclude" ? "EXCEPT" : (c.op || "AND");
        el.firstChild.textContent = "[" + tag + "] " + c.label;
        var btn = el.getElementsByTagName("button")[0];
        if (btn) btn.onclick = function () { removeChip(c); };
        box.appendChild(el);
      })(list[i]);
    }
    _rmCls($("cardChips"), "hidden");
  }

  function removeChip(chip) {
    if (!state.plan) return;
    if (chip.role === "exclude") {
      var ek = parseInt(String(chip.id).replace(/^e/, ""), 10);
      var ex = state.plan.exclude || [];
      var nex = [];
      for (var xi = 0; xi < ex.length; xi++) {
        if (xi !== ek) nex.push(ex[xi]);
      }
      state.plan.exclude = nex;
    } else {
      var parts = String(chip.id).replace(/^i/, "").split("_");
      var gi = parseInt(parts[0], 10);
      var ai = parseInt(parts[1], 10);
      var group = state.plan.include && state.plan.include[gi];
      if (group && group.any) {
        var nany = [];
        for (var j = 0; j < group.any.length; j++) {
          if (j !== ai) nany.push(group.any[j]);
        }
        group.any = nany;
        if (!group.any.length) {
          var ninc = [];
          for (var k = 0; k < state.plan.include.length; k++) {
            if (k !== gi) ninc.push(state.plan.include[k]);
          }
          state.plan.include = ninc;
        }
      }
    }
    if (!fragmentCount(state.plan)) { hideResultCards(); return; }
    validate();
  }

  function fragmentCount(plan) {
    var n = 0;
    var inc = (plan && plan.include) || [];
    for (var i = 0; i < inc.length; i++) {
      if (inc[i] && inc[i].any) n += inc[i].any.length;
    }
    n += ((plan && plan.exclude) || []).length;
    return n;
  }

  // 서버 gate 코드 → 마케터용 이름. 알 수 없는 코드는 원문 유지.
  function _gateTitle(code) {
    var map = {
      PLAN: "\uC870\uAC74 \uC870\uD569",
      G1: "SQL \uBB38\uBC95",
      OUT: "\uACB0\uACFC \uD615\uC2DD",
      SCOPE: "\uBC94\uC704 \uC815\uD569",
      FRAG: "\uC870\uAC74 SQL",
      "G-A": "\uC2E4\uD589 \uAC80\uC99D",
      "G-B": "\uACE0\uC720 \uD0A4",
      "G-C": "\uBAA8\uC9D1\uB2E8 \uBE44\uC728",
      "G-D": "\uB9E4\uAC1C\uBCC0\uC218",
      "G-F": "\uC870\uAC74 \uC774\uB984"
    };
    var k = String(code || "");
    return map[k] || k;
  }

  function renderGates(results) {
    var box = $("gates"); box.innerHTML = "";
    var list = results || [];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var el = document.createElement("div"); el.className = "gate";
      var ok = !!(r && r.ok);
      var status = ok ? "\uD1B5\uACFC" : "\uC2E4\uD328";
      var title = _gateTitle(r && r.gate);
      var detail = String((r && r.reason) || "");
      if (ok && !detail) detail = "\uC774 \uAC80\uC0AC\uB97C \uB9CC\uC871\uD588\uC2B5\uB2C8\uB2E4.";
      el.innerHTML = "<span class='" + (ok ? "g-ok" : "g-err") + "'>" + status + "</span> " +
        "<strong>" + esc(title) + "</strong> " + esc(detail);
      box.appendChild(el);
    }
    _rmCls($("cardGates"), "hidden");
  }

  function renderSql(sql) {
    $("sql").textContent = sql || "";
    _rmCls($("cardCode"), "hidden");
  }
  function renderSummaryHint(summary, showRegisterHint) {
    var el = $("hint");
    if (!el) return;
    el.className = "banner ok";
    var base = summary || "SQL\uC774 \uC900\uBE44\uB418\uC5C8\uC2B5\uB2C8\uB2E4.";
    if (showRegisterHint) {
      el.innerHTML =
        esc(base) +
        "<br/><strong>[\uB2E4\uC74C] \uC544\uB798 [\uB4F1\uB85D] \uBC84\uD2BC\uC744 \uB204\uB974\uC138\uC694.</strong> " +
        "\uC0DD\uC131\uB9CC\uC73C\uB85C\uB294 SQL \uC774\uB825\uC5D0 \uC548 \uB0A9\uB2C8\uB2E4. " +
        "\uB4F1\uB85D \uD6C4 \uC624\uB978\uCABD \uBAA9\uB85D\uC5D0 \uB098\uD0C0\uB0A9\uB2C8\uB2E4.";
    } else {
      el.textContent = base;
    }
  }
  function hideFunnel() { _addCls($("cardFunnel"), "hidden"); }
  function hideResultCards() {
    var ids = ["cardSlotResults", "cardChips", "cardFunnel", "cardGates", "cardCode"];
    for (var i = 0; i < ids.length; i++) _addCls($(ids[i]), "hidden");
    $("btnReg").disabled = true;
    state.passed = false;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function setBusy(b) {
    if (b) {
      $("btnGen").disabled = true;
      $("nl").disabled = true;
    } else {
      setInputEnabled(true);
    }
  }

  // IE 는 <details> 미지원 — #twDiagSum 클릭 토글. embed 한시적 기본 펼침 (#139)
  function _wireDiagToggle() {
    var sum = $("twDiagSum");
    var log = $("twDiagLog");
    if (!sum || !log) return;
    if (EMBED) log.style.display = "block";
    else if (!log.style.display) log.style.display = "none";
    sum.onclick = function () {
      log.style.display = (log.style.display === "none") ? "block" : "none";
      return false;
    };
  }

  function init() {
    _installOnError();
    _cacheBackend = _probeCacheBackend();
    _diag("cacheBackend=" + _cacheBackend);
    _ensureCacheWarnEl();
    try {
      _wireDiagToggle();
      try {
        var dm0 = (typeof document.documentMode !== "undefined") ? String(document.documentMode) : "n/a(non-IE)";
          var okMsg = "js ok | documentMode=" + dm0 + " | embed=" + (EMBED ? "1" : "0") + " | match=" + (MATCH_ENABLED ? "1" : "0") + " | phase=" + ctx.phase + " | v=159";
        var bootReached = !!(window.__TW_BOOT_MSG__);
        if (bootReached) _diag(String(window.__TW_BOOT_MSG__));
        _diag(okMsg);
        _diag("TW-BOOT reached=" + (bootReached ? "yes" : "no"));
        _diag("location.href=" + String(location.href || ""));
        /* 정상 시 부트 바 숨김 */
        var boot = $("twBoot");
        var tbl = $("twBootTable");
        if (boot) {
          boot.className = "";
          boot.style.display = "none";
        }
        if (tbl) {
          tbl.className = "";
          tbl.style.display = "none";
        }
      } catch (eBoot) {}
      _diag("UA=" + String(navigator.userAgent || ""));
      _diag("documentMode=" + (typeof document.documentMode !== "undefined" ? String(document.documentMode) : "n/a(non-IE)"));
      _diag("compatMode=" + String(document.compatMode || ""));
      _diag("init enter shellMode=" + (SHELL_MODE ? "1" : "0"));
      var login = window.__TW_LOGIN__ || "";
      var wfEl = $("wfInfo");
      if (wfEl) {
        wfEl.textContent = "user: " + (login || "?") +
          " / workflow: " + (WORKFLOW_NAME || "n/a") + " / register->ai_sql_id";
      }
      setInfoBar("Program: (\uBBF8\uC120\uD0DD)");
      var btnBack = $("btnTwBack");
      var btnReset = $("btnTwReset");
      var btnOpen = $("btnTwOpenWkf");
      var btnGoto = $("btnTwGotoWkf");
      if (btnBack) btnBack.onclick = function () { goBack(); return false; };
      if (btnReset) btnReset.onclick = function () { resetCtx(); return false; };
      if (btnOpen) btnOpen.onclick = function () { showOpenHint(); return false; };
      if (btnGoto) btnGoto.onclick = function () { showOpenHint(); return false; };
      _refreshOpenButtons();
      var btnGen = $("btnGen");
      var btnReg = $("btnReg");
      var nl = $("nl");
      if (btnGen) btnGen.onclick = function () { generate(); };
      if (btnReg) btnReg.onclick = function () { register(); };
      if (nl) {
        nl.onkeydown = function (e) {
          e = e || window.event;
          var key = e.keyCode || e.which;
          if (key === 13 && !e.shiftKey) {
            if (e.preventDefault) e.preventDefault();
            generate();
            return false;
          }
        };
      }
      if (SHELL_MODE) {
        ctx.phase = "ST0";
        setInputEnabled(true);
        var hint0 = $("hint");
        if (hint0) {
          hint0.className = "banner warn";
          hint0.textContent =
            "\uC870\uAC74\uC744 \uC785\uB825\uD55C \uB4A4 [\uC0DD\uC131]\uC744 \uB204\uB974\uC138\uC694. (\uD504\uB85C\uADF8\uB7A8/\uCEA0\uD398\uC778/\uC6CC\uD06C\uD50C\uB85C\uC6B0\uB294 SQL \uD6C4\uC5D0 \uC120\uD0DD \u00B7 WKF Max 15)";
        }
        setTimeout(function () {
          try { loadAiFolders(); }
          catch (eF) {
            _diag("loadAiFolders throw: " + String(eF && eF.message ? eF.message : eF));
          }
        }, 0);
      } else {
        setInputEnabled(true);
        var hintH = $("twNlHint");
        if (hintH) _addCls(hintH, "hidden");
        setTimeout(function () {
          try { loadSqlList(); }
          catch (eL) {
            var h2 = $("hint");
            if (h2) {
              h2.className = "banner err";
              h2.textContent = "loadSqlList: " + String(eL && eL.message ? eL.message : eL);
            }
            _diag("loadSqlList throw: " + String(eL && eL.message ? eL.message : eL));
          }
        }, 0);
      }
    } catch (eInit) {
      try {
        var h = $("hint");
        if (h) {
          h.className = "banner err";
          h.textContent = "Studio init: " + String(eInit && eInit.message ? eInit.message : eInit);
        }
      } catch (e2) {}
      _diag("init throw: " + String(eInit && eInit.message ? eInit.message : eInit));
    }
  }
  if (document.readyState === "loading") {
    if (document.addEventListener)
      document.addEventListener("DOMContentLoaded", init);
    else if (document.attachEvent)
      document.attachEvent("onreadystatechange", function () {
        if (document.readyState !== "loading") init();
      });
  } else {
    init();
  }
})();
