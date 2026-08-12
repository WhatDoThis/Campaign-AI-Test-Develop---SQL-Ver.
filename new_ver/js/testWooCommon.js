/*
 * testWooCommon.js (JSSP 공통 헬퍼)
 * ==================================================
 * Studio·Foundry JSSP API의 JSON 응답·요청 파싱·인증·권한 검사.
 * TW_* 바인드 후 loadLibrary로 로드한다. __v=159 (litmus 동기).
 *
 * [Main Functions]
 * ===========
 * - jsonOut — 성공 JSON 응답 기록
 * - errOut — 오류 JSON 응답 기록
 * - handleApiError — 예외를 errOut으로 변환 (code=LIB 메시지 그대로)
 * - twRequireLib — loadLibrary 직후 전역 모듈 존재 검사
 * - readPayload — payload 파라미터·body JSON 파싱
 * - twSessionTokenFromRequest — Cookie에서 세션 토큰 추출
 * - twLogonWithToken — logonWithToken으로 오퍼레이터 바인드
 * - twBindOperator — 세션 토큰 또는 logon 폴백 바인드
 * - twCheckRemoteAddr — allowedCidr IP 게이트
 * - currentLogin — 현재 로그인 ID 반환
 * - requireRight — named right 검사(fail-closed)
 * - requireStudioCsrf — CSRF·Origin·pageHost 검증
 * - twTrim — Rhino-safe 문자열 trim
 *
 * [Dependencies]
 * =========
 * - JSSP — TW_RESPONSE/TW_REQUEST/TW_DOCUMENT 바인드 후 loadLibrary
 * - testWooEnv.js — security.allowedCidr(선택 preload)
 * - testWoo.common.__v — StudioContext libVersions 진단
 */

if (typeof testWoo === "undefined") testWoo = {};
if (!testWoo.common) testWoo.common = {};
testWoo.common.__v = "159";

var TW_TITLE_MAX = 200; // woo:testWooAiSql @title length

// ACC Rhino: String.trim 미보장 → regex
function twTrim(s) {
  return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
}

/* loadLibrary 실패는 예외 없이 넘어가는 경우가 있음 — 전역 부재를 즉시 노출 */
function twRequireLib(nsName, globalPath) {
  if (globalPath === undefined || globalPath === null || globalPath === false) {
    var err = new Error(
      "LIB_NOT_LOADED: " +
        String(nsName) +
        " — ACC 콘솔에서 JS 라이브러리를 재등록하세요"
    );
    err.code = "LIB";
    throw err;
  }
}

function _twResp() {
  if (typeof TW_RESPONSE === "undefined" || TW_RESPONSE == null)
    throw new Error("TW_RESPONSE missing — set TW_RESPONSE=response before loadLibrary Common");
  return TW_RESPONSE;
}

function _twReq() {
  if (typeof TW_REQUEST === "undefined" || TW_REQUEST == null)
    throw new Error("TW_REQUEST missing — set TW_REQUEST=request before loadLibrary Common");
  return TW_REQUEST;
}

function _twDoc() {
  if (typeof TW_DOCUMENT === "undefined" || TW_DOCUMENT == null)
    throw new Error("TW_DOCUMENT missing — set TW_DOCUMENT=document before loadLibrary Common");
  return TW_DOCUMENT;
}

function jsonOut(obj) {
  _twResp().setContentType("application/json;charset=utf-8");
  _twDoc().write(JSON.stringify(obj));
}

// 1. JSON error
function errOut(msg, code, extra) {
  _twResp().setContentType("application/json;charset=utf-8");
  var body = { ok: false, error: String(msg) };
  if (code != null && code !== "") body.code = code;
  if (extra) {
    for (var k in extra) {
      if (extra.hasOwnProperty(k)) body[k] = extra[k];
    }
  }
  _twDoc().write(JSON.stringify(body));
}

function _twErrId() {
  return "TW" + String(new Date().getTime()) + String(Math.floor(Math.random() * 1000));
}

