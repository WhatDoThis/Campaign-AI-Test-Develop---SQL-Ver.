/*
 * testWooMatch.js (조건 매칭 엔진)
 * ==================================================
 * litmus 동기 __v=163. load 시 getConfig 미호출 · 런타임 _jaccardThreshold.
 * dedup=Jaccard≥0.9(name 집합). discover=값복합키 SAME/CONFLICT/MISSING.
 * UI 단정·Option ON은 Studio — 본 모듈은 판정만.
 *
 * [Main Functions]
 * ===========
 * - matchByPlan — plan+mode → 매칭 후보 목록
 * - comparePlansByValue — 두 plan 값키 대조표
 * - fragmentNameSetFromUsed — used_fragments→name Set
 * - fragmentNameSetFromPlan — plan→name Set
 * - valueKeySetFromPlan — plan→값복합키 Set
 * - jaccard — 두 name Set Jaccard
 * - containment — |Q∩X|/|Q| 비율(보조 지표)
 * - MATCH_KEY — 집합 키 상수("name")
 * - JACCARD_THRESHOLD — dedup 임계(0.9)
 * - DISCOVER_TOP_N — discover Top-N(10)
 *
 * [Dependencies]
 * =========
 * - testWoo.repo.listAiSqlForMatch — @plan_json·@sql_query 조회
 * - testWoo.wfClone.resolveWorkflowsByName — WKF·캠페인 메타
 * - testWoo.compiler.collectUsedFragments — used 없을 때 plan 파생
 * - testWoo.lifecycle.sqlContentHash — 동일 SQL 배지
 *
 * [Invariants]
 * =========
 * - dedup은 name-only Jaccard — 값·임베딩 미사용
 * - discover CONFLICT 1건이면 후보 제외 · 범위·레거시(값없음) 제외
 */
