/*
 * testWooFragContract.js (슬롯↔frag 공유 계약)
 * ==================================================
 * Stage A / libraryLookup / Foundry publish / Dedup / Compiler가
 * 각자 복제하던 축·색인·커버·샘플바인딩을 한곳에서 제공한다.
 * 같은 tags/name 축 frag는 값 사전 공백이어도 재사용하고, 별칭은 검증 후 merge한다.
 * NL 매칭은 M1 원문⊂문장 → M2 en[] → M3 concept(axis 동치). {db,en} 바인딩은 db만. litmus __v=186.
 * 모호 슬롯은 promptHints(합집합+멤버 ≤5). 클릭은 NL 보강. 감사시각은 슬롯당 GROUP BY 1회.
 * 닫힌 enum이 있으면 후보=enum만. 별칭 db가 enum에 없으면 별칭 키(라이브 값)를 씀.
 * N대는 번역 전 {ageMin:N,ageMax:N+10}. N대~M대는 {ageMin:N,ageMax:M+10}.
 * N월은 도메인 YYYY-MM 중 그 월만 고른다. 연도 질문이 아니라 카탈로그 값.
 * leftover는 및/and 슬롯의 다른 지정어만. 이미 매칭된 값(7월/10대)은 Foundry로 보내지 않는다.
 * leftover는 컬럼 identity·번역 토큰만 본다. 색인(sample/synonyms)에 섞인 다른 필터는 커버로 치지 않는다.
 * 한 슬롯에 서로 다른 축 카탈로그 값(또는 N월 형태)이 있으면 자른다. 원문(KO)만 본다. 도메인 예시 없음.
 *
 * [Main Functions]
 * ===========
 * - axisFromSlot / axisFromCard / axesCompatible — concept·영문 힌트·정합
 * - buildIndexFields — publish용 synonyms·sample_questions. `_group` 별칭 포함
 * - matchProfile / likeFieldExprs / scoreWeights / coverFieldNames — Match 프로필
 * - keywordsFromSlot — Stage A 토큰(+축 태그). 조사 어간 없음
 * - collectLexicon / splitByLexicon / mergeLexiconSlots / splitCompoundSlots — 카탈로그 값⊂NL 분할. identityOnly면 synonyms 제외. 한 슬롯 다축이면 자름. LLM 스팬이 더 길면 덮지 않음
 * - stemToken / isNoiseResidue — no-op (5단계: KO 사전 삭제)
 * - normalizeParamDomain / domainMatchSlot / yearMonthHits / entryDb — 값 매칭. N월→YYYY-MM. N대는 _bucket. `_group` 별칭→members[]
 * - matchEnPivotSlot / conceptOf / conceptsAxisMatch / kindCompatible — M1→M2G→M2→M3. M3는 concept axis 동치
 * - isNegative / markNegative / inHealCooldown / stampHeal — _negative·heal 쿨다운
 * - validateBind / attachAlias / mergeParamDomainJson — 바인딩 검증(배열은 원소별 enum)·별칭 보완(문장·공백 별칭 거부)·도메인 merge(`_group` 보존, nlMap 키 삭제 금지)
 * - sampleBindSql — {{param}} 검증/Dedup용 샘플 치환(유일 구현). 배열은 'a','b'
 * - promoteEqPlaceholderToIn — `col = {{p}}` → `col IN ({{p}})` (>= <= != 유지)
 * - coversSlot / libraryHitPredicate / slotCoverParts / splitCoordSlots / splitCompoundSlots — 재사용·및/and·다축 분할. leftover는 identity
 * - resolveNlParams — NL→params (Compiler bind 공유). `_group` 히트는 members[] (후보 교집합)
 * - upsertGroup — `_group` 별칭 기록(members는 후보 교집합, nlMap 키 유지)
 * - groupHintForParams — params 멤버 집합 ↔ `_group` 별칭 (칩 표시용. SQL 변경 없음)
 * - displayHintForParams — nlMap 별칭(학생요금) ↔ 바인딩 db (칩 표시)
 * - buildPromptHints / applyNlPatch — 닫힌 도메인 2+히트 → 합집합+멤버 칩. surface→patch 보강
 * - logCode / errorCodes — FRAG_CONTRACT:<code> 로그
 *
 * [Dependencies]
 * =========
 * - testWoo.cfg — search.maxTokens·MAX_TOKEN_LEN (없으면 기본값)
 * - testWoo.toolkit.auditMaxDates — 슬롯당 감사 GROUP BY 1회 (없으면 시계 B 스킵)
 * - 호출: Fragments·Feasibility·Foundry·Dedup·Compiler·Generate (loadLibrary 선행)
 */
