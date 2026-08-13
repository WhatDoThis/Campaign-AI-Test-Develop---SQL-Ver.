/*
 * testWooFragments.js (Fragment Stage A 검색)
 * ==================================================
 * litmus 동기 __v=165 (#174-4 M3 heal 시 param_domain 저장).
 * 슬롯별 후보 fragment 메타 검색. sql_text 일괄 로드 금지.
 * LIKE는 재호출망. 확정은 카탈로그 값⊂슬롯 + 축 identity.
 *
 * [Main Functions]
 * ===========
 * - getByName — name 단건 조회(sql_text 포함)
 * - toCard — fragment → UI 카드 객체
 * - searchBySlot — LIKE 재호출 + 축 폴백 항상 합침 + resolvedName
 * - searchByAxis — tags/name 축으로 후보 검색
 * - searchSlots — Pass0/렉시콘 slots[] 일괄 Stage A
 * - listLexiconCards — active 메타(sql_text 없음) 렉시콘용
 * - healDomain — 별칭·params를 param_domain에 merge하고 색인 갱신
 * - saveParamDomain — param_domain JSON만 저장(_negative·healAt)
 * - listCategories — Catalog용 category 목록
 * - clearCache — getByName 캐시 비우기
 *
 * [Dependencies]
 * =========
 * - woo:testWooAiFragment — xtk.queryDef select · xtk.session.Write(heal)
 * - testWoo.fragContract — keywordsFromSlot·axis·validateBind·attachAlias·buildIndexFields
 * - testWoo.cfg.getConfig — guard.STAGE_A_TOP_N·QUERY_PAGE_SIZE
 *
 * [Invariants]
 * ===========
 * - Stage A LIKE/score 필드 = fragContract.matchProfile (커버와 동일 집합)
 * - category hint는 점수만(WHERE 필터 금지)
 * - 같은 name/tags 축 frag는 신규 INSERT 없이 healDomain만
 */
