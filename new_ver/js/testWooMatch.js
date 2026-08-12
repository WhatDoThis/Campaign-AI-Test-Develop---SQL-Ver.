/*
 * testWooMatch.js (조건 매칭 · dedup=Jaccard / discover=valueContainment)
 * =====================================================================
 * FLOW-5-3: dedup 모드 Jaccard ≥ 0.9 (텍스트 유사도/임베딩 금지). MATCH_KEY=name.
 * #146/#147: discover = valueKey(name=정규화params) containment == 1.0 만 통과.
 *            name-only 폴백 금지. dedup 키·임계 불변.
 *
 * [Main Functions]
 * ===========
 * - fragmentNameSetFromUsed / fragmentNameSetFromPlan / valueKeySetFromPlan
 * - jaccard / containment / matchByPlan
 *
 * [Dependencies]
 * =========
 * - testWoo.repo.listAiSqlForMatch (@plan_json 필수 · discover)
 * - testWoo.wfClone.resolveWorkflowsByName
 * - testWoo.compiler.collectUsedFragments (선택)
 * - loadLibrary("woo:testWooMatch.js")
 *
 * Refs: http://www.vldb.org/pvldb/vol9/p1185-zhu.pdf
 *       https://ekzhu.com/datasketch/lshensemble.html
 */
