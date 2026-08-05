/*
 * testWooLlm.js (LLM Pass0 슬롯분해 + Pass1 CNF 조합계획 · server-side)
 * =====================================================================
 * Pass0: NL → slots. Pass1: 후보만 보고 CNF plan (include[].any[] + exclude[]).
 * SQL은 쓰지 않는다. op 필드 없음(중간 include 리셋 원천 차단).
 *
 * [Main Functions]
 * ===========
 * - decomposeSlots (Pass 0)
 * - selectPlan (Pass 1 → CNF)
 * - generatePlan (Pass0→StageA→Pass1)
 *
 * [Dependencies]
 * =========
 * - HttpClientRequest + MemoryBuffer (UTF-8) — 동기 execute만
 *   ※ HttpClientRequest.wait 사용 금지 (이 ACC 빌드에서 호출 불가)
 * - testWoo.cfg / testWoo.fragments
 * - serverConf.xml urlPermission 에 LLM endpoint 호스트 허용 필요
 * - 옵션: testWooAiLlmApiKey / Model / Endpoint (필수). Provider·Proxy·Pass0는 testWooEnv.js
 * - ACC Rhino: map/forEach/filter/wait/Promise 금지 · trim은 regex
 * - loadLibrary("woo:testWooLlm.js")
 * Ref: MemoryBuffer.toString([codePage:int]) 기본=CODEPAGE_UTF8 — 문자열 "utf-8" 금지
 * Ref: MemoryBuffer.fromString(str, "utf-8") 요청 인코딩은 문자열 코드페이지명
 * Ref: execute(hasProxy) 동기
 * Ref: OpenRouter /api/v1/chat/completions, Authorization: Bearer,
 *       choices[0].message.content, finish_reason 정규화(length/error)
 * Ref: anthropic/claude-opus-5 — context 1M, max_completion_tokens 128k,
 *       reasoning default_enabled=true
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
      "For each slot, fill searchKeywords: alternate phrasings useful for library keyword search.",
      "searchKeywords must include: colloquial/abbreviated forms, normalized forms,",
      "and alternate notations for any numeric range mentioned.",
      "If one phrase mixes two conditions, you MAY keep one slot; Pass1 may split later.",
      'OUTPUT JSON ONLY: {"slots":[{"id":"s1","text":"...","hintedCategory":"plan|demo|consent|fatigue|signup|other","searchKeywords":["..."]}]}'
    ];
    if (cfg.llm.pass0Examples) {
      systemLines.splice(systemLines.length - 1, 0, "Domain keyword examples: " + cfg.llm.pass0Examples);
    }
    var system = systemLines.join("\n");
    var raw = _chat(cfg, system, String(nlRequest || ""));
    var parsed = _parseJson(raw);
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
      "CANDIDATES_BY_SLOT:",
      JSON.stringify(slim),
      'OUTPUT JSON ONLY: {"grainKey":"customer_id","include":[{"any":[{"fragment":"<name>","label":"<ko>","params":{}}]}],"exclude":[{"fragment":"<name>","label":"<ko>","params":{}}],"unmatched":[]}'
    ].join("\n");
    var user = "NL:\n" + String(nlRequest || "");
    var raw = _chat(cfg, system, user);
    var plan = _parseJson(raw);
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

  var LLM_MAX_TOKENS = 8192; // Opus 5는 reasoning 토큰이 max_tokens에 합산됨

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
        else body.reasoning = { enabled: false };
        if (opts.responseFormat != null) body.response_format = opts.responseFormat;
        else if (!opts.tools) body.response_format = { type: "json_object" };
        if (opts.tools) {
          body.tools = opts.tools;
          body.tool_choice = opts.tool_choice || "auto";
          body.parallel_tool_calls = opts.parallel_tool_calls === true ? true : false;
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

  function _chat(cfg, system, userContent) {
    var adapter = _provider(cfg);
    var body = adapter.body(cfg.llm.model, system, userContent, LLM_MAX_TOKENS, {
      reasoning: { enabled: false },
      responseFormat: { type: "json_object" }
    });
    return _postJson(cfg.llm, body, adapter.headers(cfg.llm.apiKey));
  }

  function postChat(cfg, bodyObj) {
    var adapter = _provider(cfg);
    var raw = _postJson(cfg.llm, bodyObj, adapter.headers(cfg.llm.apiKey));
    try {
      return JSON.parse(String(raw));
    } catch (e) {
      throw new Error("[testWoo.llm.postChat] JSON parse failed: " + e.message);
    }
  }

  function postEmbedding(cfg, inputArray) {
    if (!cfg.llm.apiKey) throw new Error("[testWoo.llm.postEmbedding] apiKey missing");
    var embedUrl = "https://openrouter.ai/api/v1/embeddings";
    var body = { model: cfg.llm.embedModel, input: inputArray };
    var raw = _postJson(
      { apiKey: cfg.llm.apiKey, endpoint: embedUrl, useProxy: cfg.llm.useProxy },
      body,
      { "Authorization": "Bearer " + cfg.llm.apiKey }
    );
    try {
      return JSON.parse(String(raw));
    } catch (e) {
      throw new Error("[testWoo.llm.postEmbedding] parse failed: " + e.message);
    }
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
    var body = adapter.body(cfg.llm.model, system, user, 1024, {
      reasoning: { enabled: false }
    });
    var raw = _postJson(cfg.llm, body, adapter.headers(cfg.llm.apiKey));
    try {
      var wrap = JSON.parse(String(raw));
      if (wrap.choices && wrap.choices[0] && wrap.choices[0].message)
        return String(wrap.choices[0].message.content || "");
    } catch (e) {}
    return String(raw).substring(0, 500);
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
        throw new Error("HTTP " + code + " host=" + host + " body=" + preview);
      }
      if (!resBody) throw new Error("empty body HTTP " + code + " host=" + host);
      return resBody;
    } catch (e) {
      var msg = _errText(e);
      if (msg.indexOf("urlPermission") >= 0 || msg.indexOf("JST-310026") >= 0) {
        throw new Error(
          "[testWoo.llm._postJson] urlPermission blocked host=" + host +
          " — allow https://" + host + " in serverConf.xml urlPermission. detail=" + msg
        );
      }
      throw new Error("[testWoo.llm._postJson] failed host=" + host + ": " + msg);
    }
  }

  // OpenAI 호환 봉투(choices) 우선 → Anthropic envelope 폴백
  function _parseJson(rawResponse) {
    var text = String(rawResponse || "");
    var wrap = null;
    try { wrap = JSON.parse(text); } catch (eParse) { wrap = null; }

    if (wrap) {
      if (wrap.usage) {
        logInfo("[testWoo.llm] usage: " + JSON.stringify(wrap.usage));
      }

      if (wrap.error) {
        var errMsg = wrap.error.message || wrap.error.code || text.substring(0, 200);
        throw new Error("[testWoo.llm] API error: " + errMsg);
      }

      if (wrap.choices && wrap.choices.length) {
        var ch = wrap.choices[0];
        if (ch.finish_reason === "length") {
          throw new Error(
            "[testWoo.llm] 응답이 max_tokens에서 잘렸습니다. " +
            "LLM_MAX_TOKENS를 올리거나 후보 수를 줄이세요."
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
    _postJson: _postJson,
    _readResponseBody: _readResponseBody
  };
})();