// 2. catch 공통 — 서버 로그 전체 / 클라에는 요약 + detail(짧게)로 원인 추적 가능하게
function handleApiError(e) {
  var msg = (e && e.message != null) ? String(e.message) : String(e);
  var errId = _twErrId();
  try { logError("[testWoo][" + errId + "] " + msg); } catch (eLog) {}
  var detail = msg.length > 400 ? msg.substring(0, 400) + "..." : msg;

  var code = (e && e.code) ? String(e.code) : "";
  if (code === "AUTH" || msg.indexOf("NOT_AUTHENTICATED") >= 0) {
    errOut("NOT_AUTHENTICATED", "AUTH", {
      errId: errId,
      logonUrl: "/nl/jsp/logon.jsp?target=" +
        encodeURIComponent("/woo/testWooAiStudio.jssp")
    });
    return;
  }
  /* 배포 누락 — 500 요약으로 덮지 않고 안내 문구 그대로 */
  if (code === "LIB" || msg.indexOf("LIB_NOT_LOADED:") >= 0) {
    errOut(msg, "LIB", { errId: errId, detail: detail });
    return;
  }
  if (code === "FORBIDDEN" || msg.indexOf("missing right:") === 0 ||
      msg.indexOf("CSRF:") === 0 || msg.indexOf("FORBIDDEN:") === 0) {
    errOut("권한 또는 요청 검증 실패", "FORBIDDEN", { errId: errId, detail: detail });
    return;
  }
  // 검증·LLM·컴파일·ACC TypeError(map 등) — 조치 가능하도록 메시지 노출
  if (msg.indexOf("[testWoo.") === 0 ||
      msg.indexOf("payload JSON") === 0 ||
      msg.indexOf("nl_request") >= 0 ||
      msg.indexOf("plan missing") >= 0 ||
      msg.indexOf("LLM ") === 0 ||
      msg.indexOf("urlPermission") >= 0 ||
      msg.indexOf("JST-") === 0 ||
      msg.indexOf("TypeError") === 0 ||
      msg.indexOf("Cannot find function") >= 0 ||
      msg.indexOf("is not a function") >= 0) {
    errOut(msg, 400, { errId: errId, detail: detail });
    return;
  }
  errOut("처리 중 오류가 발생했습니다. errId=" + errId, 500, { errId: errId, detail: detail });
}

// 3. UTF-8 payload (한글 NL)
function readPayload() {
  var raw = "";
  try { raw = String(_twReq().getUTF8Parameter("payload") || ""); } catch (e1) {}
  if (!raw) {
    try { raw = String(_twReq().getParameter("payload") || ""); } catch (e2) {}
  }
  if (!raw) {
    try { raw = String(_twReq().getBodyAsString() || ""); } catch (e3) {}
  }
  if (!raw) return {};
  raw = twTrim(String(raw).replace(/^\uFEFF/, ""));
  if (!raw) return {};
  if (raw.charAt(0) === "{") {
    try { return JSON.parse(raw); }
    catch (eJson) {
      throw new Error("payload JSON parse failed: " + eJson.message +
        " preview=" + (raw.length > 200 ? raw.substring(0, 200) + "..." : raw));
    }
  }
  try { return JSON.parse(raw); }
  catch (e) {
    throw new Error("payload JSON parse failed: " + e.message +
      " preview=" + (raw.length > 200 ? raw.substring(0, 200) + "..." : raw));
  }
}

// 4. current operator login
function currentLogin() {
  try { return String(application.operator.login || ""); }
  catch (e) { return ""; }
}

// 5. Cookie __sessiontoken — Cookie 헤더 우선 (request.cookies 빈 배열 환경)
function twSessionTokenFromRequest() {
  var req = _twReq();
  try {
    var hdr = String(req.getHeader("Cookie") || "");
    var parts = hdr.split(";");
    for (var j = 0; j < parts.length; j++) {
      var p = parts[j].replace(/^\s+/, "");
      var eq = p.indexOf("=");
      if (eq < 0) continue;
      if (p.substring(0, eq) === "__sessiontoken")
        return p.substring(eq + 1);
    }
  } catch (e1) {}
  try {
    var cs = req.cookies;
    if (cs && cs.length != null) {
      for (var i = 0; i < cs.length; i++) {
        if (String(cs[i].name) === "__sessiontoken")
          return String(cs[i].value || "");
      }
    }
  } catch (e2) {}
  return "";
}

// 6. 세션 토큰 바인딩 — logon(sessionToken)은 폐기됐다(JST-310036).
// 현행 API는 logonWithToken(token)이고 logon()은 logonEscalation이 돌려준 컨텍스트를
// 복원할 때만 유효하다. 빌드에 logonWithToken이 없을 수 있어 존재 확인 후 폴백한다
// (Rhino에서 미정의 식별자의 typeof는 예외 없이 "undefined"를 준다).
// 주의: 두 방식 모두 127.0.0.1로 기록되어 보안 존 검사를 우회한다 — API는 AllowedCidr로 보완.
function twLogonWithToken(tok) {
  if (typeof logonWithToken === "function") {
    logonWithToken(tok);
    return "logonWithToken";
  }
  logon(tok);
  return "logon(deprecated)";
}

