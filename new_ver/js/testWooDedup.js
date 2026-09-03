/*
 * testWooDedup.js (Fragment 중복 판정)
 * ==================================================
 * litmus 동기 __v=161 (#455 embedding L2 제거 — L0·L1·L3 dedup).
 * Foundry publish 전 후보 SQL을 기존 fragment와 L0~L3 단계로 비교.
 * near 비율 분모는 모집단 COUNT, 후보 row 수가 아니다.
 * L3/probe 샘플 바인딩은 fragContract.sampleBindSql 유일 구현.
 *
 * [Main Functions]
 * ===========
 * - check — 후보 → {verdict, matches, scores, symmetricDiff, delegateHuman, reuse}
 * - tokensOf — SQL 정규화 토큰 집합
 * - jaccard — 두 토큰 집합 Jaccard 유사도
 *
 * [Dependencies]
 * =========
 * - testWoo.fragContract.sampleBindSql — {{param}} 타입 인지 샘플 치환 (#172)
 * - testWoo.lifecycle — normalizeSql·contentHash
 * - testWoo.probe — L3 set equivalence 실행
 * - testWoo.llm — near 차이 설명(L4)
 * - testWoo.cfg — foundry.dedup 임계·populationCountSql
 * - sqlGetInt — 모집단 COUNT
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

  function _sampleBindSql(sqlText, domainRaw) {
    if (testWoo.fragContract && testWoo.fragContract.sampleBindSql)
      return testWoo.fragContract.sampleBindSql(sqlText, domainRaw);
    if (testWoo.fragContract && testWoo.fragContract.logCode)
      testWoo.fragContract.logCode("DEDUP_ASYMMETRIC", "fragContract missing");
    return String(sqlText || "").replace(/\{\{\w+\}\}/g, "'__sample__'");
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
          <node expr="@param_domain"/>
          <node expr="@content_hash"/><node expr="@status"/><node expr="@is_current"/>
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
        param_domain: String(r.@param_domain || ""),
        content_hash: String(r.@content_hash),
        status: String(r.@status)
      };
      if (!row.param_domain && testWoo.fragContract && testWoo.fragContract.logCode)
        testWoo.fragContract.logCode("DEDUP_ASYMMETRIC", "peer " + row.name + " empty param_domain");
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

    // L1 Jaccard 순 → L3 (L2 embedding 제거 #455 — verdict는 L0·L3만 결정)
    var l3candidates = [];
    for (var lj = 0; lj < l1top.length && l3candidates.length < 3; lj++) {
      l3candidates.push({ frag: l1top[lj].frag, l1: l1top[lj].score, l2: 0 });
    }

    var cfg = testWoo.cfg.getConfig();
    var nearThreshold = cfg.foundry.dedupNearThreshold || 0.01;
    var population = _population();
    // {{param}} 템플릿은 PG에서 문법 오류 → 샘플 바인딩 후 probe/L3
    var candSql = _sampleBindSql(candidate.sql_text, candidate.param_domain);
    if (candSql.indexOf("{{") >= 0) {
      logWarning("[testWoo.dedup] candidate still has placeholders after sampleBind — force literal");
      candSql = candSql.replace(/\{\{\w+\}\}/g, "'__sample__'");
    }
    // probeNew는 후보 SQL 자체 검증용 — population 분모로 쓰지 않는다.
    var probeNew = testWoo.probe.run(candSql, candidate.key_column, 5);
    report.candidateTotal = probeNew.ok ? probeNew.total : -1;
    report.population = population;
    report.sampleBound = true;

    var bestNear = null;
    var bestDiff = -1;
    for (var m = 0; m < l3candidates.length; m++) {
      var old = l3candidates[m].frag;
      var oldSql = _sampleBindSql(old.sql_text, old.param_domain);
      if (oldSql.indexOf("{{") >= 0)
        oldSql = oldSql.replace(/\{\{\w+\}\}/g, "'__sample__'");
      var diff = _symmetricDiffCount(candSql, oldSql, candidate.key_column);
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

    // L3 SQL 실패(diff<0)를 near로 위장하면 {{param}} 미바인딩·일시 오류가
    // "near dedup — active 등록" 으로 둔갑한다. 실패는 novel(신규 허용)로 둔다.
    if (bestDiff < 0) {
      report.l3Unverifiable = true;
      return {
        verdict: "novel",
        matches: [],
        scores: report,
        symmetricDiff: bestDiff
      };
    }

    return { verdict: "novel", matches: [], scores: report };
  }

  return { check: check, tokensOf: tokensOf, jaccard: jaccard };
})();
testWoo.dedup.__v = "161";
