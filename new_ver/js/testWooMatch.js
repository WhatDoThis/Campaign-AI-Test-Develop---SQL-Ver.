/*
 * testWooMatch.js (조건 매칭 · fragment 집합 Jaccard · 전역)
 * ==========================================================
 * NL plan의 fragment name 집합과 등록 SQL used_fragments 집합을 비교한다.
 * FLOW-5-3: Jaccard ≥ 0.9 (텍스트 유사도/임베딩 금지). MATCH_KEY = fragment.name.
 * 5차 보완: 캠페인 스코프 제거 — 전체 registered SQL에서 WKF 매칭 후
 *          WKF·캠페인·Program·nl_request 메타를 enrichment.
 *
 * [Main Functions]
 * ===========
 * - fragmentNameSetFromUsed / fragmentNameSetFromPlan
 * - jaccard / matchByPlan
 *
 * [Dependencies]
 * =========
 * - testWoo.repo.listAiSqlForMatch
 * - testWoo.wfClone.resolveWorkflowsByName
 * - testWoo.compiler.collectUsedFragments (선택)
 * - loadLibrary("woo:testWooMatch.js")
 */
var testWoo = testWoo || {};
testWoo.match = (function () {
  "use strict";

  /** 집합 키: fragment.name (TBD §12 고정) */
  var MATCH_KEY = "name";
  /** Jaccard 임계 — 미만은 목록 제외 */
  var JACCARD_THRESHOLD = 0.9;
  var MATCH_SQL_LIMIT = 500;

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  function _parseUsed(raw) {
    if (raw == null) return [];
    if (typeof raw === "object" && raw.length != null) return raw;
    try {
      var a = JSON.parse(String(raw || "[]"));
      return a && a.length != null ? a : [];
    } catch (e) {
      return [];
    }
  }

  // 1. used_fragments → name 집합(object map)
  function fragmentNameSetFromUsed(usedJsonOrArr) {
    var arr = _parseUsed(usedJsonOrArr);
    var set = {};
    for (var i = 0; i < arr.length; i++) {
      var n = _trim(arr[i] && arr[i].name != null ? arr[i].name : "");
      if (n) set[n] = true;
    }
    return set;
  }

  // 2. plan → name 집합 (compiler 우선, 없으면 include/exclude 순회)
  function fragmentNameSetFromPlan(plan) {
    if (!plan) return {};
    if (testWoo.compiler && testWoo.compiler.collectUsedFragments) {
      try {
        var used = testWoo.compiler.collectUsedFragments(plan);
        return fragmentNameSetFromUsed(used);
      } catch (eC) {
        try {
          logWarning("[testWoo.match.fragmentNameSetFromPlan] collect: " + eC);
        } catch (eL) {}
      }
    }
    var set = {};
    var inc = plan.include || [];
    for (var g = 0; g < inc.length; g++) {
      var any = (inc[g] && inc[g].any) || [];
      for (var a = 0; a < any.length; a++) {
        var fn = _trim(any[a] && any[a].name != null ? any[a].name : "");
        if (fn) set[fn] = true;
      }
    }
    var ex = plan.exclude || [];
    for (var e = 0; e < ex.length; e++) {
      var en = _trim(ex[e] && ex[e].name != null ? ex[e].name : "");
      if (en) set[en] = true;
    }
    return set;
  }

  function _setSize(set) {
    var n = 0;
    for (var k in set) {
      if (set.hasOwnProperty(k)) n++;
    }
    return n;
  }

  // 3. Jaccard = |A∩B| / |A∪B| (빈 집합이면 0)
  function jaccard(setA, setB) {
    var a = setA || {};
    var b = setB || {};
    var overlap = 0;
    var union = 0;
    var seen = {};
    for (var ka in a) {
      if (!a.hasOwnProperty(ka)) continue;
      union++;
      seen[ka] = true;
      if (b[ka]) overlap++;
    }
    for (var kb in b) {
      if (!b.hasOwnProperty(kb)) continue;
      if (!seen[kb]) union++;
    }
    var j = 0;
    if (union > 0) j = overlap / union;
    return {
      jaccard: j,
      overlapCount: overlap,
      unionCount: union
    };
  }

  function _sortMatches(items) {
    items.sort(function (x, y) {
      if (x.exact && !y.exact) return -1;
      if (!x.exact && y.exact) return 1;
      if (y.jaccard !== x.jaccard) return y.jaccard - x.jaccard;
      var xn = String(x.name || "");
      var yn = String(y.name || "");
      if (xn < yn) return -1;
      if (xn > yn) return 1;
      return 0;
    });
  }

  // 4. plan → 전역 매칭 WKF 목록 (campaignId는 생성 대상 힌트만, 필터 아님)
  function matchByPlan(plan, campaignId, opts) {
    var threshold =
      opts && opts.threshold != null
        ? Number(opts.threshold)
        : JACCARD_THRESHOLD;
    if (isNaN(threshold) || threshold < 0) threshold = JACCARD_THRESHOLD;

    var setA = fragmentNameSetFromPlan(plan);
    var queryCount = _setSize(setA);
    var compileHashWant = "";
    if (plan && testWoo.compiler && testWoo.lifecycle) {
      try {
        var compiled = testWoo.compiler.compile(plan);
        compileHashWant = String(
          testWoo.lifecycle.compileHash(plan, compiled.sql) || ""
        );
      } catch (eH) {
        compileHashWant = "";
      }
    }

    if (!testWoo.repo || !testWoo.repo.listAiSqlForMatch) {
      throw new Error("[testWoo.match.matchByPlan] repo.listAiSqlForMatch missing");
    }
    var rows = testWoo.repo.listAiSqlForMatch(MATCH_SQL_LIMIT);

    var byWf = {};
    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri];
      var wname = _trim(row.workflow_name);
      if (!wname) continue;
      if (!byWf[wname]) {
        byWf[wname] = {
          names: {},
          compileExact: false,
          nl_request: _trim(row.nl_request) || _trim(row.title),
          ai_sql_id: row.id
        };
      }
      var part = fragmentNameSetFromUsed(row.used_fragments);
      for (var pk in part) {
        if (part.hasOwnProperty(pk)) byWf[wname].names[pk] = true;
      }
      if (
        compileHashWant &&
        String(row.compile_hash || "") === compileHashWant
      ) {
        byWf[wname].compileExact = true;
        if (_trim(row.nl_request)) {
          byWf[wname].nl_request = _trim(row.nl_request);
          byWf[wname].ai_sql_id = row.id;
        }
      }
    }

    var candidateNames = [];
    var scored = [];
    for (var wn in byWf) {
      if (!byWf.hasOwnProperty(wn)) continue;
      var setB = byWf[wn].names;
      var jac = jaccard(setA, setB);
      var setEq =
        queryCount > 0 &&
        jac.overlapCount === queryCount &&
        jac.unionCount === queryCount;
      var exact = !!(byWf[wn].compileExact || setEq);
      if (!exact && jac.jaccard < threshold) continue;
      candidateNames.push(wn);
      scored.push({
        name: wn,
        jaccard: Math.round(jac.jaccard * 10000) / 10000,
        overlapCount: jac.overlapCount,
        unionCount: jac.unionCount,
        exact: exact,
        nl_request: byWf[wn].nl_request || "",
        ai_sql_id: byWf[wn].ai_sql_id || 0,
        matchLabel:
          "\uC870\uAC74 " +
          jac.unionCount +
          "\uAC1C \uC911 " +
          jac.overlapCount +
          "\uAC1C \uB3D9\uC77C"
      });
    }

    var wfMeta = {};
    if (
      candidateNames.length &&
      testWoo.wfClone &&
      testWoo.wfClone.resolveWorkflowsByName
    ) {
      try {
        wfMeta = testWoo.wfClone.resolveWorkflowsByName(candidateNames);
      } catch (eR) {
        try {
          logWarning("[testWoo.match.matchByPlan] resolve: " + eR);
        } catch (eL2) {}
        wfMeta = {};
      }
    }

    var items = [];
    for (var si = 0; si < scored.length; si++) {
      var sc = scored[si];
      var meta = wfMeta[sc.name] || null;
      if (!meta || !meta.id) {
        /* 삭제된 WKF 등은 선택 불가 — 목록에서 제외 */
        continue;
      }
      items.push({
        id: String(meta.id),
        name: String(meta.name || sc.name),
        label: String(meta.label || sc.name),
        locked: !!meta.locked,
        locked_by: String(meta.locked_by || ""),
        jaccard: sc.jaccard,
        overlapCount: sc.overlapCount,
        unionCount: sc.unionCount,
        exact: sc.exact,
        matchLabel: sc.matchLabel,
        nl_request: sc.nl_request,
        ai_sql_id: sc.ai_sql_id,
        campaign_id: String(meta.campaign_id || ""),
        campaign_name: String(meta.campaign_name || ""),
        campaign_label: String(meta.campaign_label || ""),
        program_id: String(meta.program_id || ""),
        program_name: String(meta.program_name || ""),
        program_label: String(meta.program_label || "")
      });
    }
    _sortMatches(items);

    return {
      items: items,
      count: items.length,
      threshold: threshold,
      matchKey: MATCH_KEY,
      queryFragmentCount: queryCount,
      scope: "global",
      campaign_id: _trim(campaignId)
    };
  }

  return {
    MATCH_KEY: MATCH_KEY,
    JACCARD_THRESHOLD: JACCARD_THRESHOLD,
    fragmentNameSetFromUsed: fragmentNameSetFromUsed,
    fragmentNameSetFromPlan: fragmentNameSetFromPlan,
    jaccard: jaccard,
    matchByPlan: matchByPlan
  };
})();