var testWoo = testWoo || {};
testWoo.fragments = (function () {
  "use strict";

  var SCHEMA = "woo:testWooAiFragment";
  var _byNameCache = {};

  // 1. name 단건 — 컴파일러용 (전체 로드 금지)
  function getByName(name) {
    if (!name) return null;
    var key = String(name);
    if (_byNameCache[key]) return _byNameCache[key];
    try {
      var esc = _escLit(key);
      var q = xtk.queryDef.create(
        <queryDef schema={SCHEMA} operation="select" lineCount="1">
          <select>
            <node expr="@name"/><node expr="@label"/><node expr="@category"/>
            <node expr="@tags"/><node expr="@synonyms"/><node expr="@key_column"/>
            <node expr="@scope_key"/><node expr="@sql_text"/><node expr="@params"/>
            <node expr="@param_domain"/><node expr="@description"/><node expr="@sample_questions"/>
            <node expr="@status"/><node expr="@is_current"/><node expr="@version"/>
            <node expr="@id"/><node expr="@revoked_reason"/><node expr="@content_hash"/>
          </select>
          <where>
            <condition expr={"@name = '" + esc + "'"}/>
            <condition expr="@is_current = 1"/>
          </where>
        </queryDef>);
      var res = q.ExecuteQuery();
      for each (var r in res.testWooAiFragment) {
        var row = _rowFull(r);
        _byNameCache[key] = row;
        return row;
      }
      return null;
    } catch (e) {
      throw new Error("[testWoo.fragments.getByName] name=" + key + " cause=" + e.message);
    }
  }

  // 2. LLM 카드 (sql_text 제외)
  function toCard(f) {
    if (!f) return null;
    return {
      name: f.name, label: f.label, category: f.category, tags: f.tags,
      synonyms: safeParse(f.synonyms), key_column: f.key_column,
      description: f.description, params: safeParse(f.params),
      param_domain: safeParse(f.param_domain),
      sample_questions: safeParse(f.sample_questions)
    };
  }

  // 3. Stage A — 슬롯 1개 (DB 필터 + 페이지 스코어, sql_text 미로드)
  // statuses: 기본 ["active"]. 킬스위치 OFF 시 Foundry가 verified 를 함께 넘김.
  function searchBySlot(slot, topN, statuses) {
    if (!slot) return [];
    if (!slot.text && !(slot.searchKeywords && slot.searchKeywords.length) && !slot.resolvedName)
      return [];
    var cfg = testWoo.cfg.getConfig().search;
    var n = topN || cfg.stageATopN;
    var pageSize = cfg.queryPageSize;
    var maxPages = cfg.maxSearchPages;
    var stat = _normStatuses(statuses);
    var tokens = _keywordsFromSlot(slot);
    var hint = String(slot.hintedCategory || "").toLowerCase();
    var scored = [];
    if (tokens.length) {
      scored = _searchPages(tokens, "", pageSize, maxPages, stat);
      scored.sort(function (a, b) { return b.score - a.score; });
      if (hint) {
        for (var hi = 0; hi < scored.length; hi++) {
          if (_norm(scored[hi].card.category) === hint) scored[hi].score += 10;
        }
        scored.sort(function (a, b) { return b.score - a.score; });
      }
    }
    // ACC Rhino: Array.map 없음
    var cards = [];
    var seenC = {};
    function pushCard(c) {
      if (!c || !c.name || seenC[c.name]) return;
      seenC[c.name] = 1;
      cards.push(c);
    }
    var top = scored.slice(0, n);
    var ci;
    for (ci = 0; ci < top.length; ci++) pushCard(top[ci].card);
    var axisCards = _axisFallback(slot, n, stat) || [];
    var aj;
    for (aj = 0; aj < axisCards.length; aj++) pushCard(axisCards[aj]);
    if (slot.resolvedName) {
      try {
        var hitRow = getByName(String(slot.resolvedName));
        if (hitRow) pushCard(toCard(hitRow));
      } catch (eRn) { /* keep recall */ }
    }
    return cards;
  }

  function searchByAxis(axis, topN, statuses) {
    var a = String(axis || "").toLowerCase();
    if (!a || a.length < 2) return [];
    var cfg = testWoo.cfg.getConfig().search;
    var n = topN || cfg.stageATopN;
    var pageSize = cfg.queryPageSize;
    var maxPages = cfg.maxSearchPages;
    var stat = _normStatuses(statuses);
    var tokens = [a, "__" + a];
    var scored = _searchPages(tokens, "", pageSize, maxPages, stat);
    var cards = [];
    var seen = {};
    var i;
    for (i = 0; i < scored.length; i++) {
      var card = scored[i].card;
      if (!card || !card.name || seen[card.name]) continue;
      var axisCard = "";
      if (testWoo.fragContract && testWoo.fragContract.axisFromCard)
        axisCard = String(testWoo.fragContract.axisFromCard(card) || "").toLowerCase();
      if (axisCard !== a) continue;
      seen[card.name] = 1;
      cards.push(card);
      if (cards.length >= n) break;
    }
    return cards;
  }

  function _axisFallback(slot, topN, statuses) {
    if (!testWoo.fragContract || !testWoo.fragContract.axisFromSlot) return [];
    var hints = testWoo.fragContract.axisFromSlot(slot) || [];
    var out = [];
    var seen = {};
    var hi, j;
    for (hi = 0; hi < hints.length; hi++) {
      var more = searchByAxis(hints[hi], topN, statuses) || [];
      for (j = 0; j < more.length; j++) {
        if (!more[j] || !more[j].name || seen[more[j].name]) continue;
        seen[more[j].name] = 1;
        out.push(more[j]);
      }
    }
    return out;
  }

  function healDomain(fragRow, alias, params, opts) {
    if (!fragRow || !fragRow.id) return { ok: false, reason: "frag missing" };
    if (!testWoo.fragContract) return { ok: false, reason: "fragContract missing" };
    opts = opts || {};
    var fc = testWoo.fragContract;
    var domain = opts.domain || fc.normalizeParamDomain(fragRow.param_domain);
    var snapChanged = false;
    if (!opts.domain && testWoo.toolkit && testWoo.toolkit.refreshDomain) {
      try {
        var rr = testWoo.toolkit.refreshDomain(domain);
        if (rr && rr.ok && rr.domain) {
          domain = rr.domain;
          snapChanged = !!rr.changed;
        }
      } catch (eR) { /* keep snapshot */ }
    }
    if (testWoo.enPivot && testWoo.enPivot.enrichDomainEn) {
      try {
        var enr = testWoo.enPivot.enrichDomainEn(domain);
        if (enr && enr.domain) {
          domain = enr.domain;
          if (enr.changed) snapChanged = true;
        }
      } catch (eEn) { /* keep domain */ }
    }
    var chk = { ok: true };
    if (params && typeof params === "object")
      chk = fc.validateBind(domain, params);
    if (!chk || !chk.ok)
      return { ok: false, reason: (chk && chk.reason) || "validateBind", refreshed: snapChanged };
    var aliasHit = !!(alias && fc.domainMatchSlot(domain, alias));
    var next = domain;
    if (!aliasHit && params && typeof params === "object")
      next = fc.attachAlias(domain, alias, params);
    if (!snapChanged && aliasHit)
      return { ok: true, changed: false, reason: "alias exists", domain: next };
    var idx = fc.buildIndexFields({
      slotText: alias,
      param_domain: next,
      name: fragRow.name,
      tags: fragRow.tags,
      label: fragRow.label
    });
    var synExist = String(fragRow.synonyms || "").split(/[,;]+/);
    var synNew = String(idx.synonyms || "").split(/[,;]+/);
    var synSeen = {};
    var synOut = [];
    function pushSyn(raw) {
      var s = String(raw || "").replace(/^\s+|\s+$/g, "");
      if (!s) return;
      var key = s.toLowerCase();
      if (synSeen[key]) return;
      synSeen[key] = 1;
      synOut.push(s);
    }
    var si;
    for (si = 0; si < synExist.length; si++) pushSyn(synExist[si]);
    for (si = 0; si < synNew.length; si++) pushSyn(synNew[si]);
    var samples = [];
    try {
      var parsed = fragRow.sample_questions;
      if (typeof parsed === "string" && parsed) parsed = JSON.parse(parsed);
      if (parsed && typeof parsed.length === "number") samples = parsed;
    } catch (eS) { samples = []; }
    var aliasS = String(alias || "");
    var hasAlias = false;
    for (si = 0; si < samples.length; si++) {
      if (String(samples[si]) === aliasS) hasAlias = true;
    }
    if (aliasS && !hasAlias) samples.push(aliasS);
    var domainJson = JSON.stringify(next);
    try {
      var doc = <testWooAiFragment xtkschema={SCHEMA} _operation="update"/>;
      doc.@id = Number(fragRow.id);
      doc.@param_domain = domainJson;
      doc.@synonyms = synOut.join(",");
      doc.@sample_questions = JSON.stringify(samples);
      xtk.session.Write(doc);
      clearCache();
    } catch (eW) {
      return { ok: false, reason: String(eW.message || eW) };
    }
    return { ok: true, changed: true, domain: next };
  }

  function saveParamDomain(fragRow, domain) {
    if (!fragRow || !fragRow.id) return { ok: false, reason: "frag missing" };
    if (!domain) return { ok: false, reason: "domain missing" };
    var domainJson;
    try { domainJson = JSON.stringify(domain); }
    catch (eJ) { return { ok: false, reason: String(eJ.message || eJ) }; }
    try {
      var doc = <testWooAiFragment xtkschema={SCHEMA} _operation="update"/>;
      doc.@id = Number(fragRow.id);
      doc.@param_domain = domainJson;
      xtk.session.Write(doc);
      clearCache();
    } catch (eW) {
      return { ok: false, reason: String(eW.message || eW) };
    }
    return { ok: true, domain: domain };
  }

  // 4. Stage A — 다슬롯
  function searchSlots(slots, topN, statuses) {
    var out = [];
    var list = slots || [];
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      out.push({
        id: s.id, text: s.text, hintedCategory: s.hintedCategory || "",
        searchKeywords: s.searchKeywords || [],
        resolvedName: s.resolvedName || "",
        concept: s.concept || null,
        en_literal: s.en_literal || "",
        kind: s.kind || "",
        polarity: s.polarity || "",
        candidates: searchBySlot(s, topN, statuses)
      });
    }
    return out;
  }

  // sql_text 없이 active 카드만. 렉시콘 분할용(페이지 상한=Stage A와 동일).
  function listLexiconCards(statuses) {
    var cfg = testWoo.cfg.getConfig().search;
    var pageSize = cfg.queryPageSize;
    var maxPages = cfg.maxSearchPages;
    var stat = _normStatuses(statuses);
    var out = [];
    var start = 0;
    var page;
    for (page = 0; page < maxPages; page++) {
      var q = _buildSearchQuery([], "", start, pageSize, stat);
      var res = q.ExecuteQuery();
      var count = 0;
      for each (var r in res.testWooAiFragment) {
        count++;
        out.push(toCard(_rowMeta(r)));
      }
      if (count < pageSize) break;
      start += pageSize;
    }
    return out;
  }

  // 5. Catalog — category 집계 (sql_text 없이 페이지)
  function listCategories() {
    var cfg = testWoo.cfg.getConfig().search;
    var pageSize = cfg.queryPageSize;
    var start = 0;
    var cats = {};
    var page = 0;
    while (page < cfg.maxSearchPages) {
      var q = xtk.queryDef.create(
        <queryDef schema={SCHEMA} operation="select" lineCount={String(pageSize)} startLine={String(start)}>
          <select>
            <node expr="@category"/>
            <node expr="@status"/>
          </select>
          <where>
            <condition expr="@status = 'active'"/>
          </where>
          <orderBy>
            <node expr="@name"/>
          </orderBy>
        </queryDef>);
      var res = q.ExecuteQuery();
      var count = 0;
      for each (var r in res.testWooAiFragment) {
        count++;
        var c = String(r.@category || "other");
        cats[c] = (cats[c] || 0) + 1;
      }
      if (count < pageSize) break;
      start += pageSize;
      page++;
    }
    var list = [];
    for (var k in cats) if (cats.hasOwnProperty(k)) list.push({ category: k, count: cats[k] });
    return list;
  }

  function clearCache() { _byNameCache = {}; }

  // --- internal ---
  // 허용 status 목록 정규화 (화이트리스트 — 임의 문자열 주입 차단)
  function _normStatuses(statuses) {
    var allow = { active: 1, verified: 1 };
    var out = [];
    var list = _isArray(statuses) ? statuses : null;
    if (list) {
      for (var i = 0; i < list.length; i++) {
        var s = String(list[i] || "").toLowerCase();
        if (allow[s]) out.push(s);
      }
    }
    if (!out.length) out.push("active");
    return out;
  }

  function _statusCondition(stat) {
    if (stat.length === 1) return "<condition expr=\"@status = '" + stat[0] + "'\"/>";
    var ors = [];
    for (var i = 0; i < stat.length; i++) ors.push("@status = '" + stat[i] + "'");
    return "<condition expr=\"(" + ors.join(" OR ") + ")\"/>";
  }

  function _searchPages(tokens, hintCat, pageSize, maxPages, stat) {
    var scored = [];
    var start = 0;
    for (var page = 0; page < maxPages; page++) {
      var q = _buildSearchQuery(tokens, hintCat, start, pageSize, stat);
      var res = q.ExecuteQuery();
      var count = 0;
      for each (var r in res.testWooAiFragment) {
        count++;
        var meta = _rowMeta(r);
        var score = _score(meta, tokens, hintCat);
        if (score > 0) scored.push({ score: score, card: toCard(meta) });
      }
      if (count < pageSize) break;
      start += pageSize;
    }
    return scored;
  }

  // PG LIKE 는 대소문자 구분 — 카탈로그 토큰의 대소문자 변형을 함께 넣음
  function _tokenCaseVariants(tok) {
    var s = String(tok || "");
    if (!s) return [];
    var out = [];
    var seen = {};
    function add(v) {
      var x = String(v || "");
      if (!x || seen[x]) return;
      seen[x] = 1;
      out.push(x);
    }
    add(s);
    add(s.toLowerCase());
    add(s.toUpperCase());
    if (s.length > 1)
      add(s.charAt(0).toUpperCase() + s.substring(1).toLowerCase());
    return out;
  }

  function _pushLikeOrs(orParts, token) {
    var fields = (testWoo.fragContract && testWoo.fragContract.likeFieldExprs) ?
      testWoo.fragContract.likeFieldExprs() :
      ["label", "tags", "synonyms", "sample_questions", "name", "description", "param_domain"];
    var variants = _tokenCaseVariants(token);
    for (var vi = 0; vi < variants.length; vi++) {
      var t = _escLike(variants[vi]);
      if (!t) continue;
      for (var fi = 0; fi < fields.length; fi++)
        orParts.push("@" + fields[fi] + " LIKE '%" + t + "%'");
    }
  }

  function _buildSearchQuery(tokens, hintCat, startLine, pageSize, stat) {
    var parts = [_statusCondition(_normStatuses(stat))];
    // hintCat WHERE 필터 제거(#170-P2). 호환을 위해 인자는 유지.
    var orParts = [];
    for (var i = 0; i < tokens.length; i++) {
      _pushLikeOrs(orParts, tokens[i]);
    }
    if (orParts.length) {
      parts.push("<condition boolOperator=\"AND\" expr=\"(" + orParts.join(" OR ") + ")\"/>");
    }
    var xml =
      '<queryDef schema="' + SCHEMA + '" operation="select" lineCount="' + pageSize +
      '" startLine="' + startLine + '">' +
      "<select>" +
      '<node expr="@name"/><node expr="@label"/><node expr="@category"/>' +
      '<node expr="@tags"/><node expr="@synonyms"/><node expr="@key_column"/>' +
      '<node expr="@params"/><node expr="@param_domain"/>' +
      '<node expr="@description"/><node expr="@sample_questions"/><node expr="@status"/>' +
      "</select><where>" + parts.join("") + "</where>" +
      '<orderBy><node expr="@name"/></orderBy></queryDef>';
    return xtk.queryDef.create(new XML(xml));
  }

  function _rowMeta(r) {
    return {
      name: String(r.@name), label: String(r.@label), category: String(r.@category),
      tags: String(r.@tags), synonyms: String(r.@synonyms), key_column: String(r.@key_column),
      scope_key: String(r.@scope_key || ""), params: String(r.@params), param_domain: String(r.@param_domain),
      description: String(r.@description), sample_questions: String(r.@sample_questions),
      status: String(r.@status), is_current: r.@is_current, version: Number(r.@version) || 1,
      id: Number(r.@id) || 0, revoked_reason: String(r.@revoked_reason || ""),
      content_hash: String(r.@content_hash || ""), sql_text: ""
    };
  }

  function _rowFull(r) {
    var m = _rowMeta(r);
    m.sql_text = String(r.@sql_text);
    return m;
  }

  function _score(f, tokens, hintCat) {
    if (testWoo.fragContract && testWoo.fragContract.scoreCard)
      return testWoo.fragContract.scoreCard(f, tokens, hintCat);
    return 0;
  }

  function _keywordsFromSlot(slot) {
    if (testWoo.fragContract && testWoo.fragContract.keywordsFromSlot)
      return testWoo.fragContract.keywordsFromSlot(slot);
    return [];
  }

  function _isArray(x) {
    return Object.prototype.toString.call(x) === "[object Array]";
  }

  function _norm(s) { return String(s || "").toLowerCase().replace(/\s+/g, ""); }
  function _escLit(s) { return String(s || "").replace(/'/g, "''"); }
  function _escLike(s) { return _escLit(String(s || "").replace(/[%_]/g, "")); }
  function safeParse(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return s; } }

  return {
    getByName: getByName,
    toCard: toCard,
    searchBySlot: searchBySlot,
    searchByAxis: searchByAxis,
    searchSlots: searchSlots,
    listLexiconCards: listLexiconCards,
    healDomain: healDomain,
    saveParamDomain: saveParamDomain,
    listCategories: listCategories,
    clearCache: clearCache
  };
})();
testWoo.fragments.__v = "165";
