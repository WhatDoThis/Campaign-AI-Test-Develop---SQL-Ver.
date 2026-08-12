/*
 * testWooLlm.js (LLM Pass0·Pass1 파이프라인)
 * ==================================================
 * litmus 동기 __v=159 (#160 배포정합).
 * Pass0: NL→slots. Pass1: Stage A 후보만 보고 CNF plan 생성.
 * 최종 SQL은 쓰지 않음. 동기 HttpClientRequest만 사용.
 *
 * [Main Functions]
 * ===========
 * - decomposeSlots — Pass0 NL→slots JSON
 * - selectPlan — Pass1 후보→CNF plan JSON
 * - generatePlan — Pass0→StageA→Pass1 일괄
 * - postChat — chat/completions 호출·오류 메타 부착
 * - postEmbedding — embeddings 호출·오류 메타 부착
 * - explainDedupDiff — dedup near 차이 설명(판정 무관)
 * - reasoningOff — reasoning 비활성 body 조각
 *
 * [Dependencies]
 * =========
 * - testWoo.cfg.getConfig — apiKey·model·endpoint·provider
 * - testWoo.fragments.searchSlots — generatePlan Stage A
 * - HttpClientRequest + MemoryBuffer — serverConf urlPermission 필요
 *
 * [Invariants]
 * =========
 * - response_format json_object 미사용 — 프롬프트+_parseJson으로 JSON 강제
 * - HttpClientRequest.wait 금지 · Rhino map/forEach/filter 금지
 */
