/*
 * testWooFragments.js (Fragment Stage A 검색)
 * ==================================================
 * 슬롯별 후보 fragment 메타 검색. 전체 카탈로그·sql_text 일괄 로드 금지.
 * queryDef 페이지네이션(lineCount·startLine)으로 가드레일 유지.
 *
 * [Main Functions]
 * ===========
 * - getByName — name 단건 조회(sql_text 포함)
 * - toCard — fragment → UI 카드 객체
 * - searchBySlot — 슬롯 1건 Stage A 후보 검색
 * - searchSlots — Pass0 slots[] 일괄 Stage A
 * - listCategories — Catalog용 category 목록
 * - clearCache — getByName 캐시 비우기
 *
 * [Dependencies]
 * =========
 * - woo:testWooAiFragment — xtk.queryDef select
 * - testWoo.cfg.getConfig — guard.STAGE_A_TOP_N·QUERY_PAGE_SIZE
 *
 * [Invariants]
 * ===========
 * - Stage A LIKE: label/tags/synonyms/sample_questions/name/description
 *   (Foundry description-only 메타도 후보로 잡혀야 함)
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
    if (!slot || (!slot.text && !(slot.searchKeywords && slot.searchKeywords.length))) return [];
    var cfg = testWoo.cfg.getConfig().search;
    var n = topN || cfg.stageATopN;
    var pageSize = cfg.queryPageSize;
    var maxPages = cfg.maxSearchPages;
    var stat = _normStatuses(statuses);
    // 검색어: Pass0이 준 searchKeywords 우선. 없으면 범용 분할만 (도메인 규칙 없음)
    var tokens = _keywordsFromSlot(slot);
    if (!tokens.length) return [];
    var hint = String(slot.hintedCategory || "").toLowerCase();
    var scored = _searchPages(tokens, hint, pageSize, maxPages, stat);
    if (!scored.length && hint) scored = _searchPages(tokens, "", pageSize, maxPages, stat);
    scored.sort(function (a, b) { return b.score - a.score; });
    // ACC Rhino: Array.map 없음
    var cards = [];
    var top = scored.slice(0, n);
    for (var ci = 0; ci < top.length; ci++) cards.push(top[ci].card);
    return cards;
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
        candidates: searchBySlot(s, topN, statuses)
      });
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

  function _buildSearchQuery(tokens, hintCat, startLine, pageSize, stat) {
    var parts = [_statusCondition(_normStatuses(stat))];
    if (hintCat) {
      parts.push("<condition expr=\"@category = '" + _escLit(hintCat) + "'\"/>");
    }
    var orParts = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = _escLike(tokens[i]);
      if (!t) continue;
      // Foundry compound frag는 description·name에만 한글/영문 단서가 있는 경우가 많음
      orParts.push("@label LIKE '%" + t + "%'");
      orParts.push("@tags LIKE '%" + t + "%'");
      orParts.push("@synonyms LIKE '%" + t + "%'");
      orParts.push("@sample_questions LIKE '%" + t + "%'");
      orParts.push("@name LIKE '%" + t + "%'");
      orParts.push("@description LIKE '%" + t + "%'");
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
    var fields = [
      { blob: _norm(f.sample_questions), w: 8 },
      { blob: _norm(f.synonyms),         w: 6 },
      { blob: _norm(f.label),            w: 4 },
      { blob: _norm(f.tags),             w: 3 },
      { blob: _norm(f.description),      w: 2 }
    ];
    var score = 0, hits = 0;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i], hit = false;
      for (var j = 0; j < fields.length; j++) {
        if (fields[j].blob.indexOf(t) >= 0) {
          // 길이 정규화: 예시를 많이 넣은 fragment가 무조건 이기는 것 방지
          score += fields[j].w / Math.sqrt(Math.max(fields[j].blob.length, 1) / 50);
          hit = true;
        }
      }
      if (hit) hits++;
    }
    if (!hits) return 0;
    if (hintCat && _norm(f.category) === hintCat) score += 10;
    return score;
  }

  // Pass0 searchKeywords + 범용 분할. 도메인 별칭 하드코딩 금지.
  function _keywordsFromSlot(slot) {
    var cfg = testWoo.cfg.getConfig();
    var maxTok = cfg.search.maxTokens;
    var seen = {};
    var out = [];
    function push(raw) {
      var t = _norm(raw);
      if (!t || t.length < 2) return;
      if (t.length > cfg.guard.MAX_TOKEN_LEN) t = t.substring(0, cfg.guard.MAX_TOKEN_LEN);
      if (seen[t]) return;
      seen[t] = true;
      out.push(t);
    }
    var kws = slot.searchKeywords;
    if (kws && _isArray(kws)) {
      for (var i = 0; i < kws.length; i++) push(kws[i]);
    }
    // fallback: 구두점 기준 범용 분할만 (의미 확장 없음)
    if (!out.length && slot.text) {
      var raw = String(slot.text).toLowerCase().split(/[^0-9a-z가-힣]+/i);
      for (var j = 0; j < raw.length; j++) push(raw[j]);
    }
    return out.slice(0, maxTok);
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
    searchSlots: searchSlots,
    listCategories: listCategories,
    clearCache: clearCache
  };
})();