var testWoo = testWoo || {};
testWoo.match = (function () {
  "use strict";

  /** 집합 키: fragment.name (dedup 불변 · 삭제 금지) */
  var MATCH_KEY = "name";

  function _matchCfg() {
    var m = null;
    try {
      if (testWoo.cfg && testWoo.cfg.getConfig) m = testWoo.cfg.getConfig().match;
    } catch (eC) {}
    if (m) return m;
    try {
      if (testWoo.env && testWoo.env.getEnv) m = testWoo.env.getEnv().match;
    } catch (eE) {}
    return m || {};
  }

  function _jaccardThreshold() {
    var m = _matchCfg();
    var n = Number(m.jaccardThreshold);
    if (isNaN(n) || n < 0) return 0.9;
    return n;
  }

  function _matchSqlLimit() {
    var m = _matchCfg();
    var n = parseInt(m.sqlLimit, 10);
    if (isNaN(n) || n <= 0) return 500;
    return n;
  }

  function _discoverTopN() {
    var m = _matchCfg();
    var n = parseInt(m.discoverTopN, 10);
    if (isNaN(n) || n <= 0) return 10;
    return n;
  }

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
        var fn = _fragNameFromItem(any[a]);
        if (fn) set[fn] = true;
      }
    }
    var ex = plan.exclude || [];
    for (var e = 0; e < ex.length; e++) {
      var en = _fragNameFromItem(ex[e]);
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

  function _paramsDisplay(params) {
    if (!params || typeof params !== "object") return "";
    var keys = [];
    for (var k in params) {
      if (params.hasOwnProperty(k)) keys.push(String(k));
    }
    keys.sort();
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
      var v = params[keys[i]];
      if (_isArray(v)) parts.push(keys[i] + "=" + v.join(","));
      else parts.push(keys[i] + "=" + String(v));
    }
    return parts.join(" ");
  }

  function _paramsHasRange(params) {
    if (!params || typeof params !== "object") return false;
    var hasMin = false;
    var hasMax = false;
    for (var k in params) {
      if (!params.hasOwnProperty(k)) continue;
      var lk = String(k).toLowerCase();
      if (lk === "min") hasMin = true;
      if (lk === "max") hasMax = true;
    }
    return hasMin && hasMax;
  }

  function _paramsHasValue(params) {
    var n = _paramsNorm(params);
    return n.length > 0;
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
      if (!_paramsHasValue(item.params || {})) return;
      var ck = _compositeKey(n, item.params || {});
      if (ck) set[ck] = true;
    });
    return set;
  }

  /**
   * #154: plan → { byName, hasRange, valuedCount }
   * byName[frag] = { norm, display, label, hasRange }
   */
  function _fragValueMapFromPlan(plan) {
    var byName = {};
    var hasRange = false;
    var valuedCount = 0;
    _walkPlanItems(plan, function (item) {
      var n = _fragNameFromItem(item);
      if (!n) return;
      var params = item.params || {};
      if (_paramsHasRange(params)) hasRange = true;
      if (!_paramsHasValue(params)) return;
      byName[n] = {
        norm: _paramsNorm(params),
        display: _paramsDisplay(params),
        label: _trim(item.label) || n,
        hasRange: _paramsHasRange(params)
      };
      valuedCount++;
    });
    return { byName: byName, hasRange: hasRange, valuedCount: valuedCount };
  }

  /**
   * #154: SAME / CONFLICT / MISSING
   * CONFLICT≥1 → 목록 제외(호출측).
   */
  function comparePlansByValue(mapQ, mapX) {
    var compare = [];
    var same = 0;
    var conflict = 0;
    var missing = 0;
    var q = (mapQ && mapQ.byName) || {};
    var x = (mapX && mapX.byName) || {};
    for (var qn in q) {
      if (!q.hasOwnProperty(qn)) continue;
      var qe = q[qn];
      if (!x[qn]) {
        missing++;
        compare.push({
          name: qn,
          label: qe.label || qn,
          queryValue: qe.display || "",
          candidateValue: "",
          status: "MISSING"
        });
      } else if (String(x[qn].norm) === String(qe.norm)) {
        same++;
        compare.push({
          name: qn,
          label: qe.label || qn,
          queryValue: qe.display || "",
          candidateValue: x[qn].display || "",
          status: "SAME"
        });
      } else {
        conflict++;
        compare.push({
          name: qn,
          label: qe.label || qn,
          queryValue: qe.display || "",
          candidateValue: x[qn].display || "",
          status: "CONFLICT"
        });
      }
    }
    var extra = 0;
    for (var xn in x) {
      if (!x.hasOwnProperty(xn)) continue;
      if (!q[xn]) extra++;
    }
    return {
      same: same,
      conflict: conflict,
      missing: missing,
      extra: extra,
      compare: compare
    };
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
      if (x.isIdentical && !y.isIdentical) return -1;
      if (!x.isIdentical && y.isIdentical) return 1;
      var xs = x.sameCount != null ? x.sameCount : 0;
      var ys = y.sameCount != null ? y.sameCount : 0;
      if (ys !== xs) return ys - xs;
      var xe = x.extraCount != null ? x.extraCount : 0;
      var ye = y.extraCount != null ? y.extraCount : 0;
      if (xe !== ye) return xe - ye;
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
      /* orphan: ACC에서 삭제된 WKF — Match 후보 제외 */
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
        isIdentical: !!sc.isIdentical,
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
      if (sc.compare) row.compare = sc.compare;
      if (sc.sameCount != null) {
        row.sameCount = sc.sameCount;
        row.conflictCount = sc.conflictCount;
        row.missingCount = sc.missingCount;
        row.extraCount = sc.extraCount;
        row.queryCount = sc.queryCount;
        row.candidateCount = sc.candidateCount;
        row.intersectionCount = sc.sameCount;
        row.containment =
          sc.queryCount > 0
            ? _round4(sc.sameCount / sc.queryCount)
            : 0;
      }
      if (sc.nameContainment != null) {
        row.nameContainment = sc.nameContainment;
        row.valueContainment = sc.valueContainment;
      }
      items.push(row);
    }
    return items;
  }

  function _loadSqlRows() {
    if (!testWoo.repo || !testWoo.repo.listAiSqlForMatch) {
      throw new Error("[testWoo.match.matchByPlan] repo.listAiSqlForMatch missing");
    }
    return testWoo.repo.listAiSqlForMatch(_matchSqlLimit());
  }

  function _querySqlHash(plan) {
    if (!plan || !testWoo.compiler || !testWoo.lifecycle) return "";
    try {
      var compiled = testWoo.compiler.compile(plan);
      return String(testWoo.lifecycle.sqlContentHash(compiled.sql) || "");
    } catch (eH) {
      return "";
    }
  }

  // 4a. dedup — Jaccard≥0.9 유지 · #154: sqlContentHash exact를 1순위로 표기
  function _matchDedup(plan, campaignId, opts) {
    var threshold =
      opts && opts.threshold != null
        ? Number(opts.threshold)
        : _jaccardThreshold();
    if (isNaN(threshold) || threshold < 0) threshold = _jaccardThreshold();

    var setA = fragmentNameSetFromPlan(plan);
    var queryCount = _setSize(setA);
    var sqlHashWant = _querySqlHash(plan);
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
          sqlExact: false,
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
      if (
        sqlHashWant &&
        testWoo.lifecycle &&
        testWoo.lifecycle.sqlContentHash &&
        row.sql_query
      ) {
        try {
          var rh = testWoo.lifecycle.sqlContentHash(String(row.sql_query));
          if (rh === sqlHashWant) {
            byWf[wname].sqlExact = true;
            byWf[wname].ai_sql_id = row.id;
            if (_trim(row.nl_request)) {
              byWf[wname].nl_request = _trim(row.nl_request);
            }
          }
        } catch (eSql) {}
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
      /* #154: SQL 해시 일치를 exact 1순위 · Jaccard는 보조 통과 */
      var exact = !!(
        byWf[wn].sqlExact ||
        byWf[wn].compileExact ||
        setEq
      );
      if (!exact && jac.jaccard < threshold) continue;
      scored.push({
        name: wn,
        jaccard: _round4(jac.jaccard),
        overlapCount: jac.overlapCount,
        unionCount: jac.unionCount,
        exact: exact,
        isIdentical: !!byWf[wn].sqlExact,
        nl_request: byWf[wn].nl_request || "",
        ai_sql_id: byWf[wn].ai_sql_id || 0,
        matchLabel: byWf[wn].sqlExact
          ? "\uB3D9\uC77C SQL"
          : "\uC870\uAC74 " +
            jac.unionCount +
            "\uAC1C \uC911 " +
            jac.overlapCount +
            "\uAC1C \uB3D9\uC77C(name)"
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

  // 4b. discover — #154 값 복합키 · CONFLICT 배제 · Top-10
  function _matchDiscover(plan, campaignId, opts) {
    var mapQ = _fragValueMapFromPlan(plan);
    var setQName = fragmentNameSetFromPlan(plan);
    var rows = _loadSqlRows();
    var byWf = {};
    var sqlHashWant = _querySqlHash(plan);

    /* 값 없는 질의 · 범위형 질의 → 빈 목록(오탐 방지) */
    if (mapQ.valuedCount < 1 || mapQ.hasRange) {
      return {
        items: [],
        count: 0,
        threshold: 0,
        matchKey: "value",
        queryFragmentCount: _setSize(setQName),
        queryValueCount: mapQ.valuedCount,
        scope: "global",
        mode: "discover",
        topN: _discoverTopN(),
        campaign_id: _trim(campaignId),
        excludedReason: mapQ.hasRange ? "range_query" : "no_values"
      };
    }

    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri];
      var wname = _trim(row.workflow_name);
      if (!wname) continue;
      if (!byWf[wname]) {
        byWf[wname] = {
          map: null,
          hasPlanJson: false,
          sql_query: "",
          nl_request: _trim(row.nl_request) || _trim(row.title),
          ai_sql_id: row.id
        };
      }
      var pj = _parsePlanJson(row.plan_json);
      if (pj) {
        byWf[wname].hasPlanJson = true;
        byWf[wname].map = _fragValueMapFromPlan(pj);
      }
      if (row.sql_query) byWf[wname].sql_query = String(row.sql_query);
      if (!byWf[wname].nl_request && _trim(row.nl_request)) {
        byWf[wname].nl_request = _trim(row.nl_request);
        byWf[wname].ai_sql_id = row.id;
      }
    }

    var scored = [];
    for (var wn in byWf) {
      if (!byWf.hasOwnProperty(wn)) continue;
      var bucket = byWf[wn];
      /* 레거시: plan_json 없음 · 값 없음 → 제외 */
      if (!bucket.hasPlanJson || !bucket.map || bucket.map.valuedCount < 1) {
        continue;
      }
      /* 범위형 후보 제외 (#153 V5) */
      if (bucket.map.hasRange) continue;

      var cmp = comparePlansByValue(mapQ, bucket.map);
      if (cmp.conflict > 0) continue;
      if (cmp.same < 1) continue;

      var isId = false;
      if (
        sqlHashWant &&
        bucket.sql_query &&
        testWoo.lifecycle &&
        testWoo.lifecycle.sqlContentHash
      ) {
        try {
          isId =
            testWoo.lifecycle.sqlContentHash(bucket.sql_query) === sqlHashWant;
        } catch (eId) {
          isId = false;
        }
      }

      var nameSetX = {};
      for (var xn in bucket.map.byName) {
        if (bucket.map.byName.hasOwnProperty(xn)) nameSetX[xn] = true;
      }
      var jac = jaccard(setQName, nameSetX);
      var nCont = containment(setQName, nameSetX);
      var valueCont =
        mapQ.valuedCount > 0 ? cmp.same / mapQ.valuedCount : 0;

      scored.push({
        name: wn,
        jaccard: _round4(jac.jaccard),
        overlapCount: jac.overlapCount,
        unionCount: jac.unionCount,
        exact: isId,
        isIdentical: isId,
        sameCount: cmp.same,
        conflictCount: cmp.conflict,
        missingCount: cmp.missing,
        extraCount: cmp.extra,
        queryCount: mapQ.valuedCount,
        candidateCount: bucket.map.valuedCount,
        compare: cmp.compare,
        nameContainment: _round4(nCont.containment),
        valueContainment: _round4(valueCont),
        nl_request: bucket.nl_request || "",
        ai_sql_id: bucket.ai_sql_id || 0,
        /* 단정형 "포함" 금지 — UI는 compare[] 사용 */
        matchLabel: isId
          ? "\uB3D9\uC77C"
          : "\uC77C\uCE58 " + cmp.same + " / \uC5C6\uC74C " + cmp.missing
      });
    }

    var items = _enrichItems(scored);
    _sortDiscover(items);
    if (items.length > _discoverTopN()) {
      items = items.slice(0, _discoverTopN());
    }

    return {
      items: items,
      count: items.length,
      threshold: 0,
      matchKey: "value",
      queryFragmentCount: _setSize(setQName),
      queryValueCount: mapQ.valuedCount,
      scope: "global",
      mode: "discover",
      topN: _discoverTopN(),
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
    /* load 시 getConfig 호출 금지 — libVersions·구 Env 에서도 모듈 로드 (#427) */
    JACCARD_THRESHOLD: 0.9,
    DISCOVER_TOP_N: 10,
    fragmentNameSetFromUsed: fragmentNameSetFromUsed,
    fragmentNameSetFromPlan: fragmentNameSetFromPlan,
    valueKeySetFromPlan: valueKeySetFromPlan,
    comparePlansByValue: comparePlansByValue,
    jaccard: jaccard,
    containment: containment,
    matchByPlan: matchByPlan
  };
})();
testWoo.match.__v = "163";