var testWoo = testWoo || {};
testWoo.llm = (function () {
  "use strict";

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  function _requireLlmOpts(cfg) {
    var missing = [];
    if (!cfg.llm.apiKey) missing.push("API Key");
    if (!cfg.llm.model) missing.push("Model");
    if (!cfg.llm.endpoint) missing.push("Endpoint");
    if (!missing.length) return;
    logWarning("[testWoo.llm] LLM options not configured: " + missing.join(", "));
    throw new Error(
      "LLM 연결이 설정되어 있지 않습니다. " +
      "API Key 또는 Model(Endpoint) 설정을 확인해 주세요. " +
      "(누락: " + missing.join(", ") + ")"
    );
  }

  // 1. Pass 0 — NL → slots only (no fragment ids)
  function decomposeSlots(nlRequest) {
    var cfg = testWoo.cfg.getConfig();
    _requireLlmOpts(cfg);
    var systemLines = [
      "You extract targeting condition slots from marketer Korean NL.",
      "NL may be messy one sentence without '+' separators.",
      "Split into atomic marketing conditions. Do NOT invent SQL or fragment ids.",
      "HARD LIMITS: at most 6 slots; each searchKeywords at most 5 short phrases;",
      "total JSON under 1200 characters. No commentary, no padding, no token repetition.",
      "For each slot, fill searchKeywords: colloquial/abbreviated/normalized forms",
      "and alternate notations for any numeric range mentioned.",
      "If one phrase mixes two conditions, you MAY keep one slot; Pass1 may split later.",
      'OUTPUT JSON ONLY: {"slots":[{"id":"s1","text":"...","hintedCategory":"plan|demo|consent|fatigue|signup|other","searchKeywords":["..."]}]}'
    ];
    if (cfg.llm.pass0Examples) {
      systemLines.splice(systemLines.length - 1, 0, "Domain keyword examples: " + cfg.llm.pass0Examples);
    }
    var system = systemLines.join("\n");
    var nl = String(nlRequest || "");
    var raw;
    var parsed;
    try {
      // Pass0 첫 호출부터 penalty — Gemini 간헐 반복이 상한(2048)을 채우는 실측 대응
      raw = _chat(cfg, system, nl, "pass0", { frequencyPenalty: 0.5 });
      parsed = _parseJson(raw, "pass0");
    } catch (e0) {
      if (!_isLengthOrRepeatError(e0)) throw e0;
      logWarning("[testWoo.llm.decomposeSlots] pass0 length/repeat — retry once " +
        "(frequency_penalty=0.8)");
      var retrySys = system +
        "\nCRITICAL: Output ONE short JSON object only. Max 4 slots. Do not repeat tokens.";
      raw = _chat(cfg, retrySys, nl, "pass0", { frequencyPenalty: 0.8 });
      parsed = _parseJson(raw, "pass0");
    }
    if (!parsed.slots || !_isArray(parsed.slots) || !parsed.slots.length)
      throw new Error("[testWoo.llm.decomposeSlots] slots missing");
    var maxSlots = cfg.search.maxSlots;
    var maxTok = cfg.search.maxTokens;
    // ACC Rhino: Array.map/filter 없음 — for 루프만
    var slots = [];
    for (var i = 0; i < parsed.slots.length; i++) {
      var s = parsed.slots[i];
      var kws = [];
      if (_isArray(s.searchKeywords)) {
        for (var ki = 0; ki < s.searchKeywords.length; ki++) {
          var kw = _trim(s.searchKeywords[ki] || "");
          if (kw) kws.push(kw);
        }
      }
      var text = _trim(s.text || "");
      if (!text) continue;
      slots.push({
        id: s.id || ("s" + (i + 1)),
        text: text,
        hintedCategory: String(s.hintedCategory || ""),
        searchKeywords: kws.slice(0, maxTok)
      });
    }
    if (slots.length > maxSlots) {
      logWarning("[testWoo.llm.decomposeSlots] truncating slots " + slots.length + " -> " + maxSlots);
      slots = slots.slice(0, maxSlots);
    }
    return slots;
  }

  // 2. Pass 1 — candidates → CNF plan
  function selectPlan(nlRequest, slotCandidates) {
    var cfg = testWoo.cfg.getConfig();
    _requireLlmOpts(cfg);
    var allowed = _allowedNames(slotCandidates);
    var slim = _slimCandidates(slotCandidates);
    var system = [
      "You map Adobe Campaign targeting NL to a CNF composition plan.",
      "Never write SQL. Pick fragment names ONLY from candidates provided.",
      "You MAY merge or split slots to match library boundaries.",
      "Every chosen fragment MUST appear in the union of candidate names.",
      "Plan shape is fixed CNF (no op field):",
      "- include[]: groups combined with AND (INTERSECT).",
      "- include[i].any[]: alternatives inside a group combined with OR (UNION).",
      "- exclude[]: single exclusion bag; all OR-ed then EXCEPT once at the end.",
      "Example meaning: age AND (region Seoul OR region Gyeonggi) EXCEPT opt_out",
      "→ include:[{any:[age]},{any:[regionSeoul,regionGyeonggi]}], exclude:[opt_out]",
      "Put uncovered phrases into unmatched[]. Do not invent fragments.",
      "grainKey MUST be copied verbatim from the key_column of the chosen candidates " +
        "(a physical DB column name). Do not translate or guess it — the compiler rejects " +
        "any mismatch with the fragment key_column.",
      "CANDIDATES_BY_SLOT:",
      JSON.stringify(slim),
      'OUTPUT JSON ONLY: {"grainKey":"<key_column of chosen fragments>","include":[{"any":[{"fragment":"<name>","label":"<ko>","params":{}}]}],"exclude":[{"fragment":"<name>","label":"<ko>","params":{}}],"unmatched":[]}'
    ].join("\n");
    var user = "NL:\n" + String(nlRequest || "");
    var raw = _chat(cfg, system, user, "pass1");
    var plan = _parseJson(raw, "pass1");
    _validatePlanShape(plan);
    var n = _countFragments(plan);
    if (n > cfg.search.maxSlots)
      throw new Error("[testWoo.llm.selectPlan] too many fragments: " + n);
    _rejectOutsideCandidates(plan, allowed);
    return plan;
  }

  // 3. full pipeline helper
  function generatePlan(nlRequest) {
    var slots = decomposeSlots(nlRequest);
    var slotCandidates = testWoo.fragments.searchSlots(slots);
    var empty = [];
    var matchedSlots = [];
    for (var si = 0; si < slotCandidates.length; si++) {
      var sc = slotCandidates[si];
      if (!sc.candidates || !sc.candidates.length) empty.push(sc.text);
      else matchedSlots.push({
        id: sc.id,
        text: sc.text,
        hintedCategory: sc.hintedCategory || "",
        candidates: sc.candidates
      });
    }
    if (empty.length) {
      return {
        grainKey: "",
        include: [],
        exclude: [],
        unmatched: empty,
        matchedSlots: matchedSlots,
        _meta: { slots: slots, slotCandidates: slotCandidates, stage: "stageA_empty" }
      };
    }
    var plan = selectPlan(nlRequest, slotCandidates);
    plan.matchedSlots = matchedSlots;
    plan._meta = { slots: slots, slotCandidates: slotCandidates, stage: "pass1" };
    return plan;
  }

  var LLM_MAX_TOKENS = 8192; // reasoning 토큰이 max_tokens 에 합산되는 모델 기준 기본값
  var FREQUENCY_PENALTY_MAX = 1;
  // 단계별 출력 상한 env 키. Pass1 은 후보 카드 전량을 받아 CNF 를 만들므로 출력이 더 길다.
  var STAGE_TOKEN_KEY = { pass0: "pass0MaxTokens", pass1: "pass1MaxTokens" };

  // reasoning 을 끄는 유일한 형식. thinking 모델은 사고 토큰을 max_tokens 에 합산하므로
  // 끄지 못하면 본문 몫이 0 이 되어 finish_reason="length" + 빈 응답이 온다.
  // enabled:false 만으로는 Gemini 계열에서 thinkingBudget 이 0 으로 내려가지 않아
  // 구글 기본값(dynamic, 최대 8192)이 그대로 적용된다 → max_tokens:0 을 함께 보낸다.
  // Ref: https://openrouter.ai/blog/tutorials/gemini-25-flash-api-pricing-quickstart-provider-comparison/
  function reasoningOff() {
    return { enabled: false, max_tokens: 0 };
  }

  // 단계별 출력 상한. testWooEnv.js llm.pass0MaxTokens / pass1MaxTokens 를 따른다
  // (Triage·Foundry 와 동일하게 env 직접 참조 — cfg.llm 은 이 값을 싣지 않는다).
  function _maxTokensFor(stage) {
    var key = STAGE_TOKEN_KEY[String(stage || "pass0")] || STAGE_TOKEN_KEY.pass0;
    var v = null;
    try {
      if (testWoo.env && testWoo.env.getEnv) v = testWoo.env.getEnv().llm[key];
    } catch (eEnv) { v = null; }
    var n = Number(v);
    return (v != null && !isNaN(n) && n > 0) ? n : LLM_MAX_TOKENS;
  }

  // 반복 루프 억제. temperature:0 은 결정성을 위해 유지하되(0 이 오히려 반복을 유도할 수
  // 있으므로) frequency_penalty 로만 억제한다. 0 이면 키 자체를 body 에 넣지 않는다.
  // 미지원 모델이면 OpenRouter 가 무시하며, 거부 시 _httpError 에 원문이 남는다.
  function _frequencyPenalty() {
    var L = null;
    try {
      if (testWoo.env && testWoo.env.getEnv) L = testWoo.env.getEnv().llm;
    } catch (eEnv) { L = null; }
    if (!L || L.repetitionGuardEnabled !== true) return 0;
    var n = Number(L.frequencyPenalty);
    if (isNaN(n) || n <= 0) return 0;
    return n > FREQUENCY_PENALTY_MAX ? FREQUENCY_PENALTY_MAX : n;
  }

  var _PROVIDERS = {
    anthropic: {
      headers: function (apiKey) {
        return { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
      },
      body: function (model, system, user, maxTokens) {
        return {
          model: model,
          max_tokens: maxTokens,
          temperature: 0,
          system: system,
          messages: [{ role: "user", content: user }]
        };
      }
    },
    openrouter: {
      headers: function (apiKey) {
        return { "Authorization": "Bearer " + apiKey };
      },
      body: function (model, system, user, maxTokens, opts) {
        opts = opts || {};
        var body = {
          model: model,
          max_tokens: maxTokens != null ? maxTokens : LLM_MAX_TOKENS,
          temperature: 0,
          messages: opts.messages || [
            { role: "system", content: system },
            { role: "user", content: user }
          ]
        };
        if (opts.reasoning != null) body.reasoning = opts.reasoning;
        else body.reasoning = reasoningOff();
        var fp = (opts.frequencyPenalty != null) ?
          Number(opts.frequencyPenalty) : _frequencyPenalty();
        if (isNaN(fp) || fp < 0) fp = 0;
        if (fp > FREQUENCY_PENALTY_MAX) fp = FREQUENCY_PENALTY_MAX;
        if (fp > 0) body.frequency_penalty = fp;
        // 원칙: 본 시스템은 response_format:{type:"json_object"} 를 사용하지 않는다.
        // Gemini 계열은 structured output 강제 시 토큰 반복 루프에 빠져 max_tokens 를
        // 소진한다(#80 Triage 와 동일 조치). JSON 강제는 시스템 프롬프트의
        // "OUTPUT JSON ONLY" 지시 + _parseJson 의 {…} 추출로 대체한다.
        // Ref: https://discuss.ai.google.dev/t/gemini-2-5-flash-repeats-tokens-until-max-tokens-reached-in-structured-output/107176
        // 아래 pass-through 는 tools 와의 상호배제만 유지하기 위한 것이며 호출부는 없다.
        if (opts.responseFormat != null && !opts.tools)
          body.response_format = opts.responseFormat;
        // tools: 빈 배열도 falsy 취급. parallel_tool_calls 는 tool_choice:"none" 과 같이 내면
        // OpenRouter→Azure Anthropic 이 tool_choice.none.disable_parallel_tool_use 로 변환해
        // 400 "Extra inputs are not permitted" (Claude Sonnet 4.x via Azure).
        // Ref: https://github.com/zed-industries/zed/issues/35341
        // Ref: https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use
        if (opts.tools && opts.tools.length) {
          body.tools = opts.tools;
          var tc = opts.tool_choice != null ? opts.tool_choice : "auto";
          body.tool_choice = tc;
          if (tc !== "none") {
            body.parallel_tool_calls = opts.parallel_tool_calls === true;
          }
        }
        return body;
      }
    }
  };

  function _provider(cfg) {
    var p = _PROVIDERS[cfg.llm.provider];
    if (!p) throw new Error("[testWoo.llm] unknown provider: " + cfg.llm.provider);
    return p;
  }

  // stage = "pass0" | "pass1" — 출력 상한과 진단 메시지의 단계 표기에 쓰인다.
  // opts.frequencyPenalty 가 있으면 env 값 대신 그 값을 쓴다(Pass0 재시도용).
  function _chat(cfg, system, userContent, stage, opts) {
    opts = opts || {};
    var adapter = _provider(cfg);
    var bodyOpts = { reasoning: reasoningOff() };
    if (opts.frequencyPenalty != null) bodyOpts.frequencyPenalty = opts.frequencyPenalty;
    var body = adapter.body(cfg.llm.model, system, userContent,
      _maxTokensFor(stage), bodyOpts);
    return _postJson(cfg.llm, body, adapter.headers(cfg.llm.apiKey));
  }

  function _isLengthOrRepeatError(e) {
    var msg = String((e && e.message) || e || "");
    return msg.indexOf("max_tokens") >= 0 || msg.indexOf("반복 루프") >= 0;
  }

  /**
   * OpenRouter 가 Claude(Azure 등)로 중계할 때 parallel_tool_calls:false +
   * tool_choice:"none" 조합을 Anthropic tool_choice.none.disable_parallel_tool_use 로
   * 바꾸면 upstream 400. none 턴에서는 parallel_tool_calls 키를 제거한다.
   */
  function _sanitizeChatBody(bodyObj) {
    if (!bodyObj || typeof bodyObj !== "object") return bodyObj;
    var tools = bodyObj.tools;
    var hasTools = tools && tools.length;
    if (!hasTools) {
      try { delete bodyObj.tools; } catch (e0) {}
      try { delete bodyObj.tool_choice; } catch (e1) {}
      try { delete bodyObj.parallel_tool_calls; } catch (e2) {}
      return bodyObj;
    }
    if (bodyObj.tool_choice === "none") {
      try { delete bodyObj.parallel_tool_calls; } catch (e3) {}
    }
    return bodyObj;
  }

  function postChat(cfg, bodyObj) {
    var adapter = _provider(cfg);
    var body = _sanitizeChatBody(bodyObj);
    var raw = _postJson(cfg.llm, body, adapter.headers(cfg.llm.apiKey));
    var wrap;
    try {
      wrap = JSON.parse(String(raw));
    } catch (e) {
      throw new Error("[testWoo.llm.postChat] JSON parse failed: " + e.message);
    }
    // HTTP 200 + 본문 error 봉투도 상태코드를 실어 던진다 (throttled 분기용)
    if (wrap && wrap.error) {
      var em = wrap.error.message || wrap.error.code || "unknown";
      throw _httpError("[testWoo.llm.postChat] API error: " + em,
        _numOrNull(wrap.error.code));
    }
    return wrap;
  }

  // 임베딩 엔드포인트는 chat endpoint(옵션 testWooAiLlmEndpoint)의 호스트를 재사용한다.
  // 하드코딩하면 프로바이더 교체·프록시 환경에서 어긋나고, 호스트가 chat 과 달라지는 경우
  // serverConf.xml urlPermission 에 그 호스트를 별도로 추가해야 한다.
  var CHAT_PATH_RE = /\/chat\/completions\/?$/i;

  // #155: 패턴 불일치 시 chat URL 폴백 금지(확정 400/404). null → embed() 가 null 폴백.
  function _embedEndpoint(chatEndpoint) {
    var url = String(chatEndpoint || "");
    if (!url)
      throw new Error("[testWoo.llm.postEmbedding] endpoint empty (option testWooAiLlmEndpoint)");
    if (CHAT_PATH_RE.test(url)) return url.replace(CHAT_PATH_RE, "/embeddings");
    logWarning("[testWoo.llm._embedEndpoint] endpoint 가 /chat/completions 형태가 아니라 " +
      "임베딩 경로를 유도할 수 없습니다 — null 반환 host=" + _hostOf(url));
    return null;
  }

  function postEmbedding(cfg, inputArray) {
    if (!cfg.llm.apiKey) throw new Error("[testWoo.llm.postEmbedding] apiKey missing");
    var embedUrl = _embedEndpoint(cfg.llm.endpoint);
    if (!embedUrl) return null;
    var body = { model: cfg.llm.embedModel, input: inputArray };
    var raw = _postJson(
      { apiKey: cfg.llm.apiKey, endpoint: embedUrl, useProxy: cfg.llm.useProxy },
      body,
      { "Authorization": "Bearer " + cfg.llm.apiKey }
    );
    var wrap;
    try {
      wrap = JSON.parse(String(raw));
    } catch (e) {
      throw new Error("[testWoo.llm.postEmbedding] parse failed: " + e.message);
    }
    if (wrap && wrap.error) {
      var em = wrap.error.message || wrap.error.code || "unknown";
      throw _httpError(
        "[testWoo.llm.postEmbedding] API error: " + em,
        _numOrNull(wrap.error.code)
      );
    }
    return wrap;
  }

  // 봉투(choices/content)에서 본문만 꺼낸다. 산문을 요구하므로 JSON 을 강제하지 않고,
  // 응답이 JSON 이면 첫 문자열 값을 설명으로 쓴다. 설명은 dedup 판정에 영향이 없다.
  function _explanationText(rawResponse) {
    var text = String(rawResponse || "");
    try {
      var wrap = JSON.parse(text);
      if (wrap && wrap.choices && wrap.choices[0] && wrap.choices[0].message)
        text = String(wrap.choices[0].message.content || "");
      else if (wrap && wrap.content && wrap.content.length && wrap.content[0].text)
        text = String(wrap.content[0].text);
    } catch (eWrap) {}
    var t = _trim(text);
    if (t.indexOf("{") === 0) {
      try {
        var obj = JSON.parse(t);
        for (var k in obj) {
          if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
          if (typeof obj[k] === "string" && _trim(obj[k])) return _trim(obj[k]).substring(0, 500);
        }
      } catch (eObj) {}
    }
    return t.substring(0, 500);
  }

  function explainDedupDiff(candidate, match, diffCount) {
    var cfg = testWoo.cfg.getConfig();
    _requireLlmOpts(cfg);
    var system = "Explain in Korean (2-3 sentences) how two SQL fragments differ. Do NOT change any verdict.";
    var user = "Fragment A label: " + (candidate.label || candidate.name) +
      "\nFragment B label: " + (match.label || match.name) +
      "\nSymmetric diff count: " + diffCount +
      "\nDo not include customer PII.";
    var adapter = _provider(cfg);
    // 산문 2~3문장을 요구하면서 json_object 를 강제하면 Pass0 와 동일한 반복 루프 조건이
    // 된다(L-1). responseFormat 을 넘기지 않으므로 어댑터도 response_format 을 붙이지 않는다.
    var body = adapter.body(cfg.llm.model, system, user, 1024, {
      reasoning: reasoningOff()
    });
    var raw = _postJson(cfg.llm, body, adapter.headers(cfg.llm.apiKey));
    return _explanationText(raw);
  }

  function _errText(e) {
    if (e == null) return "unknown";
    if (typeof e === "string") return e;
    try {
      if (e.message != null && String(e.message) !== "") return String(e.message);
    } catch (ignore1) {}
    try { return String(e); } catch (ignore2) { return "unknown"; }
  }

  function _hostOf(url) {
    var s = String(url || "");
    var m = s.match(/^https?:\/\/([^\/?#]+)/i);
    return m ? m[1] : "(no-host)";
  }

  // MemoryBuffer.toString([codePage]) — codePage는 문자열 아님, 정수.
  // 공식: 기본값 MemoryBuffer.CODEPAGE_UTF8.
  // toString("utf-8") 문자열 전달 시 예외 없이 빈 문자열이 나와 HTTP 200 + empty body 오진 발생.
  function _readResponseBody(res) {
    if (!res || res.body == null) return "";
    var body = res.body;
    if (typeof body === "string") return body;

    var size = -1;
    try { size = Number(body.size); } catch (eSz) {}

    try {
      if (typeof body.isEmpty === "boolean" && body.isEmpty) return "";
    } catch (eEmpty) {}

    // 1) 기본 toString() = CODEPAGE_UTF8 (공식 기본값) — Anthropic JSON
    try {
      var s0 = body.toString();
      if (s0 != null && String(s0).length > 0) return String(s0);
    } catch (e0) {}

    // 2) 상수 정수
    try {
      if (typeof MemoryBuffer !== "undefined" && MemoryBuffer.CODEPAGE_UTF8 != null) {
        var s1 = body.toString(MemoryBuffer.CODEPAGE_UTF8);
        if (s1 != null && String(s1).length > 0) return String(s1);
      }
    } catch (e1) {}

    // 3) 응답 codePage (정수일 때만 — 한글 깨짐 위험 있어 size>0 폴백용)
    try {
      if (res.codePage != null && typeof res.codePage !== "string") {
        var s2 = body.toString(res.codePage);
        if (s2 != null && String(s2).length > 0) return String(s2);
      }
    } catch (e2) {}

    if (size > 0)
      throw new Error("response body size=" + size + " but toString yielded empty (use int CODEPAGE)");
    return "";
  }

  // 오류에 HTTP 상태코드를 실어 보낸다. 호출부는 문자열("402" 포함 여부) 대신
  // e.httpStatus / e.isRateLimited / e.isOutOfCredit 로 분기한다.
  function _httpError(message, code) {
    var err = new Error(message);
    if (code != null) {
      err.httpStatus = Number(code);
      err.isRateLimited = (Number(code) === 429);
      err.isOutOfCredit = (Number(code) === 402);
    }
    return err;
  }

  function _numOrNull(v) {
    if (v == null) return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }

  function _statusOf(e) {
    if (e == null) return null;
    try {
      if (e.httpStatus != null) return Number(e.httpStatus);
    } catch (ignore) {}
    return null;
  }

  // MemoryBuffer UTF-8 + 동기 execute만.
  // 금지: HttpClientRequest.wait — Java 브리지에서 typeof==function 이어도 호출 실패함.
  function _postJson(llm, body, headerMap) {
    var url = llm.endpoint;
    var apiKey = llm.apiKey;
    var host = _hostOf(url);
    try {
      if (!url) throw new Error("endpoint empty (option testWooAiLlmEndpoint)");
      if (!apiKey) throw new Error("apiKey empty (option testWooAiLlmApiKey)");

      var req = new HttpClientRequest(url);
      req.method = "POST";
      req.header["Content-Type"] = "application/json; charset=utf-8";
      var hm = headerMap || {};
      for (var hk in hm) {
        if (Object.prototype.hasOwnProperty.call(hm, hk)) {
          req.header[hk] = hm[hk];
        }
      }

      var buf = new MemoryBuffer();
      buf.fromString(JSON.stringify(body), "utf-8");
      req.body = buf;

      req.execute(!!llm.useProxy);

      var res = req.response;
      if (!res) throw new Error("no response after execute (host=" + host + ")");

      var code = res.code;
      var resBody = _readResponseBody(res);
      if (code < 200 || code >= 300) {
        var preview = resBody.length > 400 ? resBody.substring(0, 400) + "..." : resBody;
        throw _httpError("HTTP " + code + " host=" + host + " body=" + preview, code);
      }
      if (!resBody) throw _httpError("empty body HTTP " + code + " host=" + host, code);
      return resBody;
    } catch (e) {
      var msg = _errText(e);
      var status = _statusOf(e);
      if (msg.indexOf("urlPermission") >= 0 || msg.indexOf("JST-310026") >= 0) {
        throw _httpError(
          "[testWoo.llm._postJson] urlPermission blocked host=" + host +
          " — allow https://" + host + " in serverConf.xml urlPermission. detail=" + msg,
          status
        );
      }
      throw _httpError("[testWoo.llm._postJson] failed host=" + host + ": " + msg, status);
    }
  }

  // 응답 본문이 같은 패턴을 되풀이하다 상한에 부딪혔는지 추정한다.
  // 짧은 NL 입력에서 본문이 상한을 채우는 것은 정상 생성이 아니라 반복 루프다.
  function _looksRepetitive(text) {
    var t = String(text || "");
    if (t.length < 400) return false;
    var head = t.substring(0, 200);
    var tail = t.substring(t.length - 200);
    if (head === tail) return true;
    for (var len = 12; len <= 40; len++) {
      var unit = tail.substring(0, len);
      var hits = 0;
      var pos = 0;
      while (pos <= tail.length - len) {
        var at = tail.indexOf(unit, pos);
        if (at < 0) break;
        hits++;
        pos = at + len;
      }
      if (hits >= 3) return true;
    }
    return false;
  }

  /**
   * Pass0 length 절단 시 content 앞부분에서 {"slots":[...]} 회수.
   * 반복 루프로 꼬리만 깨진 경우 선두 JSON 이 유효한 경우가 많다.
   */
  function _salvagePass0Slots(content) {
    var text = String(content == null ? "" : content);
    var start = text.indexOf("{");
    if (start < 0) return null;
    var slice = text.substring(start);
    if (slice.length > 2500) slice = slice.substring(0, 2500);
    var end = slice.lastIndexOf("}");
    while (end > 0) {
      try {
        var obj = JSON.parse(slice.substring(0, end + 1));
        if (obj && _isArray(obj.slots) && obj.slots.length > 0) {
          if (obj.slots.length > 8) obj.slots = obj.slots.slice(0, 8);
          return obj;
        }
      } catch (eSal) {}
      end = slice.lastIndexOf("}", end - 1);
    }
    return null;
  }

  // finish_reason="length" 원인 분기 안내. reasoning 토큰이 대부분이면 상한을 올리는 게
  // 아니라 reasoning 을 꺼야 하고, reasoning=0 인데 상한을 채웠다면 반복 루프다.
  // 프롬프트에는 고객 실데이터가 섞일 수 있으므로 응답 content 만 로그에 남긴다.
  function _lengthDiag(usage, content, stage) {
    var reason = 0;
    var completion = 0;
    try {
      if (usage) {
        completion = Number(usage.completion_tokens) || 0;
        if (usage.completion_tokens_details)
          reason = Number(usage.completion_tokens_details.reasoning_tokens) || 0;
      }
    } catch (eU) {}
    var text = String(content == null ? "" : content);
    var tail = "stage=" + String(stage || "?") +
      " completion=" + completion + " reasoning=" + reason +
      " contentChars=" + text.length;
    if (text.length) {
      logWarning("[testWoo.llm] length-cut head200: " + text.substring(0, 200));
      logWarning("[testWoo.llm] length-cut tail200: " +
        text.substring(text.length > 200 ? text.length - 200 : 0));
    }
    if (reason > 0 && reason >= completion / 2) {
      return "사고(reasoning) 토큰이 출력 상한을 소진했습니다 — " + tail +
        ". max_tokens 를 올리는 대신 reasoning 을 끄십시오" +
        "(thinking 모델은 reasoning:{enabled:false} 만으로는 꺼지지 않아 max_tokens:0 이 필요).";
    }
    if (_looksRepetitive(text)) {
      return "[반복 루프 의심] 동일 패턴이 되풀이되며 출력 상한을 소진했습니다 — " + tail +
        ". Gemini 간헐 루프(json_object 없이도 발생). Pass0 는 자동 재시도·frequency_penalty 확인.";
    }
    return "출력 상한을 올리거나 후보 수를 줄이세요 — " + tail +
      ". reasoning=0 인데 completion 이 상한이면 토큰 부족이 아니라 반복 루프일 수 있습니다.";
  }

  // OpenAI 호환 봉투(choices) 우선 → Anthropic envelope 폴백
  function _parseJson(rawResponse, stage) {
    var text = String(rawResponse || "");
    var wrap = null;
    try { wrap = JSON.parse(text); } catch (eParse) { wrap = null; }

    if (wrap) {
      if (wrap.usage) {
        logInfo("[testWoo.llm] usage: " + JSON.stringify(wrap.usage));
      }

      if (wrap.error) {
        var errMsg = wrap.error.message || wrap.error.code || text.substring(0, 200);
        throw _httpError("[testWoo.llm] API error: " + errMsg, _numOrNull(wrap.error.code));
      }

      if (wrap.choices && wrap.choices.length) {
        var ch = wrap.choices[0];
        if (ch.finish_reason === "length") {
          var cutContent = ch.message ? ch.message.content : "";
          // Pass0: 잘린 본문 앞쪽에서 slots JSON 회수 시도 (반복 루프여도 선두는 유효한 경우 많음)
          if (String(stage || "") === "pass0") {
            var salvaged = _salvagePass0Slots(cutContent);
            if (salvaged) {
              logWarning(
                "[testWoo.llm] pass0 length — salvaged slots count=" +
                salvaged.slots.length + " " +
                _lengthDiag(wrap.usage, cutContent, stage)
              );
              return salvaged;
            }
          }
          throw new Error(
            "[testWoo.llm] 응답이 max_tokens에서 잘렸습니다. " +
            _lengthDiag(wrap.usage, cutContent, stage)
          );
        }
        if (ch.finish_reason === "error") {
          throw new Error(
            "[testWoo.llm] provider error: " + (ch.native_finish_reason || "")
          );
        }
        if (ch.finish_reason === "tool_calls") {
          return { __tool_calls: true, wrap: wrap, message: ch.message };
        }
        if (ch.message && ch.message.content != null) {
          text = String(ch.message.content);
          if (text === "" && ch.message.reasoning) {
            throw new Error(
              "[testWoo.llm] 응답 본문이 비어 있고 reasoning만 반환됨. " +
              "reasoning 비활성 설정을 확인하세요."
            );
          }
        }
      } else {
        if (wrap.stop_reason === "max_tokens") {
          throw new Error(
            "[testWoo.llm] LLM 응답이 max_tokens에서 잘렸습니다. " +
            "후보 수를 줄이거나 max_tokens를 올리세요."
          );
        }
        if (wrap.content && wrap.content.length) {
          var parts = [];
          for (var i = 0; i < wrap.content.length; i++) {
            if (wrap.content[i].text) parts.push(wrap.content[i].text);
          }
          if (parts.length) text = parts.join("\n");
        }
      }
    }

    var start = text.indexOf("{");
    var end = text.lastIndexOf("}");
    if (start < 0 || end < 0 || end <= start)
      throw new Error("[testWoo.llm] JSON object missing");
    try {
      return JSON.parse(text.substring(start, end + 1));
    } catch (eJson) {
      throw new Error(
        "[testWoo.llm] plan JSON parse failed: " + _errText(eJson) +
        " (max_tokens 절단 가능) preview=" +
        text.substring(start, Math.min(start + 180, end + 1))
      );
    }
  }

  function _trunc(s, n) {
    var t = String(s == null ? "" : s);
    if (t.length <= n) return t;
    return t.substring(0, n);
  }

  function _slimSamples(sq) {
    if (!_isArray(sq)) return sq;
    var out = [];
    for (var i = 0; i < sq.length && i < 2; i++) out.push(_trunc(sq[i], 120));
    return out;
  }

  function _slimCandidates(slotCandidates) {
    var out = [];
    var list = slotCandidates || [];
    for (var i = 0; i < list.length; i++) {
      var sc = list[i];
      var cands = [];
      var src = sc.candidates || [];
      for (var j = 0; j < src.length; j++) {
        var c = src[j];
        cands.push({
          name: c.name,
          label: c.label,
          category: c.category,
          description: _trunc(c.description, 200),
          params: c.params,
          param_domain: c.param_domain,
          sample_questions: _slimSamples(c.sample_questions),
          key_column: c.key_column
        });
      }
      out.push({
        id: sc.id,
        text: sc.text,
        hintedCategory: sc.hintedCategory,
        candidates: cands
      });
    }
    return out;
  }

  function _validatePlanShape(plan) {
    if (!plan) throw new Error("[testWoo.llm] plan missing");
    if (!plan.grainKey) throw new Error("[testWoo.llm] plan.grainKey missing");
    if (!_isArray(plan.unmatched)) plan.unmatched = [];
    // unmatched가 있으면 include가 있어도 완성 계획이 아님 — selectPlan은 허용하고
    // generate/gates에서 hard fail. 여기서는 형태만 검사.
    if (!_isArray(plan.exclude)) plan.exclude = [];
    if (!_isArray(plan.include)) plan.include = [];
    if (!plan.unmatched.length) {
      if (!plan.include.length) throw new Error("[testWoo.llm] plan.include empty");
      for (var i = 0; i < plan.include.length; i++) {
        var g = plan.include[i];
        if (!g || !_isArray(g.any) || !g.any.length)
          throw new Error("[testWoo.llm] include[" + i + "].any empty");
      }
    }
  }

  function _countFragments(plan) {
    var n = 0;
    for (var i = 0; i < (plan.include || []).length; i++) {
      var any = plan.include[i] && plan.include[i].any;
      if (_isArray(any)) n += any.length;
    }
    if (_isArray(plan.exclude)) n += plan.exclude.length;
    return n;
  }

  function _allowedNames(slotCandidates) {
    var set = {};
    var list = slotCandidates || [];
    for (var i = 0; i < list.length; i++) {
      var cands = list[i].candidates || [];
      for (var j = 0; j < cands.length; j++) set[cands[j].name] = true;
    }
    return set;
  }

  function _walkFragments(plan, fn) {
    var inc = plan.include || [];
    for (var i = 0; i < inc.length; i++) {
      var any = (inc[i] && inc[i].any) || [];
      for (var j = 0; j < any.length; j++) fn(any[j]);
    }
    var ex = plan.exclude || [];
    for (var k = 0; k < ex.length; k++) fn(ex[k]);
  }

  function _rejectOutsideCandidates(plan, allowed) {
    _walkFragments(plan, function (s) {
      if (!s || !s.fragment)
        throw new Error("[testWoo.llm] fragment name missing in plan");
      if (!allowed[s.fragment])
        throw new Error("[testWoo.llm] fragment outside candidates: " + s.fragment);
    });
  }

  function _isArray(x) {
    return Object.prototype.toString.call(x) === "[object Array]";
  }

  return {
    decomposeSlots: decomposeSlots,
    selectPlan: selectPlan,
    generatePlan: generatePlan,
    postChat: postChat,
    postEmbedding: postEmbedding,
    explainDedupDiff: explainDedupDiff,
    reasoningOff: reasoningOff,
    _postJson: _postJson,
    _readResponseBody: _readResponseBody
  };
})();
testWoo.llm.__v = "159";
