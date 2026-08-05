/*
 * testWooDedup.js (4단 유사도 dedup · server-side)
 * ==================================================
 * L0 contentHash → L1 jaccard → L2 embedding rerank → L3 set equivalence → L4 LLM 설명(near만).
 * near 판정 비율의 분모는 모집단 COUNT(cfg.foundry.populationCountSql), 후보 결과 건수가 아니다.
 *
 * [Main Functions]
 * ===========
 * - check(candidate) → {verdict, matches, scores, symmetricDiff, delegateHuman, reuse}
 * - tokensOf / jaccard
 *
 * [Dependencies]
 * =========
 * - testWoo.lifecycle, testWoo.probe, testWoo.embedding, testWoo.llm, testWoo.cfg
 * - sqlGetInt (모집단 COUNT)
 * - loadLibrary("woo:testWooDedup.js")
 */
var testWoo = testWoo || {};
testWoo.dedup = (function () {
  "use strict";

  // near 비율의 분모는 후보 결과 건수가 아니라 모집단 COUNT (check 호출 간 캐시)
  var _popCache = null;

  var SQL_STOP = {
    select: 1, from: 1, where: 1, and: 1, or: 1, not: 1, in: 1, is: 1, null: 1,
    distinct: 1, as: 1, on: 1, join: 1, inner: 1, left: 1, right: 1, outer: 1,
    exists: 1, between: 1, like: 1, group: 1, by: 1, order: 1, having: 1, with: 1
  };

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  function _isArray(x) {
    return Object.prototype.toString.call(x) === "[object Array]";
  }

  function tokensOf(sql) {
    var norm = testWoo.lifecycle.normalizeSql(sql);
    var raw = norm.split(/[^0-9a-z_]+/i);
    var seen = {};
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var t = _trim(raw[i]);
      if (!t || t.length < 2) continue;
      if (SQL_STOP[t]) continue;
      if (seen[t]) continue;
      seen[t] = true;
      out.push(t);
    }
    return out;
  }

  function jaccard(aTok, bTok) {
    if (!aTok.length || !bTok.length) return 0;
    var setB = {};
    for (var i = 0; i < bTok.length; i++) setB[bTok[i]] = true;
    var inter = 0;
    for (var j = 0; j < aTok.length; j++) {
      if (setB[aTok[j]]) inter++;
    }
    var union = aTok.length + bTok.length - inter;
    return union > 0 ? inter / union : 0;
  }

  function _namePrefix(name) {
    var parts = String(name || "").split("__");
    if (parts.length >= 2) return parts[0] + "__" + parts[1] + "__";
    return "";
  }

  function _tagOverlap(a, b) {
    var ta = String(a || "").split(/[,;\s]+/);
    var tb = String(b || "").split(/[,;\s]+/);
    var sb = {};
    for (var i = 0; i < tb.length; i++) {
      var t = _trim(tb[i].toLowerCase());
      if (t) sb[t] = true;
    }
    for (var j = 0; j < ta.length; j++) {
      var u = _trim(ta[j].toLowerCase());
      if (u && sb[u]) return true;
    }
    return false;
  }

  function _loadCandidates(candidate) {
    var kc = String(candidate.key_column || "");
    var sk = String(candidate.scope_key || "");
    var escK = kc.replace(/'/g, "''");
    var q = xtk.queryDef.create(
      <queryDef schema="woo:testWooAiFragment" operation="select" lineCount="500">
        <select>
          <node expr="@id"/><node expr="@name"/><node expr="@version"/>
          <node expr="@label"/><node expr="@description"/><node expr="@tags"/>
          <node expr="@key_column"/><node expr="@scope_key"/><node expr="@sql_text"/>
          <node expr="@content_hash"/><node expr="@status"/><node expr="@is_current"/>
          <node expr="@emb_vector"/><node expr="@emb_source_hash"/>
        </select>
        <where>
          <condition expr={"@key_column = '" + escK + "'"}/>
          <condition expr="(@status = 'active' OR @status = 'verified')"/>
          <condition expr="@is_current = 1"/>
        </where>
      </queryDef>);
    // scope_key는 nullable 불일치(빈문자 vs null) 때문에 아래 루프에서 메모리 필터로 처리
    var res = q.ExecuteQuery();
    var out = [];
    var candPrefix = _namePrefix(candidate.name);
    for each (var r in res.testWooAiFragment) {
      var row = {
        id: Number(r.@id),
        name: String(r.@name),
        version: Number(r.@version),
        label: String(r.@label),
        description: String(r.@description),
        tags: String(r.@tags),
        key_column: String(r.@key_column),
        scope_key: String(r.@scope_key),
        sql_text: String(r.@sql_text),
        content_hash: String(r.@content_hash),
        status: String(r.@status),
        emb_vector: String(r.@emb_vector || ""),
        emb_source_hash: String(r.@emb_source_hash || "")
      };
      if (String(row.scope_key || "") !== String(sk || "")) continue;
      if (!_tagOverlap(row.tags, candidate.tags) &&
          candPrefix && _namePrefix(row.name) !== candPrefix) continue;
      out.push(row);
    }
    return out;
  }

  function _symmetricDiffCount(newSql, oldSql, keyColumn) {
    var kc = String(keyColumn || "");
    if (!testWoo.probe.validKeyColumn(kc)) return -1;
    var dial = testWoo.probe.dialect();
    var wrapNew = "SELECT " + kc + " AS k FROM (" + newSql + ") a";
    var wrapOld = "SELECT " + kc + " AS k FROM (" + oldSql + ") b";
    var diffQ =
      "SELECT COUNT(*) FROM (" +
      "(SELECT k FROM (" + wrapNew + ") na " + dial.exceptOp + " SELECT k FROM (" + wrapOld + ") ob)" +
      " UNION ALL " +
      "(SELECT k FROM (" + wrapOld + ") ob2 " + dial.exceptOp + " SELECT k FROM (" + wrapNew + ") na2)" +
      ") tw_diff";
    try {
      return Number(sqlGetInt(diffQ));
    } catch (e) {
      logWarning("[testWoo.dedup._symmetricDiffCount] " + e.message);
      return -1;
    }
  }

  // 모집단 건수 — cfg.foundry.populationCountSql 기준. 0이면 임계 계산 불가.
  function _population() {
    if (_popCache != null) return _popCache;
    var sql = "";
    try {
      var cfg = testWoo.cfg.getConfig();
      sql = String(cfg.foundry.populationCountSql || "");
    } catch (eC) {
      sql = "";
    }
    if (!sql) {
      _popCache = 0;
      return _popCache;
    }
    try {
      _popCache = Number(sqlGetInt(sql));
    } catch (e) {
      logWarning("[testWoo.dedup._population] populationCountSql failed: " +
        String(e.message || e));
      _popCache = 0;
    }
    if (isNaN(_popCache)) _popCache = 0;
    return _popCache;
  }

  function _explainNear(candidate, match, diffCount) {
    if (!testWoo.llm || !testWoo.llm.explainDedupDiff) return "";
    try {
      return testWoo.llm.explainDedupDiff(candidate, match, diffCount);
    } catch (e) {
      return "";
    }
  }

  function check(candidate) {
    var report = { l0: null, l1: [], l2: [], l3: [] };
    if (!candidate || !candidate.sql_text)
      return { verdict: "novel", matches: [], scores: report };

    var hash = testWoo.lifecycle.contentHash(
      candidate.sql_text, candidate.key_column, candidate.scope_key);

    // L0 exact
    var exactMatch = null;
    var all = _loadCandidates(candidate);
    for (var ei = 0; ei < all.length; ei++) {
      if (all[ei].content_hash === hash ||
          hash === testWoo.lifecycle.contentHash(all[ei].sql_text, all[ei].key_column, all[ei].scope_key)) {
        exactMatch = all[ei];
        break;
      }
    }
    if (exactMatch) {
      report.l0 = { hash: hash, matchId: exactMatch.id };
      return {
        verdict: "exact",
        matches: [exactMatch],
        scores: report,
        reuse: exactMatch
      };
    }

    // L1 jaccard
    var newTok = tokensOf(candidate.sql_text);
    var l1scored = [];
    for (var i = 0; i < all.length; i++) {
      var sc = jaccard(newTok, tokensOf(all[i].sql_text));
      if (sc > 0) l1scored.push({ frag: all[i], score: sc });
    }
    l1scored.sort(function (a, b) { return b.score - a.score; });
    var l1top = l1scored.slice(0, 8);
    for (var li = 0; li < l1top.length; li++)
      report.l1.push({ id: l1top[li].frag.id, name: l1top[li].frag.name, score: l1top[li].score });
    if (!l1top.length)
      return { verdict: "novel", matches: [], scores: report };

    // L2 embedding rerank
    var l2pool = l1top.slice(0, 8);
    var candVec = null;
    if (testWoo.embedding) {
      candVec = testWoo.embedding.ensureEmbedding(candidate);
    }
    var l2scored = [];
    if (candVec) {
      for (var j = 0; j < l2pool.length; j++) {
        var fr = l2pool[j].frag;
        var fv = testWoo.embedding.ensureEmbedding(fr);
        var cs = fv ? testWoo.embedding.cosine(candVec, fv) : 0;
        l2scored.push({ frag: fr, l1: l2pool[j].score, l2: cs });
        report.l2.push({ id: fr.id, name: fr.name, cosine: cs });
      }
      l2scored.sort(function (a, b) { return b.l2 - a.l2; });
    } else {
      for (var k = 0; k < l2pool.length; k++) {
        l2scored.push({ frag: l2pool[k].frag, l1: l2pool[k].score, l2: 0 });
      }
    }

    var l3candidates = l2scored.slice(0, 3);
    var cfg = testWoo.cfg.getConfig();
    var nearThreshold = cfg.foundry.dedupNearThreshold || 0.01;
    var population = _population();
    // probeNew는 후보 SQL 자체 검증용 — population 분모로 쓰지 않는다.
    var probeNew = testWoo.probe.run(candidate.sql_text, candidate.key_column, 5);
    report.candidateTotal = probeNew.ok ? probeNew.total : -1;
    report.population = population;

    var bestNear = null;
    var bestDiff = -1;
    for (var m = 0; m < l3candidates.length; m++) {
      var old = l3candidates[m].frag;
      var diff = _symmetricDiffCount(candidate.sql_text, old.sql_text, candidate.key_column);
      report.l3.push({ id: old.id, name: old.name, symmetricDiff: diff });
      if (diff === 0) {
        return {
          verdict: "equivalent",
          matches: [old],
          scores: report,
          reuse: old
        };
      }
      if (diff >= 0 && (bestDiff < 0 || diff < bestDiff)) {
        bestDiff = diff;
        bestNear = old;
      }
    }

    if (bestNear && bestDiff >= 0 && population > 0) {
      var ratio = bestDiff / population;
      report.nearRatio = ratio;
      if (ratio > 0 && ratio < nearThreshold) {
        var explanation = _explainNear(candidate, bestNear, bestDiff);
        report.explanation = explanation;
        return {
          verdict: "near",
          matches: [bestNear],
          scores: report,
          symmetricDiff: bestDiff,
          explanation: explanation
        };
      }
    }

    // population=0 → 비율 임계를 계산할 수 없으므로 사람 판단으로 넘긴다.
    if (bestNear && bestDiff >= 0 && population <= 0) {
      return {
        verdict: "near",
        matches: [bestNear],
        scores: report,
        symmetricDiff: bestDiff,
        delegateHuman: true
      };
    }

    if (bestDiff < 0) {
      return {
        verdict: "near",
        matches: bestNear ? [bestNear] : [],
        scores: report,
        symmetricDiff: bestDiff,
        delegateHuman: true
      };
    }

    return { verdict: "novel", matches: [], scores: report };
  }

  return { check: check, tokensOf: tokensOf, jaccard: jaccard };
})();