function twBindOperator() {
  var login = currentLogin();
  if (login) return login;

  var tok = twSessionTokenFromRequest();
  if (!tok) {
    var err = new Error("NOT_AUTHENTICATED");
    err.code = "AUTH";
    throw err;
  }
  try {
    twLogonWithToken(tok);
  } catch (eLogon) {
    var err2 = new Error("NOT_AUTHENTICATED: session token bind failed: " +
      (eLogon && eLogon.message ? eLogon.message : eLogon));
    err2.code = "AUTH";
    throw err2;
  }
  login = currentLogin();
  if (!login) {
    var err3 = new Error("NOT_AUTHENTICATED");
    err3.code = "AUTH";
    throw err3;
  }
  return login;
}

// 6b. 선택적 IP 접두 게이트 (Env allowedCidr 비우면 통과)
function twCheckRemoteAddr() {
  var allow = "";
  try {
    if (testWoo.env && testWoo.env.getEnv) {
      var sec = testWoo.env.getEnv().security;
      if (sec && sec.allowedCidr) allow = String(sec.allowedCidr);
    }
  } catch (eEnv) {}
  if (!allow) {
    try {
      if (testWoo.cfg && testWoo.cfg.getConfig) {
        allow = String(testWoo.cfg.getConfig().security.allowedCidr || "");
      }
    } catch (eCfg) {}
  }
  if (!allow) return;
  var ip = "";
  try { ip = String(_twReq().getRemoteAddr() || ""); } catch (e2) { ip = ""; }
  var list = allow.split(",");
  for (var i = 0; i < list.length; i++) {
    var pfx = twTrim(list[i] || "");
    if (pfx && ip.indexOf(pfx) === 0) return;
  }
  var err = new Error("FORBIDDEN: ip not allowed");
  err.code = "FORBIDDEN";
  throw err;
}

// 7. named right — bind + IP 게이트 후 검사
function requireRight(namedRight) {
  var login = twBindOperator();
  twCheckRemoteAddr();
  if (!application.operator.hasRight(namedRight)) {
    var err = new Error("missing right: " + namedRight + " (login=" + login + ")");
    err.code = "FORBIDDEN";
    throw err;
  }
}

function _twHostOfUrl(u) {
  var m = String(u || "").match(/^https?:\/\/([^\/?#]+)/i);
  return m ? _twNormHost(m[1]) : "";
}

function _twNormHost(h) {
  var s = String(h || "").toLowerCase();
  if (s.length > 3 && s.substring(s.length - 3) === ":80")
    s = s.substring(0, s.length - 3);
  else if (s.length > 4 && s.substring(s.length - 4) === ":443")
    s = s.substring(0, s.length - 4);
  return s;
}

// 8. Register CSRF — fail-closed, host 정확 일치 (substring 우회 차단)
// optPayload: Studio post() → { csrf:"TestWooStudio", pageHost:location.host }.
// ACC urlViewer 는 X-Requested-With·Origin·Referer 를 getHeader 로 안 넘기는 경우가 많음.
function requireStudioCsrf(optPayload) {
  var req = _twReq();
  var xrw = "";
  try { xrw = String(req.getHeader("X-Requested-With") || ""); } catch (e1) {}
  if (!xrw) {
    try { xrw = String(req.getHeader("x-requested-with") || ""); } catch (e1b) {}
  }
  var csrfBody = "";
  var pageHost = "";
  if (optPayload) {
    if (optPayload.csrf != null) csrfBody = String(optPayload.csrf);
    if (optPayload.pageHost != null)
      pageHost = _twNormHost(optPayload.pageHost);
  }
  if (xrw !== "TestWooStudio" && csrfBody !== "TestWooStudio") {
    var err = new Error(
      "CSRF: X-Requested-With or payload.csrf TestWooStudio required"
    );
    err.code = "FORBIDDEN";
    throw err;
  }
  var host = "";
  try { host = _twNormHost(req.getHeader("Host") || ""); } catch (e2) {}
  var origin = "";
  var referer = "";
  try { origin = String(req.getHeader("Origin") || ""); } catch (e3) {}
  try { referer = String(req.getHeader("Referer") || ""); } catch (e4) {}
  var src = origin || referer;
  if (src) {
    if (!host || _twHostOfUrl(src) !== host) {
      var err6 = new Error("CSRF: origin host mismatch");
      err6.code = "FORBIDDEN";
      throw err6;
    }
    return;
  }
  // Origin/Referer 없음 (urlViewer) — pageHost↔Host + Studio csrf 로 동일 출처 확인
  if (csrfBody === "TestWooStudio" && host && pageHost && pageHost === host) {
    try {
      logInfo("[testWoo.csrf] Origin/Referer absent — accepted via pageHost=" + pageHost);
    } catch (eLog) {}
    return;
  }
  var err5 = new Error(
    "CSRF: Origin/Referer required (or payload.pageHost matching Host; got pageHost=" +
      pageHost + " host=" + host + ")"
  );
  err5.code = "FORBIDDEN";
  throw err5;
}
