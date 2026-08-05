<%
  response.setContentType("application/javascript;charset=utf-8");
  // 실제 값은 old_ver/secrets/OLD_VER_SECRETS.md 참조 (git 제외)
  var _SQ_TOKEN = "__SQ_TOKEN__";
  var _t = String(request.getParameter("_token") || "");
  if (_t !== _SQ_TOKEN) {
    response.sendError(403, "Forbidden");
    return;
  }
%>
(function () {
  "use strict";
  window.SchemaQuery = window.SchemaQuery || {};
  window.SchemaQuery.CONFIG = {
    // 실제 값은 old_ver/secrets/OLD_VER_SECRETS.md 참조 (git 제외)
    anthropicApiKey: "__ANTHROPIC_API_KEY__",
    anthropicModel: "claude-sonnet-4-6",
    campaign: {
      serverUrl: "__CAMPAIGN_SERVER_URL__",
      username: "__CAMPAIGN_USERNAME__",
      password: "__CAMPAIGN_PASSWORD__",
      imsBearerToken: "",
      authMode: "legacy",
      logonRememberMe: false,
    },
    schemaListLineCount: 3000,
  };
  window.SchemaQuery.STR = {
    emptyFragment: "queryDefXmlFragment 가 비어 있습니다.",
    bearerTokenMissing: "BearerTokenLogon 세션 토큰 없음",
    logonTokenMissing: "Logon 세션 토큰 없음",
    sessionRequired: "Campaign에 로그인한 상태에서 이 페이지를 열어주세요.",
    schemaPrefix: "스키마: ",
    schemaMismatch: "스키마 불일치: ",
    noFragment: "queryDefXmlFragment 없음",
    noSql: "-- SQL 없음",
    noSrcSchema: "srcSchema 없음: ",
    dash: "—",
    countParseFail: "건수 파싱 실패: ",
    apiKeyRequired: "anthropicApiKey 필요",
    messageRequired: "메시지를 입력하세요.",
    schemaSelectedPrefix: "스키마 ",
    schemaSelectedSuffix: " 선택됨.",
    selectSchema: "스키마를 선택하세요.",
    generating: "생성 중…",
    counting: "건수 조회 중…",
    countUnit: "건",
    fullXml: "전체 XML",
    fetchData: "데이터 조회",
    fetching: "조회 중…",
    fetchCount: "건수 조회",
    tabCount: "건수",
    copy: "복사",
    copiedSuffix: " 복사됨",
    soapError: "SOAP 오류: ",
    ellipsis: "…",
    selectOption: "— 선택 —",
    countSuffix: "개",
    sep: " · ",
    fieldSep: " — ",
    savePrompt: "SQL을 uplus:ai_sql에 저장하시겠습니까?",
    saveTitlePlaceholder: "제목",
    saveYes: "예",
    saveNo: "아니오",
    saveTitleRequired: "제목을 입력하세요.",
    saveOk: "uplus:ai_sql (UplusAi_sql)에 저장되었습니다.",
    saveFail: "저장 실패: ",
    saveVerifyFail: "저장 후 조회 확인 실패 — Campaign 로그인·uplus:ai_sql 권한을 확인하세요.",
    saveSaving: "저장 중…",
  };
})();
