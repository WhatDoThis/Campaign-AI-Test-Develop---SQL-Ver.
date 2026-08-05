<%

  response.setContentType("application/javascript;charset=utf-8");

  // 실제 값은 old_ver/secrets/OLD_VER_SECRETS.md 참조 (git 제외)
  var _SQ_TOKEN = "__SQ_TOKEN__";

  var _t = String(request.getParameter("_token") || "");

  if (_t !== _SQ_TOKEN) {

    response.sendError(403, "Forbidden");

    return;

  }

%>

(function (SQ) {

  "use strict";

  var STR = SQ && SQ.STR;

  if (!SQ || !SQ.fetchSchemaList || !STR) throw new Error("core required");



  var fetchSchemaList = SQ.fetchSchemaList;

  var fetchSchemaDetail = SQ.fetchSchemaDetail;

  var fetchRowCountViaSoap = SQ.fetchRowCountViaSoap;

  var formatRowCount = SQ.formatRowCount;

  var formatSqlQuery = SQ.formatSqlQuery;

  var generateQuery = SQ.generateQuery;

  var saveAiSqlRecord = SQ.saveAiSqlRecord;

  var resetSoapClient = SQ.resetSoapClient;

  var fetchCurrentOperatorLogin = SQ.fetchCurrentOperatorLogin;



  function $(id) { return document.getElementById(id); }



  var schemaSelect = $("schemaSelect");

  var btnRefreshSchemas = $("btnRefreshSchemas");

  var schemaStatus = $("schemaStatus");

  var operatorStatus = $("operatorStatus");

  var chatEl = $("chat");

  var chatInput = $("chatInput");

  var btnSend = $("btnSend");

  var btnClearChat = $("btnClearChat");



  var schemaList = [];

  var currentSchema = null;

  var chatTurns = [];



  function esc(s) {

    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  }



  function setStatus(el, html, kind) {

    el.className = "status" + (kind ? " " + kind : "");

    el.innerHTML = html;

  }



  function scrollChat() { chatEl.scrollTop = chatEl.scrollHeight; }



  function appendSystem(text) {

    var el = document.createElement("div");

    el.className = "msg msg-system";

    el.textContent = text;

    chatEl.appendChild(el);

    scrollChat();

  }



  function showWelcome(schemaId) {

    chatEl.innerHTML = "";

    appendSystem(schemaId ? STR.schemaSelectedPrefix + schemaId + STR.schemaSelectedSuffix : STR.selectSchema);

  }



  function appendUser(text) {

    var el = document.createElement("div");

    el.className = "msg msg-user";

    el.innerHTML = '<div class="msg-bubble">' + esc(text) + "</div>";

    chatEl.appendChild(el);

    scrollChat();

  }



  function appendLoading() {

    var el = document.createElement("div");

    el.className = "msg msg-assistant";

    el.innerHTML = '<div class="msg-avatar">AI</div><div class="msg-body"><div class="msg-bubble loading-bubble">' +

      '<span class="typing"><span></span><span></span><span></span></span> ' + STR.generating + "</div></div>";

    chatEl.appendChild(el);

    scrollChat();

    return el;

  }



  function renderSavePanel(state) {

    if (state.saveDone) {

      var msg = STR.saveOk;

      if (state.saveResult && state.saveResult.id != null) {

        msg += " (id: " + state.saveResult.id + ")";

      }

      return '<p class="save-done">' + esc(msg) + "</p>";

    }

    if (state.saveDismissed) return "";

    if (state.rowCountLoading || state.rowCount == null) return "";

    var err = state.saveError ? '<p class="save-err">' + esc(state.saveError) + "</p>" : "";

    if (state.saveLoading) {

      return '<div class="save-panel"><p class="hint">' + esc(STR.saveSaving) + "</p></div>";

    }

    return (

      '<div class="save-panel">' +

      err +

      "<p>" + esc(STR.savePrompt) + "</p>" +

      '<input type="text" class="save-title" maxlength="200" placeholder="' + esc(STR.saveTitlePlaceholder) + '" />' +

      '<div class="save-actions">' +

      '<button type="button" class="btn btn-sm btn-save-yes">' + esc(STR.saveYes) + "</button>" +

      '<button type="button" class="btn btn-sm btn-save-no btn-outline">' + esc(STR.saveNo) + "</button>" +

      "</div></div>"

    );

  }



  function renderBubble(state) {

    if (state.error) {

      return '<div class="msg-avatar">AI</div><div class="msg-body"><div class="msg-bubble msg-error">' + esc(state.error) + "</div></div>";

    }

    var q = state.query;

    var countLine = "";

    if (state.rowCountLoading) countLine = '<p class="msg-row-count loading">' + STR.counting + "</p>";

    else if (state.rowCountError) countLine = '<p class="msg-row-count err">' + esc(state.rowCountError) + "</p>";

    else if (state.rowCount != null) {

      countLine = '<p class="msg-row-count"><strong>' + formatRowCount(state.rowCount) + "</strong>" + STR.countUnit + "</p>";

    }

    return (

      '<div class="msg-avatar">AI</div><div class="msg-body"><div class="msg-bubble">' +

      (q.summaryKo ? '<p class="msg-summary">' + esc(q.summaryKo) + "</p>" : "") +

      (q.humanReadableFilter ? '<p class="msg-filter">' + esc(q.humanReadableFilter) + "</p>" : "") +

      countLine +

      '<pre class="code sql-code">' + esc(formatSqlQuery(q.sqlQuery || STR.noSql)) + "</pre>" +

      '<button type="button" class="btn btn-sm btn-copy" data-copy="sql">' + STR.copy + "</button>" +

      renderSavePanel(state) +

      "</div></div>"

    );

  }



  function getTurn(query) {

    for (var i = chatTurns.length - 1; i >= 0; i--) {

      if (chatTurns[i].query === query) return chatTurns[i];

    }

    return null;

  }



  function getState(query) {

    var turn = getTurn(query);

    return {

      query: query,

      rowCount: turn && turn.rowCount,

      rowCountError: turn && turn.rowCountError,

      rowCountLoading: turn && turn.rowCountLoading,

      saveDismissed: turn && turn.saveDismissed,

      saveDone: turn && turn.saveDone,

      saveError: turn && turn.saveError,

      saveLoading: turn && turn.saveLoading,

      saveResult: turn && turn.saveResult,

    };

  }



  function wireBubble(el, query) {

    var copyBtn = el.querySelector(".btn-copy");

    if (copyBtn) {

      copyBtn.addEventListener("click", function () {

        navigator.clipboard.writeText(formatSqlQuery(query.sqlQuery || ""));

        appendSystem("SQL" + STR.copiedSuffix);

      });

    }

    var yesBtn = el.querySelector(".btn-save-yes");

    var noBtn = el.querySelector(".btn-save-no");

    if (noBtn) {

      noBtn.addEventListener("click", function () {

        var turn = getTurn(query);

        if (turn) turn.saveDismissed = true;

        paint(el, getState(query));

      });

    }

    if (yesBtn) {

      yesBtn.addEventListener("click", function () {

        var turn = getTurn(query);

        var titleEl = el.querySelector(".save-title");

        var title = titleEl ? titleEl.value.trim() : "";

        if (!title) {

          if (turn) turn.saveError = STR.saveTitleRequired;

          paint(el, getState(query));

          return;

        }

        if (turn) {

          turn.saveLoading = true;

          turn.saveError = undefined;

        }

        paint(el, getState(query));

        saveAiSqlRecord({

          title: title,

          sqlQuery: query.sqlQuery,

          targetCount: turn && turn.rowCount,

        })

          .then(function (result) {

            if (turn) {

              turn.saveDone = true;

              turn.saveLoading = false;

              turn.saveError = undefined;

              turn.saveResult = result;

            }

            paint(el, getState(query));

          })

          .catch(function (err) {

            if (turn) {

              turn.saveLoading = false;

              turn.saveError = STR.saveFail + err.message;

            }

            paint(el, getState(query));

          });

      });

    }

  }



  function paint(el, state) {

    el.innerHTML = renderBubble(state);

    if (state.query) wireBubble(el, state.query);

  }



  function runCount(query, el) {

    var turn = getTurn(query);

    if (turn) {

      turn.rowCountLoading = true;

      turn.rowCountError = undefined;

    }

    paint(el, getState(query));

    return fetchRowCountViaSoap({ schema: query.schema, queryDefXmlFragment: query.queryDefXmlFragment })

      .then(function (r) {

        if (turn) {

          turn.rowCount = r.count;

          turn.rowCountError = undefined;

          turn.rowCountLoading = false;

        }

        paint(el, getState(query));

      })

      .catch(function (err) {

        if (turn) {

          turn.rowCountError = err.message;

          turn.rowCountLoading = false;

        }

        paint(el, getState(query));

      });

  }



  function setComposer(on) {

    chatInput.disabled = !on;

    btnSend.disabled = !on;

  }



  function loadOperatorStatus() {

    if (!operatorStatus || !fetchCurrentOperatorLogin) return Promise.resolve();

    operatorStatus.textContent = STR.ellipsis;

    operatorStatus.className = "operator";

    return fetchCurrentOperatorLogin()

      .then(function (login) {

        operatorStatus.textContent = login;

        operatorStatus.className = "operator ok";

        operatorStatus.title = login;

      })

      .catch(function () {

        operatorStatus.textContent = "—";

        operatorStatus.className = "operator err";

        operatorStatus.title = STR.sessionRequired;

      });

  }



  function loadSchemas() {

    setStatus(schemaStatus, STR.ellipsis, "loading");

    schemaSelect.disabled = true;

    btnRefreshSchemas.disabled = true;

    resetSoapClient();

    return fetchSchemaList()

      .then(function (list) {

        schemaList = list;

        var prev = schemaSelect.value;

        schemaSelect.innerHTML = '<option value="">' + STR.selectOption + "</option>" +

          list.map(function (s) {

            return '<option value="' + esc(s.id) + '">' + esc(s.label) + " (" + esc(s.id) + ")</option>";

          }).join("");

        if (prev && list.some(function (s) { return s.id === prev; })) schemaSelect.value = prev;

        setStatus(schemaStatus, list.length + STR.countSuffix, "ok");

      })

      .catch(function (err) { setStatus(schemaStatus, esc(err.message), "err"); })

      .finally(function () {

        schemaSelect.disabled = false;

        btnRefreshSchemas.disabled = false;

      });

  }



  function onSchemaChange(id) {

    currentSchema = null;

    if (!id) { showWelcome(null); setComposer(false); return; }

    var meta = schemaList.filter(function (s) { return s.id === id; })[0];

    if (!meta) return;

    setStatus(schemaStatus, STR.ellipsis, "loading");

    fetchSchemaDetail(meta)

      .then(function (schema) {

        currentSchema = schema;

        chatTurns = [];

        showWelcome(id);

        setStatus(schemaStatus, id.split(":")[1] + STR.sep + schema.fields.length + "f", "ok");

        setComposer(true);

      })

      .catch(function (err) { setStatus(schemaStatus, esc(err.message), "err"); });

  }



  function sendMessage() {

    var text = chatInput.value.trim();

    if (!text || !currentSchema) {

      if (!currentSchema) appendSystem(STR.selectSchema);

      return;

    }

    appendUser(text);

    chatInput.value = "";

    chatInput.style.height = "auto";

    var history = chatTurns.filter(function (t) { return t.role === "user" || t.query; });

    chatTurns.push({ role: "user", content: text });

    var loadingEl = appendLoading();

    setComposer(false);

    generateQuery({ schema: currentSchema, userMessage: text, chatTurns: history })

      .then(function (query) {

        chatTurns.push({ role: "assistant", query: query });

        paint(loadingEl, { query: query });

        return runCount(query, loadingEl);

      })

      .catch(function (err) {

        loadingEl.innerHTML = renderBubble({ error: err.message });

        chatTurns.pop();

      })

      .finally(function () {

        setComposer(true);

        chatInput.focus();

      });

  }



  function init() {

    schemaSelect.addEventListener("change", function () { onSchemaChange(schemaSelect.value); });

    btnRefreshSchemas.addEventListener("click", loadSchemas);

    btnSend.addEventListener("click", sendMessage);

    btnClearChat.addEventListener("click", function () { chatTurns = []; showWelcome(currentSchema && currentSchema.id); });

    chatInput.addEventListener("keydown", function (e) {

      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }

    });

    chatInput.addEventListener("input", function () {

      chatInput.style.height = "auto";

      chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + "px";

    });

    setComposer(false);

    loadOperatorStatus();

    loadSchemas().then(function () { showWelcome(null); });

  }



  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);

  else init();

})(window.SchemaQuery);


