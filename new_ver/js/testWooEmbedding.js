/*
 * testWooEmbedding.js (Fragment 임베딩)
 * ==================================================
 * litmus 동기 __v=159 (#160 배포정합).
 * fragment 메타(label·description·tags)를 벡터화. sql_text는 임베딩하지 않음.
 * embedEnabled=false면 embed()→null. 영속화는 lifecycle.publish가 담당.
 *
 * [Main Functions]
 * ===========
 * - embed — 텍스트 배열 → 벡터 배열(OpenRouter)
 * - normalize — L2 정규화
 * - cosine — 두 벡터 코사인 유사도
 * - embedTextOf — fragment → 임베딩 입력 문자열
 * - ensureEmbedding — fragment에 emb_vector·updated_at 세팅
 * - sourceHash — embedTextOf 해시
 *
 * [Dependencies]
 * =========
 * - testWoo.llm.postEmbedding — HTTP 임베딩 API
 * - testWoo.cfg.getConfig — llm.embedEnabled·embedModel
 */
var testWoo = testWoo || {};
testWoo.embedding = (function () {
  "use strict";

  var BATCH_MAX = 32;

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  function _isArray(x) {
    return Object.prototype.toString.call(x) === "[object Array]";
  }

  function _djb2(str) {
    var h = 5381;
    var s = String(str || "");
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) + h) + s.charCodeAt(i);
      h = h & 0x7fffffff;
    }
    return ("00000000" + h.toString(16)).slice(-16);
  }

  function embedTextOf(frag) {
    if (!frag) return "";
    var tags = frag.tags || "";
    if (_isArray(tags)) tags = tags.join(" ");
    return _trim(String(frag.label || "") + "\n" +
      String(frag.description || "") + "\n" +
      String(tags));
  }

  function sourceHash(text) {
    return _djb2(String(text || ""));
  }

  function normalize(vec) {
    if (!vec || !_isArray(vec)) return null;
    var sum = 0;
    for (var i = 0; i < vec.length; i++) {
      var v = Number(vec[i]);
      if (isNaN(v)) return null;
      sum += v * v;
    }
    if (sum <= 0) return null;
    var norm = Math.sqrt(sum);
    var out = [];
    for (var j = 0; j < vec.length; j++) out.push(Number(vec[j]) / norm);
    return out;
  }

  function cosine(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    var dot = 0;
    for (var i = 0; i < a.length; i++) dot += Number(a[i]) * Number(b[i]);
    return dot;
  }

  function embed(textArray) {
    if (!textArray || !textArray.length) return null;
    var cfg = testWoo.cfg.getConfig();
    // 플래그는 cfg.llm.embedEnabled 다(testWooConfig 가 env llm 섹션에서 싣는다).
    // cfg.foundry.embedEnabled 는 존재하지 않아 임베딩이 항상 비활성으로 새던 경로였다.
    if (!cfg.llm.embedEnabled) return null;
    if (!cfg.llm.apiKey || !cfg.llm.embedModel) {
      logWarning("[testWoo.embedding.embed] embed disabled or options missing");
      return null;
    }
    try {
      if (!testWoo.llm || !testWoo.llm.postEmbedding) return null;
      var inputs = [];
      for (var i = 0; i < textArray.length && i < BATCH_MAX; i++)
        inputs.push(String(textArray[i] || ""));
      var raw = testWoo.llm.postEmbedding(cfg, inputs);
      if (!raw || !raw.data) return null;
      var out = [];
      for (var j = 0; j < raw.data.length; j++) {
        var emb = raw.data[j].embedding;
        out.push(normalize(emb));
      }
      return out;
    } catch (e) {
      logWarning("[testWoo.embedding.embed] failed: " + (e.message || e));
      return null;
    }
  }

  function ensureEmbedding(frag) {
    if (!frag) return null;
    var text = embedTextOf(frag);
    var hash = sourceHash(text);
    if (frag.emb_vector && frag.emb_source_hash === hash) {
      try {
        var parsed = JSON.parse(String(frag.emb_vector));
        if (_isArray(parsed) && parsed.length) return parsed;
      } catch (eParse) {}
    }
    var vecs = embed([text]);
    if (!vecs || !vecs.length) return null;
    frag.emb_vector = JSON.stringify(vecs[0]);
    frag.emb_source_hash = hash;
    frag.emb_model = testWoo.cfg.getConfig().llm.embedModel;
    frag.emb_dim = vecs[0].length;
    /* #155: publish()가 emb_updated_at 을 DB에 기록. 캐시 히트 경로도 시각 갱신하지 않음 */
    frag.emb_updated_at = formatDate(
      new Date(),
      "%4Y/%2M/%2D %02H:%02N:%02S"
    );
    return vecs[0];
  }

  return {
    embed: embed,
    normalize: normalize,
    cosine: cosine,
    embedTextOf: embedTextOf,
    ensureEmbedding: ensureEmbedding,
    sourceHash: sourceHash
  };
})();
testWoo.embedding.__v = "159";