var testWoo = testWoo || {};
testWoo.match = (function () {
  "use strict";

  /** 집합 키: fragment.name (dedup 불변) */
  var MATCH_KEY = "name";
  /** Jaccard 임계 — dedup 전용 · 변경 금지 */
  var JACCARD_THRESHOLD = 0.9;
  var MATCH_SQL_LIMIT = 500;
  /** discover Top-N */
  var DISCOVER_TOP_N = 20;

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  function _isArray(x) {
    return Object.prototype.toString.call(x) === "[object Array]";
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

  function _parsePlanJson(raw) {
    if (!raw) return null;
    if (typeof raw === "object" && raw.include != null) return raw;
    try {
      return JSON.parse(String(raw));
    } catch (e) {
      return null;
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

  function _normValue(v) {
    if (v === true) return "1";
    if (v === false) return "0";
    if (v == null) return "";
    if (_isArray(v)) {
      var parts = [];
      for (var i = 0; i < v.length; i++) parts.push(_normValue(v[i]));
      parts.sort();
      return parts.join(",");
    }
    if (typeof v === "number") {
      if (isNaN(v)) return "";
      return String(v);
    }
    return _trim(String(v)).toLowerCase();
  }

  function _paramsNorm(params) {
    if (!params || typeof params !== "object") return "";
    var keys = [];
    for (var k in params) {
      if (params.hasOwnProperty(k)) keys.push(String(k));
    }
    keys.sort();
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
      parts.push(keys[i] + ":" + _normValue(params[keys[i]]));
    }
    return parts.join("|");
  }

  // discover 전용: name=정규화params
  function _compositeKey(fragName, params) {
    var n = _trim(fragName);
    if (!n) return "";
    return n + "=" + _paramsNorm(params);
  }

  function _fragNameFromItem(item) {
    if (!item) return "";
    var n = _trim(item.fragment != null ? item.fragment : "");
    if (n) return n;
    return _trim(item.name != null ? item.name : "");
  }

  function _walkPlanItems(plan, fn) {
    if (!plan) return;
    var inc = plan.include || [];
    for (var g = 0; g < inc.length; g++) {
      var any = (inc[g] && inc[g].any) || [];
      for (var a = 0; a < any.length; a++) fn(any[a]);
    }
    var ex = plan.exclude || [];
    for (var e = 0; e < ex.length; e++) fn(ex[e]);
  }

  function valueKeySetFromPlan(plan) {
    var set = {};
    _walkPlanItems(plan, function (item) {
      var n = _fragNameFromItem(item);
      if (!n) return;
      var ck = _compositeKey(n, item.params || {});
      if (ck) set[ck] = true;
    });
    return set;
  }

  function _round4(x) {
    return Math.round(Number(x) * 10000) / 10000;
  }

  // 3. Jaccard = |A∩B| / |A∪B| (빈 집합이면 0) — 삭제·시그니처 변경 금지
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

  // 3b. containment = |Q∩X| / |Q|  (Q=질의 집합)
  function containment(setQ, setX) {
    var q = setQ || {};
    var x = setX || {};
    var queryCount = _setSize(q);
    var candidateCount = _setSize(x);
    var intersectionCount = 0;
    for (var k in q) {
      if (!q.hasOwnProperty(k)) continue;
      if (x[k]) intersectionCount++;
    }
    var c = 0;
    if (queryCount > 0) c = intersectionCount / queryCount;
    return {
      containment: c,
      intersectionCount: intersectionCount,
      queryCount: queryCount,
      candidateCount: candidateCount
    };
  }

  function _sortDedup(items) {
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

  function _sortDiscover(items) {
    items.sort(function (x, y) {
      var xv = x.valueContainment != null ? x.valueContainment : 0;
      var yv = y.valueContainment != null ? y.valueContainment : 0;
      if (yv !== xv) return yv - xv;
      var xnC = x.nameContainment != null ? x.nameContainment : 0;
      var ynC = y.nameContainment != null ? y.nameContainment : 0;
      if (ynC !== xnC) return ynC - xnC;
      var xn = String(x.name || "");
      var yn = String(y.name || "");
      if (xn < yn) return -1;
      if (xn > yn) return 1;
      return 0;
    });
  }

  function _enrichItems(scored) {
    var candidateNames = [];
    for (var i = 0; i < scored.length; i++) {
      candidateNames.push(scored[i].name);
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
          logWarning("[testWoo.match] resolve: " + eR);
        } catch (eL2) {}
        wfMeta = {};
      }
    }
    var items = [];
    for (var si = 0; si < scored.length; si++) {
      var sc = scored[si];
      var meta = wfMeta[sc.name] || null;
      if (!meta || !meta.id) continue;
      var row = {
        id: String(meta.id),
        name: String(meta.name || sc.name),
        label: String(meta.label || sc.name),
        locked: !!meta.locked,
        locked_by: String(meta.locked_by || ""),
        jaccard: sc.jaccard,
        overlapCount: sc.overlapCount,
        unionCount: sc.unionCount,
        exact: !!sc.exact,
        matchLabel: sc.matchLabel || "",
        nl_request: sc.nl_request || "",
        ai_sql_id: sc.ai_sql_id || 0,
        campaign_id: String(meta.campaign_id || ""),
        campaign_name: String(meta.campaign_name || ""),
        campaign_label: String(meta.campaign_label || ""),
        program_id: String(meta.program_id || ""),
        program_name: String(meta.program_name || ""),
        program_label: String(meta.program_label || "")
      };
      if (sc.containment != null) {
        row.containment = sc.containment;
        row.intersectionCount = sc.intersectionCount;
        row.queryCount = sc.queryCount;
        row.candidateCount = sc.candidateCount;
        row.nameContainment = sc.nameContainment;
        row.valueContainment = sc.valueContainment;
        row.valueIntersectionCount = sc.valueIntersectionCount;
        row.valueQueryCount = sc.valueQueryCount;
      }
      items.push(row);
    }
    return items;
  }

  function _loadSqlRows() {
    if (!testWoo.repo || !testWoo.repo.listAiSqlForMatch) {
      throw new Error("[testWoo.match.matchByPlan] repo.listAiSqlForMatch missing");
    }
    return testWoo.repo.listAiSqlForMatch(MATCH_SQL_LIMIT);
  }

  // 4a. dedup — 변경 전과 동일 동작 (Jaccard≥0.9)
  function _matchDedup(plan, campaignId, opts) {
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

    var rows = _loadSqlRows();
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
      scored.push({
        name: wn,
        jaccard: _round4(jac.jaccard),
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

    var items = _enrichItems(scored);
    _sortDedup(items);

    return {
      items: items,
      count: items.length,
      threshold: threshold,
      matchKey: MATCH_KEY,
      queryFragmentCount: queryCount,
      scope: "global",
      mode: "dedup",
      campaign_id: _trim(campaignId)
    };
  }

  // 4b. discover — valueKey containment==1.0 만 (#147 · name-only 폴백 금지)
  function _matchDiscover(plan, campaignId, opts) {
    var setQName = fragmentNameSetFromPlan(plan);
    var setQVal = valueKeySetFromPlan(plan);
    var rows = _loadSqlRows();
    var byWf = {};

    if (_setSize(setQVal) < 1) {
      return {
        items: [],
        count: 0,
        threshold: 1,
        matchKey: "value",
        queryFragmentCount: _setSize(setQName),
        queryValueCount: 0,
        scope: "global",
        mode: "discover",
        topN: DISCOVER_TOP_N,
        campaign_id: _trim(campaignId)
      };
    }

    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri];
      var wname = _trim(row.workflow_name);
      if (!wname) continue;
      if (!byWf[wname]) {
        byWf[wname] = {
          names: {},
          values: {},
          hasPlanJson: false,
          nl_request: _trim(row.nl_request) || _trim(row.title),
          ai_sql_id: row.id
        };
      }
      var part = fragmentNameSetFromUsed(row.used_fragments);
      for (var pk in part) {
        if (part.hasOwnProperty(pk)) byWf[wname].names[pk] = true;
      }
      var pj = _parsePlanJson(row.plan_json);
      if (pj) {
        byWf[wname].hasPlanJson = true;
        var vset = valueKeySetFromPlan(pj);
        for (var vk in vset) {
          if (vset.hasOwnProperty(vk)) byWf[wname].values[vk] = true;
        }
        var nFromPlan = fragmentNameSetFromPlan(pj);
        for (var nk in nFromPlan) {
          if (nFromPlan.hasOwnProperty(nk)) byWf[wname].names[nk] = true;
        }
      }
      if (!byWf[wname].nl_request && _trim(row.nl_request)) {
        byWf[wname].nl_request = _trim(row.nl_request);
        byWf[wname].ai_sql_id = row.id;
      }
    }

    var scored = [];
    for (var wn in byWf) {
      if (!byWf.hasOwnProperty(wn)) continue;
      /* plan_json 없거나 value 집합 비면 제외 — name-only 오매칭 방지 */
      if (!byWf[wn].hasPlanJson || _setSize(byWf[wn].values) < 1) continue;
      var setXName = byWf[wn].names;
      var setXVal = byWf[wn].values;
      var vCont = containment(setQVal, setXVal);
      if (vCont.queryCount < 1 || vCont.containment < 1) continue;
      var nCont = containment(setQName, setXName);
      var jac = jaccard(setQName, setXName);
      scored.push({
        name: wn,
        jaccard: _round4(jac.jaccard),
        overlapCount: jac.overlapCount,
        unionCount: jac.unionCount,
        exact: false,
        /* UI 카운트 = value 기준 (#147) */
        containment: _round4(vCont.containment),
        intersectionCount: vCont.intersectionCount,
        queryCount: vCont.queryCount,
        candidateCount: vCont.candidateCount,
        nameContainment: _round4(nCont.containment),
        valueContainment: _round4(vCont.containment),
        valueIntersectionCount: vCont.intersectionCount,
        valueQueryCount: vCont.queryCount,
        nl_request: byWf[wn].nl_request || "",
        ai_sql_id: byWf[wn].ai_sql_id || 0,
        matchLabel:
          "\uB0B4 \uC870\uAC74 " +
          vCont.queryCount +
          "\uAC1C \uC911 " +
          vCont.intersectionCount +
          "\uAC1C \uD3EC\uD568"
      });
    }

    var items = _enrichItems(scored);
    _sortDiscover(items);
    if (items.length > DISCOVER_TOP_N) {
      items = items.slice(0, DISCOVER_TOP_N);
    }

    return {
      items: items,
      count: items.length,
      threshold: 1,
      matchKey: "value",
      queryFragmentCount: _setSize(setQName),
      queryValueCount: _setSize(setQVal),
      scope: "global",
      mode: "discover",
      topN: DISCOVER_TOP_N,
      campaign_id: _trim(campaignId)
    };
  }

  // 4. plan → 전역 매칭 (opts.mode: dedup|discover)
  function matchByPlan(plan, campaignId, opts) {
    var o = opts || {};
    var mode = _trim(o.mode || "dedup").toLowerCase();
    if (mode !== "discover") mode = "dedup";
    if (mode === "discover") return _matchDiscover(plan, campaignId, o);
    return _matchDedup(plan, campaignId, o);
  }

  return {
    MATCH_KEY: MATCH_KEY,
    JACCARD_THRESHOLD: JACCARD_THRESHOLD,
    DISCOVER_TOP_N: DISCOVER_TOP_N,
    fragmentNameSetFromUsed: fragmentNameSetFromUsed,
    fragmentNameSetFromPlan: fragmentNameSetFromPlan,
    valueKeySetFromPlan: valueKeySetFromPlan,
    jaccard: jaccard,
    containment: containment,
    matchByPlan: matchByPlan
  };
})();