var testWoo = testWoo || {};
testWoo.fragContract = (function () {
  "use strict";

  var ERROR_CODES = {
    AXIS_MISMATCH: "AXIS_MISMATCH",
    INDEX_MISS: "INDEX_MISS",
    DOMAIN_UNBOUND: "DOMAIN_UNBOUND",
    BIND_TYPE: "BIND_TYPE",
    SOURCE_MISSING: "SOURCE_MISSING",
    DEDUP_ASYMMETRIC: "DEDUP_ASYMMETRIC"
  };

  // Stage A LIKE / score / cover 가 동일 필드를 쓰도록 한 표
  var MATCH_PROFILE = {
    likeFields: [
      "label", "tags", "synonyms", "sample_questions",
      "name", "description", "param_domain"
    ],
    scoreWeights: {
      sample_questions: 8,
      synonyms: 6,
      param_domain: 7,
      label: 4,
      tags: 3,
      description: 2,
      name: 1
    },
    coverFields: [
      "label", "description", "tags", "synonyms",
      "sample_questions", "name", "param_domain"
    ],
    categoryHintBonus: 10,
    libraryRequiresSource: true
  };

  // Pass0 hintedCategory → 축 태그 별칭 (점수/정합 보조)
  var HINT_CAT_TO_AXIS = {
    plan: "plan",
    demo: "demo",
    consent: "consent",
    fatigue: "fatigue",
    signup: "joindate",
    other: ""
  };

  // 조사·관사·접속만. 도메인 명사(월/미납/동의 종류)는 넣지 않는다.
  var GLUE_TOK = {
    and: 1, or: 1, but: 1, the: 1, a: 1, an: 1, to: 1, for: 1, of: 1, in: 1,
    on: 1, at: 1, by: 1, with: 1, from: 1, as: 1, who: 1, those: 1, that: 1,
    have: 1, has: 1, had: 1, are: 1, is: 1, was: 1, been: 1, being: 1,
    their: 1, them: 1, they: 1, people: 1, person: 1, persons: 1,
    receive: 1, receiving: 1, received: 1, notification: 1, notifications: 1,
    consented: 1, consenting: 1, customer: 1, customers: 1, among: 1,
    "한": 1, "하는": 1, "된": 1, "사람": 1, "중": 1, "및": 1, "와": 1, "과": 1,
    "에서": 1, "으로": 1, "를": 1, "을": 1, "이": 1, "가": 1, "은": 1, "는": 1,
    "인": 1, "자": 1, "에게": 1, "까지": 1, "고객": 1
  };

  function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
  }

  function _isArray(x) {
    return Object.prototype.toString.call(x) === "[object Array]";
  }

  function _norm(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, "");
  }

  function _induceNDae(text) {
    var t = _trim(String(text || ""));
    var m = /(\d{1,2})\uB300\s*[\~\u301C\uFF5E\-]\s*(\d{1,2})\uB300/.exec(t);
    if (!m) m = /(\d{1,2})s\s*[\~\-]\s*(\d{1,2})s/i.exec(_norm(t));
    if (m) {
      var a = Number(m[1]);
      var b = Number(m[2]);
      if (isNaN(a) || isNaN(b) || a < 1 || b < 1 || a > 90 || b > 90) return null;
      if (a > b) {
        var tmp = a;
        a = b;
        b = tmp;
      }
      return { ageMin: a, ageMax: b + 10 };
    }
    m = /^(\d{1,2})\uB300$/.exec(t);
    if (!m) m = /^(\d{1,2})s$/.exec(_norm(t));
    if (!m) return null;
    var n = Number(m[1]);
    if (isNaN(n) || n < 1 || n > 90) return null;
    return { ageMin: n, ageMax: n + 10 };
  }

  var EN_MONTH_NUM = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
  };

  function _induceNWol(text) {
    var t = _trim(String(text || ""));
    if (!t) return null;
    var ym = /^(\d{4})-(\d{2})$/.exec(t);
    if (ym) {
      var moY = Number(ym[2]);
      if (isNaN(moY) || moY < 1 || moY > 12) return null;
      return { month: moY, year: Number(ym[1]) };
    }
    var mw = /^(\d{1,2})\uC6D4$/.exec(t);
    if (mw) {
      var n = Number(mw[1]);
      if (isNaN(n) || n < 1 || n > 12) return null;
      return { month: n };
    }
    var low = t.toLowerCase();
    if (EN_MONTH_NUM[low]) return { month: EN_MONTH_NUM[low] };
    return null;
  }

  function _isYearMonth(s) {
    return /^\d{4}-\d{2}$/.test(String(s || ""));
  }

  function _monthOfYearMonth(s) {
    if (!_isYearMonth(s)) return 0;
    return Number(String(s).substring(5, 7));
  }

  function yearMonthHits(slotText, values) {
    var nw = _induceNWol(slotText);
    if (!nw) return [];
    var out = [];
    var i, v;
    for (i = 0; i < (values || []).length; i++) {
      v = String(values[i] == null ? "" : values[i]);
      if (_monthOfYearMonth(v) === nw.month) out.push(v);
    }
    return out;
  }

  function _yearMonthsInDomain(domain, month) {
    var hits = [];
    var seen = {};
    function add(param, val) {
      var v = String(val == null ? "" : val);
      if (!_isYearMonth(v) || _monthOfYearMonth(v) !== month) return;
      if (seen[v]) return;
      seen[v] = 1;
      hits.push({ param: param, value: v });
    }
    var k, spec, ei, nk, dbv;
    if (!domain) return hits;
    for (k in domain) {
      if (!domain.hasOwnProperty(k) || String(k).charAt(0) === "_") continue;
      spec = domain[k] || {};
      if (spec.enum && typeof spec.enum.length === "number") {
        for (ei = 0; ei < spec.enum.length; ei++) add(k, spec.enum[ei]);
      }
      if (spec.nlMap && typeof spec.nlMap === "object") {
        for (nk in spec.nlMap) {
          if (!spec.nlMap.hasOwnProperty(nk)) continue;
          if (_isYearMonth(nk)) add(k, nk);
          dbv = entryDb(spec.nlMap[nk]);
          if (dbv != null && typeof dbv !== "object") add(k, dbv);
        }
      }
    }
    return hits;
  }

  function _domainAcceptsNDae(domain) {
    if (!domain) return false;
    if (domain._bucket) return true;
    if (domain.ageMin && domain.ageMax) return true;
    return false;
  }

  function _ciHas(hay, needle) {
    if (hay == null || needle == null) return false;
    var h = String(hay).toLowerCase();
    var n = String(needle).toLowerCase();
    if (!n) return false;
    return h.indexOf(n) >= 0;
  }

  function _isWordChar(c) {
    return /[0-9a-zA-Z가-힣_]/.test(String(c || ""));
  }

  function _tokenAliasHit(token, alias, dbHint, isGroup) {
    var t = _norm(token);
    var a = _norm(alias);
    if (!t || !a || a.length < 2) return false;
    if (t === a) return true;
    if (t.indexOf(a) !== 0) return false;
    var rest = t.substring(a.length);
    if (!rest) return true;
    if (isGroup) return rest.length <= 2;
    var db = "";
    if (dbHint != null && typeof dbHint !== "object") db = _norm(String(dbHint));
    if (db && t.indexOf(db) >= 0) return true;
    if (db && db === a && rest.length <= 1) return true;
    return false;
  }

  function _boundHas(hay, needle, dbHint, isGroup) {
    if (hay == null || needle == null) return false;
    var n = String(needle);
    if (!n || n.length < 2) return false;
    var toks = String(hay).split(/[^0-9a-zA-Z가-힣_]+/);
    var i;
    for (i = 0; i < toks.length; i++) {
      if (_tokenAliasHit(toks[i], n, dbHint, isGroup)) return true;
    }
    return false;
  }

  function _aliasPrefixConflict(surface, alias, dbHint, isGroup) {
    var toks = String(surface || "").split(/[^0-9a-zA-Z가-힣_]+/);
    var i, t, a;
    a = _norm(alias);
    if (!a) return false;
    for (i = 0; i < toks.length; i++) {
      t = _norm(toks[i]);
      if (t && t.indexOf(a) === 0 && t !== a &&
          !_tokenAliasHit(toks[i], alias, dbHint, isGroup))
        return true;
    }
    return false;
  }

  function _lexHint(card, key) {
    var out = { db: "", group: false };
    var domain = normalizeParamDomain(card && card.param_domain);
    if (!domain || !key) return out;
    var k, spec, map, dbv, ei;
    for (k in domain) {
      if (!domain.hasOwnProperty(k) || String(k).charAt(0) === "_") continue;
      spec = domain[k] || {};
      map = spec.nlMap;
      if (map && map[key] != null) {
        dbv = entryDb(map[key]);
        out.db = (dbv != null && typeof dbv !== "object") ? String(dbv) : "";
        return out;
      }
      if (spec.enum && typeof spec.enum.length === "number") {
        for (ei = 0; ei < spec.enum.length; ei++) {
          if (String(spec.enum[ei]) === String(key)) {
            out.db = String(key);
            return out;
          }
        }
      }
    }
    if (domain._bucket && domain._bucket.nlMap && domain._bucket.nlMap[key] != null) {
      out.group = true;
      return out;
    }
    _eachGroup(domain, function (gpk, alias, gentry) {
      if (String(alias) === String(key)) out.group = true;
    });
    return out;
  }

  function _sqlLit(v) {
    if (typeof v === "number" && isFinite(v)) return String(v);
    return "'" + String(v).replace(/'/g, "''") + "'";
  }

  function _sqlLitJoin(v) {
    if (!_isArray(v)) return _sqlLit(v);
    if (!v.length) return "'__sample__'";
    var buf = [];
    var i;
    for (i = 0; i < v.length; i++) {
      if (v[i] != null && typeof v[i] === "object") continue;
      buf.push(_sqlLit(v[i]));
    }
    if (!buf.length) return "'__sample__'";
    return buf.join(",");
  }

  // col = {{param}} → col IN ({{param}}). >= <= != <> 는 그대로.
  function promoteEqPlaceholderToIn(sqlText) {
    return String(sqlText || "").replace(
      /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{\{(\w+)\}\}/g,
      "$1 IN ({{$2}})"
    );
  }

  function logCode(code, detail) {
    var c = ERROR_CODES[code] || String(code || "UNKNOWN");
    var msg = "[FRAG_CONTRACT:" + c + "]";
    if (detail) msg += " " + String(detail);
    try { logWarning(msg); } catch (eL) { /* non-ACC unit */ }
    return c;
  }

  function normalizeParamDomain(raw) {
    if (raw == null || raw === "") return {};
    if (typeof raw === "object" && !_isArray(raw)) return raw;
    try {
      var o = JSON.parse(String(raw));
      if (o && typeof o === "object" && !_isArray(o)) return o;
    } catch (e) { /* fall through */ }
    return {};
  }

  function _tagAxes(tagsStr) {
    var raw = String(tagsStr || "").split(/[,;\s]+/);
    var out = [];
    var seen = {};
    for (var i = 0; i < raw.length; i++) {
      var t = _trim(raw[i]).toLowerCase();
      if (!t || seen[t]) continue;
      seen[t] = 1;
      out.push(t);
    }
    return out;
  }

  function axisFromCard(card) {
    if (!card) return "";
    var axes = _tagAxes(card.tags);
    if (axes.length) return String(axes[0] || "").toLowerCase();
    var name = String(card.name || "").toLowerCase();
    var segs = name.split("__");
    if (segs.length >= 3) return segs[segs.length - 1];
    return "";
  }

  function axisFromSlot(slot) {
    var text = "";
    var hintCat = "";
    var concept = "";
    var kind = "";
    if (slot && typeof slot === "object") {
      text = String(slot.text || "");
      hintCat = String(slot.hintedCategory || "").toLowerCase();
      concept = String(slot.concept || "");
      kind = String(slot.kind || "");
    } else {
      text = String(slot || "");
    }
    var fromC = _axisFromConcept(concept, kind);
    if (fromC) return [fromC];
    var hints = _axisHintsFromText(text);
    if (hints.length) return hints;
    var mapped = HINT_CAT_TO_AXIS[hintCat];
    if (mapped) return [mapped];
    return [];
  }

  function _axisFromConcept(concept, kind) {
    var c = String(concept || "").toLowerCase();
    if (!c) return "";
    if (c.indexOf("gender") >= 0 || c.indexOf("sex") >= 0) return "gender";
    if (c.indexOf("region") >= 0 || c.indexOf("area") >= 0 ||
        c.indexOf("city") >= 0 || c.indexOf("province") >= 0) return "region";
    if (c.indexOf("age") >= 0) return "age";
    if (c.indexOf("plan") >= 0 || c.indexOf("fare") >= 0 || c.indexOf("tariff") >= 0)
      return "plan";
    if (c.indexOf("consent") >= 0) return "consent";
    if (c.indexOf("join") >= 0 || c.indexOf("signup") >= 0 || c.indexOf("tenure") >= 0)
      return "joindate";
    if (String(kind || "").toLowerCase() === "range" && c.indexOf("date") >= 0)
      return "joindate";
    return "";
  }

  function _axisHintsFromText(slotText) {
    var t = String(slotText || "");
    var hints = [];
    function push(a) {
      for (var i = 0; i < hints.length; i++) if (hints[i] === a) return;
      hints.push(a);
    }
    if (/\bgender\b|\bsex\b/i.test(t)) push("gender");
    if (/\bage\b|\bagegroup\b/i.test(t)) push("age");
    if (/\bplan\b/i.test(t)) push("plan");
    if (/\bregion\b|\barea\b/i.test(t)) push("region");
    if (/\bconsent\b/i.test(t)) push("consent");
    if (/join\s*date|\bcreated\b|\bsignup\b|\btenure\b/i.test(t)) push("joindate");
    return hints;
  }

  function _axisAliasMatch(hint, axis) {
    if (!hint || !axis) return false;
    if (hint === axis) return true;
    if (hint === "plan" && axis.indexOf("plan") >= 0) return true;
    if (hint === "consent" && (axis.indexOf("consent") >= 0 || axis.indexOf("marketing") >= 0))
      return true;
    if (hint === "age" && (axis === "age" || axis === "agegroup")) return true;
    if (hint === "gender" && (axis === "gender" || axis === "sex")) return true;
    if (hint === "region" && (axis === "region" || axis === "area")) return true;
    if (hint === "joindate" &&
        (axis.indexOf("join") >= 0 || axis.indexOf("signup") >= 0 ||
         axis.indexOf("created") >= 0 || axis === "tenure"))
      return true;
    return false;
  }

  function axesCompatible(card, slotOrText) {
    var hints;
    if (slotOrText && typeof slotOrText === "object")
      hints = axisFromSlot(slotOrText);
    else
      hints = _axisHintsFromText(slotOrText);
    if (!hints.length) return true;
    var axis = axisFromCard(card);
    if (!axis) return false;
    for (var i = 0; i < hints.length; i++) {
      if (_axisAliasMatch(hints[i], axis)) return true;
    }
    return false;
  }

  function stemToken(raw) {
    return _trim(raw);
  }

  function isNoiseToken(raw) {
    return !_trim(raw);
  }

  function isNoiseResidue(text) {
    return !_trim(text || "");
  }

  function collectLexicon(cards, opts) {
    var identityOnly = !!(opts && opts.identityOnly);
    var out = [];
    var seen = {};
    var list = cards || [];
    function add(key, card) {
      var k = _trim(key);
      if (k.length < 2 || isNoiseToken(k)) return;
      var name = card && card.name ? String(card.name) : "";
      var id = _norm(k) + "|" + name;
      if (seen[id]) return;
      seen[id] = 1;
      out.push({
        key: k,
        name: name,
        axis: axisFromCard(card),
        card: card
      });
    }
    function addMap(map, card) {
      var nk, nv, dbv;
      if (!map || typeof map !== "object") return;
      for (nk in map) {
        if (!map.hasOwnProperty(nk)) continue;
        add(nk, card);
        nv = map[nk];
        dbv = entryDb(nv);
        if (dbv != null && typeof dbv !== "object") add(String(dbv), card);
      }
    }
    var ci, card, domain, k, spec, ei, syn, si, synParts;
    for (ci = 0; ci < list.length; ci++) {
      card = list[ci];
      if (!card) continue;
      domain = normalizeParamDomain(card.param_domain);
      for (k in domain) {
        if (!domain.hasOwnProperty(k) || String(k).charAt(0) === "_") continue;
        spec = domain[k] || {};
        addMap(spec.nlMap, card);
        if (spec.enum && typeof spec.enum.length === "number") {
          for (ei = 0; ei < spec.enum.length; ei++) add(spec.enum[ei], card);
        }
      }
      if (domain._bucket) addMap(domain._bucket.nlMap, card);
      _eachGroup(domain, function (gpk, alias, gentry) {
        add(alias, card);
        var gi;
        for (gi = 0; gi < gentry.members.length; gi++)
          add(gentry.members[gi], card);
      });
      if (identityOnly) {
        add(card.label, card);
      } else {
        syn = card.synonyms;
        if (typeof syn === "string") synParts = syn.split(/[,;]+/);
        else if (syn && typeof syn.length === "number") synParts = syn;
        else synParts = [];
        for (si = 0; si < synParts.length; si++) add(synParts[si], card);
      }
    }
    return out;
  }

  function _tokenAliasHitLoose(token, alias, dbHint, isGroup) {
    if (_tokenAliasHit(token, alias, dbHint, isGroup)) return true;
    var t = _norm(token);
    var a = _norm(alias);
    if (!t || !a || t.indexOf(a) !== 0) return false;
    return _isGlueTok(t.substring(a.length));
  }

  function _lexHitsInText(text, lexicon, loose) {
    text = String(text || "");
    if (!text || !lexicon || !lexicon.length) return [];
    var entries = [];
    var ei;
    for (ei = 0; ei < lexicon.length; ei++) entries.push(lexicon[ei]);
    entries.sort(function (a, b) {
      return String(b.key || "").length - String(a.key || "").length;
    });
    var used = [];
    var ui;
    for (ui = 0; ui < text.length; ui++) used.push(0);
    var hits = [];
    var k, klen, pos, at, overlap, hi, hLow, nLow;
    hLow = text.toLowerCase();
    for (ei = 0; ei < entries.length; ei++) {
      k = _trim(entries[ei] && entries[ei].key);
      klen = k.length;
      if (klen < 2) continue;
      nLow = k.toLowerCase();
      pos = 0;
      while (pos <= hLow.length - klen) {
        at = hLow.indexOf(nLow, pos);
        if (at < 0) break;
        overlap = false;
        for (hi = 0; hi < klen; hi++) {
          if (used[at + hi]) { overlap = true; break; }
        }
        if (!overlap) {
          var tokStart = at;
          var tokEnd = at + klen;
          while (tokStart > 0 && _isWordChar(text.charAt(tokStart - 1))) tokStart--;
          while (tokEnd < text.length && _isWordChar(text.charAt(tokEnd))) tokEnd++;
          var token = text.substring(tokStart, tokEnd);
          var hint = _lexHint(entries[ei].card, k);
          var okHit = loose ?
            _tokenAliasHitLoose(token, k, hint.db, hint.group) :
            _tokenAliasHit(token, k, hint.db, hint.group);
          if (!okHit) {
            pos = at + 1;
            continue;
          }
          for (hi = 0; hi < klen; hi++) used[at + hi] = 1;
          hits.push({
            start: at,
            key: k,
            name: entries[ei].name,
            axis: entries[ei].axis,
            card: entries[ei].card
          });
        }
        pos = at + 1;
      }
    }
    return hits;
  }

  var EN_MONTH = {
    january: 1, february: 1, march: 1, april: 1, june: 1,
    july: 1, august: 1, september: 1, october: 1, november: 1, december: 1,
    may: 1
  };

  function _shapeHitsInText(text) {
    var s = String(text || "");
    var hits = [];
    var pos = 0;
    var at, ds, n, prev;
    while (pos < s.length) {
      at = s.indexOf("\uC6D4", pos);
      if (at < 0) break;
      ds = at - 1;
      if (ds >= 0 && /[0-9]/.test(s.charAt(ds))) {
        if (ds > 0 && /[0-9]/.test(s.charAt(ds - 1))) ds = ds - 1;
        n = Number(s.substring(ds, at));
        prev = ds > 0 ? s.charAt(ds - 1) : "";
        if (!isNaN(n) && n >= 1 && n <= 12 && (ds === 0 || !_isWordChar(prev))) {
          hits.push({
            start: ds,
            key: s.substring(ds, at + 1),
            name: "",
            axis: "_shape_month",
            card: null
          });
        }
      }
      pos = at + 1;
    }
    var parts = s.split(/[^0-9a-zA-Z가-힣]+/);
    var pi, part, pl, idx, cursor;
    cursor = 0;
    for (pi = 0; pi < parts.length; pi++) {
      part = parts[pi];
      if (!part) continue;
      idx = s.indexOf(part, cursor);
      if (idx < 0) idx = s.toLowerCase().indexOf(part.toLowerCase(), cursor);
      if (idx < 0) continue;
      cursor = idx + part.length;
      pl = part.toLowerCase();
      if (EN_MONTH[pl] && (pl.length >= 4 || pl === "may")) {
        hits.push({
          start: idx,
          key: part,
          name: "",
          axis: "_shape_month",
          card: null
        });
      }
      if (/^\d{4}-\d{2}$/.test(part)) {
        hits.push({
          start: idx,
          key: part,
          name: "",
          axis: "_shape_month",
          card: null
        });
      }
    }
    return hits;
  }

  function splitByLexicon(nl, lexicon) {
    var text = String(nl || "");
    var hits = _lexHitsInText(text, lexicon, false);
    hits.sort(function (a, b) { return a.start - b.start; });
    var slots = [];
    var seen = {};
    var i, h, id, hintCat;
    for (i = 0; i < hits.length; i++) {
      h = hits[i];
      id = String(h.name || "") + ":" + _norm(h.key);
      if (seen[id]) continue;
      seen[id] = 1;
      hintCat = "demo";
      if (h.axis === "plan") hintCat = "plan";
      if (h.axis === "joindate") hintCat = "signup";
      slots.push({
        text: h.key,
        hintedCategory: hintCat,
        searchKeywords: [h.key, h.axis],
        resolvedName: h.name || ""
      });
    }
    return slots;
  }

  function mergeLexiconSlots(lexSlots, llmSlots) {
    var lex = lexSlots || [];
    var llm = llmSlots || [];
    if (!lex.length) return llm;
    var out = [];
    var i, j, s, covered, k;
    for (i = 0; i < lex.length; i++) out.push(lex[i]);
    for (i = 0; i < llm.length; i++) {
      s = llm[i];
      if (!s || isNoiseResidue(s.text)) continue;
      covered = false;
      for (j = 0; j < out.length; j++) {
        k = String(out[j].text || "");
        if (!k) continue;
        if (_ciHas(s.text, k) || _ciHas(k, s.text)) {
          var llmT = String(s.text || "");
          if (llmT.length > k.length && _ciHas(llmT, k) && !_ciHas(k, llmT))
            continue;
          covered = true;
          if (s.concept && !out[j].concept) out[j].concept = s.concept;
          if (s.en_literal && !out[j].en_literal) out[j].en_literal = s.en_literal;
          if (s.kind && !out[j].kind) out[j].kind = s.kind;
          break;
        }
      }
      if (!covered) out.push(s);
    }
    return out;
  }

  function _axisKey(h) {
    return String((h && h.axis) || "") + "|" + String((h && h.name) || "");
  }

  function _pushHitUnique(arr, seen, h) {
    if (!h || !h.key) return;
    var id = _axisKey(h) + "|" + _norm(h.key);
    if (seen[id]) return;
    seen[id] = 1;
    arr.push(h);
  }

  function _leftoverAfterHits(s, hits) {
    var toks = _slotContentTokens({ text: String((s && (s.text || s.surface)) || "") });
    var out = [];
    var i, t, covered, hi;
    for (i = 0; i < toks.length; i++) {
      t = toks[i];
      covered = false;
      for (hi = 0; hi < (hits || []).length; hi++) {
        if (_tokenAliasHitLoose(t, hits[hi].key, "", false)) {
          covered = true;
          break;
        }
      }
      if (!covered) out.push(t);
    }
    return out.length ? out.join(" ") : "";
  }

  function _contentKey(s) {
    var toks = _slotContentTokens({ text: String((s && (s.text || s.surface)) || "") });
    var i, keys = [];
    for (i = 0; i < toks.length; i++) keys.push(String(toks[i]).toLowerCase());
    keys.sort();
    return keys.join("|");
  }

  function _leftoverIsFull(s, leftover) {
    if (!leftover) return false;
    return _contentKey(s) === _contentKey({ text: leftover });
  }

  function _childFromHit(src, h) {
    var kws = [h.key];
    if (h.axis && String(h.axis).charAt(0) !== "_") kws.push(h.axis);
    return {
      id: "",
      text: h.key,
      surface: h.key,
      hintedCategory: (src && src.hintedCategory) || "",
      searchKeywords: kws,
      resolvedName: h.name || "",
      concept: null,
      en_literal: "",
      polarity: (src && src.polarity) || "include",
      kind: h.axis === "_shape_month" ? "categorical" : ((src && src.kind) || "")
    };
  }

  function _dedupSlots(slots) {
    var out = [];
    var seen = {};
    var i, s, id;
    for (i = 0; i < (slots || []).length; i++) {
      s = slots[i];
      if (!s) continue;
      id = _norm(s.resolvedName || "") + "|" + _norm(s.text || s.surface || "");
      if (seen[id]) continue;
      seen[id] = 1;
      out.push(s);
    }
    return out;
  }

  function splitCompoundSlots(slots, lexicon) {
    var out = [];
    var i, s, hits, seen, axes, leftover, hi, ak;
    for (i = 0; i < (slots || []).length; i++) {
      s = slots[i];
      if (!s) continue;
      var rawT = _trim(s.text || s.surface || "");
      var ndRange = _induceNDae(rawT);
      if (String(s.kind || "").toLowerCase() === "range" ||
          (ndRange && /[\~\u301C\uFF5E\-]/.test(rawT))) {
        out.push(s);
        continue;
      }
      hits = [];
      seen = {};
      var srcKo = String(s.text || s.surface || "");
      var raw = [];
      var r1 = _lexHitsInText(srcKo, lexicon, true);
      var r3 = _shapeHitsInText(srcKo);
      var ri;
      for (ri = 0; r1 && ri < r1.length; ri++) raw.push(r1[ri]);
      for (ri = 0; r3 && ri < r3.length; ri++) raw.push(r3[ri]);
      for (ri = 0; ri < raw.length; ri++) _pushHitUnique(hits, seen, raw[ri]);
      axes = [];
      seen = {};
      for (hi = 0; hi < hits.length; hi++) {
        ak = _axisKey(hits[hi]);
        if (seen[ak]) continue;
        seen[ak] = 1;
        axes.push(hits[hi]);
      }
      leftover = _leftoverAfterHits(s, axes);
      if (_leftoverIsFull(s, leftover)) leftover = "";
      if (axes.length >= 2 || (axes.length === 1 && leftover)) {
        try {
          if (typeof twDbg === "function")
            twDbg("splitCompound", "«" + srcKo + "» → " + axes.length +
              "축" + (leftover ? (" leftover=" + leftover) : ""));
        } catch (eSc) { /* skip */ }
        for (hi = 0; hi < axes.length; hi++)
          out.push(_childFromHit(s, axes[hi]));
        if (leftover)
          out.push(_coordChild(s, leftover, "", null));
        continue;
      }
      out.push(s);
    }
    return _dedupSlots(out);
  }

  function _pushUniqueTok(arr, seen, raw) {
    var s = _trim(raw);
    if (s.length < 2) return;
    var key = s.toLowerCase();
    if (seen[key]) return;
    seen[key] = 1;
    arr.push(s);
  }

  function buildIndexFields(opts) {
    opts = opts || {};
    var slotText = _trim(opts.slotText || "");
    var rationale = _trim(opts.rationale || "");
    var label = _trim(opts.label || "");
    var name = _trim(opts.name || "");
    var domain = normalizeParamDomain(opts.param_domain != null ? opts.param_domain : opts.paramDomain);

    var samples = [];
    if (slotText) samples.push(slotText);
    if (rationale) samples.push(rationale);
    if (!samples.length) samples.push(label || name || "");

    var syn = [];
    var seen = {};
    var parts = String(slotText).split(/[^0-9a-zA-Z가-힣]+/);
    var pi;
    for (pi = 0; pi < parts.length; pi++) _pushUniqueTok(syn, seen, parts[pi]);
    if (slotText) _pushUniqueTok(syn, seen, slotText);

    function pushNlMap(sm) {
      if (!sm || typeof sm !== "object") return;
      for (var sn in sm) {
        if (!sm.hasOwnProperty(sn)) continue;
        _pushUniqueTok(syn, seen, sn);
        var stL = String(sn).toLowerCase();
        if (stL !== sn) _pushUniqueTok(syn, seen, stL);
      }
    }
    var sk;
    for (sk in domain) {
      if (!domain.hasOwnProperty(sk)) continue;
      if (sk.charAt(0) === "_") continue;
      pushNlMap(domain[sk] && domain[sk].nlMap);
    }
    if (domain._bucket) pushNlMap(domain._bucket.nlMap);
    _eachGroup(domain, function (gpk, alias, gentry) {
      _pushUniqueTok(syn, seen, alias);
      var gei;
      for (gei = 0; gei < gentry.en.length; gei++)
        _pushUniqueTok(syn, seen, gentry.en[gei]);
    });

    return {
      synonyms: syn.length ? syn.join(",") : "",
      sample_questions: samples,
      sample_questions_json: JSON.stringify(samples)
    };
  }

  function likeFieldExprs() {
    return MATCH_PROFILE.likeFields.slice(0);
  }

  function scoreWeights() {
    var w = MATCH_PROFILE.scoreWeights;
    var out = {};
    for (var k in w) if (w.hasOwnProperty(k)) out[k] = w[k];
    return out;
  }

  function coverFieldNames() {
    return MATCH_PROFILE.coverFields.slice(0);
  }

  function matchProfile() {
    return {
      likeFields: likeFieldExprs(),
      scoreWeights: scoreWeights(),
      coverFields: coverFieldNames(),
      categoryHintBonus: MATCH_PROFILE.categoryHintBonus,
      libraryRequiresSource: MATCH_PROFILE.libraryRequiresSource,
      hintCatToAxis: HINT_CAT_TO_AXIS
    };
  }

  function keywordsFromSlot(slot) {
    var maxTok = 12;
    var maxLen = 40;
    try {
      if (testWoo.cfg && testWoo.cfg.getConfig) {
        var cfg = testWoo.cfg.getConfig();
        if (cfg.search && cfg.search.maxTokens) maxTok = cfg.search.maxTokens;
        if (cfg.guard && cfg.guard.MAX_TOKEN_LEN) maxLen = cfg.guard.MAX_TOKEN_LEN;
      }
    } catch (eC) { /* defaults */ }
    var seen = {};
    var out = [];
    function push(raw) {
      var s = _trim(raw);
      if (!s || s.length < 2) return;
      if (s.length > maxLen) s = s.substring(0, maxLen);
      var key = s.toLowerCase();
      if (!seen[key]) {
        seen[key] = true;
        out.push(s);
      }
      var compact = _norm(s);
      if (compact && !seen[compact]) {
        seen[compact] = true;
        out.push(compact);
      }
    }
    if (!slot) return [];
    var kws = slot.searchKeywords;
    if (kws && _isArray(kws)) {
      for (var i = 0; i < kws.length; i++) push(kws[i]);
    }
    if (slot.text) {
      var raw = String(slot.text).split(/[^0-9a-zA-Z가-힣]+/);
      for (var j = 0; j < raw.length; j++) push(raw[j]);
    }
    // 값 토큰이 색인에 없어도 tags=age LIKE로 축 frag를 찾는다.
    var hints = axisFromSlot(slot);
    for (var hi = 0; hi < hints.length; hi++) push(hints[hi]);
    return out.slice(0, Math.max(maxTok * 3, 12));
  }

  function _fieldBlob(card, field) {
    if (!card) return "";
    var v = card[field];
    if (v == null) return "";
    if (field === "sample_questions") {
      if (typeof v === "object" && typeof v.length === "number") return v.join(" ");
      return String(v);
    }
    if (field === "param_domain") {
      if (typeof v === "object") {
        try { return JSON.stringify(v); } catch (eJ) { return String(v); }
      }
      return String(v);
    }
    return String(v);
  }

  function _coverBlob(card) {
    var fields = MATCH_PROFILE.coverFields;
    var parts = [];
    for (var i = 0; i < fields.length; i++)
      parts.push(_fieldBlob(card, fields[i]));
    return parts.join(" ").toLowerCase().replace(/\s+/g, "");
  }

  function _isGlueTok(raw) {
    var t = String(raw || "").toLowerCase();
    if (!t) return true;
    return !!GLUE_TOK[t];
  }

  function _slotContentTokens(slot) {
    var out = [];
    var seen = {};
    function addChunk(raw) {
      var parts = String(raw || "").split(/[^0-9a-zA-Z가-힣]+/);
      var i, t, key;
      for (i = 0; i < parts.length; i++) {
        t = _trim(parts[i]);
        if (t.length < 2 || _isGlueTok(t)) continue;
        key = t.toLowerCase();
        if (seen[key]) continue;
        seen[key] = 1;
        out.push(t);
      }
    }
    if (!slot) return out;
    if (typeof slot === "string") {
      addChunk(slot);
      return out;
    }
    addChunk(slot.text);
    addChunk(slot.en_literal);
    var kws = slot.searchKeywords;
    if (kws && _isArray(kws)) {
      var ki;
      for (ki = 0; ki < kws.length; ki++) addChunk(kws[ki]);
    }
    return out;
  }

  function _xpathLeaf(domain, card) {
    var src = domain && domain._source;
    var leaf = src && src.xpath ? String(src.xpath) : "";
    leaf = leaf.replace(/^@/, "").replace(/.*\//, "");
    if (!leaf && card && card.name) {
      var segs = String(card.name).split("__");
      leaf = segs.length ? segs[segs.length - 1] : "";
    }
    return leaf;
  }

  // 컬럼 고유 토큰. tags 축·색인 문장은 넣지 않음(오염된 synonyms가 leftover를 삼킴).
  function _distinctiveIdentityToks(card, domain) {
    var out = [];
    var seen = {};
    var axis = axisFromCard(card);
    function add(raw) {
      var parts = String(raw || "").toLowerCase().split(/[^0-9a-zA-Z가-힣]+/);
      var i, t;
      for (i = 0; i < parts.length; i++) {
        t = parts[i];
        if (t.length < 3 || _isGlueTok(t)) continue;
        if (axis && t === String(axis).toLowerCase()) continue;
        if (seen[t]) continue;
        seen[t] = 1;
        out.push(t);
      }
    }
    add(_xpathLeaf(domain, card));
    if (card && card.label) add(card.label);
    if (domain && domain._source && domain._source.concept)
      add(domain._source.concept);
    return out;
  }

  function _hayHasTok(hayToks, blob, tok) {
    var t = String(tok || "").toLowerCase();
    if (!t) return false;
    var i;
    for (i = 0; i < hayToks.length; i++) {
      if (String(hayToks[i] || "").toLowerCase() === t) return true;
    }
    return false;
  }

  function _hasCoord(slotObj) {
    var s = String((slotObj && slotObj.text) || "") + " " +
      String((slotObj && slotObj.en_literal) || "");
    return /및|\band\b|[가-힣]와\s|[가-힣]과\s/.test(s);
  }

  // leftover는 및/and 가 있을 때만. 값 번역(July/teens)은 같은 필터이지 신규 축이 아님.
  function slotCoverParts(card, slot, domainRaw) {
    var slotObj = (slot && typeof slot === "object") ? slot :
      { text: String(slot || ""), searchKeywords: [] };
    var domain = normalizeParamDomain(domainRaw != null ? domainRaw :
      (card && card.param_domain));
    var dist = _distinctiveIdentityToks(card, domain);
    var hay = _slotContentTokens(slotObj);
    var blob = (String(slotObj.en_literal || "") + " " +
      String(slotObj.text || "")).toLowerCase();
    var identityHit = false;
    var di;
    for (di = 0; di < dist.length; di++) {
      if (_hayHasTok(hay, blob, dist[di])) { identityHit = true; break; }
    }
    var covered = [];
    var leftoverKo = [];
    var leftoverEn = [];
    var axis = axisFromCard(card);
    var i, t, tl;
    function _axisOrDist(tok) {
      var x = String(tok || "").toLowerCase();
      if (axis && x === String(axis).toLowerCase()) return true;
      return _hayHasTok(dist, dist.join(" "), x);
    }
    for (i = 0; i < hay.length; i++) {
      t = hay[i];
      if (domainMatchSlot(domain, t)) {
        covered.push(t);
        continue;
      }
      if (_axisOrDist(t)) {
        covered.push(t);
        continue;
      }
      leftoverKo.push(t);
    }
    var enToks = _slotContentTokens({ text: slotObj.en_literal || "" });
    for (i = 0; i < enToks.length; i++) {
      t = enToks[i];
      if (domainMatchSlot(domain, t)) {
        covered.push(t);
        continue;
      }
      if (_axisOrDist(t)) {
        covered.push(t);
        continue;
      }
      leftoverEn.push(t);
    }
    var leftover = [];
    if (_hasCoord(slotObj))
      leftover = leftoverEn.length ? leftoverEn : leftoverKo;
    return {
      covered: covered,
      leftover: leftover,
      identityHit: identityHit
    };
  }

  function _splitCoordOnce(text, kind) {
    var s = _trim(text);
    if (!s) return null;
    var m = kind === "en" ?
      s.match(/^([\s\S]+?)\s+\band\b\s+([\s\S]+)$/i) :
      s.match(/^([\s\S]+?)\s*(및|와|과)\s+([\s\S]+)$/);
    if (!m) return null;
    var left = _trim(m[1]);
    var right = _trim(kind === "en" ? m[2] : m[3]);
    if (!left || !right) return null;
    var lToks = _slotContentTokens({ text: left });
    var rToks = _slotContentTokens({ text: right });
    if (!lToks.length || !rToks.length) return null;
    return { left: left, right: right, lToks: lToks, rToks: rToks };
  }

  function _coordChild(src, text, enLit, spec) {
    return {
      id: "",
      text: text,
      surface: text,
      hintedCategory: src.hintedCategory || "",
      searchKeywords: spec ? [spec] : [],
      resolvedName: "",
      concept: null,
      en_literal: enLit || "",
      polarity: src.polarity || "include",
      kind: src.kind || ""
    };
  }

  // A 및 B HEAD → A HEAD + B HEAD. 범위(kind=range)는 나누지 않음.
  function splitCoordSlots(slots) {
    var out = [];
    var i, s, ko, en, leftKo, rightKo, leftEn, rightEn, head;
    for (i = 0; i < (slots || []).length; i++) {
      s = slots[i];
      if (!s) continue;
      if (String(s.kind || "").toLowerCase() === "range") {
        out.push(s);
        continue;
      }
      ko = _splitCoordOnce(s.text || s.surface || "", "ko");
      en = _splitCoordOnce(s.en_literal || "", "en");
      if (!ko && !en) {
        out.push(s);
        continue;
      }
      leftKo = ko ? ko.left : "";
      rightKo = ko ? ko.right : "";
      if (ko && ko.lToks.length === 1 && ko.rToks.length >= 2) {
        head = ko.rToks.slice(1).join(" ");
        leftKo = ko.lToks[0] + (head ? " " + head : "");
        rightKo = ko.right;
      }
      leftEn = en ? en.left : String(s.en_literal || "");
      rightEn = en ? en.right : String(s.en_literal || "");
      out.push(_coordChild(s, leftKo || leftEn, leftEn, ko ? ko.lToks[0] :
        (en && en.lToks.length ? en.lToks[en.lToks.length - 1] : "")));
      out.push(_coordChild(s, rightKo || rightEn, rightEn, ko ? ko.rToks[0] :
        (en && en.rToks.length ? en.rToks[0] : "")));
    }
    for (i = 0; i < out.length; i++) out[i].id = "s" + (i + 1);
    return out;
  }

  function coversSlot(card, slot) {
    if (!card) return false;
    var slotObj = (slot && typeof slot === "object") ? slot :
      { text: String(slot || ""), searchKeywords: [] };
    if (!axesCompatible(card, slotObj)) return false;
    var parts = slotCoverParts(card, slotObj, card.param_domain);
    return parts.leftover.length === 0 && parts.covered.length > 0;
  }

  function _isEnPair(v) {
    return !!(v && typeof v === "object" && !_isArray(v) &&
      (v.db != null || _isArray(v.en)));
  }

  function entryDb(v) {
    if (_isEnPair(v) && v.db != null) return v.db;
    return v;
  }

  function _normalizeMembers(raw) {
    var arr = _isArray(raw) ? raw : (raw != null && raw !== "" ? [raw] : []);
    var out = [];
    var seen = {};
    var i, s;
    for (i = 0; i < arr.length; i++) {
      if (arr[i] != null && typeof arr[i] === "object") continue;
      s = String(arr[i]);
      if (!s || seen[s]) continue;
      seen[s] = 1;
      out.push(s);
    }
    return out;
  }

  function _normalizeGroupEntry(raw) {
    if (!raw || typeof raw !== "object" || _isArray(raw)) return null;
    var members = _normalizeMembers(raw.members);
    if (!members.length) return null;
    var src = String(raw.src || "llm").toLowerCase();
    if (src !== "human") src = "llm";
    var en = [];
    var seenEn = {};
    var ei, e;
    if (_isArray(raw.en)) {
      for (ei = 0; ei < raw.en.length; ei++) {
        if (raw.en[ei] != null && typeof raw.en[ei] === "object") continue;
        e = _trim(raw.en[ei]);
        if (e.length < 2 || seenEn[e.toLowerCase()]) continue;
        seenEn[e.toLowerCase()] = 1;
        en.push(e);
      }
    }
    return {
      members: members,
      src: src,
      verified: raw.verified === true || raw.verified === "true",
      en: en
    };
  }

  function _aliasParamKeyLocal(key) {
    var k = String(key || "");
    if (!k) return "";
    if (k.indexOf("_") >= 0)
      return k.replace(/_([a-zA-Z])/g, function (_, c) {
        return String(c).toUpperCase();
      });
    return k.replace(/[A-Z]/g, function (c) {
      return "_" + String(c).toLowerCase();
    });
  }

  function _paramCandidates(domain, pk) {
    var out = [];
    var seen = {};
    function add(v) {
      if (v == null || typeof v === "object") return;
      var s = String(v);
      if (!s || seen[s]) return;
      seen[s] = 1;
      out.push(s);
    }
    function addFromSpec(spec) {
      if (!spec) return;
      var ei, nk;
      if (spec.enum && _isArray(spec.enum)) {
        for (ei = 0; ei < spec.enum.length; ei++) add(spec.enum[ei]);
      }
    }
    function addNl(spec) {
      if (!spec || !spec.nlMap || typeof spec.nlMap !== "object") return;
      var nk;
      for (nk in spec.nlMap) {
        if (!spec.nlMap.hasOwnProperty(nk)) continue;
        add(entryDb(spec.nlMap[nk]));
      }
    }
    var spec = (domain && domain[pk]) || {};
    var alt = _aliasParamKeyLocal(pk);
    var altSpec = (alt && alt !== pk && domain) ? domain[alt] : null;
    addFromSpec(spec);
    addFromSpec(altSpec);
    if (out.length) return out;
    addNl(spec);
    addNl(altSpec);
    return out;
  }

  function _isCandDb(domain, pk, val) {
    if (val == null || typeof val === "object") return false;
    var cand = _paramCandidates(domain, pk);
    var s = String(val);
    var i;
    for (i = 0; i < cand.length; i++) {
      if (String(cand[i]) === s) return true;
    }
    return false;
  }

  function _finestValue(domain, pk, alias, stored) {
    var a = alias != null ? String(alias) : "";
    if (a && _isCandDb(domain, pk, a)) return a;
    if (stored != null && stored !== "" && typeof stored !== "object" &&
        _isCandDb(domain, pk, stored))
      return stored;
    var cand = _paramCandidates(domain, pk);
    if (!cand.length) return stored;
    return null;
  }

  function _filterGroupMembers(domain, pk, members) {
    var cand = _paramCandidates(domain, pk);
    var src = _normalizeMembers(members);
    if (!cand.length) return src;
    var allow = {};
    var i, m, out = [];
    for (i = 0; i < cand.length; i++) allow[String(cand[i])] = 1;
    for (i = 0; i < src.length; i++) {
      m = String(src[i]);
      if (allow[m]) out.push(m);
    }
    return out;
  }

  function _eachGroup(domain, fn) {
    var g = domain && domain._group;
    if (!g || typeof g !== "object" || _isArray(g)) return;
    var pk, alias, bucket, entry;
    for (pk in g) {
      if (!g.hasOwnProperty(pk) || String(pk).charAt(0) === "_") continue;
      bucket = g[pk];
      if (!bucket || typeof bucket !== "object" || _isArray(bucket)) continue;
      for (alias in bucket) {
        if (!bucket.hasOwnProperty(alias)) continue;
        entry = _normalizeGroupEntry(bucket[alias]);
        if (!entry) continue;
        fn(String(pk), String(alias), entry);
      }
    }
  }

  function _mergeGroupBlock(base, incGroup) {
    if (!incGroup || typeof incGroup !== "object" || _isArray(incGroup)) return false;
    if (!base._group || typeof base._group !== "object" || _isArray(base._group))
      base._group = {};
    var changed = false;
    var pk, alias, incB, incE, baseE, mi, bj, found, merged;
    for (pk in incGroup) {
      if (!incGroup.hasOwnProperty(pk) || String(pk).charAt(0) === "_") continue;
      incB = incGroup[pk];
      if (!incB || typeof incB !== "object" || _isArray(incB)) continue;
      if (!base._group[pk] || typeof base._group[pk] !== "object")
        base._group[pk] = {};
      for (alias in incB) {
        if (!incB.hasOwnProperty(alias)) continue;
        incE = _normalizeGroupEntry(incB[alias]);
        if (!incE) continue;
        baseE = _normalizeGroupEntry(base._group[pk][alias]);
        if (!baseE) {
          base._group[pk][alias] = incE;
          changed = true;
          continue;
        }
        merged = baseE.members.slice(0);
        for (mi = 0; mi < incE.members.length; mi++) {
          found = false;
          for (bj = 0; bj < merged.length; bj++) {
            if (String(merged[bj]) === String(incE.members[mi])) { found = true; break; }
          }
          if (!found) {
            merged.push(incE.members[mi]);
            changed = true;
          }
        }
        baseE.members = merged;
        if (baseE.src !== "human") {
          if (incE.src === "human") {
            baseE.src = "human";
            changed = true;
          } else if (incE.src && incE.src !== baseE.src) {
            baseE.src = incE.src;
          }
        }
        if (!baseE.verified && incE.verified) {
          baseE.verified = true;
          changed = true;
        }
        if (incE.en && incE.en.length) {
          if (!baseE.en) baseE.en = [];
          for (mi = 0; mi < incE.en.length; mi++) {
            found = false;
            for (bj = 0; bj < baseE.en.length; bj++) {
              if (String(baseE.en[bj]).toLowerCase() === String(incE.en[mi]).toLowerCase()) {
                found = true;
                break;
              }
            }
            if (!found) {
              baseE.en.push(incE.en[mi]);
              changed = true;
            }
          }
        }
        base._group[pk][alias] = baseE;
      }
    }
    return changed;
  }

  function upsertGroup(domainRaw, param, alias, members, meta) {
    var domain = normalizeParamDomain(domainRaw);
    var pk = _trim(param);
    var a = _trim(alias);
    if (!pk || !a || a.length > 24) return domain;
    meta = meta || {};
    var enIn = meta.en;
    var block = {};
    block[pk] = {};
    block[pk][a] = {
      members: _normalizeMembers(members),
      src: String(meta.src || "llm").toLowerCase() === "human" ? "human" : "llm",
      verified: meta.verified === true || meta.verified === "true",
      en: _isArray(enIn) ? enIn : (enIn ? [enIn] : [])
    };
    _mergeGroupBlock(domain, block);
    var g = domain._group && domain._group[pk] && domain._group[pk][a];
    if (g && g.members)
      g.members = _filterGroupMembers(domain, pk, g.members);
    return domain;
  }

  function _paramBound(params, pk) {
    if (!params || !pk) return null;
    if (params[pk] != null && params[pk] !== "") return params[pk];
    var want = String(pk).toLowerCase().replace(/_/g, "");
    var k, kn;
    for (k in params) {
      if (!params.hasOwnProperty(k)) continue;
      kn = String(k).toLowerCase().replace(/_/g, "");
      if (kn === want && params[k] != null && params[k] !== "") return params[k];
    }
    return null;
  }

  function _sameMemberSet(a, b) {
    var aa = _normalizeMembers(a);
    var bb = _normalizeMembers(b);
    if (!aa.length || aa.length !== bb.length) return false;
    var seen = {};
    var i;
    for (i = 0; i < aa.length; i++) seen[String(aa[i]).toLowerCase()] = 1;
    for (i = 0; i < bb.length; i++) {
      if (!seen[String(bb[i]).toLowerCase()]) return false;
    }
    return true;
  }

  function groupHintForParams(domainRaw, params) {
    var domain = normalizeParamDomain(domainRaw);
    if (!domain || !domain._group || !params) return null;
    var pk, alias, g, bound, hitUnverified = null, hitVerified = null;
    var block, hint;
    for (pk in domain._group) {
      if (!domain._group.hasOwnProperty(pk)) continue;
      bound = _paramBound(params, pk);
      if (bound == null) continue;
      block = domain._group[pk];
      for (alias in block) {
        if (!block.hasOwnProperty(alias)) continue;
        g = block[alias];
        if (!g || !_sameMemberSet(g.members, bound)) continue;
        hint = {
          param: pk,
          alias: alias,
          members: g.members,
          verified: g.verified === true || g.verified === "true",
          src: g.src || "llm"
        };
        if (!hint.verified) hitUnverified = hint;
        else if (!hitVerified) hitVerified = hint;
      }
    }
    return hitUnverified || hitVerified;
  }

  function displayHintForParams(domainRaw, params) {
    var domain = normalizeParamDomain(domainRaw);
    if (!domain || !params) return null;
    var pk, spec, map, nk, dbv, val, hint = null;
    for (pk in params) {
      if (!params.hasOwnProperty(pk)) continue;
      if (String(pk).charAt(0) === "_") continue;
      val = params[pk];
      if (val == null || typeof val === "object") continue;
      spec = domain[pk] || {};
      map = spec.nlMap;
      if (!map || typeof map !== "object") continue;
      if (map[String(val)]) {
        hint = { param: pk, alias: String(val), value: String(val) };
        continue;
      }
      for (nk in map) {
        if (!map.hasOwnProperty(nk)) continue;
        dbv = entryDb(map[nk]);
        if (dbv != null && String(dbv) === String(val)) {
          hint = { param: pk, alias: String(nk), value: String(val) };
          break;
        }
      }
    }
    return hint;
  }

  function domainMatchSlot(domainRaw, slotText) {
    var domain = normalizeParamDomain(domainRaw);
    if (!domain) return null;
    var text = String(slotText || "");
    if (!text) return null;
    if (domain._bucket && domain._bucket.nlMap && domain._bucket.nlMap[text] != null)
      return { param: "_bucket", nl: text, value: entryDb(domain._bucket.nlMap[text]) };
    var nd0 = _induceNDae(text);
    if (nd0 && _domainAcceptsNDae(domain))
      return { param: "_bucket", nl: text, value: nd0 };
    var nw0 = _induceNWol(text);
    if (nw0) {
      var ymHits = _yearMonthsInDomain(domain, nw0.month);
      if (ymHits.length === 1)
        return { param: ymHits[0].param, nl: text, value: ymHits[0].value };
      if (ymHits.length > 1) {
        var ymVals = [];
        var ymi;
        for (ymi = 0; ymi < ymHits.length; ymi++) ymVals.push(ymHits[ymi].value);
        return { param: ymHits[0].param, nl: text, value: ymVals };
      }
    }
    var k;
    for (k in domain) {
      if (!domain.hasOwnProperty(k)) continue;
      if (k.charAt(0) === "_") continue;
      var spec = domain[k] || {};
      var map = spec.nlMap;
      var nk, dbv, bound;
      var en = spec.enum;
      if (en && typeof en.length === "number") {
        for (var ei = 0; ei < en.length; ei++) {
          if (_boundHas(text, en[ei], en[ei], false))
            return { param: k, value: en[ei] };
        }
      }
      if (map && typeof map === "object") {
        for (nk in map) {
          if (!map.hasOwnProperty(nk)) continue;
          dbv = entryDb(map[nk]);
          if (_boundHas(text, nk, dbv, false) ||
              (dbv != null && typeof dbv !== "object" && _boundHas(text, dbv, dbv, false))) {
            bound = _finestValue(domain, k, nk, dbv != null ? dbv : map[nk]);
            if (bound == null) continue;
            return { param: k, nl: String(nk), value: bound };
          }
        }
      }
    }
    if (domain._bucket && domain._bucket.nlMap) {
      var bm = domain._bucket.nlMap;
      for (nk in bm) {
        if (!bm.hasOwnProperty(nk)) continue;
        if (_boundHas(text, nk, null, true))
          return { param: "_bucket", nl: String(nk), value: entryDb(bm[nk]) };
      }
    }
    var bestAlias = "";
    var bestPk = "";
    var bestMembers = null;
    _eachGroup(domain, function (gpk, alias, gentry) {
      if (!_boundHas(text, alias, null, true)) return;
      if (_isCandDb(domain, gpk, alias)) {
        if (String(alias).length >= String(bestAlias).length) {
          bestAlias = alias;
          bestPk = gpk;
          bestMembers = [alias];
        }
        return;
      }
      var mem = _filterGroupMembers(domain, gpk, gentry.members);
      if (!mem.length) return;
      if (String(alias).length >= String(bestAlias).length) {
        bestAlias = alias;
        bestPk = gpk;
        bestMembers = mem;
      }
    });
    if (bestMembers) {
      if (bestMembers.length === 1 && String(bestMembers[0]) === bestAlias &&
          _isCandDb(domain, bestPk, bestAlias))
        return { param: bestPk, nl: bestAlias, value: bestAlias };
      return { param: bestPk, nl: bestAlias, value: bestMembers, group: true };
    }
    return null;
  }

  var HEAL_COOLDOWN_MS = 600000;
  var NEGATIVE_TTL_MS = 86400000;

  function _healCooldownMs() {
    try {
      var env = testWoo.env && testWoo.env.getEnv ? testWoo.env.getEnv() : null;
      var t = env && env.triage;
      if (t && t.healCooldownMs != null) {
        var n = Number(t.healCooldownMs);
        if (!isNaN(n) && n >= 0) return n;
      }
    } catch (eC) { /* default */ }
    return HEAL_COOLDOWN_MS;
  }

  function _negativeTtlMs() {
    try {
      var env = testWoo.env && testWoo.env.getEnv ? testWoo.env.getEnv() : null;
      var t = env && env.triage;
      if (t && t.negativeTtlMs != null) {
        var n = Number(t.negativeTtlMs);
        if (!isNaN(n) && n >= 0) return n;
      }
    } catch (eT) { /* default */ }
    return NEGATIVE_TTL_MS;
  }

  function conceptOf(domainRaw) {
    var domain = normalizeParamDomain(domainRaw);
    var src = domain && domain._source;
    return src && src.concept ? String(src.concept) : "";
  }

  function _conceptsAxisMatch(slotConcept, domainConcept, kind) {
    var sc = String(slotConcept || "");
    var dc = String(domainConcept || "");
    if (!sc || !dc) return false;
    if (sc === dc) return true;
    var sa = _axisFromConcept(sc, kind);
    var da = _axisFromConcept(dc, "");
    return !!(sa && da && sa === da);
  }

  function conceptsAxisMatch(slotConcept, domainConcept, kind) {
    return _conceptsAxisMatch(slotConcept, domainConcept, kind);
  }

  function _domainKind(domain) {
    var src = domain && domain._source;
    var t = src ? String(src.tier || src.kind || "").toLowerCase() : "";
    if (t === "enum" || t === "categorical") return "categorical";
    if (t === "range") return "range";
    if (t === "boolean") return "boolean";
    if (domain && domain._bucket) return "range";
    return "categorical";
  }

  function kindCompatible(slotKind, domainRaw) {
    var sk = String(slotKind || "other").toLowerCase();
    var dk = _domainKind(normalizeParamDomain(domainRaw));
    if (!sk || sk === "other") return true;
    return sk === dk;
  }

  function _dbKey(db) {
    if (db != null && typeof db === "object") {
      try { return JSON.stringify(db); } catch (eJ) { return String(db); }
    }
    return String(db);
  }

  function _enList(v) {
    if (_isEnPair(v) && _isArray(v.en)) return v.en;
    return null;
  }

  function _enHit(entry, lit) {
    var ens = _enList(entry);
    var n = _norm(lit);
    if (!ens || !n || n.length < 2) return false;
    var i, e, toks, ti, tok;
    toks = n.split(/[^a-z0-9]+/);
    for (i = 0; i < ens.length; i++) {
      e = _norm(ens[i]);
      if (!e || e.length < 2) continue;
      if (n === e) return true;
      for (ti = 0; ti < toks.length; ti++) {
        tok = toks[ti];
        if (!tok || tok.length < 2) continue;
        if (/^\d{1,2}$/.test(tok)) continue;
        if (tok === e) return true;
      }
    }
    return false;
  }

  function _walkNlMaps(domain, fn) {
    var k, spec, map, nk;
    for (k in domain) {
      if (!domain.hasOwnProperty(k)) continue;
      if (k.charAt(0) === "_") continue;
      spec = domain[k] || {};
      map = spec.nlMap;
      if (!map || typeof map !== "object") continue;
      for (nk in map) {
        if (!map.hasOwnProperty(nk)) continue;
        fn(k, String(nk), map[nk]);
      }
    }
    if (domain._bucket && domain._bucket.nlMap) {
      map = domain._bucket.nlMap;
      for (nk in map) {
        if (!map.hasOwnProperty(nk)) continue;
        fn("_bucket", String(nk), map[nk]);
      }
    }
    _eachGroup(domain, function (gpk, alias, gentry) {
      fn(gpk, alias, { db: gentry.members, en: gentry.en });
    });
  }

  function matchEnPivotSlot(domainRaw, slot) {
    var domain = normalizeParamDomain(domainRaw);
    var empty = { layer: null, param: "", nl: "", value: null, ambiguous: false, hits: [] };
    if (!domain || !slot) return empty;
    var surface = String(slot.surface || slot.text || "");
    var enLit = String(slot.en_literal || "");
    var concept = String(slot.concept || "");
    var kind = String(slot.kind || "");
    var m1 = surface ? domainMatchSlot(domain, surface) : null;
    if (m1)
      return {
        layer: m1.group ? "M2G" : "M1", param: m1.param, nl: m1.nl || "",
        value: m1.value, ambiguous: false, group: !!m1.group, hits: [m1]
      };
    if (_domainAcceptsNDae(domain)) {
      var ndE = _induceNDae(enLit);
      if (ndE)
        return {
          layer: "M1", param: "_bucket", nl: surface || enLit,
          value: ndE, ambiguous: false, group: false,
          hits: [{ param: "_bucket", nl: surface || enLit, value: ndE }]
        };
    }
    var hits = [];
    var seen = {};
    _walkNlMaps(domain, function (param, nl, entry) {
      var db = entryDb(entry);
      var isG = _isArray(db);
      var dbHint = isG ? "" : db;
      var koOk = surface && (_boundHas(surface, nl, dbHint, isG) ||
        (!isG && db != null && typeof db !== "object" &&
          _boundHas(surface, String(db), db, false)));
      var enOk = !!(enLit && _enHit(entry, enLit));
      if (surface && !koOk && enOk && _aliasPrefixConflict(surface, nl, dbHint, isG))
        enOk = false;
      if (!koOk && !enOk) return;
      var key = param + "|" + _dbKey(db);
      if (seen[key]) return;
      seen[key] = 1;
      hits.push({ param: param, nl: nl, value: db });
    });
    if (hits.length === 1) {
      var gHit = _isArray(hits[0].value);
      return {
        layer: gHit ? "M2G" : "M2", param: hits[0].param, nl: hits[0].nl,
        value: hits[0].value, ambiguous: false, group: gHit, hits: hits
      };
    }
    if (hits.length > 1)
      return {
        layer: "M2", param: "", nl: "", value: null,
        ambiguous: true, hits: hits
      };
    var locked = conceptOf(domain);
    if (concept && locked && _conceptsAxisMatch(concept, locked, kind) &&
        kindCompatible(kind, domain))
      return {
        layer: "M3", param: "", nl: "", value: null,
        ambiguous: false, hits: [], concept: locked, kindOk: true
      };
    return empty;
  }

  function isNegative(domainRaw, key, nowMs) {
    var domain = normalizeParamDomain(domainRaw);
    var neg = domain && domain._negative;
    if (!neg || typeof neg !== "object") return false;
    var k = String(key || "");
    if (!k || neg[k] == null) return false;
    var ts = Number(neg[k]);
    if (isNaN(ts)) return false;
    var now = nowMs != null ? Number(nowMs) : new Date().getTime();
    return (now - ts) < _negativeTtlMs();
  }

  function markNegative(domainRaw, key, nowMs) {
    var domain = normalizeParamDomain(domainRaw);
    var k = String(key || "");
    if (!k) return domain;
    if (!domain._negative || typeof domain._negative !== "object") domain._negative = {};
    domain._negative[k] = nowMs != null ? Number(nowMs) : new Date().getTime();
    return domain;
  }

  function inHealCooldown(domainRaw, nowMs) {
    var domain = normalizeParamDomain(domainRaw);
    var src = domain && domain._source;
    if (!src || src.healAt == null) return false;
    var ts = Number(src.healAt);
    if (isNaN(ts)) return false;
    var now = nowMs != null ? Number(nowMs) : new Date().getTime();
    return (now - ts) < _healCooldownMs();
  }

  function stampHeal(domainRaw, nowMs) {
    var domain = normalizeParamDomain(domainRaw);
    if (!domain._source || typeof domain._source !== "object") domain._source = {};
    domain._source.healAt = nowMs != null ? Number(nowMs) : new Date().getTime();
    return domain;
  }

  function _isSingleAxisCached(card, domain) {
    if (!domain || !domain._source) return false;
    var axes = _tagAxes(card && card.tags);
    return axes.length === 1;
  }

  // 서가 identity = 축 + _source + 단일 tags. 값 미등재(도메인 매칭)는 heal.
  // 색인에 없는 내용 명사가 남으면 히트 금지(같은 축 다른 컬럼 삼킴 방지).
  function libraryHitPredicate(card, slot, domainRaw) {
    if (!card) return false;
    var slotObj = (slot && typeof slot === "object") ? slot :
      { text: String(slot || ""), searchKeywords: [] };
    var slotText = String(slotObj.text || "");
    var domain = normalizeParamDomain(domainRaw != null ? domainRaw : card.param_domain);
    if (MATCH_PROFILE.libraryRequiresSource && (!domain || !domain._source))
      return false;
    if (!axesCompatible(card, slotObj)) return false;
    var parts = slotCoverParts(card, slotObj, domain);
    if (parts.leftover.length) return false;
    if (parts.covered.length) return true;
    var hints = axisFromSlot(slotObj);
    if (!hints.length) return !!domainMatchSlot(domain, slotText);
    if (!_isSingleAxisCached(card, domain)) return false;
    return true;
  }

  function sampleBindSql(sqlText, domainRaw) {
    var domain = normalizeParamDomain(domainRaw);
    var unbound = [];
    var sql = promoteEqPlaceholderToIn(sqlText);
    var out = String(sql || "").replace(/\{\{(\w+)\}\}/g, function (_m, key) {
      var spec = domain[key] || {};
      var map = spec.nlMap;
      var nk, nv, bk, b;
      if (map && typeof map === "object") {
        for (nk in map) {
          if (!map.hasOwnProperty(nk)) continue;
          nv = entryDb(map[nk]);
          if (_isArray(nv) && nv.length) return _sqlLitJoin(nv);
          if (nv != null && typeof nv !== "object") return _sqlLit(nv);
        }
      }
      if (spec.enum && _isArray(spec.enum) && spec.enum.length)
        return _sqlLitJoin(spec.enum[0]);
      if (domain._bucket && domain._bucket.nlMap) {
        for (bk in domain._bucket.nlMap) {
          if (!domain._bucket.nlMap.hasOwnProperty(bk)) continue;
          b = entryDb(domain._bucket.nlMap[bk]);
          if (b && b[key] != null) {
            if (_isArray(b[key])) return _sqlLitJoin(b[key]);
            if (typeof b[key] !== "object") return _sqlLit(b[key]);
          }
        }
      }
      if (key === "ageMin") return "20";
      if (key === "ageMax") return "30";
      var typ = String(spec.type || "").toLowerCase();
      if (typ === "int" || typ === "integer" || typ === "long" || typ === "number" ||
          typ === "byte" || typ === "short" || typ === "float" || typ === "double")
        return "0";
      unbound.push(key);
      return "'__sample__'";
    });
    if (unbound.length)
      logCode(ERROR_CODES.BIND_TYPE, "fallback __sample__ keys=" + unbound.join(","));
    return out;
  }

  // Compiler bindPlanParams 와 동일 해석 — haystack에서 nlMap/_bucket → params
  function resolveNlParams(domainRaw, haystack, needKeys) {
    var domain = normalizeParamDomain(domainRaw);
    var hay = String(haystack || "");
    var need = needKeys || null;
    var params = {};
    var pk;
    var ndHay = _induceNDae(hay);
    if (ndHay && _domainAcceptsNDae(domain)) {
      if (!need || need.ageMin) params.ageMin = ndHay.ageMin;
      if (!need || need.ageMax) params.ageMax = ndHay.ageMax;
    }

    if (domain._bucket && domain._bucket.nlMap) {
      var bm = domain._bucket.nlMap;
      var bestB = "";
      var bestBv = null;
      for (var bk in bm) {
        if (!bm.hasOwnProperty(bk)) continue;
        if (!_boundHas(hay, bk, null, true)) continue;
        if (String(bk).length >= String(bestB).length) {
          bestB = String(bk);
        bestBv = entryDb(bm[bk]);
        }
      }
      if (bestBv && typeof bestBv === "object") {
        for (pk in bestBv) {
          if (!bestBv.hasOwnProperty(pk)) continue;
          if (need && !need[pk]) continue;
          if (params[pk] != null && params[pk] !== "") continue;
          params[pk] = bestBv[pk];
        }
      }
    }

    for (pk in domain) {
      if (!domain.hasOwnProperty(pk)) continue;
      if (pk.charAt(0) === "_") continue;
      if (need && !need[pk]) continue;
      if (params[pk] != null && params[pk] !== "") continue;
      var spec = domain[pk] || {};
      var ev, evi;
      if (spec.enum && _isArray(spec.enum)) {
        for (evi = 0; evi < spec.enum.length; evi++) {
          ev = spec.enum[evi];
          if (_boundHas(hay, ev, ev, false)) {
            params[pk] = ev;
            break;
          }
        }
      }
      if (params[pk] != null && params[pk] !== "") continue;
      var map = spec.nlMap;
      if (!map || typeof map !== "object") continue;
      var bestK = "";
      var bestV = null;
      for (var nk in map) {
        if (!map.hasOwnProperty(nk)) continue;
        if (!_boundHas(hay, nk, entryDb(map[nk]), false) &&
            !_boundHas(hay, entryDb(map[nk]), entryDb(map[nk]), false)) continue;
        if (String(nk).length >= String(bestK).length) {
          bestK = String(nk);
          bestV = _finestValue(domain, pk, nk, entryDb(map[nk]));
        }
      }
      if (bestV != null && typeof bestV !== "object")
        params[pk] = bestV;
    }
    var gBest = {};
    _eachGroup(domain, function (gpk, alias, gentry) {
      if (need && !need[gpk]) return;
      if (params[gpk] != null && params[gpk] !== "") return;
      if (!_boundHas(hay, alias, null, true)) return;
      if (_isCandDb(domain, gpk, alias)) {
        if (!gBest[gpk] || String(alias).length >= String(gBest[gpk].alias).length)
          gBest[gpk] = { alias: alias, members: [alias] };
        return;
      }
      var mem = _filterGroupMembers(domain, gpk, gentry.members);
      if (!mem.length) return;
      if (!gBest[gpk] || String(alias).length >= String(gBest[gpk].alias).length)
        gBest[gpk] = { alias: alias, members: mem };
    });
    for (pk in gBest) {
      if (!gBest.hasOwnProperty(pk)) continue;
      if (gBest[pk].members.length === 1 &&
          String(gBest[pk].members[0]) === gBest[pk].alias &&
          _isCandDb(domain, pk, gBest[pk].alias))
        params[pk] = gBest[pk].alias;
      else
        params[pk] = gBest[pk].members.slice(0);
    }
    return params;
  }

  function _numericVals(params) {
    var out = [];
    if (!params || typeof params !== "object") return out;
    var k;
    for (k in params) {
      if (!params.hasOwnProperty(k)) continue;
      if (String(k).charAt(0) === "_") continue;
      var v = params[k];
      if (v != null && typeof v === "object") continue;
      var n = Number(v);
      if (isFinite(n) && String(v) !== "" && String(v) !== "true" && String(v) !== "false")
        out.push(n);
    }
    return out;
  }

  // params가 _range/enum/type과 맞는지. 컬럼명·연령대 규칙 하드코딩 없음.
  function validateBind(domainRaw, params) {
    var domain = normalizeParamDomain(domainRaw);
    if (!params || typeof params !== "object")
      return { ok: false, reason: "no params" };
    var nums = _numericVals(params);
    if (domain._range && nums.length) {
      var mn = nums[0];
      var mx = nums[0];
      var ni;
      for (ni = 1; ni < nums.length; ni++) {
        if (nums[ni] < mn) mn = nums[ni];
        if (nums[ni] > mx) mx = nums[ni];
      }
      if (domain._range.min != null && mx < Number(domain._range.min))
        return { ok: false, reason: "out_of_range" };
      if (domain._range.max != null && mn > Number(domain._range.max))
        return { ok: false, reason: "out_of_range" };
    }
    var pk;
    for (pk in params) {
      if (!params.hasOwnProperty(pk)) continue;
      if (String(pk).charAt(0) === "_") continue;
      var spec = domain[pk];
      if (!spec || !spec.enum || !_isArray(spec.enum) || !spec.enum.length) continue;
      var val = params[pk];
      var vals;
      if (_isArray(val)) {
        if (!val.length) return { ok: false, reason: "empty_array", param: pk };
        vals = val;
      } else if (val != null && typeof val === "object") {
        continue;
      } else {
        vals = [val];
      }
      var vi;
      for (vi = 0; vi < vals.length; vi++) {
        var one = vals[vi];
        if (one != null && typeof one === "object")
          return { ok: false, reason: "not_in_enum", param: pk };
        var found = false;
        var ei;
        for (ei = 0; ei < spec.enum.length; ei++) {
          if (String(spec.enum[ei]) === String(one)) { found = true; break; }
        }
        if (!found) return { ok: false, reason: "not_in_enum", param: pk };
      }
    }
    return { ok: true };
  }

  // 슬롯 별칭을 nlMap/_bucket에 추가(이미 있으면 유지). 2+ 키는 _bucket, 1키는 해당 param.
  function attachAlias(domainRaw, alias, params) {
    var domain = normalizeParamDomain(domainRaw);
    var a = _trim(alias);
    if (!a || !params || typeof params !== "object") return domain;
    if (a.length > 12 || a.indexOf(" ") >= 0) return domain;
    var sqlKeys = [];
    var pk;
    for (pk in params) {
      if (!params.hasOwnProperty(pk)) continue;
      if (String(pk).charAt(0) === "_") continue;
      if (params[pk] == null || typeof params[pk] === "object") continue;
      sqlKeys.push(pk);
    }
    if (sqlKeys.length >= 2) {
      if (!domain._bucket || typeof domain._bucket !== "object")
        domain._bucket = { nlMap: {} };
      if (!domain._bucket.nlMap || typeof domain._bucket.nlMap !== "object")
        domain._bucket.nlMap = {};
      if (domain._bucket.nlMap[a] == null) {
        var bucket = {};
        var bi;
        for (bi = 0; bi < sqlKeys.length; bi++)
          bucket[sqlKeys[bi]] = params[sqlKeys[bi]];
        domain._bucket.nlMap[a] = bucket;
      }
      return domain;
    }
    if (sqlKeys.length === 1) {
      var p1 = sqlKeys[0];
      if (!domain[p1] || typeof domain[p1] !== "object")
        domain[p1] = { required: true, type: "string" };
      if (!domain[p1].nlMap || typeof domain[p1].nlMap !== "object")
        domain[p1].nlMap = {};
      if (domain[p1].nlMap[a] == null)
        domain[p1].nlMap[a] = params[p1];
    }
    return domain;
  }

  function mergeParamDomainJson(existingJson, incomingJson) {
    var base = normalizeParamDomain(existingJson);
    var inc = normalizeParamDomain(incomingJson);
    var changed = false;
    var k, nk, specB, specI, mapB, mapI;
    for (k in inc) {
      if (!inc.hasOwnProperty(k)) continue;
      specI = inc[k] || {};
      if (k === "_range" && specI && typeof specI === "object") {
        if (!base._range || typeof base._range !== "object") {
          base._range = { min: specI.min, max: specI.max };
          changed = true;
          continue;
        }
        if (specI.min != null &&
            (base._range.min == null || Number(specI.min) < Number(base._range.min))) {
          base._range.min = specI.min;
          changed = true;
        }
        if (specI.max != null &&
            (base._range.max == null || Number(specI.max) > Number(base._range.max))) {
          base._range.max = specI.max;
          changed = true;
        }
        continue;
      }
      if (k === "_group") {
        if (_mergeGroupBlock(base, specI)) changed = true;
        continue;
      }
      if (!base[k]) {
        base[k] = specI;
        changed = true;
        continue;
      }
      specB = base[k] || {};
      mapI = specI && specI.nlMap;
      if (mapI && typeof mapI === "object") {
        if (!specB.nlMap || typeof specB.nlMap !== "object") {
          specB.nlMap = {};
          changed = true;
        }
        mapB = specB.nlMap;
        for (nk in mapI) {
          if (!mapI.hasOwnProperty(nk)) continue;
          if (mapB[nk] == null) {
            mapB[nk] = mapI[nk];
            changed = true;
          }
        }
      }
      if (specI && specI.enum && _isArray(specI.enum)) {
        if (!specB.enum || !_isArray(specB.enum)) {
          specB.enum = [];
          changed = true;
        }
        var ei, ej, ev, found;
        for (ei = 0; ei < specI.enum.length; ei++) {
          ev = specI.enum[ei];
          found = false;
          for (ej = 0; ej < specB.enum.length; ej++) {
            if (String(specB.enum[ej]) === String(ev)) { found = true; break; }
          }
          if (!found) {
            specB.enum.push(ev);
            changed = true;
          }
        }
      }
      if (specI && specI.type && !specB.type) {
        specB.type = specI.type;
        changed = true;
      }
      base[k] = specB;
    }
    if (inc._source && typeof inc._source === "object") {
      var prevSrc = base._source && typeof base._source === "object" ? base._source : {};
      base._source = inc._source;
      if (prevSrc.concept) base._source.concept = prevSrc.concept;
      if (prevSrc.conceptAliases) base._source.conceptAliases = prevSrc.conceptAliases;
      if (prevSrc.enRefreshedAt) base._source.enRefreshedAt = prevSrc.enRefreshedAt;
      if (prevSrc.enModel) base._source.enModel = prevSrc.enModel;
      if (prevSrc.healAt != null && base._source.healAt == null)
        base._source.healAt = prevSrc.healAt;
      changed = true;
    }
    if (inc._negative && typeof inc._negative === "object") {
      if (!base._negative || typeof base._negative !== "object") base._negative = {};
      var nkNeg;
      for (nkNeg in inc._negative) {
        if (!inc._negative.hasOwnProperty(nkNeg)) continue;
        if (base._negative[nkNeg] == null) {
          base._negative[nkNeg] = inc._negative[nkNeg];
          changed = true;
        }
      }
    }
    return { changed: changed, json: JSON.stringify(base), domain: base };
  }

  function applyNlPatch(orig, surface, patch) {
    var o = String(orig == null ? "" : orig);
    var s = String(surface == null ? "" : surface);
    var p = String(patch == null ? "" : patch);
    if (!p) return o;
    if (o.indexOf(p) >= 0) return o;
    if (s && o.indexOf(s) >= 0) return o.replace(s, p);
    if (!o) return p;
    return o + " " + p;
  }

  function _emptyHints() {
    var out = [];
    out.auditSqlCount = 0;
    return out;
  }

  function _maxClarifyRounds(opts) {
    var n;
    if (opts && opts.maxRounds != null) {
      n = Number(opts.maxRounds);
      if (!isNaN(n) && n >= 0) return n;
    }
    try {
      var env = testWoo.env && testWoo.env.getEnv ? testWoo.env.getEnv() : null;
      if (env && env.triage && env.triage.clarifyMaxRounds != null) {
        n = Number(env.triage.clarifyMaxRounds);
        if (!isNaN(n) && n >= 0) return n;
      }
    } catch (eE) { /* default */ }
    try {
      var cfg = testWoo.cfg && testWoo.cfg.getConfig ? testWoo.cfg.getConfig() : null;
      if (cfg && cfg.triage && cfg.triage.clarifyMaxRounds != null) {
        n = Number(cfg.triage.clarifyMaxRounds);
        if (!isNaN(n) && n >= 0) return n;
      }
    } catch (eC) { /* default */ }
    return 2;
  }

  function _snapshotCapOf(opts) {
    var n;
    if (opts && opts.snapshotCap != null) {
      n = Number(opts.snapshotCap);
      if (!isNaN(n) && n > 0) return n;
    }
    try {
      var env = testWoo.env && testWoo.env.getEnv ? testWoo.env.getEnv() : null;
      if (env && env.triage && env.triage.valueProbeLimitMax != null) {
        n = Number(env.triage.valueProbeLimitMax);
        if (!isNaN(n) && n > 0) return n;
      }
    } catch (eE) { /* default */ }
    return 200;
  }

  function _closedValues(domain) {
    var out = [];
    var seen = {};
    function add(v) {
      if (v == null || typeof v === "object") return;
      var s = String(v);
      if (!s || seen[s]) return;
      seen[s] = 1;
      out.push(s);
    }
    var k, spec, ei, nk;
    if (!domain) return out;
    for (k in domain) {
      if (!domain.hasOwnProperty(k) || String(k).charAt(0) === "_") continue;
      spec = domain[k] || {};
      if (spec.enum && _isArray(spec.enum)) {
        for (ei = 0; ei < spec.enum.length; ei++) add(spec.enum[ei]);
      }
      if (spec.nlMap && typeof spec.nlMap === "object") {
        for (nk in spec.nlMap) {
          if (!spec.nlMap.hasOwnProperty(nk)) continue;
          add(entryDb(spec.nlMap[nk]));
        }
      }
    }
    return out;
  }

  function _probeHintValues(probes) {
    var out = [];
    var seen = {};
    var i, p, arr, j, v;
    for (i = 0; i < (probes || []).length; i++) {
      p = probes[i] || {};
      arr = p.distinctValues || p.candidatesTop10 || [];
      if (p.matchedValue) arr = [p.matchedValue].concat(arr);
      for (j = 0; j < arr.length; j++) {
        v = String(arr[j] == null ? "" : arr[j]);
        if (!v || seen[v]) continue;
        seen[v] = 1;
        out.push(v);
      }
    }
    return out;
  }

  function _mergeHintValues(domain, probes) {
    var out = [];
    var seen = {};
    var src = _closedValues(domain);
    var extra = _probeHintValues(probes);
    var i, v;
    function add(x) {
      v = String(x == null ? "" : x);
      if (!v || seen[v]) return;
      seen[v] = 1;
      out.push(v);
    }
    for (i = 0; i < src.length; i++) add(src[i]);
    for (i = 0; i < extra.length; i++) add(extra[i]);
    return out;
  }

  function _hintTokens(text) {
    var raw = String(text || "").split(/[^0-9a-zA-Z가-힣_]+/);
    var out = [];
    var seen = {};
    var i, t;
    t = _trim(text);
    if (t.length >= 2 && t.length <= 24) {
      out.push(t);
      seen[_norm(t)] = 1;
    }
    for (i = 0; i < raw.length; i++) {
      t = _trim(raw[i]);
      if (t.length < 2 || seen[_norm(t)]) continue;
      seen[_norm(t)] = 1;
      out.push(t);
    }
    return out;
  }

  function _valueMatchesToken(val, token, domain) {
    var t = _trim(token);
    if (!t || t.length < 2) return false;
    var v = String(val == null ? "" : val);
    if (!v) return false;
    if (_norm(v).indexOf(_norm(t)) === 0) return true;
    if (_boundHas(v, t, v, false)) return true;
    var k, spec, dbv;
    if (!domain) return false;
    for (k in domain) {
      if (!domain.hasOwnProperty(k) || String(k).charAt(0) === "_") continue;
      spec = domain[k] || {};
      if (spec.nlMap && spec.nlMap[t] != null) {
        dbv = entryDb(spec.nlMap[t]);
        if (dbv != null && String(dbv) === v) return true;
      }
    }
    return false;
  }

  function _bestHintToken(text, values, domain) {
    var toks = _hintTokens(text);
    var best = "";
    var bestN = 1;
    var i, j, n, t;
    for (i = 0; i < toks.length; i++) {
      t = toks[i];
      n = 0;
      for (j = 0; j < (values || []).length; j++) {
        if (_valueMatchesToken(values[j], t, domain)) n++;
      }
      if (n >= 2 && (n > bestN || (n === bestN && t.length > best.length))) {
        bestN = n;
        best = t;
      }
    }
    return best;
  }

  function _paramOfValues(domain, values) {
    if (!domain || !values || !values.length) return "";
    var k, spec, ei, nk, dbv, i, want;
    for (k in domain) {
      if (!domain.hasOwnProperty(k) || String(k).charAt(0) === "_") continue;
      spec = domain[k] || {};
      for (i = 0; i < values.length; i++) {
        want = String(values[i]);
        if (spec.enum && _isArray(spec.enum)) {
          for (ei = 0; ei < spec.enum.length; ei++) {
            if (String(spec.enum[ei]) === want) return k;
          }
        }
        if (spec.nlMap && typeof spec.nlMap === "object") {
          for (nk in spec.nlMap) {
            if (!spec.nlMap.hasOwnProperty(nk)) continue;
            dbv = entryDb(spec.nlMap[nk]);
            if (dbv != null && String(dbv) === want) return k;
          }
        }
      }
    }
    return "";
  }

  function _allTimeValues(hits) {
    var i, s;
    if (!hits || !hits.length) return false;
    for (i = 0; i < hits.length; i++) {
      s = String(hits[i] || "");
      if (!/^\d{4}-\d{2}(-\d{2}(T.*)?)?$/.test(s)) return false;
    }
    return true;
  }

  function _slotTier(slot, domain) {
    var t = String((slot && slot.tier) || "").toLowerCase();
    if (t) return t;
    var src = domain && domain._source;
    if (src && src.tier) return String(src.tier).toLowerCase();
    if (testWoo.toolkit && testWoo.toolkit.classifyField && src && src.schema && src.xpath) {
      try {
        var cls = testWoo.toolkit.classifyField(src.schema, src.xpath);
        if (cls && cls.tier) return String(cls.tier).toLowerCase();
      } catch (eC) { /* unknown */ }
    }
    return "unknown";
  }

  function _loadAuditDates(opts, domain, hits) {
    opts = opts || {};
    if (opts.auditDates) return { dates: opts.auditDates, sqlCount: 0 };
    if (typeof opts.auditFn === "function") {
      var d = {};
      try { d = opts.auditFn(hits, domain) || {}; } catch (eF) { d = {}; }
      return { dates: d, sqlCount: 1 };
    }
    var src = domain && domain._source;
    if (!src || !src.schema || !src.xpath) return { dates: {}, sqlCount: 0 };
    if (!testWoo.toolkit || !testWoo.toolkit.auditMaxDates)
      return { dates: {}, sqlCount: 0 };
    try {
      var r = testWoo.toolkit.auditMaxDates(src.schema, src.xpath, hits);
      if (!r) return { dates: {}, sqlCount: 0 };
      return { dates: r.dates || {}, sqlCount: Number(r.sqlCount) || 0 };
    } catch (eA) {
      return { dates: {}, sqlCount: 0 };
    }
  }

  function _sortHintMembers(hits, dates, clockA) {
    var copy = [];
    var i;
    for (i = 0; i < (hits || []).length; i++) copy.push(hits[i]);
    if (clockA) {
      copy.sort(function (a, b) {
        var sa = String(a);
        var sb = String(b);
        if (sa === sb) return 0;
        return sa > sb ? -1 : 1;
      });
      return copy;
    }
    if (!dates) return copy;
    copy.sort(function (a, b) {
      var da = dates[a] || {};
      var db = dates[b] || {};
      var ma = String(da.modified || "");
      var mb = String(db.modified || "");
      if (ma !== mb) return ma > mb ? -1 : 1;
      var ca = String(da.created || "");
      var cb = String(db.created || "");
      if (ca !== cb) return ca > cb ? -1 : 1;
      return 0;
    });
    return copy;
  }

  function _collectHintHits(slot, domain, values) {
    var text = String((slot && (slot.surface || slot.slotText || slot.text)) || "");
    var ym = yearMonthHits(text, values);
    if (ym.length)
      return { hits: ym, token: text, param: _paramOfValues(domain, ym), clockA: true };
    var gBest = null;
    if (domain) {
      _eachGroup(domain, function (gpk, alias, gentry) {
        if (!_boundHas(text, alias, null, true)) return;
        var mem = _filterGroupMembers(domain, gpk, gentry.members);
        if (mem.length < 2) return;
        if (!gBest || String(alias).length > String(gBest.token).length)
          gBest = { hits: mem, token: alias, param: gpk, clockA: false };
      });
    }
    if (gBest) return gBest;
    var token = _bestHintToken(text, values, domain);
    if (!token) return { hits: [], token: "", param: "", clockA: false };
    var hits = [];
    var i;
    for (i = 0; i < (values || []).length; i++) {
      if (_valueMatchesToken(values[i], token, domain)) hits.push(values[i]);
    }
    return {
      hits: hits,
      token: token,
      param: _paramOfValues(domain, hits),
      clockA: _allTimeValues(hits)
    };
  }

  function _columnHintOptions(columns) {
    var out = [];
    var seen = {};
    var i, c, lab;
    for (i = 0; i < (columns || []).length && out.length < 5; i++) {
      c = columns[i] || {};
      lab = String(c.label || c.columnName || c.sqlColumn || c.name || "");
      if (!lab || seen[lab]) continue;
      seen[lab] = 1;
      out.push({
        label: lab,
        patch: lab,
        value: String(c.sqlColumn || c.columnName || lab),
        union: false
      });
    }
    return out;
  }

  function _hintForSlot(slot, opts) {
    var domain = normalizeParamDomain(slot && slot.domain);
    var tier = _slotTier(slot, domain);
    if (tier === "highcard" || tier === "high_card") tier = "highCard";
    if (tier === "highCard" || tier === "link")
      return { item: null, auditSqlCount: 0 };
    var cols = (slot && slot.columns) || [];
    var values = _mergeHintValues(domain, (slot && slot.probes) || []);
    var packed = _collectHintHits(slot, domain, values);
    var cap = _snapshotCapOf(opts);
    if (packed.hits.length > cap)
      return { item: null, auditSqlCount: 0 };
    if (packed.hits.length >= 2) {
      var clockA = packed.clockA || _allTimeValues(packed.hits);
      var audit = { dates: {}, sqlCount: 0 };
      if (!clockA) audit = _loadAuditDates(opts, domain, packed.hits);
      var members = _sortHintMembers(packed.hits, audit.dates, clockA);
      var token = packed.token || String((slot && slot.surface) || "");
      var options = [];
      options.push({
        label: token + " 전체",
        patch: token + " 전체",
        value: packed.hits.slice(0),
        union: true,
        param: packed.param || ""
      });
      var mi, db;
      for (mi = 0; mi < members.length && options.length < 5; mi++) {
        db = String(members[mi]);
        options.push({
          label: db,
          patch: db,
          value: db,
          union: false,
          param: packed.param || ""
        });
      }
      var hintTier = tier;
      if (hintTier === "unknown" || hintTier === "categorical") hintTier = "enum";
      if (hintTier !== "enum" && hintTier !== "distinct" &&
          hintTier !== "range" && hintTier !== "boolean")
        hintTier = "distinct";
      return {
        auditSqlCount: audit.sqlCount || 0,
        item: {
          slotId: String((slot && slot.slotId) || ""),
          surface: token,
          kind: "value",
          tier: hintTier,
          options: options
        }
      };
    }
    if (cols.length >= 2) {
      var cOpts = _columnHintOptions(cols);
      if (cOpts.length >= 2) {
        return {
          auditSqlCount: 0,
          item: {
            slotId: String((slot && slot.slotId) || ""),
            surface: String((slot && (slot.surface || slot.slotText || slot.text)) || ""),
            kind: "column",
            tier: "distinct",
            options: cOpts
          }
        };
      }
    }
    return { item: null, auditSqlCount: 0 };
  }

  function buildPromptHints(input) {
    var empty = _emptyHints();
    input = input || {};
    if (input.retryInput) return empty;
    var round = Number(input.clarifyRound) || 0;
    if (round < 0) round = 0;
    if (round >= _maxClarifyRounds(input)) return empty;
    var slots = input.slots || [];
    var i, slot, hint;
    var sqlN = 0;
    for (i = 0; i < slots.length; i++) {
      slot = slots[i] || {};
      if (slot.retryInput) continue;
      hint = _hintForSlot(slot, input);
      if (hint && hint.auditSqlCount) sqlN += Number(hint.auditSqlCount) || 0;
      if (hint && hint.item && hint.item.options && hint.item.options.length >= 2) {
        var out = [hint.item];
        out.auditSqlCount = sqlN;
        return out;
      }
    }
    empty.auditSqlCount = sqlN;
    return empty;
  }

  function buildPromptHintsFromUnresolved(unresolved, opts) {
    opts = opts || {};
    var slots = [];
    var i, u, row, domain;
    for (i = 0; i < (unresolved || []).length; i++) {
      u = unresolved[i] || {};
      domain = u.domain || null;
      if (!domain && u.fragment && testWoo.fragments && testWoo.fragments.getByName) {
        try {
          row = testWoo.fragments.getByName(String(u.fragment));
          if (row) domain = row.param_domain;
        } catch (eG) { domain = null; }
      }
      slots.push({
        slotId: u.slotId || ("u" + i),
        surface: u.surface || u.text || "",
        reason: u.reason || "",
        domain: domain,
        probes: u.probes || [],
        columns: u.columns || [],
        retryInput: !!u.retryInput
      });
    }
    return buildPromptHints({
      slots: slots,
      nl: opts.nl || "",
      clarifyRound: opts.clarifyRound || 0,
      maxRounds: opts.maxRounds,
      auditDates: opts.auditDates,
      snapshotCap: opts.snapshotCap
    });
  }

  function buildPromptHintsFromSlotResults(slotResults, opts) {
    opts = opts || {};
    var slots = [];
    var i, s, ev, domain, row, verdict;
    for (i = 0; i < (slotResults || []).length; i++) {
      s = slotResults[i] || {};
      verdict = String(s.verdict || "").toLowerCase();
      if (verdict === "feasible") continue;
      ev = s.evidence || {};
      domain = ev.domain || null;
      if (!domain && ev.fragmentName && testWoo.fragments && testWoo.fragments.getByName) {
        try {
          row = testWoo.fragments.getByName(String(ev.fragmentName));
          if (row) domain = row.param_domain;
        } catch (eG) { domain = null; }
      }
      slots.push({
        slotId: s.slotId || ("s" + i),
        surface: s.slotText || "",
        reason: s.verdict || "",
        domain: domain,
        probes: ev.valueProbes || [],
        columns: ev.columnsConsidered || [],
        tier: ev.tier || (ev.source && ev.source.tier) || ""
      });
    }
    return buildPromptHints({
      slots: slots,
      nl: opts.nl || "",
      clarifyRound: opts.clarifyRound || 0,
      maxRounds: opts.maxRounds,
      auditDates: opts.auditDates,
      snapshotCap: opts.snapshotCap
    });
  }

  function scoreCard(meta, tokens, hintCat) {
    var weights = MATCH_PROFILE.scoreWeights;
    var fields = [];
    var fk;
    for (fk in weights) {
      if (!weights.hasOwnProperty(fk)) continue;
      var blob = _norm(_fieldBlob(meta, fk));
      fields.push({ blob: blob, w: weights[fk] });
    }
    var score = 0;
    var hits = 0;
    for (var i = 0; i < tokens.length; i++) {
      var t = _norm(tokens[i]);
      var hit = false;
      if (!t) continue;
      for (var j = 0; j < fields.length; j++) {
        if (fields[j].blob.indexOf(t) >= 0) {
          score += fields[j].w / Math.sqrt(Math.max(fields[j].blob.length, 1) / 50);
          hit = true;
        }
      }
      if (hit) hits++;
    }
    if (!hits) return 0;
    if (hintCat && _norm(meta.category) === _norm(hintCat))
      score += MATCH_PROFILE.categoryHintBonus;
    return score;
  }

  return {
    errorCodes: ERROR_CODES,
    logCode: logCode,
    matchProfile: matchProfile,
    likeFieldExprs: likeFieldExprs,
    scoreWeights: scoreWeights,
    coverFieldNames: coverFieldNames,
    axisFromSlot: axisFromSlot,
    axisFromCard: axisFromCard,
    axesCompatible: axesCompatible,
    stemToken: stemToken,
    isNoiseToken: isNoiseToken,
    isNoiseResidue: isNoiseResidue,
    collectLexicon: collectLexicon,
    splitByLexicon: splitByLexicon,
    mergeLexiconSlots: mergeLexiconSlots,
    splitCompoundSlots: splitCompoundSlots,
    buildIndexFields: buildIndexFields,
    keywordsFromSlot: keywordsFromSlot,
    normalizeParamDomain: normalizeParamDomain,
    domainMatchSlot: domainMatchSlot,
    yearMonthHits: yearMonthHits,
    matchEnPivotSlot: matchEnPivotSlot,
    conceptOf: conceptOf,
    conceptsAxisMatch: conceptsAxisMatch,
    kindCompatible: kindCompatible,
    isNegative: isNegative,
    markNegative: markNegative,
    inHealCooldown: inHealCooldown,
    stampHeal: stampHeal,
    validateBind: validateBind,
    attachAlias: attachAlias,
    mergeParamDomainJson: mergeParamDomainJson,
    coversSlot: coversSlot,
    slotCoverParts: slotCoverParts,
    splitCoordSlots: splitCoordSlots,
    libraryHitPredicate: libraryHitPredicate,
    sampleBindSql: sampleBindSql,
    promoteEqPlaceholderToIn: promoteEqPlaceholderToIn,
    resolveNlParams: resolveNlParams,
    upsertGroup: upsertGroup,
    groupHintForParams: groupHintForParams,
    displayHintForParams: displayHintForParams,
    entryDb: entryDb,
    applyNlPatch: applyNlPatch,
    buildPromptHints: buildPromptHints,
    buildPromptHintsFromUnresolved: buildPromptHintsFromUnresolved,
    buildPromptHintsFromSlotResults: buildPromptHintsFromSlotResults,
    scoreCard: scoreCard
  };
})();
testWoo.fragContract.__v = "186";
