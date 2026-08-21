# ============================================================
# Campaign v8 API / SOAP 접속 테스트 — 단일 설정 파일 (마스킹본)
# 사용: curl, Postman, Node(dotenv), Python 등에서 로드
# ※ 실제 값은 (부록)Info.md 참조 — Git 커밋·공유용 샘플
# ============================================================

# --- Campaign Sandbox (베이스 URL, 끝 / 없음) ---
CAMPAIGN_SERVER_URL=https://your-campaign-server.example.com

# --- 인증 모드: ims | legacy | browser ---
# ims       → IMS Bearer + soaprouter (Builder 기본)
# legacy    → SOAP Logon (username/password)
# browser   → 브라우저 쿠키 세션 (콘솔과 동일 operator, curl만으로는 어려움)
CAMPAIGN_AUTH_MODE=legacy

# --- SOAP 엔드포인트 (자동 조합용) ---
CAMPAIGN_SOAP_URL=${CAMPAIGN_SERVER_URL}/nl/jsp/soaprouter.jsp

# --- Legacy Logon (authMode=legacy 일 때) ---
CAMPAIGN_USERNAME=your_username
CAMPAIGN_PASSWORD=your_password_here
CAMPAIGN_LOGON_REMEMBER=false

# --- Adobe IMS (authMode=ims 일 때) ---
IMS_TOKEN_URL=https://ims-na1.adobelogin.com/ims/token/v3
IMS_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
IMS_CLIENT_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
IMS_SCOPE=openid,AdobeID,campaign_sdk,additional_info.projectedProductContext,campaign_config_server_general,deliverability_service_general,read_organizations

# --- Campaign JSSP 프록시 (서버에 배포된 경로) ---
# HTML/JSSP 로드·IMS 토큰 발급 시 ?_token= 필수
JSSP_ACCESS_TOKEN=your_jssp_access_token_here
JSSP_IMS_TOKEN_PATH=/uplus/ims-token.jssp
JSSP_WHOAMI_PATH=/uplus/whoami.jssp
JSSP_CONFIG_PATH=/uplus/config.jssp

# 전체 URL (로컬/Postman용)
JSSP_IMS_TOKEN_URL=${CAMPAIGN_SERVER_URL}${JSSP_IMS_TOKEN_PATH}?_token=${JSSP_ACCESS_TOKEN}
JSSP_WHOAMI_URL=${CAMPAIGN_SERVER_URL}${JSSP_WHOAMI_PATH}

# --- WebApp (Workflow Builder) ---
WEBAPP_BUILDER_ID=APP29
WEBAPP_BUILDER_URL=${CAMPAIGN_SERVER_URL}/webApp/APP29

# --- Anthropic (채팅 API 테스트, SOAP과 무관 · 직결 롤백용) ---
ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-sonnet-4-6

# --- OpenRouter (채팅 API 테스트, SOAP과 무관 · 기본 프로바이더) ---
# 프로바이더 선택: openrouter(기본) | anthropic
LLM_PROVIDER=openrouter
OPENROUTER_API_URL=https://openrouter.ai/api/v1/chat/completions
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENROUTER_MODEL=anthropic/claude-opus-5
OPENROUTER_HTTP_REFERER=https://your-campaign-server.example.com
OPENROUTER_X_TITLE=Campaign-AI-TestWoo

# ============================================================
# SOAP 호출 테스트 — 스키마·액션·샘플 쿼리
# (ExecuteQuery body 안 queryDef fragment)
# ============================================================

# 자주 쓰는 SOAPAction (Header: SOAPAction)
SOAP_ACTION_EXECUTE_QUERY=xtk:queryDef#ExecuteQuery
SOAP_ACTION_WRITE=xtk:session#Write
SOAP_ACTION_PERSIST_WRITE=xtk:persist#Write
SOAP_ACTION_LOGON=xtk:session#Logon

# --- 내부 스키마 목록 (xtk:schema) ---
TEST_SCHEMA_LIST=xtk:schema
TEST_SCHEMA_LIST_LINE_COUNT=10
# queryDef fragment:
# <select><node expr="@namespace"/><node expr="@name"/><node expr="@label"/></select>
# <orderBy><node expr="@namespace"/><node expr="@name"/></orderBy>
# <lineCount>10</lineCount>

# --- 스키마 1건 상세 (srcSchema memo) ---
TEST_SCHEMA_DETAIL=xtk:schema
TEST_SCHEMA_DETAIL_ID=nms:recipient

# --- 워크플로 (테스트용 PK / internalName 채워서 사용) ---
TEST_WORKFLOW_SCHEMA=xtk:workflow
TEST_WORKFLOW_ID=
TEST_WORKFLOW_INTERNAL_NAME=

# --- operator / whoami ---
TEST_OPERATOR_SCHEMA=xtk:operator

# --- 커스텀 확장 스키마 (있을 경우) ---
TEST_CUSTOM_SCHEMA=uplus:ai_sql

# ============================================================
# 빠른 체크리스트 (순서)
# 1) GET  JSSP_IMS_TOKEN_URL          → access_token JSON
# 2) GET  JSSP_WHOAMI_URL             → { ok, login } (브라우저 쿠키 필요)
# 3) POST CAMPAIGN_SOAP_URL           → Authorization: Bearer {token}
#        SOAPAction: xtk:queryDef#ExecuteQuery
#        Body: xtk:schema ExecuteQuery (위 fragment)
# ============================================================
