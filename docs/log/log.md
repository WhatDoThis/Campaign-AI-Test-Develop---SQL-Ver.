# Log

## Log Index
148. 2026-08-11 로드맵 문서 P0-2·P1 수정 — PoC-0·INJ-8-2 본문승인·가드레일
147. 2026-08-11 P0 브랜치 분리 — roadmap new_ver 복원 · fix/embed-layout
146. 2026-08-11 고도화 기반 — 추적표·Rules/Skills/Agents·차수 가이드(0~8+PoC)
145. 2026-08-10 embed UI — 입력 2줄 · 답변 영역 확대 (v=143)
144. 2026-08-10 Studio UI — 진단/TW-BOOT 제거 · 입력·이력 확대 (v=142)
143. 2026-08-10 재오픈 흰화면 — enter 에도 _r=tick (urlViewer 캐시)
142. 2026-08-10 embed SQL 이력 세로 채움 — table-cell 2열 · composer→main (v=140)
141. 2026-08-10 폼 그리드 좌측공백 — Reload 버튼 colspan=3
140. 2026-08-10 폼 enter 방어 — twStudioUrl 선행 set · _r 는 Reload/Apply만
139. 2026-08-10 baseline — #134/#136/#138 레이아웃 철회 (#133/#135/#137 유지)
138. 2026-08-10 embed UI 깨짐 수정 — table-cell 2열 · 입력창 왼쪽
137. 2026-08-10 폼 FormatDate 제거 — ShellPick tick 캐시버스트 (XTK-170016)
136. 2026-08-10 embed 레이아웃 복원 — 좌 AI / 우 SQL 이력
135. 2026-08-10 urlViewer 미로드 판별 — 폼 캐시버스트 · TW-BOOT · Reload
134. 2026-08-10 embed 흰화면 잔존 — flex/CSS변수 제거 · 세로스택 · #twBoot
133. 2026-08-10 urlViewer 흰화면 근본원인 — IE 미지원 API(fetch/Promise) 제거
132. 2026-08-10 Studio 배너「승인 API 열기」링크 제거
131. 2026-08-10 SQL이력 있을 때 흰화면 — WebView JS 호환 · 삭제 버튼
130. 2026-08-10 Apply/재진입 urlViewer 흰 화면 — flex:1 제거 · form height
129. 2026-08-10 Register CSRF — Origin 없을 때 pageHost↔Host 폴백
128. 2026-08-10 embed WF SQL 이력 — table→flex · 340px
127. 2026-08-10 Studio/Generate `\u` 한글 오타 전수 스캔·수정
126. 2026-08-10 Register CSRF — payload.csrf 폴백 (urlViewer 헤더 미전달)
125. 2026-08-10 Studio 승인 배너 한글 오타 수정 · SQL 이력 패널 확장
124. 2026-08-10 OpenRouter Claude Azure 400 — tool_choice.none + parallel_tool_calls 제거
123. 2026-08-10 Shell* SOAP 교체 · 빈 액티비티 Status · Pass0 salvage/penalty
122. 2026-08-10 확장 폼 레이아웃 — 상단 제거 · Studio 최대 · Apply에 WF/act/sql
121. 2026-08-10 Apply 단순화 — 첫 액티비티만 · Inspect out×3 · 선택 UI 제거
120. 2026-08-10 SOAP Element≠string — Inspect 스칼라 복귀 + ListAiActivities 분리
119. 2026-08-10 SOAP Too many arguments — InspectAiTarget out DOM 1개로 축소
118. 2026-08-10 embed Studio 흰 빈칸 — min-height:0 접힘 복구
117. 2026-08-10 Apply 액티비티 — 텍스트입력 → 캔버스 목록 type=list 선택
116. 2026-08-10 listAiSql 진단·Repository 재배포 안내 · embed 높이 압축
115. 2026-08-10 Studio UX — listSql·bindPick·폼 축소·브라우저 열기·embed 밀집
114. 2026-08-10 Studio 임베드 — type=html iframe → ACC urlViewer+sessionToken
113. 2026-08-10 가이드 §7 재배포 — #112 콘솔 경로·파일 대응표(A~E) 보강
112. 2026-08-10 계약 B — Inspect/Bind 대상 ibankSqlDM(+레거시 customActivity) · script SQL 금지
111. 2026-08-10 #96~#110 검수 P0·P1 수정 — ai-sql-id 중복·enter throw·embed CSS·로그96 결번
110. 2026-08-07 InspectAiTarget — activityCount long↔int SOAP 타입 오류 → string outs
109. 2026-08-07 WebApp형 Studio 임베드 — Inspect/Bind ai_sql-id · 확장 폼 iframe
108. 2026-08-07 AI Studio 다이얼로그 — nothingToEdit/Save 로 OK(닫기) 활성
107. 2026-08-07 AI Studio 호스트 — 폼 하드코딩 제거 · Option testWooAiStudioBaseUrl 단일 소스
106. 2026-08-07 AI Studio 다이얼로그 — URL·WF명 자동/readOnly · baseUrl은 인풋폼에서 고정
105. 2026-08-07 AI Studio 진입점 — 캠페인 Targeting용 Properties 옆 flatSubFormButton 으로 변경
104. 2026-08-07 xtk:workflow 저장 XML-110013 — xpathTargetDataSource 제거 안내(ref 무관)
103. 2026-08-07 섹션7 문구 정리 — 확장(entity-schema+ref), “상속 불가” 논쟁 표현 제거
102. 2026-08-07 woo:testWooExtendWorkflow — Workflow 확장 폼 + ref 연결 · AI Studio 탭
101. 2026-08-07 testWooAiWorkflowUi — methods를 srcSchema 직속으로 이동 (XML-110013)
100. 2026-08-07 섹션7a·7b — soapCall BuildStudioUrl · listSql/getSql · Studio 우측 SQL 패널
99. 2026-08-06 개발가이드 v1.7.0 — 섹션7 WF캔버스↔Studio↔커스텀 액티비티 (다음 적용)
98. 2026-08-06 Fragment 생애주기 설계 — 승인→라벨 · enum+certified · merged_into_id (런타임 변경 없음)
97. 2026-08-06 Studio 검증 결과 UI — PASS/FAIL·게이트 코드를 한글 라벨로 표시
96. 2026-08-06 결번(기록 누락) — 승인 UI 추정 작업, git으로 단일 커밋 특정 불가
95. 2026-08-06 스모크 9c list_schemas namespace 누락 수정 (args={} → allowed ns)
94. 2026-08-06 리포트09 부분 핫픽스 — E-1 예산132 · C-1 sanitize순서 · E-2 tokenBudget · A-1 자가검증 · 스모크9c
93. 2026-08-06 Pass0 Gemini 간헐 반복 루프 완화 — pass0MaxTokens 2048 · frequencyPenalty 0.3 · length 시 1회 재시도
92. 2026-08-06 F-0~F-5·#91 검증 완료 — 스모크 14/14 · dryRun feasible→woo__customer__region__seoul gate.pass
91. 2026-08-06 Triage no_column 오탐 차단 — describe_schema 필수(재지시·강등) + 스모크 9 forceGenerate
90. 2026-08-06 Foundry 생성 단계 근원 수정 F-0~F-5 — 출력 계약·requireJson·형태 재시도·단계 예산·dryRunSlot
89. 2026-08-06 fragment 생성 단계 진단 보강 (turn별 finish_reason·응답 본문 프리뷰) + 강제 턴 지시를 요청 사본에만 주입
88. 2026-08-06 종료된 큐를 수기 재큐잉했을 때의 무동작 done 에 사유 기록 (fragment 0건 오인 방지)
87. 2026-08-06 허용 namespace 를 woo 단독으로 확정 (ACC 수기 수정이 재배포마다 덮이던 원인 제거) + 스모크 4·4b·5 대상 전환 + grainKeyCandidates 정합
86. 2026-08-06 Foundry 배치 첫 실행 실패 정리 — logError 선행으로 큐 상태 유실(SCR-160012) + Triage 턴 소진 강제 응답 + 허용 namespace 프롬프트 주입
85. 2026-08-06 logon(sessionToken) 폐기 대응 (logonWithToken · JST-310036) + 큐 폴링 20초 정합 + Foundry 상시 ON
84. 2026-08-06 json_object 반복 루프 근원 제거 (R-1~R-4 · L-1~L-3) — length 진단 강화 + 스모크 LLM 스텝 + 단계별 토큰 상한
83. 2026-08-06 thinking 모델 reasoning 비활성 형식 교정 (max_tokens:0) + Pass0 토큰 env 연결 + Foundry 사고 예산 고정
82. 2026-08-06 논리명→물리명(sqlname) 결함 수정 — 툴킷 sqlColumn 노출·해석 + 프롬프트 3종 + 스모크 4b/4c + 가이드 v1.6.0
81. 2026-08-06 AI 스키마 5종 상단 정의서화 (이누머레이션·인덱스·속성 명세)
80. 2026-08-06 Triage response_format 제거(Gemini tools 충돌) + G-C 모집단 분모 결함 수정
79. 2026-08-06 workflow_id(long) → workflow_name(string) 전환 — WF 인터널네임 보관 (BAS-010042 해소)
78. 2026-08-05 방언 지원 정책 명문화 — 미검증 DBMS 런타임 가드 + FDA 주석 + 문자열 대조 도구 (추가5 반영)
77. 2026-08-05 SQL 방언 정합 M-1~M-3 (limitSelect DISTINCT TOP · 스모크 6a/6b, 06 리포트 반영)
76. 2026-08-05 Adobe API 오용 수정 N-1~N-6 + 배포 스모크 (05 리포트 반영)
75. 2026-08-05 코드 점검 결함 수정 P0~P2 (04 리포트 반영)
74. 2026-08-05 navtree listdet→list (폼 잘림) + notebook 재등록 안내
73. 2026-08-05 Fragment 입력폼 단일화 (foundry.xml 삭제)
72. 2026-08-05 Fragment 입력폼 섹션2 호환 + Foundry 교체용 분리
71. 2026-08-05 시크릿 보관소 버전별 분리 (new_ver/secrets 신설) + 형식 간소화
70. 2026-08-05 Fragments navtree 기본 sysFilter (verified·승인대기)
69. 2026-08-05 navtree Fragments Verified 폴더 제거 (단일 목록)
68. 2026-08-05 navtree Sample 폴더 제거 (Explorer 운영 범위만)
67. 2026-08-05 입력폼 notebook 탭 + Sample 폴더 연결·스크롤 개선
66. 2026-08-05 navtree·로그 내부 호스트명 placeholder 치환 (공개 저장소 대응)
65. 2026-08-05 신규 구축(new_ver) ACC 적용 현황·이슈·잔여 작업 정리
64. 2026-08-05 navtree xpath ACC 배포 스키마 정합 (XTK-170036)
63. 2026-08-05 navtree label 슬래시 제거 (QUE-370028)
62. 2026-08-05 woo:testWooAiNav navtree XML 신규 (uplus 분리)
61. 2026-08-05 Foundry 큐 UX 안내 (진행/운영승인/재생성 구분)
60. 2026-08-05 PRD 단일화(Rebuild→docs/main) + old_ver 시크릿 분리 + Git 초기 배포
59. 2026-08-05 Skill acc-data-access (Campaign DB 접근 원칙)
58. 2026-08-05 옵션 3개로 축소 + Env 주석 + 미배포 파일 삭제
57. 2026-08-05 Feasibility Triage + testWooEnv.js (옵션→내장 상수 분리)
56. 2026-08-05 Fragment Foundry 통합 (툴킷·dedup·큐·게이트 확장)
55. 2026-08-05 Cursor AI 개발 환경 세팅 (skill·rule·AGENTS)
54. 2026-08-05 (부록)Info·Info_mask OpenRouter LLM 설정 항목 추가
53. 2026-08-05 (부록)Info 민감정보 마스킹본 Info_mask.md 생성
52. 2026-08-05 Config/Llm 미사용 옵션·분기 정리 (llmTimeoutMs 제거, useProxy 통합)
51. 2026-08-05 OpenRouter 전환 (프로바이더 어댑터 + Bearer + choices 파싱 + Opus 5 reasoning off)
50. 2026-08-05 샘플 시드 WF JS 단순화 (JSSP·JS library 제거)
49. 2026-08-05 샘플 스키마 ACC 콘솔 방식으로 정정 (DDL/SQL 제거)
48. 2026-08-05 Test Woo 샘플 스키마·시드 (고객100·가입150)
47. 2026-08-04 MemoryBuffer.toString 정수 CODEPAGE (empty body 200)
46. 2026-08-04 LLM 응답 UTF-8 강제 디코딩 (한글 mojibake)
45. 2026-08-04 wait 완전제거 + ACC Rhino 전수조사
44. 2026-08-04 LLM sync execute (wait 미존재 대응)
43. 2026-08-04 ACC Rhino Array.map/forEach 제거 + err detail
42. 2026-08-04 P0/P1 검수 반영 (MemoryBuffer·CSRF·gates·errId)
41. 2026-08-04 urlPermission Anthropic 허용 가이드 보강
40. 2026-08-04 LLM _postJson 에러 메시지 보강 (urlPermission)
39. 2026-08-04 Cookie 헤더 우선 파싱 (AuthDebug BOUND_OK)
38. 2026-08-04 AuthDebug Cookie 헤더 보강 (진단)
37. 2026-08-04 검수 반영 (logon·게이트·UTF-8·Register sql 무시)
36. 2026-08-03 testWooAiLogon.jssp (xtk:session#Logon 토큰 발급)
35. 2026-08-03 Studio ACC 웹인증 (logon redirect + X-Security-Token)
34. 2026-08-03 requireRight 에러에 login 표시
33. 2026-08-03 Common JST-310000 response is not defined 수정
32. 2026-08-03 Studio JSSP 한글 인코딩(엔티티/\u) 수정
31. 2026-08-03 JSSP 5개로 축소 (Validate가 count/catalog 흡수)
30. 2026-08-03 JS 전역 woo→testWoo (스키마 namespace 충돌 해소)
29. 2026-08-03 섹션4 JSSP·Studio `/woo/` 적용 가이드
28. 2026-08-03 Phase3 스키마 과수정 철회 + CNF 게이트 보강
27. 2026-08-03 CNF 컴파일러 + WorkflowIo 폐기
26. 2026-08-03 LLM 미설정 안내 메시지 개선
25. 2026-08-03 LLM 옵션 JS fallback 제거
24. 2026-08-03 공식문서 교차검증 수정 (setStatus·getOption·스키마순서)
23. 2026-08-03 섹션3 JS 검수 반영 (권한·StageA·Pass0)
22. 2026-08-03 스키마 attribute→index/key 하단 배치
21. 2026-08-03 스키마·폼 name 카멜 + sqltable 통일
20. 2026-08-03 스키마 검수 반영 (autopk/sqltable/enum)
19. 2026-08-03 StageA 도메인 토큰 하드코딩 제거
18. 2026-08-03 queryDef lineCount·StageA 가드레일 전면 수정
17. 2026-08-03 섹션3 JS 라이브러리 적용 가이드
16. 2026-08-03 입력 폼 height 속성 제거 (xtk:form 준수)
15. 2026-08-03 입력 폼 name=스키마 스네이크 재정리
14. 2026-08-03 입력 폼 name 카멜 표기 정정
13. 2026-08-03 섹션2 데이터 모델 적용 가이드
12. 2026-08-03 화이트박스 정합 + 섹션1 안내 정리
11. 2026-08-03 모호 NL 계약 + new_ver v1.4 코어 정합
10. 2026-08-03 PRD v1.3 설계 점검 완료 (섹션1 Go)
9. 2026-08-03 PRD v1.2 정확도·신뢰도 아키텍처 점검 보완
8. 2026-08-03 PRD 단순화 재작성 (fragment SELECT 조합 알고리즘 확정)
7. 2026-08-03 Test Woo 네이밍 전환 (testWoo/woo/test_woo_*)
6. 2026-07-31 new_ver 코드 파일명 woo_ 접두사 통일 및 연동 점검
5. 2026-07-31 개발 가이드 리포트 + new_ver 구현 스캐폴드 제작
4. 2026-07-31 통합 PRD codemap 수기부담 축소 확정 (raw 자동적재 / group 수기)
3. 2026-07-31 통합 PRD 재작성 (v1+v2 병합, 제약 기반 생성 원칙) Rebuild/PRD.md
2. 2026-07-31 AI 대상자 추출 시스템 PRD 초안 작성 (fragment 기반)
1. 2026-07-31 old_ver 시스템 구조 분석 문서 작성

## Log Body

148. 2026-08-11 로드맵 문서 P0-2·P1 수정 — PoC-0·INJ-8-2 본문승인·가드레일
Purpose: 검수 P0-2/P1 반영. navtree view 비문서화 리스크를 PoC-0으로 막고, INJ-8-2 본문 반영을 운영자 승인으로 확정. Changes:

- PoC-0 신설(1차 선행) · 1차 Step1 PASS/FAIL 분기 · 4차 navtree sysFilter 주석 DoD
- 3차 lockedBy 파일명 고정(PASS: testWooWorkflowExt / FAIL: testWooAiWkfLock)
- 6차 원안 본문 Write 유지(registered SQL만) · 추적표·INDEX·가드레일(tamplate/view/docs-code분리)
Changed files: docs/report/upgrade_plan/*, docs/report/11_고도화_추적표.md, .cursor/rules/00-acc-guardrails.mdc, docs/log/log.md

147. 2026-08-11 P0 브랜치 분리 — roadmap new_ver 복원 · fix/embed-layout
Purpose: docs/roadmap-v2 커밋에 혼입된 new_ver 변경을 제거하고 문서 브랜치를 main 코드 베이스라인과 일치시킴. Changes:

- 진단: html/js −2KB = #twDiag/_diag no-op·TW-BOOT 제거(b). #133 `_xhrPost` 유지(a 아님)
- docs/roadmap-v2: new_ver 4파일을 main과 동일하게 복원 커밋
- 레이아웃 후보만 fix/embed-layout 브랜치로 분리(0차 DoD 후 병합 검토)
Changed files: new_ver/html/testWooAiStudio.js, new_ver/jssp/testWooAiStudio.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/input_form/testWooExtendWorkflow.xml, docs/log/log.md

146. 2026-08-11 고도화 기반 — 추적표·Rules/Skills/Agents·차수 가이드(0~8+PoC)
Purpose: 관리자 아이디어 전수 ID화 + 커서 운용체계 + AI 실행용 차수 문서로 유실·환각 구현을 차단. new_ver 코드 변경 없음. Changes:

- `docs/report/11_고도화_추적표.md` — 66 ID · 판정 · 차수 매핑 (UI-3-2=`@isAiFolder`, J-9-5-2=불가·경량언급, FLOW-5-3=Jaccard 0.9)
- `.cursor/rules/00-acc-guardrails.mdc` + skills 5 + agents 3 (`acc-verifier`/`acc-id-tracer`/`acc-doc-writer`)
- `docs/report/upgrade_plan/00_INDEX.md` + `01_0차`~`10_8차` + `04_3a_PoC` — Chat 첨부용 단독완결 가이드(HUMAN_CONSOLE·DoD·디버그)
- ReportIndex 갱신 · 브랜치 `docs/roadmap-v2`
Changed files: docs/report/11_고도화_추적표.md, docs/report/upgrade_plan/*, docs/report/00_ReportIndex.md, .cursor/rules/00-acc-guardrails.mdc, .cursor/skills/acc-*/, .cursor/agents/*, docs/log/log.md

145. 2026-08-10 embed UI — 입력 2줄 · 답변 영역 확대 (v=143)
Purpose: #144 에서 입력창을 과도하게 키운 것을 되돌리고, 생성 결과(답변) 영역에 공간을 배분 Changes:

- textarea#nl: height 52px(~2줄), composer 를 hint 바로 아래로 이동
- .answer 래퍼 min-height 280px · SQL pre max-height 240px
- 폼/Studio ?v=143 (카드 id 동일 — JS 로직 변경 없음)
Changed files: new_ver/jssp/testWooAiStudio.jssp, new_ver/input_form/testWooExtendWorkflow.xml, docs/log/log.md

144. 2026-08-10 Studio UI — 진단/TW-BOOT 제거 · 입력·이력 확대 (v=142)
Purpose: 사용자용 UI 정리 — 진단 섹션·노란 TW-BOOT 제거, 자연어 입력창과 SQL 이력 세로 확대 Changes:

- #twDiag / #twBoot / 노란 bgcolor 테이블 삭제 (상단 노란 깜빡임 원인)
- embed textarea#nl height 200px(min) · body/side min-height 420px (table-cell 동시 확장)
- urlViewer container height 560→640 · 폼/Studio ?v=142
- _diag no-op · onerror 는 hint 배너만
Changed files: new_ver/jssp/testWooAiStudio.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, new_ver/input_form/testWooExtendWorkflow.xml, docs/log/log.md

143. 2026-08-10 재오픈 흰화면 — enter 에도 _r=tick (urlViewer 캐시)
Purpose: 동일 WF 창 닫았다 재오픈 시 Studio URL 에 _r 없어 urlViewer(IE)가 이전 문서를 재사용해 흰화면이 나던 문제 수정 Changes:

- 원인: #139 가 enter 에서 _r 를 빼 동일 URL 재진입 → MSHTML 캐시. Reload 만 _r 갱신되어 그때만 정상
- enter: ShellPick 후 twStudioUrl 에 `_r=`+tick 재설정 (선행 set 은 SOAP 실패 폴백 유지)
- 폼 캐시 리트머스 v=141
- Studio JSSP 변경 없음
Changed files: new_ver/input_form/testWooExtendWorkflow.xml, docs/log/log.md

142. 2026-08-10 embed SQL 이력 세로 채움 — table-cell 2열 · composer→main (v=140)
Purpose: #139 float baseline 에서 SQL 이력이 콘텐츠 높이만 잡아 위·아래 공백이 생기던 문제를 해소. Changes:

- embed: display:table / table-cell 2열(좌 64% / 우 36%), 행 높이 동일
- composer 를 .main 안으로 이동(입력창이 이력 옆에 붙지 않음)
- _showSqlSide: inline display 제거 → CSS table-cell 유지
- 캐시 버스트 Studio/폼 ?v=140
Changed files: new_ver/jssp/testWooAiStudio.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, new_ver/input_form/testWooExtendWorkflow.xml, docs/log/log.md

141. 2026-08-10 폼 그리드 좌측공백 — Reload 버튼 colspan=3
Purpose: urlViewer 좌측 ~425px 공백 원인 확정(폼 그리드) · CSS 무수정 Changes:

- (a) 화면 Studio URL 이 v=138+_r → ACC 폼은 #138, #139/#140 폼 미배포(리트머스)
- (b) 좌측 공백 경계 x≈425 = Apply 행 컬럼2 시작선 → Studio CSS 아님, colcount=3 그리드
- Reload 버튼에 colspan="3" 누락 → 다음 colspan=3(urlViewer)가 컬럼2부터 배치
- (c) 흰화면 캐시헤더(no-store/Pragma) 가설은 별도 커밋(#142 예정)으로 분리 검증
- 이번 커밋: 폼 XML + 주석만. JSSP/CSS 변경 없음

Changed files: new_ver/input_form/testWooExtendWorkflow.xml, docs/log/log.md

140. 2026-08-10 폼 enter 방어 — twStudioUrl 선행 set · _r 는 Reload/Apply만
Purpose: SOAP 실패 시 urlViewer URL 미설정으로 Viewer 통째 소실 방지 Changes:

- 흰화면 원인 (b): enter 에서 twStudioUrl 미설정 → urlViewer 빈 페이지
- SOAP 호출 전에 twStudioUrl 기본값(v=139, _r 없음) 선행 set
- 캐시버스트: 매 진입 _r 금지 · Reload/Apply 직후에만 _r=tick
- Studio URL 칸 판별 기준을 폼 주석에 명시 (비면 enter 실패 / 값+흰면 Studio)

Changed files: new_ver/input_form/testWooExtendWorkflow.xml, docs/log/log.md

139. 2026-08-10 baseline — #134/#136/#138 레이아웃 철회 (#133/#135/#137 유지)
Purpose: 추측 레이아웃 누적 악화 중단 · 검증 가능 baseline 확보 Changes:

- git: #133~#138 이 d7715db 단일 squash → #134/#136/#138 단독 revert 불가
- 유지: #133 XHR/ES5 · #135 TW-BOOT · #137 FormatDate 금지·ShellPick tick
- 철회: #134 세로스택 · #136 좌우 재도입 실험 · #138 table-cell+composer-in-main
- embed CSS 를 #131 float+has-sql-side 로 복구 · composer 를 .body 밖으로
- 진단 패널 embed 기본 펼침 + location.href / TW-BOOT reached 기록
- #134·#136·#138 철회 사유: 추측 기반 반복 수정으로 상호 충돌·누적 악화
- 폼 XML 미포함 (원인 분리 — #140)

Changed files: new_ver/jssp/testWooAiStudio.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, docs/log/log.md

138. 2026-08-10 embed UI 깨짐 수정 — table-cell 2열 · 입력창 왼쪽
Purpose: float+min-height 로 중칸 공백·이력 우측 둥둥·입력창 유실 Changes:

- embed: float 제거 → display:table / table-cell (좌 64% / 우 36%)
- composer(생성·등록)를 main 안으로 이동 — 왼쪽 AI 열에 고정
- _showSqlSide: 인라인 display 제거, has-sql-side 클래스만 (CSS가 table-cell)
- ?v=138 · 폼 URL v=138

Changed files: new_ver/jssp/testWooAiStudio.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, new_ver/input_form/testWooExtendWorkflow.xml, docs/log/log.md

137. 2026-08-10 폼 FormatDate 제거 — ShellPick tick 캐시버스트 (XTK-170016)
Purpose: #135 폼의 FormatDate/GetDate 가 보안존에서 SQL expression 거부됨 Changes:

- 원인: XTK-170016 FormatDate 는 SQL 식으로 분류 · 운영자 권한 없음
- 폼: FormatDate 제거 · ShellPick 3번째 out tick 으로 `_r=` 구성
- ShellPick JS: Date.getTime() 문자열 반환 · 스키마 out tick 추가
- 재배포 필수 동시: schema + testWooWorkflowUi.js + ExtendWorkflow 폼

Changed files: new_ver/input_form/testWooExtendWorkflow.xml, new_ver/schema/testWooAiWorkflowUi.xml, new_ver/js/testWooWorkflowUi.js, docs/log/log.md

136. 2026-08-10 embed 레이아웃 복원 — 좌 AI / 우 SQL 이력
Purpose: #134 세로스택이 UX를 해침 — 17~18시 좌우 분할로 복원 (흰화면 수정은 유지) Changes:

- embed: main margin-right 38% + side float 36% (왼쪽 AI·오른쪽 이력)
- 입력창(composer)은 하단 full-width clear
- 정상 부팅 시 TW-BOOT 바 숨김(오류 시에만 표시) · 진단 패널에 기록
- ?v=136 · 폼 URL v=136

Changed files: new_ver/jssp/testWooAiStudio.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, new_ver/input_form/testWooExtendWorkflow.xml, docs/log/log.md

135. 2026-08-10 urlViewer 미로드 판별 — 폼 캐시버스트 · TW-BOOT · Reload
Purpose: 재진입 시 Viewer만 완전 공백(하단 Apply·SQL은 정상) — JSSP HTML 미도착 가능 Changes:

- 스크린샷 판독: 폼 SOAP OK · Viewer에 #twBoot 없음 → 연결끊김 아님, urlViewer 문서 미표시
- 폼: enter 시 Studio URL+_r 캐시버스트 · UrlViewer+urlMode · Studio URL 필드 · Reload Studio
- Studio: CSS 이전 TW-BOOT 노란 테이블 마커(v=135) — 이것도 없으면 폼 Viewer 미로드
- 재배포: ExtendWorkflow 폼 + Studio.jssp + StudioJs.jssp

Changed files: new_ver/input_form/testWooExtendWorkflow.xml, new_ver/jssp/testWooAiStudio.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, docs/log/log.md

134. 2026-08-10 embed 흰화면 잔존 — flex/CSS변수 제거 · 세로스택 · #twBoot
Purpose: #133 XHR 후에도 재오픈 흰화면 — IE에 flex/var(--*)/float 이력패널이 접힘 Changes:

- embed: flex·100vh·float 우측패널 제거 → 세로 스택(이력은 main 아래 전체폭)
- CSS 변수(var) → hex 고정 (IE11 미지원)
- header/main/aside/footer/details → div · HTML5 shiv 유지
- #twBoot 최상단: HTML만으로 documentMode 표시, JS 로드 시 js ok 로 갱신
- StudioJs Content-Type text/javascript · ?v=134

Changed files: new_ver/jssp/testWooAiStudio.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, docs/log/log.md

133. 2026-08-10 urlViewer 흰화면 근본원인 — IE 미지원 API(fetch/Promise) 제거
Purpose: ACC urlViewer=MSHTML(IE) 에서 Studio 재진입 흰화면·삭제 confirm 미동작 근본 수정 Changes:

- 진짜 원인: 클라이언트 JS 의 fetch/Promise/.finally/classList (CSS 아님)
- 이력 0건이면 loadSqlList 가 post 이전 return → 정상으로 보임 → #118·#128·#130·#131 CSS 오진 재발 원인
- post → XMLHttpRequest(+ActiveX 폴백) 콜백 · Promise/finally 제거 · className 헬퍼
- window.confirm 은 WebBrowser 호스트가 억제 → 삭제 2단계 클릭(3초)
- X-UA-Compatible IE=edge (charset 직후) · #twDiag 진단 패널(documentMode/UA/XHR)
- StudioJs Cache-Control no-store · ?v=133 · html↔jssp 동기화
- #130·#131 float/has-sql-side CSS 는 흰화면 소멸 확인 후 단순화 재검토(이번엔 유지)

Changed files: new_ver/html/testWooAiStudio.js, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/jssp/testWooAiStudio.jssp, docs/log/log.md

132. 2026-08-10 Studio 배너「승인 API 열기」링크 제거
Purpose: 마케터 UI에 JSON API 링크 불필요 — 승인 화면은 추후 별도 Changes:

- awaiting_approval 배너에서 링크 제거 (안내 문구만 유지)
- script ?v=132
- 재배포: testWooAiStudio.jssp + testWooAiStudioJs.jssp

Changed files: new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, new_ver/jssp/testWooAiStudio.jssp, docs/log/log.md

131. 2026-08-10 SQL이력 있을 때 흰화면 — WebView JS 호환 · 삭제 버튼
Purpose: 이력 0건은 되고 2건 후 재오픈 시 또 흰 화면 — 목록 렌더 경로만 터지는 패턴 Changes:

- 원인: 이력>0 일 때만 타던 forEach/구엔진 + 캐시된 StudioJs · table/flex 접힘 잔존
- StudioJs: URLSearchParams→수동 qs, forEach/filter 제거, setTimeout 로드, onerror 힌트
- embed: float+has-sql-side · script ?v=131 캐시 무력
- deleteSql API + 이력 행 우측「삭제」confirm
- 재배포: Studio.jssp + StudioJs + Validate + Repository

Changed files: new_ver/jssp/testWooAiStudio.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, new_ver/jssp/testWooAiValidate.jssp, new_ver/js/testWooRepository.js, docs/log/log.md

130. 2026-08-10 Apply/재진입 urlViewer 흰 화면 — flex:1 제거 · form height
Purpose: 등록·Apply 후 Studio 재오픈 시 상단이 흰 빈칸, Apply 줄만 남음 Changes:

- #128 embed flex + `@supports` body{flex:1} 이 부모 height:auto 에서 0으로 접힘
- embed를 table 62%/38% 로 복귀 · 충돌 @supports 블록 삭제
- 폼 urlViewer 를 container height=520 으로 공간 예약
- StudioJs: forEach→for (이력 로드 안전)
- 재배포: testWooAiStudio.jssp + StudioJs + testWooExtendWorkflow 폼

Changed files: new_ver/jssp/testWooAiStudio.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, new_ver/input_form/testWooExtendWorkflow.xml, docs/log/log.md

129. 2026-08-10 Register CSRF — Origin 없을 때 pageHost↔Host 폴백
Purpose: 등록 시 `CSRF: Origin/Referer required` — urlViewer 가 Origin/Referer 미전달 Changes:

- Studio post()에 pageHost=location.host
- requireStudioCsrf: Origin/Referer 없으면 csrf+pageHost===Host 로 통과
- 재배포: testWooCommon.js + StudioJs.jssp (Register는 기존 requireStudioCsrf(p))

Changed files: new_ver/js/testWooCommon.js, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, docs/log/log.md

128. 2026-08-10 embed WF SQL 이력 — table→flex · 340px
Purpose: urlViewer 임베드에서 이력 패널이 여전히 좁게 보임(240px table-cell 축소) Changes:

- embed `.body` flex · `.side` flex-basis 340px / min 300px
- 재배포: testWooAiStudio.jssp 후 Studio 다이얼로그 재오픈

Changed files: new_ver/jssp/testWooAiStudio.jssp, docs/log/log.md

127. 2026-08-10 Studio/Generate `\u` 한글 오타 전수 스캔·수정
Purpose: #125 수정 후 “아직 안 뜬 문구”에도 같은 이스케이프 오타 잔존 여부 검증 Changes:

- 잔존: 시간초과·Generate queued 문구 `질뮬`/`재시큐` → 질문/재시도
- 추가: triage 상세 summary `확인 규거` → `확인 근거`
- known-bad 패턴(`\uC9C8\uEBAC` 등) new_ver 전역 재스캔 → 0건
- 재배포: StudioJs + Generate.jssp

Changed files: new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, new_ver/jssp/testWooAiGenerate.jssp, docs/log/log.md

126. 2026-08-10 Register CSRF — payload.csrf 폴백 (urlViewer 헤더 미전달)
Purpose: 등록 시 `CSRF: X-Requested-With TestWooStudio required` — Generate는 CSRF 미검사라 통과, Register만 실패 Changes:

- requireStudioCsrf(optPayload): 헤더 또는 payload.csrf=TestWooStudio
- Studio post() 가 모든 API에 csrf 필드 첨부 · Origin/Referer host 검사는 유지
- 재배포: testWooCommon.js + Register.jssp + StudioJs.jssp

Changed files: new_ver/js/testWooCommon.js, new_ver/jssp/testWooAiRegister.jssp, new_ver/jssp/testWooAiFragmentReview.jssp, new_ver/jssp/testWooAiFragmentAdmin.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, docs/log/log.md

125. 2026-08-10 Studio 승인 배너 한글 오타 수정 · SQL 이력 패널 확장
Purpose: awaiting_approval 안내가 잘못된 `\uXXXX` 로 깨져 보임 + WF SQL 이력 좁음 Changes:

- 이미/아닙니다/질문/재시도 이스케이프 수정 · 링크 문구 “승인 API 열기”
- `.side` 300→380px, embed 168→240px
- 재배포: testWooAiStudio.jssp + testWooAiStudioJs.jssp

Changed files: new_ver/jssp/testWooAiStudio.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, docs/log/log.md

124. 2026-08-10 OpenRouter Claude Azure 400 — tool_choice.none + parallel_tool_calls 제거
Purpose: Sonnet 4.6(Azure) 전환 시 `tool_choice.none.disable_parallel_tool_use: Extra inputs are not permitted` Changes:

- postChat/_sanitizeChatBody: tool_choice none 이면 parallel_tool_calls 삭제
- openrouter adapter·Feasibility·Foundry 동일 규칙
- 재배포: testWooLlm.js (+ Feasibility/Foundry 툴 루프 쓰면 해당 JS도)

Changed files: new_ver/js/testWooLlm.js, new_ver/js/testWooFeasibility.js, new_ver/js/testWooFoundry.js, docs/log/log.md

123. 2026-08-10 Shell* SOAP 교체 · 빈 액티비티 Status · Pass0 salvage/penalty
Purpose: SOP-330003(구 Bind 시그니처)·빈 CA 안내 유실·Pass0 Gemini 반복 length 동시 조치 Changes:

- SOAP 메서드명 ShellProbe/ShellPick/ShellBind 로 교체(구 Inspect/Bind/GetBindPick 제거)
- 폼 Apply 에 Status 복구 — 액티비티 없을 때 [안내] 문구 표시
- Pass0: 하드 리밋 프롬프트 · 첫 호출 fp=0.5 · length 시 slots salvage · 재시도 fp=0.8
- 재배포: schema + WorkflowUi.js + form + (Pass0) testWooLlm.js

Changed files: new_ver/schema/testWooAiWorkflowUi.xml, new_ver/js/testWooWorkflowUi.js, new_ver/input_form/testWooExtendWorkflow.xml, new_ver/js/testWooLlm.js, docs/report/01_개발가이드.md, docs/log/log.md

122. 2026-08-10 확장 폼 레이아웃 — 상단 제거 · Studio 최대 · Apply에 WF/act/sql
Purpose: 상단 요약/Status 제거, urlViewer를 Apply 직전까지 확대, 하단에 WF·Activity·ai_sql_id 배치 Changes:

- 폼: Studio first · Apply separator · Workflow 1줄 · Activity+SQL+Apply 같은 줄
- BuildStudioUrl/Refresh/Status/Selected SQL 라벨 제거 (enter는 Inspect+GetBindPick만)

Changed files: new_ver/input_form/testWooExtendWorkflow.xml, docs/log/log.md

121. 2026-08-10 Apply 단순화 — 첫 액티비티만 · Inspect out×3 · 선택 UI 제거
Purpose: SOAP Too many arguments 지속 → 복수 선택 폐기, 타게팅 1개 전제로 최소 시그니처 Changes:

- InspectAiTarget: out ×3 (has / message / firstActivityName)
- ListAiActivities·activityName 인자 제거
- BindAiSqlId: 항상 첫 ibankSqlDM 에 바인딩
- 폼: Target activity readOnly + Apply 만

Changed files: new_ver/js/testWooWorkflowUi.js, new_ver/schema/testWooAiWorkflowUi.xml, new_ver/input_form/testWooExtendWorkflow.xml, docs/report/01_개발가이드.md, AGENTS.md, docs/log/log.md

120. 2026-08-10 SOAP Element≠string — Inspect 스칼라 복귀 + ListAiActivities 분리
Purpose: 폼은 Element(inspectResult)인데 서버 메서드는 string → 타입 불일치. Inspect/List 분리로 안정화 Changes:

- InspectAiTarget: 검증된 string out ×5 로 복귀
- ListAiActivities 신설: actList DOM ×1 (폼 type=list)
- 전체 JSSP 셸은 Apply→activities 쓰기 때문에 비권장(아래 채팅 설명)
- 재배포: schema → JS → form (셋 동시)

Changed files: new_ver/js/testWooWorkflowUi.js, new_ver/schema/testWooAiWorkflowUi.xml, new_ver/input_form/testWooExtendWorkflow.xml, docs/report/01_개발가이드.md, docs/log/log.md

119. 2026-08-10 SOAP Too many arguments — InspectAiTarget out DOM 1개로 축소
Purpose: Inspect out 을 6개로 늘린 뒤 `Too many arguments in XML SOAP message` 발생 — ACC SOAP 인자 한도 Changes:

- InspectAiTarget: in 1 + out 1 (`testWooInspect` DOM: @has/@count/@message/@default + act[])
- 폼: xpathOut=/tmp/testWooInspect 후 set 로 /tmp/@* 매핑 · list xpath=/tmp/testWooInspect/act
- 가드레일 문서화: 스칼라 out 추가 금지, 풍부 데이터는 DOM 봉투
- 재배포 순서: schema → JS WorkflowUi → form ExtendWorkflow (셋 모두 필수)

Changed files: new_ver/js/testWooWorkflowUi.js, new_ver/schema/testWooAiWorkflowUi.xml, new_ver/input_form/testWooExtendWorkflow.xml, docs/report/01_개발가이드.md, docs/log/log.md

118. 2026-08-10 embed Studio 흰 빈칸 — min-height:0 접힘 복구
Purpose: #116 embed 압축에서 min-height 제거 후 urlViewer 안 Studio 가 흰 빈 영역으로 접힘 Changes:

- body.embed / .app: height:auto + min-height:480px (100%+min-height:0 제거)
- overflow:hidden → auto
- 재배포: JSSP testWooAiStudio.jssp 만

Changed files: new_ver/jssp/testWooAiStudio.jssp, docs/log/log.md

117. 2026-08-10 Apply 액티비티 — 텍스트입력 → 캔버스 목록 type=list 선택
Purpose: Apply 대상 커스텀 액티비티를 자유입력 대신 캔버스 ibankSqlDM 목록에서 고르게 함 (복수 대응) Changes:

- InspectAiTarget 6번째 out: actList DOM (`testWooAiActList/act`)
- 폼: type=list + xpathValue + expr → `/tmp/@testWooAiActivityName` (xtk:workflow WSDL 선택과 동일)
- HTML select/sysEnum 동적 채움은 ACC 비지원 → memory list 가 공식 대안
- 재배포: schema testWooAiWorkflowUi + JS WorkflowUi + form ExtendWorkflow

Changed files: new_ver/js/testWooWorkflowUi.js, new_ver/schema/testWooAiWorkflowUi.xml, new_ver/input_form/testWooExtendWorkflow.xml, docs/log/log.md

116. 2026-08-10 listAiSql 진단·Repository 재배포 안내 · embed 높이 압축
Purpose: `listAiSqlByWorkflow is not a function` 은 Adobe API 오용이 아니라 서버 Repository.js 구버전. embed CSS 를 urlViewer 낮은 높이에 맞게 압축 Changes:

- Validate: repo 메서드 없으면 재배포 안내 메시지
- listAiSqlByWorkflow 자체는 xtk.queryDef(공식) — 로컬 new_ver 에 이미 존재
- Studio embed: min-height 제거·폰트/패딩 축소·퍼널 숨김·side 168px
- 인풋폼 다이얼로그 고정 height 는 ACC 공식상 불가(비율 레이아웃) — SubFormButton API 에 height 없음

Changed files: new_ver/jssp/testWooAiValidate.jssp, new_ver/jssp/testWooAiStudio.jssp, docs/report/01_개발가이드.md, docs/log/log.md

115. 2026-08-10 Studio UX — listSql·bindPick·폼 축소·브라우저 열기·embed 밀집
Purpose: urlViewer 동작 후 UX — SQL 이력 listSql 오류(구 Validate) 대응, 폼 단순화, Studio 한 화면 밀집, Apply=SQL선택+액티비티명 Changes:

- Validate: listSql/getSql 유지 + setBindPick/getBindPick (Option testWooAiBindPick_&lt;login&gt;)
- Studio: SQL 클릭·등록 시 setBindPick · embed 헤더「브라우저로 보기」·CSS 밀집
- 확장 폼: Fallback/수동 ai_sql_id 제거 · Selected SQL 표시 · activity @name + Apply + check
- Inspect 5번째 out=defaultActivityName · Bind 에 workflowName·pick 폴백
- 이력은 woo:testWooAiSql(workflow_name) 에 남음 — 창 닫았다 열어도 listSql 정상 시 유지

Changed files: new_ver/jssp/testWooAiValidate.jssp, new_ver/jssp/testWooAiStudio.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, new_ver/js/testWooWorkflowUi.js, new_ver/schema/testWooAiWorkflowUi.xml, new_ver/input_form/testWooExtendWorkflow.xml, docs/log/log.md

114. 2026-08-10 Studio 임베드 — type=html iframe → ACC urlViewer+sessionToken
Purpose: 콘솔에서 iframe HTML이 글자로 보이던 UX를 Adobe 폼 컨트롤 urlViewer 로 교체 (사용자 제시 adHocReport 패턴 · KCS UrlViewer) Changes:

- `testWooExtendWorkflow`: `type="urlViewer"` `sessionToken="true"`
  `urlExpr="$(serverUrl)+'/woo/testWooAiStudio.jssp?workflowName='+@internalName+'&embed=1'"`
- type=html iframe 제거. Fallback URL(Option) 필드는 외부 브라우저용으로 유지
- 가이드 §7 임베드 계약 문구 갱신

Changed files: new_ver/input_form/testWooExtendWorkflow.xml, docs/report/01_개발가이드.md, docs/log/log.md

113. 2026-08-10 가이드 §7 재배포 — #112 콘솔 경로·파일 대응표(A~E) 보강
Purpose: “뭘 어디에”가 불명확하다는 피드백에 맞춰 Data schemas / JS / Input form / JSSP / uplus 외 작업을 표로 고정 Changes:

- `01_개발가이드` §5-1 을 A(필수4)·B(Option)·C(uplus)·D(스킵)·E(검증) 로 재작성

Changed files: docs/report/01_개발가이드.md, docs/log/log.md

112. 2026-08-10 계약 B — Inspect/Bind 대상 ibankSqlDM(+레거시 customActivity) · script SQL 금지
Purpose: 운영 액티비티 `ibankSqlDM`(AI 대상자 추출)에 `ai-sql-id` 만 바인딩하는 B안을 코드·가이드에 반영. OOTB SQL Data Management·script SQL 주입은 대상/금지 Changes:

- Inspect/Bind: 주 요소 `ibankSqlDM`, 레거시 팔레트 xpath `customActivity` 병행 인식
- 상태 메시지·폼 도움말·Studio 안내 문구를 ibankSqlDM / no script 기준으로 갱신
- 샘플 계약 XML 을 `ibankSqlDM` + `ai-sql-id` 로 정정
- 가이드 v1.7.6 · pipeline-contracts · skill/architecture 동기화
- 7d 런타임·`uplus:workflow` 스키마 `ai-sql-id` 필드 추가는 저장소 외 → 운영 반영 안내로 분리

Changed files: new_ver/js/testWooWorkflowUi.js, new_ver/input_form/testWooExtendWorkflow.xml, new_ver/schema/testWooAiWorkflowUi.xml, new_ver/workflow/testWooSampleCustomActivityContract.xml, new_ver/html/testWooAiStudio.js, new_ver/jssp/testWooAiStudioJs.jssp, docs/report/01_개발가이드.md, .cursor/skills/campaign-ai-studio/{SKILL.md,pipeline-contracts.md,architecture.md}, AGENTS.md, docs/log/log.md

111. 2026-08-10 #96~#110 검수 P0·P1 수정 — ai-sql-id 중복·enter throw·embed CSS·로그96 결번
Purpose: ACC 콘솔 통합 계층(#96~#110) 검수 P0 2건·P1 3건 수정. Fragment 생애주기 런타임 전환·WebApp 이관은 범위 외 Changes:

- P0-1: `_twWfSetAiSqlId` — E4X XMLList 대입 시 자식 무음 유실 → length>1 이면 전부 제거 후 단일 재삽입, before/after logInfo
- P0-2: BuildStudioUrl 진입 경로 — `testWooAiStudioBaseUrl` 비면 throw 대신 안내 HTML(옵션 미설정·설정법). BindAiSqlId 액션 경로는 throw 유지. Adobe: soapCall 예외는 모두 표시되어 <enter> throw 시 Targeting 확장 폼 진입 불가
- P1: BindAiSqlId activityName 불일치 시 캔버스 후보 @name 목록 포함
- P1: embed=1 CSS — 표/블록 폴백 + `@supports(flex)` · vh→부모 높이(%). DOM/스크립트 변경 없음
- P1: Fallback URL을 iframe 바로 아래 이동 + 빈 프레임 시 브라우저 붙여넣기 안내. Web Applications 비채택 사유를 폼 상단 주석에 기록
- P1: form enter / Refresh 2+2 호출은 오픈 vs 수동으로 분리되어 3중 아님 → 호출 축소 없이 주석만 남김
- 로그 #96 결번 복원 기재(번호 재사용 금지). #98이 언급한 “승인 UI(#96 계열)”은 git 단일 커밋으로 특정 불가
- ai-sql-id 참조 구조 확정 → 킬스위치 역조회(fragment → ai_sql_id → WF) 경로 성립 후보 (`10_Fragment_생애주기_설계.md` TBD 해소)
- 4-1 Fallback URL 외부 브라우저 진단은 폐쇄망이라 로컬에서 미실행 — 배포 후 사용자 검증 항목으로 유지

Changed files: new_ver/js/testWooWorkflowUi.js, new_ver/input_form/testWooExtendWorkflow.xml, new_ver/jssp/testWooAiStudio.jssp, new_ver/schema/testWooAiWorkflowUi.xml, docs/log/log.md

110. 2026-08-07 InspectAiTarget — activityCount long↔int SOAP 타입 오류 → string outs
Purpose: 폼 soapCall 이 int 로 보내고 메서드가 long 을 기대해 발생한 타입 불일치 해소 Changes:

- hasActivity·activityCount out 을 string 으로 통일 (스키마·JS·확장 폼)

Changed files: new_ver/schema/testWooAiWorkflowUi.xml, new_ver/js/testWooWorkflowUi.js, new_ver/input_form/testWooExtendWorkflow.xml, docs/log/log.md

109. 2026-08-07 WebApp형 Studio 임베드 — Inspect/Bind ai_sql-id · 확장 폼 iframe
Purpose: AI Studio를 확장 폼(콘솔 WebView)에 임베드하고, CA 존재 확인 및 Register 후 ai_sql-id 캔버스 반영 Changes:

- SOAP BuildStudioUrl(embed iframe HTML) · InspectAiTarget · BindAiSqlId
- testWooExtendWorkflow: iframe/html · CA status · Apply to canvas
- Studio ?embed=1 레이아웃 · Register 안내 문구
- 가이드 섹션7 주 UX를 임베드로 승격 (외부 브라우저는 폴백)

Changed files: new_ver/js/testWooWorkflowUi.js, new_ver/schema/testWooAiWorkflowUi.xml, new_ver/input_form/testWooExtendWorkflow.xml, new_ver/jssp/testWooAiStudio.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, new_ver/workflow/testWooXtkWorkflowRedirectPatch.xml, new_ver/workflow/testWooSampleCustomActivityContract.xml, docs/report/01_개발가이드.md, AGENTS.md, docs/log/log.md

108. 2026-08-07 AI Studio 다이얼로그 — nothingToEdit/Save 로 OK(닫기) 활성
Purpose: URL 안내 전용 서브폼에서 OK가 비활성(저장할 필드 없음)이던 문제 해소 Changes:

- aiStudio form에 nothingToEdit/nothingToSave=true (OOTB View population 패턴)

Changed files: new_ver/input_form/testWooExtendWorkflow.xml, docs/log/log.md

107. 2026-08-07 AI Studio 호스트 — 폼 하드코딩 제거 · Option testWooAiStudioBaseUrl 단일 소스
Purpose: 호스트는 이미 둔 Option을 쓰고 폼/JS에 URL을 박지 않음. 자동 표시·readOnly UX는 유지 Changes:

- BuildStudioUrl(workflowName)만 — getOption(testWooAiStudioBaseUrl) 필수
- 확장 폼 soapCall 에서 baseUrl 파라미터·하드코딩 제거
- 가이드 재배포 순서 정리

Changed files: new_ver/input_form/testWooExtendWorkflow.xml, new_ver/js/testWooWorkflowUi.js, new_ver/schema/testWooAiWorkflowUi.xml, docs/report/01_개발가이드.md, docs/log/log.md

106. 2026-08-07 AI Studio 다이얼로그 — URL·WF명 자동/readOnly · baseUrl은 인풋폼에서 고정
Purpose: 사용자가 URL을 입력·수정하지 않도록 하고, 호스트는 개발자가 확장 폼 soapCall에서만 바꾸게 함 Changes:

- testWooExtendWorkflow: form enter 시 BuildStudioUrl · internalName/URL readOnly · base=__CAMPAIGN_SERVER_URL__
- BuildStudioUrl(workflowName, baseUrl) 시그니처 · JS fallback 동일 호스트
- 가이드 섹션7 진입 UX 문구 갱신

Changed files: new_ver/input_form/testWooExtendWorkflow.xml, new_ver/js/testWooWorkflowUi.js, new_ver/schema/testWooAiWorkflowUi.xml, docs/report/01_개발가이드.md, docs/log/log.md

105. 2026-08-07 AI Studio 진입점 — 캠페인 Targeting용 Properties 옆 flatSubFormButton 으로 변경
Purpose: 캠페인 Targeting 임베드에는 iconbox 좌측 탭이 안 보임. Properties와 같은 툴바 버튼으로 진입점 이동 Changes:

- testWooExtendWorkflow: lib/aiStudio 서브폼으로 UI 본체 정리
- RedirectPatch: Properties </input> 다음 insert 스니펫
- 가이드 섹션7 진입점·체크리스트를 캠페인 Targeting 기준으로 수정

Changed files: new_ver/input_form/testWooExtendWorkflow.xml, new_ver/workflow/testWooXtkWorkflowRedirectPatch.xml, docs/report/01_개발가이드.md, docs/log/log.md

104. 2026-08-07 xtk:workflow 저장 XML-110013 — xpathTargetDataSource 제거 안내(ref 무관)
Purpose: AI ref 추가 저장 시 원본 ~2045행 xpathTargetDataSource 가 이 환경 xtk:form 에 없어 검증 실패 Changes:

- RedirectPatch 에 Save 전 속성 2곳 삭제 절차 명시
- 원인: FDA 관련 속성·빌드 불일치. ref 줄 자체 오류 아님

Changed files: new_ver/workflow/testWooXtkWorkflowRedirectPatch.xml, docs/log/log.md

103. 2026-08-07 섹션7 문구 정리 — 확장(entity-schema+ref), “상속 불가” 논쟁 표현 제거
Purpose: 독자 혼동을 줄이기 위해 진입점 설명을 entity-schema 별도 폼 + ref 확장으로만 기술 Changes:

- 가이드·폼 주석·RedirectPatch 에서 상속/불가 논쟁 문구 삭제
- 용어 통일: 확장 폼(`entity-schema="xtk:workflow"`) + 원본에 ref 한 줄

Changed files: docs/report/01_개발가이드.md, new_ver/input_form/testWooExtendWorkflow.xml, new_ver/workflow/testWooXtkWorkflowRedirectPatch.xml, new_ver/workflow/testWooXtkWorkflowButtonPatch.xml, new_ver/schema/testWooAiWorkflowUi.xml, docs/log/log.md

102. 2026-08-07 woo:testWooExtendWorkflow — Workflow 확장 폼 + ref 연결 · AI Studio 탭
Purpose: 원본 Workflow.xml은 보관하고, AI UI만 woo 확장 폼에 두며 xtk:workflow에는 ref 한 줄로 연결 Changes:

- `input_form/testWooExtendWorkflow.xml` (AI Studio 페이지 + soapCall, entity-schema=xtk:workflow)
- `workflow/testWooXtkWorkflowRedirectPatch.xml` (</form> 직전 insert 스니펫)
- 구 Properties 옆 직접 패치 폐기 · 원본 백업 복사
- 가이드 진입점·적용표 갱신

Changed files: new_ver/input_form/testWooExtendWorkflow.xml, new_ver/workflow/testWooXtkWorkflowRedirectPatch.xml, new_ver/workflow/testWooXtkWorkflowButtonPatch.xml, new_ver/workflow/backup/xtk_workflow_ORIGINAL.xml, docs/report/01_개발가이드.md, docs/log/log.md

101. 2026-08-07 testWooAiWorkflowUi — methods를 srcSchema 직속으로 이동 (XML-110013)
Purpose: ACC 저장 시 `Element 'methods' is unknown (/element in xtk:srcSchema)` — methods를 element 안에 두면 문법 오류 Changes:

- `<methods>` 를 `<element>` 밖으로 이동 (srcSchema 직속)
- element는 빈 호스트 노드만 유지

Changed files: new_ver/schema/testWooAiWorkflowUi.xml, docs/log/log.md

100. 2026-08-07 섹션7a·7b — soapCall BuildStudioUrl · listSql/getSql · Studio 우측 SQL 패널
Purpose: WF 캔버스에서 Studio를 공식 Adobe 경로(soapCall+스키마 SOAP)로 열고, WF별 SQL 이력을 Studio 오른쪽에 표시 Changes:

- Adobe 검토: factory 폼 상속 불가 · soapCall/Implementing SOAP methods 채택 · fat client 공식 openUrl 없음 → URL을 /tmp에 쓰고 외부 브라우저
- 스키마 `woo:testWooAiWorkflowUi` + JS `woo_testWooAiWorkflowUi_BuildStudioUrl` + xtk:workflow 패치 블록
- Repository `listAiSqlByWorkflow`/`getAiSqlById` · Validate action listSql|getSql
- Studio 우측 패널 · Register 후 목록 갱신 · 커스텀 액티비티 계약 `ai_sql-id`로 정정
- 가이드 v1.7.1 적용 표 · pipeline-contracts · adobe-references

Changed files: new_ver/schema/testWooAiWorkflowUi.xml, new_ver/js/testWooWorkflowUi.js, new_ver/js/testWooRepository.js, new_ver/workflow/testWooXtkWorkflowButtonPatch.xml, new_ver/workflow/backup/README.md, new_ver/workflow/testWooSampleCustomActivityContract.xml, new_ver/jssp/testWooAiValidate.jssp, new_ver/jssp/testWooAiStudio.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, docs/report/01_개발가이드.md, docs/report/00_ReportIndex.md, .cursor/skills/campaign-ai-studio/pipeline-contracts.md, adobe-references.md, AGENTS.md, docs/log/log.md

99. 2026-08-06 개발가이드 v1.7.0 — 섹션7 WF캔버스↔Studio↔커스텀 액티비티 (다음 적용)
Purpose: WF 내 LLM Studio 진입·WF별 SQL 목록·커스텀 액티비티 `ai_sql-id` E2E를 01 가이드에 섹션7로 정리. 진행 위치(섹션4~6 vs 7)와 진입점 A/B/C 우선순위를 문서화 Changes:

- 파이프라인: Register→`ai_sql_id`→액티비티 조회 (WF XML SQL 주입 금지 재확인)
- 섹션7: Properties 옆 버튼(A) · 하단 AI 탭(B) · 캠페인 WebApp(C) · factory 폼 상속 불가(Adobe)
- Studio 우측 WF별 SQL 목록 · 7a~7e 체크리스트 · 적용 진행표 갱신
- ReportIndex `01_개발가이드` 설명 갱신

Changed files: docs/report/01_개발가이드.md, docs/report/00_ReportIndex.md, docs/log/log.md

98. 2026-08-06 Fragment 생애주기 설계 — 승인→라벨 · enum+certified · merged_into_id (런타임 변경 없음)
Purpose: 사전 승인 병목을 라벨+사후 큐레이션으로 전환하는 설계를 확정. 채팅 원문이 박힌 `10_승인시스템전면교체.md`를 전면 재작성·개명. Foundry/Stage A 코드는 건드리지 않음 Changes:

- 검수 트리거: novelty → **frequency**. near는 청소(병합 제안), 사람이 볼 대상 아님
- 상태: 병렬 `lifecycleState` 금지. 기존 enum 유지 + **`certified` 1값만 추가**
- `verified` 의미 축소(민감 blocking만). 일반 슬롯은 향후 `active` 직행
- `supersedes_id` 오버로드 금지(버전 계보 전용) → 병합은 **`merged_into_id`**
- 킬스위치: 신규 상태 없이 **`revoked`** 재사용 (`deprecated`는 버전 교체 의미 유지)
- 스키마 정의만: `certified_by` / `certified_at` / `merged_into_id` (읽기·쓰기 로직 없음)
- 승인 UI(#96 계열·폼/목록/HTML)는 폐기하지 않고 **민감 예외·킬스위치 전용**으로 격하(문서에 명시)
- 로그 번호: Index 최상단이 #97 이라 본 항목은 **#98** (요청문의 “#95→#96”은 시점 어긋남)

Changed files: docs/report/10_Fragment_생애주기_설계.md (신규·구 10_승인시스템전면교체.md 대체), docs/report/00_ReportIndex.md, new_ver/schema/testWooAiFragment.xml, docs/log/log.md

97. 2026-08-06 Studio 검증 결과 UI — PASS/FAIL·게이트 코드를 한글 라벨로 표시
Purpose: 마케터가 PASS/PLAN/G1/OUT 같은 내부 코드를 이해하지 못함. 표시만 사용자 명칭으로 바꿈(서버 게이트 코드는 유지) Changes:

- PASS/FAIL → 통과/실패
- PLAN/G1/OUT/SCOPE 등 → 조건 조합 · SQL 문법 · 결과 형식 …
- 카드 제목: 검증 게이트 → 자동 검증 결과
- 통과 시 상세 없으면 “이 검사를 만족했습니다.”

Changed files: new_ver/html/testWooAiStudio.js, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/jssp/testWooAiStudio.jssp, docs/log/log.md

96. 2026-08-06 결번(기록 누락) — 승인 UI 추정 작업, git으로 단일 커밋 특정 불가
Purpose: Log Index 가 95 다음 97 로 건너뛴 채번 공백을 정정. 번호를 다른 작업에 재사용하지 않음 Changes:

- Index/Body 에 #96 을 **결번(기록 누락)** 으로 명시 기재
- #98 Body 가 “승인 UI(#96 계열·폼/목록/HTML)”을 언급하나, `git log` / `-S "96."` / FragmentReview 관련 커밋으로는 95→97 사이 단일 작업을 특정할 수 없음
- `testWooAiFragmentReview.jssp` 등은 초기·감사 커밋에 이미 존재. 실제 승인 UI 구현 로그가 누락된 것으로 판단
- 이후 작업은 #111 부터 정상 채번

Changed files: docs/log/log.md

95. 2026-08-06 스모크 9c list_schemas namespace 누락 수정 (args={} → allowed ns)
Purpose: ACC 스모크 14/15 — 9 PASS(attempts=1) · 9c 만 `namespace not allowed:  (allowed: woo)` 로 FAIL. Foundry 회귀가 아니라 스모크 계측 버그 Changes:

- 원인: 9c 가 예산 소진용으로 `list_schemas({})` 호출. 툴은 `required:["namespace"]` 이라 빈 ns 거부(카운트도 안 올라감). 5c 는 `{namespace:"woo"}` 로 이미 PASS
- 조치: `toolkit.env().allowedNamespaces[0]` 을 burnArgs 로 전달 (5c 와 동일)
- 재배포: `testWooSmoke.js` 만. 기대: 9c PASS · summary 15/15

Changed files: new_ver/tools/testWooSmoke.js, docs/log/log.md

94. 2026-08-06 리포트09 부분 핫픽스 — E-1 예산132 · C-1 sanitize순서 · E-2 tokenBudget · A-1 자가검증 · 스모크9c
Purpose: F-0~F-5 는 #92(단일 슬롯·단일 attempt)로 실증 완료. 리포트09 중 연쇄 기여가 큰 항목만 적용(9b/forceRetry 보류) Changes:

**전제**
- #92: dryRun `attempts=1` · gate.pass · `woo__customer__region__seoul` — happy path 실증됨
- 이번 범위 제외: 9b / `forceRetry` (사유: attempts≥2 실측 전 과금 대비 이득 낮음). dryRunSlot 에 미사용 옵션 자리도 만들지 않음

**C-1 — orphan tool_calls 로 인한 400 잠복 리스크 및 `_sanitizeToolHistory` no-op**
- 원인: attempt>0 에서 sanitize→compress 순서라 끝 push 더미가 압축에 버려지고 sanitize 가 사실상 no-op. 끝 push 자체는 프로토콜 위반(잠복 400)
- 조치: compress→sanitize 로 순서 교체. 더미 tool 은 assistant 직후(기존 tool 열 끝) splice. `runToolLoop` 반환 직전 sanitize 1회
- 검증: 기존 스모크 9 PASS 유지(400 시 tool 메시지 순서 문제). attempts≥2 실측은 이후 로그로 판단

**E-1 — 다중 슬롯 totalCallBudget 기아**
- 원인: total=40 ≈ 슬롯1분(12+24). 슬롯2부터 total/probe 기아 → “랜덤” Foundry 실패로 보임
- 조치: totalCallBudget **132** (= maxNewFragments(3)*(12+24)+margin 24). probeSql 18 / probeValues 14 / searchColumns 18. toolkit 하드코딩 fallback 동일 정렬. 산식 주석 고정
- 검증: 스모크 **9c.foundry.budget** (비과금) — generate 가 phase 상한에서 멈추고 total 여유·phase 이름 포함 확인

**E-2 — tokenBudget 미검사 (축소)**
- 원인: tokenBudget/dailyBudget 선언만 있고 검사 없음(주석 “부분 미적용”도 부정확)
- 조치: `processQueueItem` 슬롯 생성 후 누적 tokensUsed > tokenBudget 이면 `needs_human_design` / `"요청 토큰 예산 초과"`. dryRunSlot 제외. dailyBudget 은 **미구현** 주석만
- 검증: (배포 후) tokenBudget 임시 1000 → needs_human_design 재현 후 원복

**A-1 — probe_sql 자가검증 미고지**
- 원인: 프롬프트에 total/distinctKey/nullKey 자가검증 절차 없음
- 조치: `_foundrySystemPrompt` · `_gateFeedback` 에 1줄 추가
- 검증: 생성 저널에서 probe_sql 후 최종 JSON 패턴 확인

**F-6(9c)**
- 원인: 스모크가 attempts=1·슬롯1만 봐 예산 회귀를 못 잡음
- 조치: `9c.foundry.budget` 추가, `TW_SMOKE_SKIP_LLM` 무관 항상 실행. 9b/forceRetry 보류

Changed files: new_ver/js/testWooEnv.js, new_ver/js/testWooToolkit.js, new_ver/js/testWooFoundry.js, new_ver/tools/testWooSmoke.js, docs/log/log.md

93. 2026-08-06 Pass0 Gemini 간헐 반복 루프 완화 — pass0MaxTokens 2048 · frequencyPenalty 0.3 · length 시 1회 재시도
Purpose: Studio 에서 Pass0 가 다시 `completion=8192 reasoning=0 contentChars=16166 [반복 루프 의심]` 으로 실패했다. #84(json_object 제거) 회귀가 아니라 Gemini 간헐 루프다 — 같은 날 스모크 Pass0 는 completion≈117 로 통과했다 Changes:

**왜 “또”인가**
- 진단 문구에 `stage=pass0` / `[반복 루프 의심]` 이 있으므로 **#84 코드는 배포된 상태**다
- `response_format(json_object)` 는 로컬·호출부 모두 없음. 제거 후에도 Gemini 2.5 Flash 가
  temperature=0 에서 같은 토큰을 반복하는 경우가 있다(포럼·실측)
- 3:41 스모크 Pass0 PASS → 3:4x Studio 실패 = **간헐**. 회귀 아님

**조치**
- `pass0MaxTokens` 8192 → **2048** (슬롯 JSON 에 충분, 루프 시 과금·대기 축소)
- `frequencyPenalty` 0.1 → **0.3**
- `decomposeSlots`: length/반복 예외 시 penalty=0.6 + “short JSON only” 지시로 **1회 재시도**
- 진단 문구를 “json_object 재도입 확인” → “Gemini 간헐·재시도/penalty 확인” 으로 정정

**검증**
- `node tools/checkRhinoSyntax.js` OK
- 재배포: `testWooEnv.js` → `testWooLlm.js` → Studio 동일 NL 재시도
  기대: 통과, 또는 저널에 `pass0 length/repeat — retry once` 후 통과

Changed files: new_ver/js/testWooEnv.js, new_ver/js/testWooLlm.js, docs/log/log.md

92. 2026-08-06 F-0~F-5·#91 검증 완료 — 스모크 14/14 · dryRun feasible→woo__customer__region__seoul gate.pass
Purpose: ACC 에서 스모크·FoundryDryRun 으로 #90/#91 핫픽스를 실측 확인했다 Changes:

**스모크 14/14 PASS**
- 9.foundry.generate: `name=woo__customer__region__seoul attempts=1 tokens=4043`
- triage `feasible/high canProceed=true` (forceGenerate 불필요 — 오탐 경로 해소)

**생성 경로 (정상 궤적)**
- Triage: search(서울→region/city) → describe SampleCustomer → probe_values sRegion
- Generate: search(region/city/address) → probe_values → probe_sql → turn4 hasJson=true
- SQL: `SELECT DISTINCT sCustomer_id FROM testWooSampleCustomer WHERE sRegion = '서울'`
- F-0 스키마 키·F-1 hasJson·게이트 1회 통과 확인. 마크다운 펜스(```json)는 파서가 `{…}` 추출로 흡수

**다음**: Studio NL → 큐 → WKF_testWooFoundry 배치 → awaiting_approval + fragment 1건

Changed files: docs/log/log.md

91. 2026-08-06 Triage no_column 오탐 차단 — describe_schema 필수(재지시·강등) + 스모크 9 forceGenerate
Purpose: 스모크 9 기준선이 `triage blocked / no_column high` 로 끊겼다. 생성(F-0)은 실행조차 안 됐다. 원인은 모델이 서울/주소/도시(값·동의어)만 search_columns 하고 describe_schema 없이 컬럼 부재를 단정한 것 Changes:

**기준선 (F-5 첫 실행)**
- 13/14 PASS · FAIL 9.foundry.generate `reason=triage blocked attempts=0`
- toolkit: search_columns(서울|주소|도시, woo) ×3 만 호출 → describe/probe 0회
- `region`/`sRegion` 은 4c 에서 이미 존재 확인됨 → **no_column 은 오탐**
- SCR-160012 는 스모크 요약 `logError`(실패 시 WF 중단) — 생성 경로 예외 아님

**조치**
- Triage 프롬프트: 위치 슬롯은 region/지역 검색 → list/describe → probe_values. 값 키워드만으로 no_column 금지
- 루프: no_column 인데 describe_schema 없으면 재지시 후 턴 계속(마지막 턴 제외)
- 강등: describe 없이 no_column → ambiguous (갭로그 오염·생성 차단의 false high 제거)
- evidence 에 search_columns `matchCount` 기록
- 스모크 9: `forceGenerate:true` — triage 오탐이 있어도 생성 경로(F-0)는 검증. triage 차단은 WARNING

**검증**
- `node tools/checkRhinoSyntax.js` 전수 OK
- 재배포: Feasibility · Toolkit · Foundry · Smoke → 스모크 9 재실행
  기대: (a) triage 가 describe→probe 후 feasible 이거나 (b) forced generate 후 gate.pass

Changed files: new_ver/js/testWooFeasibility.js, new_ver/js/testWooToolkit.js, new_ver/js/testWooFoundry.js, new_ver/tools/testWooSmoke.js, docs/log/log.md

90. 2026-08-06 Foundry 생성 단계 근원 수정 F-0~F-5 — 출력 계약·requireJson·형태 재시도·단계 예산·dryRunSlot
Purpose: `fragment JSON missing` 의 근원은 출력 계약 부재이며 루프 종료 조건 불일치가 이를 증폭시켰다(리포트 08 자가진단 A·B). 생성 경로에 JSON 스키마·게이트 규칙·계측기를 넣고, 평문 턴·형태 실패가 재시도로 이어지게 한다 Changes:

**근원 진단 (알고리즘 A·B)**
- `_fragDocFromLlm` 이 읽는 9종 필드 중 프롬프트에 명시된 것은 name 패턴·scopeKey 힌트뿐.
  `sqlText` 키 이름조차 없었다 → **계약 부재(A2)**
- 프롬프트 "JSON only on the final turn" vs 코드 "툴 없는 첫 턴에 return" →
  평문 한 줄이면 강제 턴(6) 전에 루프 종료 → **종료 조건 불일치(B3)** = #89 증상

**F-5 (최우선) dryRunSlot 계측기**
- `foundry.dryRunSlot(slotText, opts)` — 큐 Read/Write·publish·embedding·dedup 없음
- triage(옵션) → generateFragmentForSlot → `{ok, triage, fragDoc, gate, attempts, …}`
- `new_ver/workflow/testWooFoundryDryRun.js` 1회성 액티비티 예제
- 스모크 **9.foundry.generate (billable)** — `TW_SMOKE_SLOT_TEXT` 로 dryRun, gate.pass 필수
- 기준선: 배포 직후 dryRun 첫 실패 내용은 운영 저널에 그대로 남긴다(F-0 전·후 비교용).
  로컬에서는 billable 호출 불가 → 구문 검사만 완료. **ACC 첫 dryRun 로그를 #90 후속으로 붙일 것**

**F-0 출력 계약**
- `_foundrySystemPrompt` 에 FRAGMENT_SCHEMA_EXAMPLE + SELECT-grain·WITH 금지·G1·G-B·G-C·
  name 정규식·scopeKey="" · params 배열 규칙 전문
- FINAL_TURN_NUDGE / JSON_NUDGE / shape·gate 되먹임에 동일 스키마 재고지
- `_fragDocFromLlm`: 필수 필드(name/keyColumn/sqlText) 즉시 판정, params 배열·객체 양쪽 수용

**F-1 루프 종료**
- `runToolLoop(..., {requireJson:true})` — JSON 없으면 nudge 후 continue, 마지막 턴만 예외
- `tool_calls` 판정은 배열 우선(finish_reason 의존 제거). 턴 로그에 `hasJson=`
- Triage 루프에도 동일 tool_calls 판정 적용

**F-2 형태 실패 재시도**
- `_parseFragmentJson` / `_fragDocFromLlm` 을 attempt 루프 안 try/catch
- `_shapeFeedback` → role:user 되먹임. 소진 시에만 `{fragDoc:null, shapeError}` 반환
- `processQueueItem` last_error 에 shapeError 포함

**F-3 히스토리 안전화**
- `_sanitizeToolHistory` — 미응답 tool_calls 에 `{"error":"not executed"}` 더미
- attempt≥2: `_compressForRetry` (system + 최초 user + assistant 본문 + 되먹임)
- assistant 객체 재구성 금지(reasoning_details 보존). 압축 시에만 tool_calls 제거 슬림본

**F-4 단계 예산**
- env: `totalCallBudget:40`, `triageCallBudget:12`, `generateCallBudget:24`
- `toolkit.setPhaseBudget(kind)` + invoke 시 phase 초과 메시지에 단계명 명시
- triage / generateFragmentForSlot 진입 시 각각 setPhaseBudget

**검증**
- `node tools/checkRhinoSyntax.js` 전수 OK (dryRun WF 포함)
- ACC: (1) Foundry.js·Toolkit·Env·Feasibility·Smoke 재배포
  (2) `testWooFoundryDryRun` 또는 스모크 9번 → 기준선 기록
  (3) Studio NL → 큐 → 배치 왕복

Changed files: new_ver/js/testWooFoundry.js, new_ver/js/testWooToolkit.js, new_ver/js/testWooEnv.js, new_ver/js/testWooFeasibility.js, new_ver/workflow/testWooFoundryDryRun.js, new_ver/tools/testWooSmoke.js, docs/report/01_개발가이드.md, docs/report/00_ReportIndex.md, docs/log/log.md

89. 2026-08-06 fragment 생성 단계 진단 보강 (turn별 finish_reason·응답 본문 프리뷰) + 강제 턴 지시를 요청 사본에만 주입
Purpose: namespace 를 woo 로 좁힌 뒤 Triage 는 통과했으나(queueId=27283) 생성 단계가 `fragment JSON missing` 으로 실패했다. 어느 턴에서 왜 JSON 이 안 나왔는지 로그가 전혀 없어 원인 판정이 불가하다 Changes:

**진행 상황 (woo 단독 효과 확인)**
- Triage 가 `search_columns namespaces="woo"` 로 정상 조사 → `describe_schema
  woo:testWooSampleCustomer` 까지 도달. #87 이전의 nms 배회가 사라졌다
- `invoke failed … reason=namespace not allowed: nms (allowed: woo)` /
  `no allowed namespaces (requested: cus / allowed: woo)` — #86 에서 넣은 사유 로깅과
  허용목록 동봉이 실제로 동작. 모델이 다음 턴에 woo 로 자체 교정했다
- 실패는 큐 행에 정상 기록(`failed queueId=27283` + err_id) + 배치는 계속 진행 → #86 검증 완료

**진단 보강 (원인 판정 불가 상태 해소)**
- `runToolLoop` 이 턴마다 `finish_reason` / `toolCalls` / `contentLen` 을 logInfo.
  강제 턴에는 `(forced answer)` 표시 — 평문 응답·빈 본문·툴 차단을 구분한다
- `_parseFragmentJson` 실패 시 응답 본문 앞뒤 200자를 logWarning + 오류 메시지에
  `contentLen`/`turn`/`finish_reason` 을 실었다. 프롬프트 본문은 남기지 않는다
- `runToolLoop` 반환값에 `finishReason`/`turn`/`lastTurn` 추가 (호출부 진단용)

**강제 턴 지시 주입 방식 교정**
- #86 에서 Foundry 는 messages 재사용 때문에 지시문을 넣지 못했는데, 요청 사본
  (`msgs.concat([...])`)에만 넣으면 히스토리 오염 없이 강제할 수 있다 → 지시문 추가
- Triage 는 재시도 루프가 없어 기존 push 방식을 유지

**검증**
- `node tools/checkRhinoSyntax.js` 19/19 OK
- 원인 자체는 미확정 — 재배포 후 다음 실행의 `turn=…finish_reason=…` 과 본문 프리뷰로 확정

Changed files: new_ver/js/testWooFoundry.js, docs/log/log.md

88. 2026-08-06 종료된 큐를 수기 재큐잉했을 때의 무동작 done 에 사유 기록 (fragment 0건 오인 방지)
Purpose: 큐 27581 이 `Done` 인데 fragment 가 0건이라는 보고. 해당 배치 실행에는 toolkit 호출이 한 건도 없었다 — `missing_slots_json` 이 비어 있어 아무 일도 하지 않고 `done` 이 된 경로였다. 상태만 보면 성공과 구분되지 않아 사유를 남긴다 Changes:

**구조적 원인**
- 종료 상태 전이(`_finalizeInfeasible` / `awaiting_approval`)는 `missing_slots_json` 을 `"[]"` 로
  비운다. 설계상 자동 재큐잉이 없으므로(사용자가 같은 NL 을 다시 요청해야 한다) 정상 동작이다
- 그러나 완료된 행을 **수기로 `queued` 로 되돌리면** `missing.length === 0` 분기로 들어가
  `status: "done"` 만 찍고 종료한다. 저널에도 `processed=1 failed=0` 한 줄만 남아
  "정상 처리됐는데 fragment 가 없다" 로 보인다
- 직전 안내(#87 응답)에서 "status/attempt_count 를 되돌리면 재사용 가능" 이라고만 적어
  이 경로를 유발했다. `missing_slots_json` 복원이 빠져 있었다

**조치**
- `processQueueItem` 의 무매칭 분기에 `last_error` 안내문 기록 +
  `logInfo`("처리 없이 done · 재생성은 신규 요청 필요"). 상태 필드만 보고도 구분된다
- 판정 자체는 변경하지 않았다(`ok:true` / `done` 유지) — 실패가 아니라 처리 대상 부재이므로

**검증**
- `node tools/checkRhinoSyntax.js` 19/19 OK

Changed files: new_ver/js/testWooFoundry.js, docs/log/log.md

87. 2026-08-06 허용 namespace 를 woo 단독으로 확정 (ACC 수기 수정이 재배포마다 덮이던 원인 제거) + 스모크 4·4b·5 대상 전환 + grainKeyCandidates 정합
Purpose: 사용자가 ACC 에서 `foundry.namespaces` 를 `woo` 로 계속 고쳤는데 재배포마다 `nms,cus,woo` 로 되돌아갔다. 원인은 로컬 `testWooEnv.js` 가 초기 커밋부터 `nms,cus,woo` 였다는 것 — 소스를 사용자 의도대로 바꾸고 여기에 묶인 스모크·프롬프트 값을 함께 맞춘다 Changes:

**원인**
- ACC 배포는 로컬 파일 붙여넣기라 **로컬이 유일한 원본**이다. #86 안내가 "Env 재배포" 였으므로
  수기 수정본이 그때마다 덮였다. `git log -S"namespaces:"` 결과 이 값은 초기 커밋 이후 무변경
- #85 시점 배포본이 `woo` 단독이었다는 점은 #86 에서 미확정으로 남긴 `list_schemas nms/cus
  ok=false` 를 설명한다 — queryDef 예외가 아니라 **"namespace not allowed"** 였다.
  이번 스모크 5c 가 `nms=50건 · cus=0건 · woo=7건` 으로 반대편(전부 허용)을 확인해 확정됨

**결정 — namespaces: "nms,cus,woo" → "woo"**
- 테스트 범위는 `woo:testWooSampleCustomer` 하나다. nms 개방의 실측 손해:
  Triage 가 `search_columns namespaces="nms,cus"`(woo 제외!) 로 4회, 이어서
  `describe_schema nms:common`(기술 스키마) 로 흘렀다. `sRegion` 에 `서울` 이 있는
  올바른 테이블을 스스로 배제한 것이다. `cus` 는 이 인스턴스에 스키마 0건
- env 주석에 근거와 "운영에서 nms:recipient 가 필요해지면 스모크 4·4b 와 함께 되돌린다" 명시

**연동 조정 (namespaces 축소로 깨지는 지점)**
- 스모크 4·4b 가 `nms:recipient` 를 쓰고 있어 그대로면 "namespace not allowed" FAIL.
  `TW_SMOKE_DESCRIBE_ID = "woo:testWooAiFragment"` 상수로 전환 — 코어 스키마는 시드 여부와
  무관하게 항상 배포되므로 샘플 테이블(4c 처럼 SKIP 대상)보다 적합하다.
  `sqlname` 미선언이어도 ACC 가 타입 접두사로 생성하므로(`name`→`sName`) 4b 전제는 유지된다
- 스모크 5 키워드 `email` → `TW_SMOKE_SEARCH_KEYWORD = "category"` (같은 이유로 시드 비의존)
- 스모크 5 에 `skippedNamespaces` 비어있음 검사 추가 (#86 에서 노출시킨 값의 실사용)
- `toolkit.env().grainKeyCandidates` 에서 `iRecipientId` 제거 → `["sCustomer_id"]`.
  #86 이후 이 값이 Triage 프롬프트에 실려 나가므로, 닿을 수 없는 키를 남기면 그 키로 SQL 을
  만들다 게이트에서 실패하며 턴을 소진한다(다음 회귀 예방)

**#86 수정 실증 (사용자 실행 로그)**
- 스모크 13/13 PASS (5c 신설분 포함) · `dbms=postgresql (dialect verified)`
- Foundry 배치: `processed=1 failed=0` — `tool loop exceeded` 와 `SCR-160012` 재현 없음.
  마지막 턴 강제 응답이 동작해 예외 대신 판정으로 종료됐다

**검증**
- `node tools/checkRhinoSyntax.js` 19/19 OK
- 잔여 `nms:recipient` 참조 0건(주석 설명만) · 가이드 v1.6.3

Changed files: new_ver/js/testWooEnv.js, new_ver/js/testWooToolkit.js, new_ver/tools/testWooSmoke.js, docs/report/01_개발가이드.md, docs/log/log.md

86. 2026-08-06 Foundry 배치 첫 실행 실패 정리 — logError 선행으로 큐 상태 유실(SCR-160012) + Triage 턴 소진 강제 응답 + 허용 namespace 프롬프트 주입
Purpose: `WKF_testWooFoundry` 첫 실행이 `SCR-160012` 로 정지했다. 저널의 `triage tool loop exceeded` 는 증상이고, 실패가 큐에 기록되지 않아 원인 추적이 막힌 구조가 본질이다. 실패 기록·툴 루프 종료·프롬프트 근거를 함께 교정한다 Changes:

**결함 1 (P0) — logError 가 상태 저장보다 앞서 실행돼 실패 근거가 유실**
- ACC WF 의 `logError` 는 로그만 남기지 않는다. **스크립트 실행을 즉시 중단하고 인스턴스를
  오류 정지**시킨다 → `catch` 블록의 `logError` 뒤에 있던 `_updateQueue` 가 실행되지 않았다
  https://experienceleague.adobe.com/en/docs/campaign/automation/workflows/advanced-management/javascript-scripts-and-templates
- 결과: 큐 27581 이 `processing` + `last_error`/`err_id`/`evidence_log` 공백으로 갇혔고,
  `_hasProcessing()` 가드 때문에 **`staleProcessingMinutes`(30분) 동안 배치 전체가 스킵**됐다.
  `SCR-160012` 도 예외가 아니라 이 `logError` 자체가 원인이다
- `testWooFoundry.js`: `processQueueItem` 의 catch·프리플라이트 분기에서 **저장 → 로그** 순서로
  교정하고 건별 실패 로그를 `logWarning` 으로 낮췄다(배치가 다음 queued 건을 계속 처리)
- `_updateQueue` 자체 실패도 try/catch 로 감싸 배치를 죽이지 않게 했다
- `processBatch` 는 실패 건수를 세어 요약 `logWarning` 을 남기고 `failed` 를 반환.
  배치 WF 스크립트 로그도 `processed=n failed=n` 으로 확장
- 배치 전체 중단이 맞는 프리플라이트(`sql` right 미보유)만 `logError` 유지 — 주석에
  "수동 재시작 필요" 를 명시(기존 "재시도 가능" 은 사실과 달랐다)

**결함 2 (P0) — Triage 툴 루프가 최종 응답을 강제하지 않음**
- `runTriageLoop` 의 턴 상한이 `for (t=0; t<4; t++)` 하드코딩이었고, 마지막 턴에도
  `tool_choice:"auto"` 라 모델이 4턴 전부를 툴 호출로 쓰면 판정 없이 예외로 끝났다
  (실제 로그: `search_columns` 4회 → `list_schemas` 3회 → `describe_schema` 1회 → 예외)
- 마지막 턴에 `tool_choice:"none"` + 최종 지시 메시지로 **판정 JSON 을 강제**한다.
  근거가 부족하면 `ambiguous` 로 답하게 해 강등 규칙이 정상 동작하도록 유도
- 턴 상한을 `triage.maxTurns`(env 신설, 권장 6 · 가드 2~12)로 분리
- `finish_reason="length"` 를 별도 진단으로 분기(기존에는 "triage JSON missing" 으로 위장),
  JSON 부재 오류에 turn/finish_reason/contentLen 을 실었다
- `testWooFoundry.runToolLoop` 도 동일 결함이라 마지막 턴 강제 + `length` 진단을 대칭 적용.
  되먹임 재시도가 messages 를 재사용하므로 Foundry 쪽은 지시 문장을 넣지 않았다

**결함 3 (P1) — 툴 실패 사유가 어디에도 남지 않음**
- `list_schemas namespace=nms/cus` 가 `ok=false` 인데 저널에 사유가 없어 원인 판정이 불가했다
  (`invoke` 가 `ok=` 만 찍었고, 사유가 담긴 `evidence_log` 는 결함 1 때문에 저장 실패)
- `invoke` 실패 시 사유를 `logWarning` 으로 남긴다
- `list_schemas` 미허용 오류에 **허용 목록을 동봉**해 모델이 다음 턴에 자체 교정하게 했다
- `search_columns` 가 조회 실패·미허용 namespace 를 조용히 건너뛰던 경로를 노출:
  `skippedNamespaces` + `allowedNamespaces` 반환 + `partialScan:true` 강제 + `logWarning`.
  조용한 스킵은 "조사했으나 0건" 으로 위장돼 근거 없는 `no_column` 을 만든다

**결함 4 (P1) — 허용 namespace·값 검색 방법을 모델에 알려주지 않음**
- `toolkit.env()` 가 구현돼 있으나 **어디서도 호출되지 않았다**. 툴 설명의 `e.g. nms, cus, woo`
  는 예시일 뿐이어서 모델이 ns 를 찍어보며 턴을 낭비했다
- Triage 시스템 프롬프트에 `dbms` / `allowedNamespaces` / `grainKeyCandidates` 를 주입
- `search_columns` 는 컬럼 이름·라벨만 매칭한다는 점과, `서울` 같은 값은 컬럼을 먼저 찾고
  `probe_values` 로 확인해야 한다는 점을 명시(실제로 값 4종을 컬럼명으로 검색해 턴을 소진했다)

**스모크·문서**
- `testWooSmoke.js` **5c 신설** — `toolkit.env().allowedNamespaces` 전수 `list_schemas` 조회.
  WF 저널에서 `ok=false` 로만 보였던 실패를 배포 시점에 사유까지 드러낸다(비과금)
- 6a 정리 실패를 `logError` → `twFail` 로 교체(요약 출력이 잘리는 것을 방지)
- 가이드 v1.6.2 섹션6 에 **8) WF 로깅·툴 루프 규약** 신설 + 스모크 표 5c + 완료 체크 2항
- 스킬 `acc-rhino-constraints.md` 에 WF `logError` 중단 규약 추가, JSSP 인증 예시를
  `logonWithToken` 가드로 갱신(#85 코드와 문서 불일치 해소)

**검증**
- `node tools/checkRhinoSyntax.js` 19/19 OK · `node tools/checkDialectSql.js` 6/6 OK
- 배포 전 조치: 큐 27581 은 `processing` 에 갇혀 있다 → 재배포 후 `queued` 로 되돌리거나
  30분 스테일 복구를 기다려야 배치가 다시 돈다. WF 인스턴스도 오류 정지 상태이므로 재시작 필요

Changed files: new_ver/js/testWooFoundry.js, new_ver/js/testWooFeasibility.js, new_ver/js/testWooToolkit.js, new_ver/js/testWooEnv.js, new_ver/js/testWooConfig.js, new_ver/workflow/testWooFoundryBatch.js, new_ver/tools/testWooSmoke.js, docs/report/01_개발가이드.md, .cursor/skills/campaign-ai-studio/acc-rhino-constraints.md, docs/log/log.md

85. 2026-08-06 logon(sessionToken) 폐기 대응 (logonWithToken · JST-310036) + 큐 폴링 20초 정합 + Foundry 상시 ON
Purpose: 로그 #84 배포 후 실환경 확인에서 Studio 큐 폴링이 5초마다 `JST-310036 The 'logon' JavaScript method is deprecated` 를 저널에 남겼다. 폐기 API 를 교체하고, 폴링 주기가 Foundry 배치 주기(5분)와 어긋나 노이즈를 만드는 구조를 함께 정리한다 Changes:

**실환경 확인 결과 (#84 검증 완료분)**
- 스모크 12/12 PASS · `dbms=postgresql (dialect verified)`
- `7.llm.pass0 (billable)` PASS `slots=1` / `8.llm.embedding (billable)` PASS `dim=1536`
- Studio `서울에 사는 고객` → Pass0 usage `completion_tokens=104`, `reasoning_tokens=0`
  (수정 전 8192 소진) → **R-1 반복 루프 제거 확정**
- 8번 PASS 는 L-2 의 `cfg.foundry.embedEnabled` → `cfg.llm.embedEnabled` 교정이 실제로
  임베딩을 켰다는 증거다(그 전에는 항상 즉시 null). 이후 dedup L2 가 실동한다
- `foundry.enabled=true` 로 미매칭 요청이 큐에 적재됨(queueId=27581, `queued`) — 설계대로 동작

**결함 1 — logon(sessionToken) 폐기 (JST-310036)**
- 근거: `logon()` 은 `logonEscalation` 이 돌려준 **컨텍스트 복원용으로만** 유효하고, 세션 토큰
  바인딩의 현행 API 는 `logonWithToken(token)` 이다. 다른 대체는 `logonWithUser(login, password)`
  / `logonWithContext(context)`
  https://experienceleague.adobe.com/developer/campaign-api/api/f-logon.html
- `testWooCommon.js`: `twLogonWithToken(tok)` 신설 — `typeof logonWithToken === "function"` 확인 후
  호출, 부재 빌드에서는 `logon(tok)` 폴백(Rhino 는 미정의 식별자의 typeof 에 예외를 던지지 않는다).
  `twBindOperator` 가 이를 사용하고 실패 메시지를 "session token bind failed" 로 일반화
- `testWooAiStudio.jssp`: Common 을 로드하지 않는 UI 셸이라 동일 가드를 인라인
- `testWooAiAuthDebug.jssp`: 동일 가드 + 응답에 `bindMethod`(`logonWithToken` / `logon(deprecated)`)
  추가 — 어느 경로로 바인딩됐는지 진단에 남긴다
- 오류가 아니라 경고였으므로 기능 영향은 없었다. 다만 폴링 1회마다 1건씩 쌓여 진짜 오류를 묻는다

**결함 2 — 큐 폴링 주기가 배치 주기와 불일치**
- `pollQueue` 가 5초 간격 × 120회였다. Foundry 배치는 5분 주기라 10분 창에서 상태가 바뀔 기회는
  2회뿐인데 조회는 120회 발생 → 저널 인증 로그 120건
- UI 문구도 "약 5분 간격으로 상태가 갱신됩니다" 로 코드(5초)와 반대였다
- `QUEUE_POLL_MS = 20000` · `QUEUE_POLL_MAX = 30` 상수로 분리(하드코딩 제거, 총 대기 10분 유지)
- 문구 정정: "약 20초 간격으로 상태를 확인하며, fragment 생성 배치는 약 5분 주기로 동작합니다"
- `new_ver/html/testWooAiStudio.js` 와 `new_ver/jssp/testWooAiStudioJs.jssp` **양쪽 동시 수정**
  (동기 규칙). 수정 후 두 파일에서 상수 4개 존재·잔여 `, 5000)` 0건을 스크립트로 대조

**Foundry 상시 ON 확정**
- `testWooEnv.js` `foundry.enabled: false` → **`true`**. ACC 배포본만 켜져 있어 다음 재배포 때
  되돌아갈 상태였다
- `.cursor/skills/campaign-ai-studio/SKILL.md` 의 "Foundry default off" 행을 현행(ON)으로 교체.
  끄면 unmatched 오류 UI 로 복귀한다는 점과 LLM 과금 유무를 함께 명시
- env 주석도 true/false 동작 대비로 재작성

**검증**
- `checkRhinoSyntax` 19/19 통과
- Studio JS 2종 동기 대조 스크립트 통과(상수 4항목 · 레거시 5000 잔여 0)
- **미실행(환경 필요)**: 재배포 후 저널에 JST-310036 미발생 확인, `AuthDebug` 의 `bindMethod`
  값 확인, 폴링 20초 반영 확인

Changed files: new_ver/js/testWooCommon.js, new_ver/js/testWooEnv.js, new_ver/jssp/{testWooAiStudio,testWooAiStudioJs,testWooAiAuthDebug}.jssp, new_ver/html/testWooAiStudio.js, .cursor/skills/campaign-ai-studio/SKILL.md, docs/log/log.md

84. 2026-08-06 json_object 반복 루프 근원 제거 (R-1~R-4 · L-1~L-3) — length 진단 강화 + 스모크 LLM 스텝 + 단계별 토큰 상한
Purpose: `docs/report/07_SQL생성추가_디버깅1.md` 반영. #83 이 잡지 못한 `finish_reason="length"` 의 실제 원인(structured output 반복 루프)을 제거하고, 이 계열 결함이 매번 마케터 입력 시점에 처음 발현되던 구조를 스모크로 차단한다 Changes:

**#83 진단이 왜 부분 정답이었나**
- #83 은 "사고 토큰이 max_tokens 를 먹는다"로 보고 `reasoningOff()` = `{enabled:false, max_tokens:0}` 를 적용했다. 이 조치 자체는 성공했다 — 이후 usage 가 `reasoning=0` 으로 바뀌었다
- 그런데 `completion=8192`(상한)는 그대로였다. NL 이 8자인데 본문이 상한을 채우는 것은 정상 생성이 아니라 **같은 토큰을 반복하다 상한에 부딪힌 것**이다
- 재현 조건은 JSON 강제 출력(`response_format:{type:"json_object"}`). Gemini 2.5 Flash 계열의 알려진 결함이다
  https://discuss.ai.google.dev/t/gemini-2-5-flash-repeats-tokens-until-max-tokens-reached-in-structured-output/107176
- #80 에서 Triage 의 `response_format` 만 제거했고 `_chat`(Pass0/Pass1 공용)·`explainDedupDiff` 에는 그대로 남아 있었다. 같은 지뢰를 한 곳만 치운 상태였다

**원칙 명문화: 본 시스템은 `response_format:{type:"json_object"}` 를 사용하지 않는다**
- JSON 강제는 시스템 프롬프트 `OUTPUT JSON ONLY` + `_parseJson` 의 `indexOf("{")`~`lastIndexOf("}")` 추출이 담당한다(파싱부 무변경)
- `testWooLlm.js` 상단 `[설계 원칙]` 섹션과 어댑터 주석, 가이드 섹션6 규약표에 근거 URL 과 함께 고정

**R-1 (P0) `_chat` + 어댑터 기본값에서 json_object 제거 — testWooLlm.js**
- `_chat` 이 넘기던 `responseFormat: {type:"json_object"}` 삭제
- openrouter 어댑터의 `else if (!opts.tools) body.response_format = {type:"json_object"}` **기본 주입 삭제**. `tools` 와의 상호배제 pass-through 만 남겼고(`opts.responseFormat != null && !opts.tools`) 현재 호출부는 0곳
- 전수 grep 결과 코드상 잔여 사용처 0곳. 문서(02·03 리포트)의 기술은 이력이라 원문 유지

**R-3 (P1) `_lengthDiag` 진단 강화 — 이번 디버깅이 길어진 직접 원인 제거**
- 기존에는 예외만 던져 응답 본문이 사라져 "반복 루프"와 "진짜 절단"을 구분할 수 없었다
- `_lengthDiag(usage, content, stage)` 로 확장: `stage`/`completion`/`reasoning`/`contentChars` 를 메시지에, **응답 content 앞 200자·뒤 200자**를 `logWarning` 으로 남긴다
- `_looksRepetitive(text)` 신설 — 앞/뒤 200자 동일 또는 뒤 200자에서 12~40자 단위가 3회 이상 반복이면 `"[반복 루프 의심]"` 문구를 메시지에 포함
- 사용자 노출 메시지에 힌트 추가: "reasoning=0 인데 completion 이 상한이면 토큰 부족이 아니라 반복 루프일 수 있습니다"
- **프롬프트 본문은 로그에 남기지 않는다**(고객 실데이터 유입 가능) — 응답 content 만
- 로컬 검증: 파일에서 `_looksRepetitive` 본문을 추출해 실행 — 반복 문자열 `true`, 슬롯 12개 정상 JSON(1239자, 키가 구조적으로 반복됨) `false`, 400자 미만 `false`

**R-2 (P1) 반복 루프 억제 파라미터 — testWooEnv.js / testWooLlm.js**
- env `llm.repetitionGuardEnabled: true` · `llm.frequencyPenalty: 0.1` 추가(가드 0~1)
- `_frequencyPenalty()` 가 플래그 true + 0 초과일 때만 `frequency_penalty` 를 body 에 넣는다(0 이면 키 자체를 넣지 않음). 상한 1 로 클램프
- `temperature` 는 **0 유지**(결정성 우선). 반복 억제는 penalty 로만 처리
- 적용 범위는 openrouter 어댑터 body 1곳. Triage·Foundry 는 body 를 직접 구성하고 `tools` 사용(structured output 미사용)이라 리포트 지시대로 대상에서 제외
- **리포트와의 명명 차이**: 리포트는 `FREQUENCY_PENALTY`/`REPETITION_GUARD_ENABLED`/`PASS1_MAX_TOKENS` 로 지시했으나, `testWooEnv.js` llm 섹션은 기존 항목이 전부 camelCase(`pass0MaxTokens` 등)라 섹션 내 일관성을 택했다(UPPER_SNAKE 는 guard 섹션 관례)

**R-4 (P0) 스모크에 LLM 실호출 스텝 추가 — 재발 방지 근원 조치**
- 스모크 1~6 은 전부 DB/스키마 계열이라 LLM 결함이 스모크를 통과한 뒤 **항상 사용자 입력 시점에** 처음 발현됐다. #80(tools 충돌)·#83(사고 토큰)·금번(반복 루프) 유출 경로가 동일하다(#82 의 "스모크 미포함" 과 같은 구조)
- `7.llm.pass0 (billable)`: `decomposeSlots("서울에 사는 고객")` → 슬롯 1건 이상. 예외 메시지에 `max_tokens` 가 있으면 "반복 루프 회귀 의심" 으로 FAIL
- `8.llm.embedding (billable)`: `cfg.llm.embedEnabled` true 일 때만 `postEmbedding` → 벡터 길이 > 0. 실패는 SKIP 아닌 FAIL, `embedEnabled=false` 면 SKIP
- `TW_SMOKE_SKIP_LLM`(기본 false) 로 7·8 만 건너뛸 수 있게 하되, 켜면 배포 완료로 보지 않는다

**L-1 (P1) explainDedupDiff 의 json_object 제거 + 평문 우선 파싱**
- #80 에서 "미처리(경미)" 로 분류했으나 경미하지 않았다. 산문 2~3문장을 요구하며 JSON 을 강제하는 R-1 과 동일 조건이라 near 설명이 상시 실패한다(`max_tokens` 1024 라 피해만 작았음)
- R-1 로 기본 주입이 사라졌고, `_explanationText(raw)` 신설로 봉투(choices/content)에서 본문만 꺼낸 뒤 **평문을 그대로** 설명으로 쓴다. content 가 JSON 이면 첫 문자열 값을 쓰고, 실패해도 dedup 판정에 영향 없다는 원칙은 유지

**L-2 (P2) postEmbedding 엔드포인트 + embedEnabled 참조 경로 결함**
- 하드코딩 `https://openrouter.ai/api/v1/embeddings` 제거 → `_embedEndpoint()` 가 `cfg.llm.endpoint` 의 `/chat/completions` 를 `/embeddings` 로 치환해 **같은 호스트 재사용**. 형태가 다르면 `logWarning` 후 원본 사용. 호스트가 달라지면 urlPermission 추가 필요를 주석·가이드에 명시
- **추가 발견(실행 이력이 없던 진짜 이유)**: `testWooEmbedding.embed()` 가 `cfg.foundry.embedEnabled` 를 읽는데 이 필드는 존재하지 않는다(Config 는 `cfg.llm.embedEnabled` 로 싣는다) → env 가 `embedEnabled:true` 여도 임베딩이 **항상 즉시 null 반환**. `cfg.llm.embedEnabled` 로 교정
- 그 결함 덕분에 dedup L2 우회 경로(`candVec` null → L1 점수만으로 L3 진행)가 사실상 상시 검증돼 있었다 — `embedEnabled:false` 로도 판정이 동작함은 코드 경로상 확인, 실환경 재확인은 스모크 8 SKIP 케이스로 수행

**L-3 (P2) pass0MaxTokens 가 Pass1 에도 적용되던 문제**
- env `llm.pass1MaxTokens: 8192` 신설(기본 Pass0 와 동일값)
- `_pass0MaxTokens()` → `_maxTokensFor(stage)` 로 교체, `_chat(cfg, system, user, stage)` 가 `"pass0"`/`"pass1"` 을 받아 해당 상한 사용
- `_parseJson(raw, stage)` 로 단계를 전달해 `_lengthDiag` 메시지에 `stage=pass0|pass1` 표기. fragment 가 쌓여 Pass1 이 절단되면 `pass1MaxTokens` 만 올린다

**문서**
- `01_개발가이드.md` v1.6.1: 섹션6 에 **7) LLM 요청 파라미터 규약** 신설(json_object 금지 · tools 병용 금지 · reasoningOff 단일 형식 · 단계별 상한 · frequency_penalty · 임베딩 호스트 재사용 · length 진단 판독 요령), 스모크 표에 7·8 추가 + "LLM 스텝 생략 시 배포 완료 불인정" 명시, 완료 체크 2행 추가
- `00_ReportIndex.md`: `07_SQL생성추가_디버깅1.md` 등재

**검증**
- `node tools/checkRhinoSyntax.js` 19/19 · `node tools/checkDialectSql.js` 6/6 통과
- `_looksRepetitive` 실동 검증(위 R-3)
- **미실행(환경 필요)**: R-1 단독 실행 검증(Studio "서울에 사는 고객"), 스모크 7·8, dedup near 설명 채움, Pass1 절단 미발생

Changed files: new_ver/js/testWooLlm.js, new_ver/js/testWooEnv.js, new_ver/js/testWooEmbedding.js, new_ver/tools/testWooSmoke.js, docs/report/{00_ReportIndex,01_개발가이드}.md, docs/log/log.md

83. 2026-08-06 thinking 모델 reasoning 비활성 형식 교정 (max_tokens:0) + Pass0 토큰 env 연결 + Foundry 사고 예산 고정
Purpose: Gemini 2.5 Flash 전환 후 Pass0 첫 호출에서 `finish_reason="length"` 로 실패하던 원인을 제거한다 Changes:

**증상**: "서울에 사는 고객" 입력 → `[testWoo.llm] 응답이 max_tokens에서 잘렸습니다`. 라이브러리 0건이라 후보도 0건이고 NL 이 8자인데도 8192 토큰을 소진

**원인**: thinking 모델은 사고 토큰이 `max_tokens` 에 합산된다. 예산 미지정 시 구글 기본값 dynamic(최대 8192)이 적용되어 본문 몫이 0 이 된다. 기존 `reasoning:{enabled:false}` 는 Gemini 계열에서 `thinkingBudget:0` 으로 내려가지 않는다 — 끄려면 `max_tokens:0` 이 필요하다

**수정 — testWooLlm.js**
- `reasoningOff()` 추가·export: `{enabled:false, max_tokens:0}` 단일 형식. `_chat`·`explainDedupDiff`·openrouter 어댑터 기본값이 모두 이 함수를 쓴다
- `_pass0MaxTokens()` 추가: `testWooEnv.js llm.pass0MaxTokens` 를 실제로 읽는다. 기존에는 이 env 값을 읽는 곳이 없어 하드코딩 8192 만 적용됐다(Triage·Foundry 는 정상 참조 중)
- `_lengthDiag(usage)` 추가: `finish_reason="length"` 메시지에 `completion`/`reasoning` 토큰 수를 붙이고, 사고 토큰이 절반 이상이면 "상한을 올리지 말고 reasoning 을 끄라" 로 안내를 분기

**수정 — testWooFeasibility.js**: Triage 도 `testWoo.llm.reasoningOff()` 사용 (4096 상한이라 동일 증상 예정이었음)

**수정 — testWooFoundry.js**: `reasoning:{enabled:true, effort:"high"}` → `{max_tokens:_reasoningBudget(maxTok)}`. `effort:"high"` 는 상한의 대부분을 사고에 배정해 본문 몫을 남기지 않을 수 있다. 절대 예산(상한의 1/4, 1024~8192)으로 고정해 3/4 를 fragment JSON·tool_calls 출력용으로 보장한다. Anthropic 하한 1024 도 충족

**검증**: `checkRhinoSyntax` 19/19 통과

Changed files: new_ver/js/testWooLlm.js, new_ver/js/testWooFeasibility.js, new_ver/js/testWooFoundry.js

82. 2026-08-06 논리명→물리명(sqlname) 결함 수정 — 툴킷 sqlColumn 노출·해석 + 프롬프트 3종 + 스모크 4b/4c + 가이드 v1.6.0
Purpose: 툴킷이 LLM 에게 논리 속성명만 노출하는데 실행 경로는 원시 SQL 이라 Foundry/Triage 가 실테이블에서 100% 실패하던 결함을 제거한다 Changes:

**근본 원인 (실측 확인)**
- ACC 는 스키마 속성에 `sqlname` 이 없으면 타입 접두사를 붙여 물리 컬럼명을 자동 생성한다
- `woo:testWooSampleCustomer` 배포 스키마 실측: `customer_id`→`sCustomer_id`, `age`→`iAge`, `region`→`sRegion`, `marketing_consent`→`iMarketing_consent`, `birth_date`→`tsBirth_date`, PK `id`→`iTestWooSampleCustomerId`
- 테이블명은 `sqltable` 선언값 그대로(`testWooSampleCustomer`). 네임스페이스 접두사 형태(`WooTestWooSampleCustomer`)는 존재하지 않음을 SQL 오류로 확인
- `SELECT COUNT(*)`=101 vs `queryDef count`=100 → 차이 1건은 ACC PK=0 기술 레코드

**파급 경로 (미발현 상태였던 이유: probe_values 스모크 미포함 + Foundry 완주 이력 없음)**
- `describe_schema`/`search_columns` 가 `@name` 만 반환 → LLM 이 논리명 학습
- `probe_values` 가 그 이름을 `COUNT(DISTINCT <col>)` 에 직삽 → `column does not exist`
- `probe_sql` · 생성 fragment `sql_text` 도 논리명 → G-A 게이트 실패 → gateRetries 소진 → `needs_human_design`
- Pass1 `grainKey` 예시가 `customer_id` → 컴파일러 `key_column mismatch` 로 매 요청 실패
- `nms:recipient` 등 표준 스키마도 동일(Adobe 가 `sqlname="sEmail"` 명시)

**수정 — testWooToolkit.js**
- `_sqlColumnOf(attr)` 추가: `@sqlname` 추출
- `_resolveSqlColumn(schemaId, requested)` 추가: 논리명·물리명 양방향 조회 → 물리명 반환. 스키마 미선언 식별자는 거부(정합성 + 임의 문자열 SQL 유입 차단). `sqlname` 없는 속성은 "XML 저장 필드라 조회 불가" 로 명시 실패
- `_toolDescribeSchema` / `_toolSearchColumns`: 컬럼마다 `sqlColumn` 노출. search 는 `sqlname` 도 키워드 매칭 대상에 포함
- `_toolProbeValues`: LLM 인자를 `_resolveSqlColumn` 으로 해석 후 SQL 조립, 응답에 `name`/`sqlColumn` 동봉
- `DESCRIBE_JSON_CAP` 4096→6144: `sqlColumn` 추가로 `nms:recipient`(47컬럼)가 절단되는 것 방지
- `env().grainKeyCandidates`: `["customer_id","iRecipientId","recipientId"]` → `["sCustomer_id","iRecipientId"]` (물리명 통일)
- 도구 description 4종에 "SQL 에는 sqlColumn 사용" 명시

**수정 — 프롬프트 3종**
- `testWooFoundry.js` `_foundrySystemPrompt`: 물리명 강제 + keyColumn 도 sqlColumn
- `testWooFeasibility.js` `_triageSystemPrompt`: evidence/alternatives 에 sqlColumn 보고
- `testWooLlm.js` Pass1: `grainKey` 는 후보의 `key_column` 을 그대로 복사(예시에서 `customer_id` 제거)

**문서 — 01_개발가이드.md v1.6.0**
- 섹션2 "논리명 vs 물리명" 신설: 접두사 규칙표, 실측 대응표, 논리명/물리명 사용처 구분표, PK=0 기술 레코드
- 샘플 fragment `sql_text`·`key_column` 을 실측 물리명으로 교정
- 섹션6 "물리 컬럼명 추정 금지" 행을 `sqlColumn` 조회 절차로 대체 + 물리 테이블명·기술 레코드 행 추가

**스모크 보강 — testWooSmoke.js** (결함이 배포 후에야 드러난 원인: `probe_values` 미점검)
- `4b.sqlColumn`: `describe_schema("nms:recipient")` 가 `sqlColumn` 을 채우고 `name` 과 다른 컬럼이 1개 이상 존재하는지. SQL 실행 없음 → 비용 0, 표준 스키마라 환경 무관
- `4c.probe_values`: `woo:testWooSampleCustomer` 에 **논리명** `region` 을 넣어 `sqlColumn=sRegion` 해석 + 실제 SQL 실행 확인. `describe_schema` 결과와 교차 검증하므로 물리명 하드코딩 없음
- `twSkip()` + 요약 3상태(PASS/SKIP/FAIL) 도입: 샘플 스키마 미배포 시 4c 는 SKIP(PASS 로 세지 않음). 대형 표준 테이블은 `COUNT(DISTINCT)` 비용 때문에 4c 대상에서 제외
- 고객 데이터 미출력 원칙 유지 — 값 목록 대신 `distinct`/`sampled` 건수만 기록

**검증**: `checkRhinoSyntax` 19/19, `checkDialectSql` 6/6 통과. TS 린트 오류는 E4X 미지원 기존 전역 현상

Changed files: new_ver/js/testWooToolkit.js, new_ver/js/testWooFoundry.js, new_ver/js/testWooFeasibility.js, new_ver/js/testWooLlm.js, new_ver/tools/testWooSmoke.js, docs/report/01_개발가이드.md

81. 2026-08-06 AI 스키마 5종 상단 정의서화 (이누머레이션·인덱스·속성 명세)
Purpose: 샘플 데이터 스키마 2종을 제외한 AI 스키마 5종의 상단 주석을, 열거형·인덱스·전 속성의 용도를 한 줄씩 기술한 정의서 형식으로 확장한다 Changes:

**공통 구성** (기존 rule #6 골격 유지 + 섹션 추가)
- `[Main Functions]` → `[Enumerations]` → `[Keys / Indexes]` → `[Attributes]` → `[Dependencies]`
- 속성은 `name (type length) 설명` 한 줄 형식. 기능 그룹별로 소제목 구분
- 코드 실동작을 확인한 뒤 기술. 문서상 계획과 코드가 다른 항목은 코드 기준으로 적고
  미구현·예약 필드는 그 사실을 명시

**스키마별 요점**
- `testWooAiFragment` : status 6종 중 컴파일러는 active 만 통과, `active`(boolean) 는
  navtree·폼 필터용이며 판정 근거가 아님을 명시. Stage A 스코어 가중치 실측값 기재
  (sample_questions 8 · synonyms 6 · label 4 · tags 3 · description 2 · category 힌트 +10).
  인덱스 5종의 용도(버전 중복 차단·dedup L0·현행 조회·후보 축소·카테고리 필터) 구분
- `testWooAiSql` : impact_status 가 testWooLifecycle 갱신 대상임을 명시.
  `target_count` 는 Studio 가 0 을 보내는 현재 상태를 그대로 기록
- `testWooAiRequestQueue` : status 10종 전이 의미를 개별 기술(throttled 는 재시도 금지 등).
  `clarify_answers`(읽기만) · `cost_estimate`(기록 경로 없음) 를 예약 필드로 표기
- `testWooAiGapLog` : 개념 단위 집계 테이블임을 명시. `verdict` 가 열거형이 아닌
  자유 문자열이라 값 검증이 코드 책임이라는 점 기재. 전용 navtree 노드·폼 없음
- `testWooAiGolden` : 판정 기준이 fragment 부분집합 포함이며 SQL 문자열 비교가 아님을 명시.
  `expected_count_min/max` · `expected_verdict` · `case_type` 은 러너 미사용(예약)

**검증**
- 스키마 7종 전체 well formed 확인(PowerShell `[xml]` 파싱)
- XML 주석 내 이중 하이픈 잔여 0건 확인(주석 구분자 제외)
- 의존 관계 기술은 navtree·input_form 실제 등록 여부와 대조.
  Gap Log 의 navtree 목록 노드 부재, Golden 폼의 예약 필드 부재를 반영
Changed files: new_ver/schema/{testWooAiFragment,testWooAiSql,testWooAiRequestQueue,testWooAiGapLog,testWooAiGolden}.xml

80. 2026-08-06 Triage response_format 제거(Gemini tools 충돌) + G-C 모집단 분모 결함 수정
Purpose: LLM 모델을 `google/gemini-2.5-flash` 로 전환한 뒤 Foundry 배치가 `[testWoo.llm.postChat] API error: Function calling with a response mime type: 'application/json' is unsupported` 로 실패. 원인 제거와, 그 다음 단계에서 반드시 걸릴 G-C 게이트 결함을 함께 처리한다 Changes:

**결함 1 — Triage 가 tools + response_format 동시 전송 (P0, 실제 발생)**
- `testWooLlm.js` `_buildBody` 는 `else if (!opts.tools)` 로 이미 상호배제 처리되어 있었으나,
  `testWooFeasibility.js` `runTriageLoop` 은 body 를 **직접 구성**하며 우회했다
- Google API 는 function calling 과 `responseMimeType: application/json` 병용을 거부한다.
  Foundry `runToolLoop` 은 `response_format` 을 보내지 않아 무사했고 Triage 만 해당
- `response_format: { type: "json_object" }` 제거 + 금지 이유 주석.
  JSON 강제는 시스템 프롬프트("OUTPUT JSON ONLY on final turn")와 기존
  `content.indexOf("{")`~`lastIndexOf("}")` 추출 로직이 이미 담당하므로 파싱부 변경 없음
- 사전 격리 점검(WF JS 로 4개 요청 형태 직접 전송)에서 이 조합이 통과해 **오탐**이 났다.
  OpenRouter 의 업스트림 라우팅 편차로 1회 표본이 우연히 수용된 것으로 판단 →
  이후 파라미터 호환성은 1회 성공으로 판정하지 말고 실제 파이프라인까지 돌릴 것

**결함 2 — G-C 게이트가 populationCountSql 미설정 시 상시 실패 (P0, 잠재)**
- `testWooGates.js` `validateFragment` 가 분모 부재 시 `pop = probe.total` 로 폴백 →
  `probe.total >= pop * 0.95` 가 `total >= total*0.95` 가 되어 **결과가 1건이라도 있으면 항상 실패**
- `testWooEnv.js` 주석의 "비우면 G-C 완화" 와 코드 동작이 정반대였다
- `pop = 0` 기본값으로 교정 → 기존 `pop > 0 &&` 가드가 상한 검사를 자연히 생략.
  `sqlGetInt` 실패 시에도 `pop = 0` + `logWarning`(조용한 상시 실패 방지)
- 실패 메시지 분리: `결과 0건` / `결과가 모집단의 95% 이상 (n/pop) — 필터 효과 없음`.
  성공 메시지에 population 설정 여부 표기
- `testWooEnv.js` `populationCountSql` 주석 정정: 용도 2곳(G-C, dedup near) 명시,
  비었을 때 동작 명시, 예시를 `COUNT(DISTINCT customer_id)` → `COUNT(*)` 로 교체
  (물리 컬럼명은 ACC 버전·DBMS 마다 달라 논리명으로 쓸 수 없음)

**검증**
- `checkRhinoSyntax.js` 19/19 통과
- `response_format` 잔여 사용처는 `testWooLlm.js` `_buildBody` 1곳뿐이며 tools 와 상호배제 확인
- 미처리(경미): `explainDedupDiff` 는 산문 응답을 요구하면서 `_buildBody` 기본값으로
  `json_object` 가 붙는다. 예외는 아니고 near 설명이 JSON 형태로 저장되는 표시 문제
Changed files: new_ver/js/testWooFeasibility.js, new_ver/js/testWooGates.js, new_ver/js/testWooEnv.js

79. 2026-08-06 workflow_id(long) → workflow_name(string) 전환 — WF 인터널네임 보관 (BAS-010042 해소)
Purpose: Studio 를 `?workflowId=WKF94`(워크플로 인터널네임)로 열면 큐 insert 가 `BAS-010042 Value 'WKF94' is not a valid integer` 로 실패했다. 정수 PK 대신 환경 이식이 가능한 인터널네임을 보관하도록 필드 타입·명칭을 전환한다 Changes:

**결함 원인**
- 스키마는 `workflow_id type="long"` 인데 Studio URL 파라미터가 검증 없이
  `p.workflow_id` → `doc.@workflow_id` 로 그대로 대입되어 Write 시점에 ACC 가 거부
- 영향 2경로: `enqueueRequest`(큐 insert, 실제 발생) / `saveAiSql`(Register, 동일 원인 잠재)

**인터널네임 채택 근거**
- 이 필드는 조회·조인에 쓰이지 않는 순수 추적용(navtree 열 + 입력폼 표시)
- 정수 `@id` 는 autopk 라 패키지 배포 시 환경마다 값이 달라짐. 인터널네임은 유지됨
- 운영자가 `WKF94` 를 콘솔 검색창에 바로 넣어 워크플로를 찾을 수 있음
- 향후 레이블 조인이 필요해도 OOTB `xtk:workflow` 는 `@internalName` 에 내부 키가 있어 가능

**변경 내용**
- 스키마 2종: `workflow_id`(long) → `workflow_name`(string, length=64).
  `testWooAiSql` 의 `idx_wf` keyfield xpath 도 함께 전환(unique 아닌 dbindex 로 충돌 없음)
- `testWooRepository.js`: `WF_NAME_MAX=64` 상수 + `_wfName()` 헬퍼 신설(trim + 초과 시
  절단하며 `logWarning`). `saveAiSql`·`enqueueRequest` 두 write 지점에 적용
- `testWooFoundry.js`: `_getQueue` select 노드와 반환 필드를 문자열로 전환(`Number()` 제거)
- JSSP 2종: Generate·Register 페이로드 키를 `workflow_name` 으로, 기본값 `0` → `""`
- URL 파라미터: `?workflowId=` → `?workflowName=` (Studio.jssp, 클라이언트 JS 2종)
- 클라이언트 JS 2종 동기 유지: `WORKFLOW_ID` → `WORKFLOW_NAME` (선언·generate·register·푸터 4곳)
- 버튼 패치: `document.value.@id` → `@internalName`, URL 파라미터명 및 주석 갱신
- 스모크: `workflow_id: 0` → `workflow_name: ""`
- 문서: 개발가이드 이력 필드표·API 계약·Studio 접속 URL·큐 필드표, 스킬 pipeline-contracts.md

**검증**
- `checkRhinoSyntax.js` 19/19 통과
- 변경 XML 6종 well-formed 확인(PowerShell `[xml]` 파싱)
- 저장소 전역 `workflow_id`/`WORKFLOW_ID`/`workflowId` 잔여 참조 0건
  (과거 리포트 `04_SQL생성추가_추가2.md` 는 이력 문서라 원문 유지)

**배포 주의**
- 스키마 2종 재배포 후 **DB 구조 갱신 필수**(정수 → 문자열 컬럼 타입 변경).
  기존 행의 `0` 은 `"0"` 으로 남으므로 필요 시 갱신 후 정리
Changed files: new_ver/schema/{testWooAiRequestQueue,testWooAiSql}.xml, new_ver/input_form/{testWooAiRequestQueue,testWooAiSql}.xml, new_ver/navtree/testWooAiNavtree.xml, new_ver/js/{testWooRepository,testWooFoundry}.js, new_ver/jssp/{testWooAiGenerate,testWooAiRegister,testWooAiStudio,testWooAiStudioJs}.jssp, new_ver/html/testWooAiStudio.js, new_ver/workflow/testWooXtkWorkflowButtonPatch.xml, new_ver/tools/testWooSmoke.js, docs/report/01_개발가이드.md, .cursor/skills/campaign-ai-studio/pipeline-contracts.md

78. 2026-08-05 방언 지원 정책 명문화 — 미검증 DBMS 런타임 가드 + FDA 주석 + 문자열 대조 도구 (추가5 반영)
Purpose: docs/report/06_SQL생성추가_추가5.md(추가4 개정판) 반영. M-1 A/B/C·M-2·M-3 은 로그 #77 에서 이미 적용 완료이며, 본 항목은 개정판에서 **신규 추가된 수정 D/E 와 방언 지원 정책**만 처리한다 Changes:

**수정 D (신규) — 미검증 DBMS 런타임 가드**
- 배경: ACC v7 은 PostgreSQL/Oracle/MSSQL 을 모두 지원하지만 본 시스템은 **PostgreSQL 에서만
  실동 검증**된다. `dialect()` 에 분기가 존재한다는 사실이 "3종 지원됨" 으로 오해될 위험을 차단
  https://experienceleague.adobe.com/en/docs/campaign-classic/using/release-notes/compatibility-matrix
- `testWooProbe.js` `_dbmsInfo()` 신설 → `{dbms, dialectVerified}` 계산
- `preflight()` 반환에 `dbms` / `dialectVerified` 추가. 성공·실패(NO_SQL_RIGHT,
  NO_SQL_SELECT_RIGHT) 3경로 모두에 포함해 실패 시에도 진단 정보가 남게 함
- PG 가 아니면 성공 경로 말미에 `logWarning` — **차단하지 않는다**(정상 진행).
  권한 실패 경로에서는 경고를 내지 않는다(이미 차단된 상태라 노이즈)
- 기존 호출부(`foundry._preflight` → `pf.ok`/`pf.code`/`pf.message`)는 필드 추가만이라 무영향

**수정 E (신규) — FDA 확장 여지 주석**
- `getDBMSType(name)` 은 데이터소스명을 받고 미지정 시 `nms:default` 를 쓴다. FDA 로 외부
  데이터소스를 붙이면 fragment SQL 대상 방언이 달라질 수 있다
  https://experienceleague.adobe.com/developer/campaign-api/api/m-Application-getDBMSType.html
- `dialect()` 상단에 `dialect(dsName) → getDBMSType(dsName)` 확장 필요 주석만 추가.
  **구현하지 않음**(리포트 지시)

**M-3 부수 — 스모크 요약에 DBMS 표기**
- `TW_SMOKE_DBMS` 에 `preflight()` 의 `dbms`/`dialectVerified` 를 담아 2번 스텝 PASS 메시지와
  최종 요약에 출력. 어떤 DB 에서 나온 결과인지 로그만 보고 판단 가능하게 함

**검증 도구 상설화 (리포트 검증 5항)**
- `tools/checkDialectSql.js` 신설 — `testWooProbe.js` 에서 `dialectFor` **본문을 파일에서 추출**해
  실행하므로 코드 사본이 아닌 실제 구현을 대조한다. DB 접속 불필요, 종료코드 반환
- 로그 #77 에서는 동일 검사를 임시 스크립트로 1회 실행 후 삭제했는데, 검증 절차 5항이 상시
  항목이 되었으므로 도구로 승격
- 실행 결과 6/6 통과 (DISTINCT 3종 + 파생 테이블 래핑 3종):
  - MSSQL  `SELECT DISTINCT TOP 50 col AS tw_val FROM tbl WHERE col IS NOT NULL ORDER BY 1`
  - Oracle `SELECT DISTINCT col AS tw_val FROM tbl WHERE col IS NOT NULL ORDER BY 1 FETCH FIRST 50 ROWS ONLY`
  - PG     `SELECT DISTINCT col AS tw_val FROM tbl WHERE col IS NOT NULL ORDER BY 1 LIMIT 50`
  - 래핑 3종 모두 `{orderBy:null}` 로 외부 ORDER BY 미생성

**개정판 재확인 결과 (무변경)**
- 수정 C 의 dedup 항목: `_symmetricDiffCount` 는 `dial.exceptOp` 만 쓰고 limit 래핑을 하지
  않으므로 `{orderBy:null}` 전환 대상이 없다 — 재확인 후 무변경 (로그 #77 과 동일 결론)
- M-2 의 `getQueueStatus` operation 확인: `getIfExists` 로 이미 정상 (testWooRepository.js:143)

**문서**
- docs/report/01_개발가이드.md 섹션 6: "방언 지원 범위"·"getDBMSType 데이터소스" 규약 2건 추가,
  스모크 2번에 dbms 기록 명시, 완료 체크에 dbms 확인 + 로컬 도구 2종 실행 추가 · v1.5.1
- docs/report/00_ReportIndex.md: `06_SQL생성추가_추가5.md` 등재 + `tools/` 점검 도구 표 추가
- **번호 중복 지적**: `06_…추가4` / `06_…추가5` 가 접두 번호를 공유한다(규칙상 후자는 `07_`).
  docs/ 파일 개명은 요청 시에만 수행하므로 인덱스에 안내 문구만 남김

**미실행 (환경 필요)**
- 검증 4항(`probe_values`/`probe_sql`/dedup L3 실동작) · 7항(PG 에서 `dialectVerified:true`,
  경고 미발생) · 8항(`foundry.enabled=false`)은 ACC 배포 후 스모크로 확인
- Oracle/MSSQL 은 **실행 검증하지 않는다**(리포트 금지 항목). 문자열 정합까지만 보증

Changed files: new_ver/js/testWooProbe.js, new_ver/tools/testWooSmoke.js, tools/checkDialectSql.js(신규), docs/report/{00_ReportIndex,01_개발가이드}.md, docs/log/log.md

77. 2026-08-05 SQL 방언 정합 M-1~M-3 (limitSelect DISTINCT TOP · 스모크 6a/6b, 06 리포트 반영)
Purpose: docs/report/06_SQL생성추가_추가4.md 의 잔여 결함 3건 교정. M-1 은 로그 #76 의 N-4(limitSelect 신설) 지시가 방언 분기를 고려하지 못한 후속 교정이다 Changes:

**M-1 (P1) limitSelect 방언 조립 오류 — MSSQL probe_values 전량 실패**
- 근거: T-SQL 구문 순서는 `SELECT [ALL|DISTINCT] [TOP n] select_list`
  https://learn.microsoft.com/en-us/sql/t-sql/queries/select-transact-sql
  MSSQL 은 뷰·인라인함수·파생테이블·서브쿼리·CTE 내부의 ORDER BY 를 거부(TOP/OFFSET 동반 시만 허용)
  https://learn.microsoft.com/en-us/answers/questions/1061604/the-order-by-clause-is-invalid-in-views-inline-fun
  Oracle row limiting: ORDER BY … FETCH FIRST n ROWS ONLY
  https://blogs.oracle.com/sql/how-to-select-the-top-n-rows-per-group-with-sql-in-oracle-database
- **자기 유입 결함 2건** (#76 N-4 에서 넣은 코드):
  1) `head = "SELECT TOP n "` + selectList 조립 + `_toolProbeValues` 가 selectList 에
     `"DISTINCT col AS tw_val"` 를 섞어 전달 → MSSQL 에서 `SELECT TOP 50 DISTINCT …` 구문 오류
  2) `limit(sql, n)` 이 `limitSelect("*", "(sql) tw_lim", …)` 를 호출 → 인자 sql 이 이미
     ORDER BY 를 포함한 완성 SELECT 면 파생 테이블 안의 ORDER BY 로 MSSQL 오류
- 수정 A: `limitSelect(selectList, fromClause, whereSql, n, opts)` 로 시그니처 확장.
  `opts = {distinct, orderBy}` — DISTINCT 는 방언별 위치가 다르므로 opts 로 받고,
  MSSQL 만 `"SELECT " + dis + "TOP n "` 로 조립. `orderBy: null` 이면 ORDER BY 생략
- 수정 B: `dialect()` 반환에서 **`limit` 삭제**. 전수 grep 결과 `.limit(` 호출부 0건이라
  하위 호환 부담 없이 제거 (파생 테이블 이중 래핑 경로 자체를 없앰)
- 수정 C: `_toolProbeValues` 를 `limitSelect(col + " AS tw_val", tbl, col + " IS NOT NULL",
  limit, {distinct:true})` 로 전환. `probe.run` 샘플 경로는 opts 생략(기본 distinct=false,
  orderBy="1") 으로 현행 유지
- **dedup 은 대상 아님**: `_symmetricDiffCount` 는 `dial.exceptOp` 만 쓰고 limit 래핑을
  하지 않아 집합연산 내부 ORDER BY 문제가 없음 (리포트 C항 확인 결과 무변경)
- `dialectFor(dbmsType)` 신설 + export — `dialect()` 는 `getDBMSType()` 결과로 이를 호출.
  방언 시뮬레이션을 가능하게 해 스모크 5b 에서 실행 없이 문자열 검증
- 검증(로컬, 실제 파일에서 함수 추출해 실행):
  - MSSQL  `SELECT DISTINCT TOP 50 col AS tw_val FROM tbl WHERE col IS NOT NULL ORDER BY 1`
  - Oracle `SELECT DISTINCT col AS tw_val FROM tbl WHERE col IS NOT NULL ORDER BY 1 FETCH FIRST 50 ROWS ONLY`
  - PG     `SELECT DISTINCT col AS tw_val FROM tbl WHERE col IS NOT NULL ORDER BY 1 LIMIT 50`
  - 파생 래핑(`{orderBy:null}`) 3종 모두 외부 ORDER BY 미생성 → 리포트 기대값과 전부 일치

**M-2 (P2) 스모크 6번 getIfExists 경로 보장**
- 확인 결과 `repo.getQueueStatus` 는 이미 `operation="getIfExists"` 였다(경로 자체는 유효)
- 다만 Foundry 핵심 경로인 `_getQueue` 는 스모크가 타지 않아 향후 회귀를 놓칠 수 있으므로
  `testWoo.foundry.peekQueue(id)` 를 읽기 전용 진입점으로 노출 (운영 로직 미사용)
- 6번을 분리: **6b** 무매치(`-1`) 조회 → 예외 아닌 `null` (부작용 없어 더미 생성 전 수행) /
  **6a** 더미 왕복 → `peekQueue`(=`_getQueue`) + `getQueueStatus` **양쪽** 에서
  `@id` 읽힘 + `status="queued"` 일치 확인
- 더미 레코드 `finally` 삭제 + 삭제 실패 시 `logError` 수동 안내는 현행 유지

**M-3 (P2) 스모크 1번 전역 부재 로그 노이즈**
- `testWoo` 자체가 undefined 면 14개 모듈이 전부 missing 으로 나열되어 "loadLibrary 실패"
  라는 진짜 원인이 묻혔다. 스모크는 장애 상황에서 읽는 산출물이므로 메시지 품질이 복구 속도다
- 전역 부재는 별도 메시지("JS 라이브러리 배포 여부와 woo: 네임스페이스를 먼저 확인")로 조기 반환,
  개별 모듈 누락은 `n/14 modules undefined` 형태로 구분

**문서**
- docs/report/01_개발가이드.md 섹션 6: 규약 3건 추가(행 제한 SQL 조립 단일 래핑 지점 ·
  DISTINCT 위치 · 파생테이블/집합연산 ORDER BY 금지) + 스모크 표에 5b/6b/6a 반영 · v1.5.0
- docs/report/00_ReportIndex.md: `06_SQL생성추가_추가4.md` 등재

**미실행 (환경 필요)**
- 06 리포트 검증 4번(`probe_values` 실동작 회귀) · 7번(`foundry.enabled=false` 회귀)은 ACC 배포 후.
  5번(방언 3종 문자열)은 로컬에서 선검증 완료했고 스모크 5b 가 ACC 에서 재확인한다
- 현재 DBMS 가 PostgreSQL 이면 M-1 의 MSSQL 구문 오류는 실환경에 나타나지 않았을 가능성이 높다.
  다만 방언 분기 코드가 깨진 상태였으므로 DBMS 변경·타 환경 이관 시 즉시 발현될 결함이었다

Changed files: new_ver/js/testWoo{Probe,Toolkit,Foundry}.js, new_ver/tools/testWooSmoke.js, docs/report/{00_ReportIndex,01_개발가이드}.md, docs/log/log.md

76. 2026-08-05 Adobe API 오용 수정 N-1~N-6 + 배포 스모크 (05 리포트 반영)
Purpose: docs/report/05_SQL생성추가_추가3.md 의 신규 결함 6건 교정 — 이 중 N-2 는 로그 #75 의 P2-1(E4X 전환) 과정에서 새로 유입시킨 결함이다 Changes:

**N-1 (P0) getIfExists 반환 파싱 — 큐 처리 전면 불능**
- 근거: operation 표 "getIfExists: One element is returned. If no match element exists,
  then an empty element is returned" / select 만 `<xxx-collection>` 으로 감싼다.
  문서의 존재 판정 관용구도 `if (res.@id != undefined)` 다.
  https://experienceleague.adobe.com/en/docs/campaign/automation/workflows/advanced-management/javascript-in-workflows
  https://experienceleague.adobe.com/developer/campaign-api/api/sm-queryDef-ExecuteQuery.html
- 교정 규칙: 존재 판정 `String(res.@id || "") === ""`, `res` 자체를 행으로 읽음,
  `<select>` 에 `<node expr="@id"/>` 필수(N-6 동시 해소)
- **리포트는 2곳(_getQueue/_getFragmentById)만 지목했으나 전수 grep 결과 6곳**:
  - `testWooFoundry._getQueue` — 큐 조회 전면 실패 (P0)
  - `testWooLifecycle._getFragmentById` — `@id` 미선택까지 동반(N-6). revoke/hardDelete 가 의존
  - `testWooRepository.bumpFragmentUsage` — cnt 가 항상 0 → usage_count 가 매번 1 로 리셋
  - `testWooRepository.getQueueStatus` — Studio 큐 상태 조회가 항상 null
  - `testWooRepository.upsertGapLog` — 기존 레코드를 못 찾아 **같은 개념이 매번 새 행으로 누적**
    (request_count 집계가 무의미해지던 원인)
  - `testWooAiFragmentReview.jssp loadFragment` — 승인 화면 detail 이 항상 null
  → 뒤 4곳은 #75 이전부터 있던 기존 결함 (리포트 범위 밖에서 추가 발견)
- 부수: `_isSchemaError` 에서 `"does not exist"` / `"unknown"` 제거 → **XTK-170/171 접두사만**.
  일반 JS 오류까지 "스키마 미배포"로 치환되어 원인 추적을 막고 있었다

**N-2 (P0) Schema 객체에 toXMLString 없음 — 스키마 조회 전부 조용히 0건**
- 근거: Schema 클래스의 메서드는 `toDocument` 하나뿐(공식 Methods 표), 반환은 DOMDocument.
  `toXMLString` 은 DOMElement 메서드다.
  https://experienceleague.adobe.com/developer/campaign-api/api/c-Schema.html
  https://experienceleague.adobe.com/developer/campaign-api/api/m-Schema-toDocument.html
- `_schemaXml`: `new XML(sch.toXMLString())` → `sch.toDocument().documentElement.toXMLString()`
- **자기 유입 결함**: #75 P2-1 에서 정규식 파싱을 E4X 로 바꿀 때 넣은 코드.
  `catch (eSch) {}` 가 예외를 삼켜 증상이 "에러"가 아니라 **"모든 스키마 조회 0건"** 으로 나타나
  Triage 가 근거 없이 no_column 을 내는 거짓 판정으로 이어지던 상태
- 조용한 실패 제거: `search_columns` / `describe_schema` 의 빈 catch → `logWarning` +
  `schemaLoadFailed` 를 결과·evidenceLog 에 실어 전파
- feasibility: `no_column` + `schemaLoadFailed` → `ambiguous` 강등
  ("컬럼 없음"이 아니라 "확인 불가"). partialScan(확신도 제한)과 구분해 처리

**N-3 (P1) 물리 컬럼명 추정 금지 규약화**
- 근거: sqlname 미지정 시 물리명은 타입 접두사 + 이름으로 자동 생성(string→s, integer→i…)
  https://experienceleague.adobe.com/en/docs/campaign-classic/using/configuring-campaign-classic/schema-reference/database-mapping
- #75 의 queryDef 카운트 방식 유지. `_hasProcessing` 상단에 sqlGetInt 로 되돌리지 말라는
  방지 주석 + 근거 URL 명시 (ACC 버전·DBMS 별로 sStatus/sstatus/s_status 로 갈림)
- 가이드 섹션 6 에 규약 신설 (woo:* 커스텀 스키마 물리명 추정 SQL 금지)

**N-4 (P2) dial.limit 이중 서브쿼리 + 샘플 비결정성**
- `dialect()` 에 `limitSelect(selectList, fromClause, whereSql, n)` 신설 = **유일한 래핑 지점**.
  항상 `ORDER BY 1` 을 붙인다 (Oracle FETCH FIRST / MSSQL TOP 은 정렬 없으면 비결정적,
  auditSample 은 승인 근거 자료이므로 재현성 필수)
- `probe.run` 샘플: 3중 중첩 → 1중 (`limitSelect(kc + " AS tw_key", "(inner) tw_sample", "", lim)`)
- `_toolProbeValues`: DISTINCT 를 select 절로 올려 **중첩 0** 으로 생성
- 기존 `limit(sql, n)` 은 `limitSelect` 위임 호출로 남겨 하위 호환 유지

**N-5 (P2) used_fragments 부분 문자열 매칭 오탐**
- `_parseUsedFragments` + `_usesFragment` 신설 → JSON 파싱 후 **원소 name 정확 비교**
- `listImpact` 의 `uf.indexOf(needle)` / `revoke` 의 `|| uf.indexOf(f.name)` 삭제
  (`sub__x` 조회에 `sub__x_v2` 가 걸려 무관한 SQL 이 affected 로 마킹되던 문제)
- 파싱 실패 레코드는 무시하지 않고 `impact_status="unknown"` + logWarning

**N-6 (P2) getIfExists select 에 @id 누락** — N-1 에서 6곳 전부 처리 완료

**S-1 배포 직후 스모크 (신규)**
- `new_ver/tools/testWooSmoke.js`: WF JS 액티비티용. checkRhinoSyntax 가 못 잡는
  **API 시그니처 오용**(N-2 가 정확히 그 사각지대)을 덮는다
- 1.모듈 14개 전역 정의 / 2.preflight ok / 3.sqlSelect 반환 XML 구조 logInfo /
  4.describe_schema 속성 비어있지 않음(N-2 회귀) / 5.search_columns 1건+ /
  6.큐 더미 왕복(N-1 회귀) / 7.PASS·FAIL 요약 + 실패 시 logError
- 더미 레코드는 finally 삭제, 삭제 실패 시 logError 로 수동 정리 안내. 고객 데이터 미출력
- `tools/checkRhinoSyntax.js` 검사 대상에 `new_ver/tools` 추가 (19개 파일 전부 통과)

**부수: 조용한 실패 제거 (Foundry 핵심 경로 3곳)**
- `foundry.runToolLoop` / `feasibility.runTriageLoop` 의 tool args 파싱 실패 → logWarning
- `foundry.processQueueItem` 의 `missing_slots_json` 파싱 실패는 빈 배열로 삼키면
  **슬롯 전체를 건너뛴 채 done 으로 종료**되므로 `failed` + `FFDATA` 로 전환
- 나머지 빈 catch(DBMS 타입 탐지·예산 기본값 등)는 무해한 폴백이라 미변경

**문서**
- docs/report/01_개발가이드.md: 섹션 6 규약 4건 추가(getIfExists 반환형 · getSchema toDocument ·
  물리명 추정 금지 · 샘플 재현성 · 빈 catch 금지) + **6) 배포 마지막 단계 스모크** · v1.4.9
- docs/report/00_ReportIndex.md: `05_SQL생성추가_추가3.md` 등재

**미실행 (환경 필요)**
- 05 리포트 검증 1~8번은 ACC 배포 후 스모크 실행으로 수행. 특히 3번(describe_schema 속성 육안 확인)
  과 4번(큐 1건 → processBatch)이 N-2/N-1 회귀 검출 지점

Changed files: new_ver/js/testWoo{Foundry,Lifecycle,Repository,Toolkit,Probe,Feasibility}.js, new_ver/jssp/testWooAiFragmentReview.jssp, new_ver/tools/testWooSmoke.js(신규), tools/checkRhinoSyntax.js, docs/report/{00_ReportIndex,01_개발가이드}.md, docs/log/log.md

75. 2026-08-05 코드 점검 결함 수정 P0~P2 (04 리포트 반영)
Purpose: docs/report/04_SQL생성추가_추가2.md 의 P0~P2 결함 전수 수정 — sqlSelect format 규약 정합, dedup 구문오류, sql right 프리플라이트, 큐 선점, StageA 재실행, evidence 기계근거화, 툴 예산 요청단위, E4X 파싱 전환 Changes:

**P0-1 E4X 리터럴 미종료 (파일 전체 로드 실패)**
- testWooDedup.js `_loadCandidates`: `expr={... + "'"/>` → `"'"}/>`, 죽은 `if (sk)` 블록 제거
- **추가 발견**: 동일 결함이 testWooLifecycle.js `publish`(line 113)에도 있어 함께 수정
  → 두 파일 모두 loadLibrary 시점에 파싱 실패 상태였음 (testWoo.dedup / testWoo.lifecycle undefined)

**P0-2 sqlSelect 호출 규약 (Adobe 공식문서 불일치)**
- 근거: `sqlSelect(format, query [, dataSource])` — 1번째 인자는 라벨이 아니라 결과 XML 스키마이고
  반환은 XML 객체(배열 아님). https://experienceleague.adobe.com/developer/campaign-api/api/f-sqlSelect.html
- testWooProbe.js: `_safeSqlSelect(label,…)` → `_safeSqlSelect(format,…)`, 반환 `{ok, xml}` (rows 제거)
  - 존재 검증 format `"row"` / 샘플은 `AS tw_key` 별칭 + `"row,@tw_key:string"` + `for each` 순회
- testWooToolkit.js `_toolProbeValues`: `AS tw_val` 별칭 + `"row,@tw_val:string"` + E4X
- 전수 grep 결과 위 2곳 외 sqlSelect 호출부 없음 (sqlGetInt는 규약 영향 없음)

**P0-3 'sql' named right 프리플라이트**
- 근거: sqlGetInt 문서 "The operator must have the 'sql' right…"
  https://experienceleague.adobe.com/developer/campaign-api/api/f-sqlGetInt.html
- testWooProbe.js `preflight()` 신규 (sqlGetInt + sqlSelect 각각 확인) → export
- Foundry `processBatch()` 진입 시 1회: 실패면 큐 상태 미변경 + logError + 배치 중단(재시도 가능)
- `processQueueItem()` 진입 시: 실패면 큐 `failed` + message 를 last_error 기록
- 일반 SQL 오류와 구분되는 errId 접두사 `FFPERM` (throttled 은 `FFTHR`)

**P0-4 큐 선점 동시성**
- `processBatch()`: 스테일 복구 → `processing` 존재 시 `skipped:true` 로 중단
- **설계 판단**: 물리 컬럼명(`sStatus` 등) 추정 SQL 대신 **queryDef** 로 센다.
  리포트도 "물리명은 sqltable 기준으로 확정할 것"으로 미확정이었고, queryDef 는 스키마 매핑에만
  의존하므로 컬럼명 추정 실패 위험이 없다 (sqlGetInt COUNT 미사용)
- 스테일 복구: `processing` + updated_at 30분 초과 → `queued` (testWooEnv `foundry.staleProcessingMinutes`)
  updated_at 파싱 실패 레코드는 건드리지 않고 logWarning (오복구로 인한 중복 처리 방지)
- `_claimQueue` 주석에 "완전한 원자성은 WF 단일 인스턴스 설정에 의존" 명시

**P1-1 순차 생성 후 Stage A 재실행**
- `splice + si--` 패턴 제거 → `pending.shift()` + `_resolveRemainingBySearch()`
- publish 성공 직후에만 clearCache + 남은 슬롯 재검색, 커버되면 `resolvedBy:"reuse_after_publish"`
- `maxNewFragments` 는 실제 publish 건수만 증가 (기존과 동일하게 유지)
- **연쇄 수정**: Stage A 는 `@status='active'` 만 검색해 신규 publish(`verified`)를 못 찾으므로
  `searchBySlot/searchSlots` 에 3번째 인자 `statuses` 추가(기본 `["active"]` = 기존 동작 유지,
  Foundry 재사용 판정만 `["active","verified"]`). 화이트리스트 정규화로 주입 차단
  → 이 보강 없이는 P1-1 재검색이 항상 0건이 되어 무의미했음

**P1-2 게이트 재시도 — A안 채택 (LLM 자가수정)**
- 근거: B안(1회 판정 후 즉시 failed)은 게이트 실패 원인이 프롬프트로 교정 가능한 경우까지
  큐를 죽인다. A안은 실패 근거를 같은 대화에 넣어 재생성하므로 설계 의도(자가수정)와 일치
- `_runGateWithRetry` 삭제 → `generateFragmentForSlot(cfg, nl, slotText, queueId, slotId)` 가
  게이트까지 소유하고 `{fragDoc, gate, attempts, tokensUsed}` 반환
- **리포트 스니펫 수정**: 실패 근거를 `role:"tool"` 로 push 하면 OpenAI 호환 API 가 400 을 낸다
  (tool 메시지는 직전 assistant `tool_calls` 에 1:1 대응 필수). 마지막 턴은 content 응답이라
  대응 tool_call 이 없으므로 `role:"user"` 로 되먹임
- `cfg.foundry.gateRetries`(기본 2) 유지, runToolLoop 이 `usage.total_tokens` 합산 → `tokens_used` 저장

**P1-3 dedup verdict near publish**
- 스키마 `woo:testWooAiFragment`: `dedup_verdict`(enum novel|near|equivalent|exact, 16) ·
  `dedup_match_id`(long) · `dedup_diff_count`(long) — attribute 는 dbindex 하단 배치
- input_form 에 Dedup 탭 추가 / `testWooLifecycle.publish` 가 3필드 기록
- Foundry: publish 전 fragDoc 에 dedup 판정 채움, near 는 publish(status=verified) 하되
  큐 `awaiting_approval` + slotResults `needsDedupReview:true` + last_error 에 검토 안내
- **버그 동반 수정**: 재사용 분기가 존재하지 않는 `dedup.matchId` 를 참조해 fragmentId 가 항상 null
  → `dedup.matches[0].id` 로 교정
- FragmentReview.jssp: list/detail 에 `dedupVerdict/dedupMatchId/dedupDiffCount/needsDedupReview/dedupWarning`,
  detail 은 유사 fragment 를 `similar` 로 함께 반환(sqlText 나란히 비교용)
  ※ HTML 승인 화면은 여전히 미구현 — 배너는 이 JSON 계약을 소비하는 UI 구현 시점에 렌더

**P1-4 dedup population 계산 오류**
- `_popCache` 모듈 스코프 + `_population()` 신규 → `cfg.foundry.populationCountSql` 기준 sqlGetInt
- `ratio = bestDiff / _population()`, population 0 이면 `near` + `delegateHuman:true`
- `probeNew` 는 후보 SQL 자체 검증 용도로만 유지(`scores.candidateTotal`), 분모로 사용 안 함

**P1-5 Triage evidence 기계 근거화**
- `applyDemotionRules(raw, toolCallCount)` → `applyDemotionRules(raw, toolLog)`
- `_hasToolCall(log,name)` 기준 강등: no_value↔probe_values, no_column↔search_columns,
  feasible↔툴 0회, feasible+low
- `evidence.toolCalls` 를 toolLog.length 로 **덮어쓰고**, LLM 자기신고와 불일치 시
  `evidence.selfReportMismatch=true` + narrative 부기
- 슬롯별 phase 슬라이스(`markPhase`/`getEvidenceLogSince`)로 **이전 슬롯 근거 전용 차단**

**P1-6 resetBudget 중복 호출**
- toolkit: `resetRequest()`(카운터+로그 초기화) / `markPhase(name)`(구분자만, 인덱스 반환) 분리,
  `resetBudget` 은 deprecated 별칭 유지, `getEvidenceLogSince(idx)` 추가
- `feasibility.runTriageLoop` / `foundry.runToolLoop` 내부 초기화 호출 삭제
- `foundry.processQueueItem()` 진입 시 `resetRequest()` 1회 / triage·generate 는 markPhase
- evidence 수집을 `_collectEvidence()` 1회로 통합 (초기화 제거로 발생할 중복 누적 제거)
- 단계 슬라이스 소비처는 triage 뿐이므로 Foundry 의 markPhase 는 **구분자 기록 전용**
  (반환 인덱스를 쓰지 않아 `phaseStart` 는 반환 객체에서 제거). fragment 의 `audit_sample` 은
  evidenceLog 가 아니라 게이트의 `auditSample` 에서 나오므로 단계 슬라이스가 필요 없다

**구문 검증 도구 (신규)**
- `tools/checkRhinoSyntax.js`: E4X XML 리터럴·문자열·주석·정규식을 건너뛰며 괄호 균형과
  **E4X 보간(`attr={…}`) 미종료** 를 검사. P0-1 이 ACC 배포 전까지 발견되지 않은 원인이
  "로드 전 구문 확인 수단 없음" 이었으므로 추가
- 검증: 수정 전 커밋(`git show HEAD:`) 기준 실행 시 testWooDedup.js:96 / testWooLifecycle.js:113
  두 결함을 정확히 재현 검출, 현재 코드는 18개 파일 전부 통과 (검출력 확인된 도구)
- 실행: `node tools/checkRhinoSyntax.js` (저장소 루트)

**P2-1 XML 파싱 정규식 → E4X**
- `_schemaXml(id)` 신규: `application.getSchema()` 는 Schema 매핑 객체이므로
  `new XML(sch.toXMLString())` 로 변환 후 E4X 순회 (리포트의 `sch..attribute` 직접 접근은
  getSchema 반환형이 E4X XML 이 아니라 성립하지 않음)
- `describe_schema`: `xml..attribute` / `xml..element[@type='link']` → `{columns, links}` JSON,
  4KB 초과 시 attribute 절단 + `truncated:true`
- `_resolveSqlTable`: 루트 element(`@name == 스키마 @name`)의 `@sqltable` 만 사용, 없으면 예외
- `search_columns`: E4X 순회 (한글 label / 영문 name 부분일치 유지)

**P2-2 search_columns 스키마 대량 로드**
- 근거: getSchema 는 스크립트 종료까지 메모리 유지
- `SEARCH_SCHEMA_LOAD_CAP=30`(namespace당) · 스키마 목록 요청 단위 캐시(`_schemaListCache`)
- 반환에 `{scanned, totalCandidates, partialScan}` → evidenceLog 에 `partialScan` 플래그 기록
- feasibility: `no_column` + partialScan 이면 confidence 를 medium 이하로 제한

**P2-3 402/429 판정을 HTTP 상태코드로**
- testWooLlm `_httpError(msg, code)`: `err.httpStatus/isRateLimited/isOutOfCredit` 부착
- `_postJson` 비2xx·empty body·urlPermission 경로 모두 상태코드 보존, 200+본문 error 봉투도 처리
- Foundry catch: `msg.indexOf("402")` 문자열 검색 폐기 → `e.isRateLimited || e.isOutOfCredit`
- `throttled` 은 `attempt_count` 를 claim 이전 값으로 되돌려 **미증가**(자동 재시도 금지 원칙)

**P2-4 GapLog 개념 정규화**
- `_normalizeConcept`: 공백 전부 제거 → 구두점 제거 → 말미 조사 제거 → 소문자 (128자 절단)
- 기존 GapLog 레코드는 마이그레이션하지 않고 신규부터 적용

**P2-5 스키마 배포 선행**
- 전수 점검 결과 Queue/Sql 필드는 모두 존재, Fragment 의 dedup 3필드만 누락 → 추가(P1-3)
- `_getQueue` queryDef 를 try/catch 로 감싸 XTK 스키마 오류를 "스키마 배포가 선행되지 않았습니다" 로 치환
- 가이드에 배포 순서 명시: 스키마 재등록 → DB 구조 업데이트 → JS library → JSSP → navtree

**문서**
- docs/report/01_개발가이드.md: **섹션 6 신규** (sql named right, WF 동시 실행 금지 절차,
  배포 순서, Foundry 확장 필드 점검표, ACC 읽기 SQL 규약 표) · v1.4.8
- docs/report/00_ReportIndex.md: `04_SQL생성추가_추가2.md` 등재
- testWooEnv.js: `foundry.staleProcessingMinutes: 30` 추가 (+ Config 노출)

**미실행 (환경 필요)**
- 04 리포트 P0-2(d) 실측: `sqlSelect("row,@x:string","SELECT 1 AS x")` 반환 XML 구조 logInfo 확인
  → 공식 예제(`res.publicUrl.@sstringValue`)와 동일 구조를 가정해 `xml.row` / `@tw_key` 로 구현.
  실제 루트/노드명이 다르면 `_safeSqlSelect` 소비부 2곳만 조정하면 됨
- 검증 절차 1~12번(loadLibrary·preflight·probe·triage 강등·dedup·배치 동시성·throttled)은 ACC 배포 후 수행

Changed files: new_ver/js/testWoo{Probe,Dedup,Lifecycle,Toolkit,Feasibility,Foundry,Fragments,Llm,Env,Config}.js, new_ver/schema/testWooAiFragment.xml, new_ver/input_form/testWooAiFragment.xml, new_ver/jssp/testWooAiFragmentReview.jssp, tools/checkRhinoSyntax.js(신규), docs/report/{00_ReportIndex,01_개발가이드}.md, docs/log/log.md

74. 2026-08-05 navtree listdet→list (폼 잘림) + notebook 재등록 안내
Purpose: listdet 하단 고정 높이로 memo 필드 잘림 — ACC에 notebook 미반영 상태 확인 Changes:

navtree 3종 view type=listdet → list (더블클릭/Open 전체 폼)
입력폼 주석: ACC type=notebook 재등록 필수
Changed files: new_ver/navtree/testWooAiNavtree.xml, new_ver/input_form/testWooAi{Fragment,Sql,RequestQueue}.xml, docs/log/log.md

73. 2026-08-05 Fragment 입력폼 단일화 (foundry.xml 삭제)
Purpose: testWooAiFragment.xml / .foundry.xml 이중 파일 혼선 제거 — Foundry 본편 1개만 유지 Changes:

testWooAiFragment.xml = Foundry+notebook (ACC 등록본과 동일)
testWooAiFragment.foundry.xml 삭제
Changed files: new_ver/input_form/testWooAiFragment.xml, docs/log/log.md

72. 2026-08-05 Fragment 입력폼 섹션2 호환 + Foundry 교체용 분리
Purpose: ACC 구 스키마에 없는 Foundry xpath 로 testWooAiFragment 폼 저장 실패(XML-110013) Changes:

testWooAiFragment.xml — 섹션2 필드만(notebook 5탭)
testWooAiFragment.foundry.xml — 스키마 Update 후 교체용
navtree Fragments sysFilter Foundry 전까지 주석 처리
Changed files: new_ver/input_form/testWooAiFragment.xml, testWooAiFragment.foundry.xml, new_ver/navtree/testWooAiNavtree.xml, docs/log/log.md

71. 2026-08-05 시크릿 보관소 버전별 분리 (new_ver/secrets 신설) + 형식 간소화
Purpose: new_ver 코드의 민감값이 old_ver 보관소에 섞여 있던 문제 해소 및 조회 편의를 위한 형식 정리 Changes:

new_ver/secrets/NEW_VER_SECRETS.md 신설 — navtree view @url 2건 이관
old_ver/secrets/OLD_VER_SECRETS.md — old_ver 항목만 유지
두 파일 형식 통일: `// 출처파일` + `변수 = 원래값` 코드블록만 (표·설명문 제거)
.gitignore 에 new_ver/secrets/ 추가, navtree 헤더 참조 경로 갱신
Changed files: new_ver/secrets/NEW_VER_SECRETS.md, old_ver/secrets/OLD_VER_SECRETS.md, .gitignore, new_ver/navtree/testWooAiNavtree.xml, docs/log/log.md

70. 2026-08-05 Fragments navtree 기본 sysFilter (verified·승인대기)
Purpose: Verified 전용 폴더 대신 단일 Fragments 목록에 Adobe sysFilter 기본값으로 승인 대기만 표시 Changes:

testWooAiFragment view: @status='verified' AND @active=0 sysFilter
Changed files: new_ver/navtree/testWooAiNavtree.xml, docs/log/log.md

69. 2026-08-05 navtree Fragments Verified 폴더 제거 (단일 목록)
Purpose: Fragment 전체·Verified 승인대기를 폴더 2개로 나눌 실익 없음 — status 컬럼·Filters 로 충분 Changes:

testWooAiNavtree.xml 에서 testWooAiFragmentVerified nodeModel 삭제
Changed files: new_ver/navtree/testWooAiNavtree.xml, docs/log/log.md

68. 2026-08-05 navtree Sample 폴더 제거 (Explorer 운영 범위만)
Purpose: 샘플 mart 스키마는 E2E·probe용이며 Explorer 노출 불필요 — 운영 navtree 는 Fragment/Queue/SQL 만 유지 Changes:

testWooAiNavtree.xml 에서 Sample Customer/Subscription nodeModel 삭제
Changed files: new_ver/navtree/testWooAiNavtree.xml, docs/log/log.md

67. 2026-08-05 입력폼 notebook 탭 + Sample 폴더 연결·스크롤 개선
Purpose: listdet 하단 폼 잘림 해소 및 Sample Customer/Subscription Explorer 연결 오류 대응 Changes:

입력 폼 5종 type=notebook 탭 분리 (Fragment/Sql/Queue/Sample×2)
navtree Sample view form= 명시, Customer Name 컬럼 label
Sample 연결 오류: input_form/testWooSample*.xml ACC Input forms 등록 필수
Changed files: new_ver/input_form/*.xml, new_ver/navtree/testWooAiNavtree.xml, docs/log/log.md

66. 2026-08-05 navtree·로그 내부 호스트명 placeholder 치환 (공개 저장소 대응)
Purpose: 공개 GitHub 저장소에 LG U+ 테스트 Campaign 서버 실제 엔드포인트가 노출되지 않도록 치환 Changes:

navtree views/view/@url 2건(Studio·GapAdmin) → `__CAMPAIGN_SERVER_URL__` + 헤더에 배포 전 치환 안내 추가
log #65 Studio URL → `{CAMPAIGN_SERVER_URL}` 표기
실제 값은 old_ver/secrets/OLD_VER_SECRETS.md(git 제외)에 출처 추가 기록
Changed files: new_ver/navtree/testWooAiNavtree.xml, docs/log/log.md, old_ver/secrets/OLD_VER_SECRETS.md

65. 2026-08-05 신규 구축(new_ver) ACC 적용 현황·이슈·잔여 작업 정리
Purpose: Test Woo AI 신규 구축(new_ver) 이후 ACC 환경 적용 진행상황, 발생 이슈, 후속 작업을 한곳에 기록 Changes:

**A. 로컬(new_ver) 구현 완료 범위**
- 데이터 모델: `woo:testWooAiFragment` / `testWooAiSql` / `testWooAiRequestQueue` / `testWooAiGapLog` / `testWooAiGolden` + 샘플 `testWooSampleCustomer` / `testWooSampleSubscription`
- 입력 폼: Fragment / Sql / RequestQueue / Golden / Sample 2종
- JS 라이브러리: Config(옵션3) + Env(튜닝) + Pass0/StageA/Pass1 + Compiler/Gates/Lifecycle + Foundry 확장(Feasibility·Toolkit·Dedup·Embedding·Foundry·Probe)
- JSSP: Studio·Generate·Validate·Register·QueueStatus·FragmentReview(JSON)·GapAdmin·AuthDebug
- WF: `testWooSampleSeed.js`(샘플 100/150), `testWooFoundryBatch.js`(Foundry 5분 배치), `testWooGoldenRun.js`
- Explorer: `woo:testWooAiNav` navtree (`new_ver/navtree/testWooAiNavtree.xml`) — uplus:customizing 과 분리
- UX: Foundry 큐 상태별 Studio 배너 ([진행중]/[운영승인필요], 자동 재시도 없음)

**B. ACC 환경 — 확인·진행된 사항**
- Studio URL 접근·JSSP 배포: `{CAMPAIGN_SERVER_URL}/woo/testWooAiStudio.jssp`
- 샘플 시드 WF 실행: `testWooSampleCustomer` 100건, `testWooSampleSubscription` 150건 적재
- Foundry 큐 동작: Studio NL 매칭 실패 시 `woo:testWooAiRequestQueue` INSERT 확인 (Generate → enqueueRequest)
- XtkOption 최소 3개(ApiKey/Model/Endpoint) + `testWooEnv.js` 튜닝 분리 구조 반영
- `woo:testWooAiNav` navtree 신규 문서 등록 진행 (uplus XML 수정 없이 merge)

**C. ACC 환경 — 미완·미확인**
- 스키마 **Foundry 확장 필드** ACC 재등록 + **Update database structure** (version/active/origin/is_current 등)
- `WKF_testWooFoundry` WF 생성·스케줄(5분) 또는 수동 Run — **Queue → Fragment 생성의 필수 경로**
- JS 라이브러리 전량 배포 및 loadLibrary 순서(Config→…→Foundry) 검증
- Fragment **active 라이브러리 0건** → Studio Stage A 매칭 실패 지속 (Foundry 완료 + ops 승인 전까지)
- navtree Explorer 실폴더 생성 완료 여부 (`[WOO] Fragments` 등)
- Foundry 확장 후 navtree columns/orderBy 확장 컬럼 복원 (version·label·active 등)
- HTML 운영 승인 UI (`FragmentReview` 페이지) — **미구현**, 현재 Explorer에서 `verified` → `active` 수동
- 03 스펙 잔여: clarification UI/API, partial-exec 체크박스, Golden `expectedVerdict`

**D. 발생·해결 이슈**
| # | 증상/에러 | 원인 | 조치 |
|---|-----------|------|------|
| 1 | Studio NL → 매칭 실패 | active fragment 0건 + Foundry off 또는 WF 미처리 | Foundry ON + WF 실행 + fragment 승인 |
| 2 | `relation "testwooairequestqueue" does not exist` | Queue 스키마 DB 미반영 | 스키마 Save → Update database structure |
| 3 | Queue有 / Fragment無 | enqueue ≠ publish. WF 미실행·failed·infeasible·verified만 존재(active 필터) | Queue status·last_error·WF 로그 확인 |
| 4 | QUE-370028 invalid `/` in folder name | nodeModel label `Test Woo AI / …` → Explorer 폴더명 기본값 | label → `[WOO] Fragments` (슬래시 제거) |
| 5 | XTK-170036 `@version` `@label` `@active` `@id` unknown | navtree xpath가 ACC **미배포** Foundry 필드 참조 | navtree 기본 필드만 사용; 스키마 재배포 후 확장 |
| 6 | uplus:customizing 에 navtree 삽입 혼선 | woo 전용은 **별도** xtk:navtree 문서 | `woo:testWooAiNav` New 등록 (merge) |
| 7 | 큐 UX “승인 후 재시도” 혼동 | queued vs awaiting_approval 구분 부족 | Generate/Studio phase별 배너 (log #61) |

**E. 후속 작업 우선순위**
1. **스키마·DB**: Fragment/Queue/Sql(+GapLog) 최신 XML 재등록 → Update structure → Preview 필드 확인
2. **JS·WF**: 전 JS 재배포 → `WKF_testWooFoundry` 생성·실행 → Queue `status`가 `awaiting_approval`까지 도달 확인
3. **Explorer**: `woo:testWooAiNav` Save → `[WOO] Fragments` 폴더 생성 → `verified` fragment 목록 확인
4. **운영 승인**: Explorer에서 `status=verified`, `active=false` → `active=true` (또는 lifecycle API)
5. **E2E**: Studio 동일 NL 재시도 → Stage A 매칭 → SQL 생성
6. **navtree**: 스키마 반영 후 Foundry 컬럼·Verified sysFilter 재적용
7. **선택**: FragmentReview HTML UI, fragment 스모크 시드 WF, Golden Run 보완

**F. 설계 불변 (재확인)**
- LLM은 fragment SQL만 작성; 최종 SQL은 컴파일러 조립
- Foundry 생성 fragment는 자동 `active` 금지 — ops 승인 필수
- DB CRUD: `xtk.session.Write` (sqlExec/raw DML 금지)
- 마케터: Studio만 / fragment·queue 관리: 운영·개발

Changed files: docs/log/log.md

64. 2026-08-05 navtree xpath ACC 배포 스키마 정합 (XTK-170036)
Purpose: navtree columns/orderBy 가 ACC 미배포 Foundry 필드(version/label/active/@id) 참조로 저장 실패 Changes:

Fragment/Queue/SQL/Sample view: 섹션2 기본 필드만 사용, @id·@version·Foundry 확장 컬럼 제거
Changed files: new_ver/navtree/testWooAiNavtree.xml, docs/log/log.md

63. 2026-08-05 navtree label 슬래시 제거 (QUE-370028)
Purpose: Explorer New folder 기본 label 의 / 문자가 ACC 폴더명 규칙 위반으로 QUE-370028 발생 Changes:

nodeModel label: Test Woo AI / … → [WOO] … (uplus [샘플] 패턴)
Changed files: new_ver/navtree/testWooAiNavtree.xml, docs/log/log.md

62. 2026-08-05 woo:testWooAiNav navtree XML 신규 (uplus 분리)
Purpose: uplus:customizing 과 별도 xtk:navtree 문서로 Test Woo AI Explorer 폴더 타입·JSSP command 구성 Changes:

new_ver/navtree/testWooAiNavtree.xml: model testWooAi + Fragment/Queue/SQL/Sample nodeModel, Studio·GapAdmin views/commands
Verified 전용 sysFilter 폴더 타입 포함
Changed files: new_ver/navtree/testWooAiNavtree.xml, docs/log/log.md

61. 2026-08-05 Foundry 큐 UX 안내 (진행/운영승인/재생성 구분)
Purpose: 마케터가 queued 메시지에서 승인 대기·자동 알림을 오해하지 않도록 단계별 배너 명시 Changes:

Generate.jssp 큐 접수 문구 개선
Studio pollQueue: [진행중]/[운영승인필요]/시간초과 안내, 자동 재시도 없음 명시
Changed files: new_ver/jssp/testWooAiGenerate.jssp, html/testWooAiStudio.js, jssp/testWooAiStudioJs.jssp, docs/log/log.md

60. 2026-08-05 PRD 단일화(Rebuild→docs/main) + old_ver 시크릿 분리 + Git 초기 배포
Purpose: 이원화된 PRD를 docs/main 하나로 통합하고, 공개 저장소 배포 전 평문 자격증명을 코드에서 분리 Changes:

Rebuild/PRD.md(v1.5)를 docs/main/PRD.md로 이관 통합 → v1.6. 구 v0.1 초안(uplus·IR·WF XML 주입) 폐기
v0.1 유효 부록만 병합: 용어집(B.1 고유/B.2 ACC/B.3 신뢰도 + 폐기용어 명시), 쉬운 설명(부록 E), old_ver 관계(부록 F)
Rebuild/ 폴더 삭제, 참조 3곳 경로 갱신 (00_ReportIndex, 01_개발가이드 v1.6, 02_SQL생성추가)
old_ver 평문 시크릿 4개 파일 placeholder 치환 (API 키·admin 계정·_SQ_TOKEN) → old_ver/secrets/OLD_VER_SECRETS.md 보관
.gitignore 신규: docs/main/(민감)Info.md, old_ver/secrets/
Changed files: docs/main/PRD.md, .gitignore, old_ver/secrets/OLD_VER_SECRETS.md, old_ver/jssp_code/{config,core,app}.jssp.js, old_ver/html_code/ai_test_page.html, docs/report/{00_ReportIndex,01_개발가이드,02_SQL생성추가}.md, docs/log/log.md

59. 2026-08-05 Skill acc-data-access (Campaign DB 접근 원칙)
Purpose: sqlExec/ raw DML 금지, Write·testWooSampleSeed 패턴을 Skill에 명시 (가이드 오류 방지) Changes:

.cursor/skills/campaign-ai-studio/acc-data-access.md 신규
SKILL.md, architecture.md, pipeline-contracts.md 갱신
Changed files: .cursor/skills/campaign-ai-studio/*.md, docs/log/log.md

58. 2026-08-05 옵션 3개로 축소 + Env 주석 + 미배포 파일 삭제
Purpose: XtkOption은 ApiKey/Model/Endpoint만 유지, 나머지는 Env로 통합. 미배포 코드 정리 Changes:

testWooEnv.js — security/llm.provider/useProxy/pass0Examples 주석·필드 추가
testWooConfig.js — 옵션 3개만 읽기
testWooCommon.js — allowedCidr Env 참조
삭제: Codemap/WorkflowIo JS·스키마·폼, Catalog/Count/Logon/CodemapSync JSSP, Studio.html, sample_data 생성 스크립트
Changed files: new_ver/js/testWooEnv.js, testWooConfig.js, testWooCommon.js, testWooLlm.js, workflow/testWooXtkWorkflowButtonPatch.xml, docs/log/log.md

57. 2026-08-05 Feasibility Triage + testWooEnv.js (옵션→내장 상수 분리)
Purpose: 03 스펙(실현가능성 판정) 반영 및 XtkOption 폭증 해소 — 시크릿만 옵션, 튜닝은 Git 관리 JS Changes:

testWooEnv.js 신규 — foundry/triage/dedup/toolkit 한도·플래그 내장
testWooConfig.js — API Key/Model/Endpoint/Provider/Proxy/Pass0Examples만 옵션 읽기
testWooFeasibility.js — triage + 증거 강등(ambiguous)
testWooToolkit.js — probe_values, search_columns, evidenceLog
testWooFoundry.js — 슬롯별 triage 선행, infeasible/partially_infeasible 종료
스키마 — Queue(slotResults/evidenceLog), Sql(excludedSlots), GapLog, Golden(expectedVerdict)
JSSP — GapAdmin, QueueStatus 확장, Studio 불가 보고 UI Changed files: new_ver/js/testWooEnv.js, testWooConfig.js, testWooFeasibility.js, testWooToolkit.js, testWooFoundry.js, testWooRepository.js, new_ver/schema/*.xml, new_ver/jssp/testWooAiGapAdmin.jssp, testWooAiGenerate.jssp, testWooAiRegister.jssp, testWooAiStudio.jssp, html/testWooAiStudio.js, workflow/testWooFoundryBatch.js, docs/report/00_ReportIndex.md

56. 2026-08-05 Fragment Foundry 통합 (툴킷·dedup·큐·게이트 확장)
Purpose: docs/report/02_SQL생성추가.md 스펙 기반 미매칭 슬롯 Foundry 파이프라인 및 fragment 생애주기 구현
Changes:
- 신규 JS 6개: testWooProbe, Lifecycle, Embedding, Dedup, Toolkit, Foundry
- 스키마 확장: testWooAiFragment(버전/임베딩/감사), testWooAiSql(usedFragments/compileHash), testWooAiRequestQueue(부활), testWooAiGolden
- 게이트 G-A~G-F + SCOPE, LLM postChat/postEmbedding/tool_calls, Config Foundry 옵션 10종
- JSSP: Generate Foundry 분기, QueueStatus, FragmentReview, FragmentAdmin / Studio 큐 폴링
- WF: testWooFoundryBatch.js, testWooGoldenRun.js
Changed files: new_ver/js/testWoo*.js, new_ver/schema/*.xml, new_ver/jssp/*.jssp, new_ver/input_form/*.xml, new_ver/workflow/*.js, new_ver/html/testWooAiStudio.js, docs/log/log.md, docs/report/00_ReportIndex.md

55. 2026-08-05 Cursor AI 개발 환경 세팅 (skill·rule·AGENTS)
Purpose: Adobe Campaign AI Studio 구현 품질 향상을 위해 Cursor skill·rule·서브에이전트 가이드 구성
Changes:
- `.cursor/skills/campaign-ai-studio/`: SKILL + architecture, adobe-references, acc-rhino-constraints, pipeline-contracts
- `.cursor/rules/`: campaign-ai-project(alwaysApply), acc-server-javascript, acc-schema-forms
- `AGENTS.md`: 서브에이전트 라우팅·아키텍처 불변 조건·검증 체크리스트
Changed files: .cursor/skills/campaign-ai-studio/*, .cursor/rules/*.mdc, AGENTS.md, docs/log/log.md

54. 2026-08-05 (부록)Info·Info_mask OpenRouter LLM 설정 항목 추가
Purpose: LLM 설정 파일에 OpenRouter 프로바이더 항목·샘플값 추가 (기본 프로바이더 openrouter)
Changes:
- (부록)Info.md, Info_mask.md: LLM_PROVIDER, OPENROUTER_API_URL/KEY/MODEL, HTTP-Referer·X-Title 샘플 추가
- Anthropic 섹션 주석을 직결 롤백용으로 명시
Changed files: docs/main/(부록)Info.md, docs/main/Info_mask.md, docs/log/log.md

53. 2026-08-05 (부록)Info 민감정보 마스킹본 Info_mask.md 생성
Purpose: API 키·비밀번호·토큰 등 민감정보를 샘플 값으로 치환한 공유용 설정 파일 작성
Changes:
- docs/main/Info_mask.md 신규 생성 (서버 URL, 계정, IMS, JSSP 토큰, Anthropic API 키 마스킹)
Changed files: docs/main/Info_mask.md, docs/log/log.md

52. 2026-08-05 Config/Llm 미사용 옵션·분기 정리 (llmTimeoutMs 제거, useProxy 통합)
Purpose: OpenRouter 전환 후 코드에만 존재하던 dead option/export/분기 제거 — ACC Rhino 패턴은 유지
Changes:
- testWooConfig: llmTimeoutMs·allowedCidr(OPT) 제거, llm.useProxy getConfig 통합, export getConfig만
- testWooLlm: _llmUseProxy 제거, _postJson(llm,…), provider 중복 기본값·Anthropic type:error 중복 분기 제거
- 가이드: testWooAiLlmTimeoutMs 행 삭제
Changed files: new_ver/js/testWooConfig.js, new_ver/js/testWooLlm.js, docs/report/01_개발가이드.md, docs/log/log.md

51. 2026-08-05 OpenRouter 전환 (프로바이더 어댑터 + Bearer + choices 파싱 + Opus 5 reasoning off)
Purpose: Anthropic 직결 → OpenRouter(anthropic/claude-opus-5) 프로바이더 어댑터 방식 전환, Anthropic 롤백 경로 보존
Changes:
- testWooConfig: testWooAiLlmProvider 옵션, getConfig().llm.provider (기본 openrouter)
- testWooLlm: _PROVIDERS(anthropic|openrouter), LLM_MAX_TOKENS=8192, headerMap _postJson, choices[] 파싱, usage logInfo
- 가이드: OpenRouter 옵션·serverConf urlPermission·롤백·스모크 체크
- PRD: OpenRouter 제3자 중계·provider 옵션 제약
Changed files: new_ver/js/testWooConfig.js, new_ver/js/testWooLlm.js, docs/report/01_개발가이드.md, Rebuild/PRD.md, docs/log/log.md

50. 2026-08-05 샘플 시드 WF JS 단순화 (JSSP·JS library 제거)
Purpose: 테스트 데이터 적재를 워크플로우 JavaScript code Run 한 번으로 단순화
Changes:
- 삭제: testWooAiSampleSeed.jssp, js/testWooSampleSeed.js, js/testWooSampleSeedData.js
- 추가: workflow/testWooSampleSeed.js (생성기 출력, WF 붙여넣기용)
- generate_testwoo_sample_seed.py → workflow JS 출력
- 가이드 섹션5: Start→JS code→End WF Run 절차
Changed files: new_ver/workflow/testWooSampleSeed.js, new_ver/sample_data/generate_testwoo_sample_seed.py, docs/report/01_개발가이드.md, docs/log/log.md

49. 2026-08-05 샘플 스키마 ACC 콘솔 방식으로 정정 (DDL/SQL 제거)
Purpose: Update DB에 CREATE/INSERT SQL 직접 실행은 ACC 절차 위반 — srcSchema + Write 적재로 전환
Changes:
- 삭제: testWooSample_schema.sql, testWooSample_seed.sql
- 추가: testWooSampleSeed.js, testWooSampleSeedData.js, testWooAiSampleSeed.jssp
- generate_testwoo_sample_seed.py → JS 데이터 출력으로 변경
- 가이드 섹션5: 콘솔 스키마 등록·Update DB·JSSP 적재 절차
Changed files: new_ver/js/testWooSampleSeed*.js, new_ver/jssp/testWooAiSampleSeed.jssp, new_ver/sample_data/generate_testwoo_sample_seed.py, new_ver/schema/testWooSample*.xml, docs/report/01_개발가이드.md, docs/log/log.md

48. 2026-08-05 Test Woo 샘플 스키마·시드 (고객100·가입150)
Purpose: E2E 타겟팅 테스트용 고객·가입 샘플 테이블 DDL 및 시드 데이터 (재가입·동시 다중 요금제 규칙 반영)
Changes:
- testWooSample_schema.sql: testWooSampleCustomer / testWooSampleSubscription CREATE + 제약
- testWooSample_seed.sql: 고객 100 + 가입 150 INSERT (Python 생성기 검증)
- generate_testwoo_sample_seed.py: (customer_id, plan_code) 유일, 탈퇴 후 재가입 다른 요금제
Changed files: new_ver/sample_data/testWooSample_schema.sql, new_ver/sample_data/testWooSample_seed.sql, new_ver/sample_data/generate_testwoo_sample_seed.py, docs/log/log.md

47. 2026-08-04 MemoryBuffer.toString 정수 CODEPAGE (empty body 200)
Purpose: HTTP 200 + empty body — 공식 toString codePage는 int(CODEPAGE_UTF8). 문자열 "utf-8" 전달 시 빈 문자열
Changes:
- _readResponseBody: toString() 기본 → CODEPAGE_UTF8 정수 → codePage 폴백; size>0이면 명시 에러
Changed files: new_ver/js/testWooLlm.js, docs/log/log.md

46. 2026-08-04 LLM 응답 UTF-8 강제 디코딩 (한글 mojibake)
Purpose: unmatched 슬롯이 ìµœê·¼… 로 표시 — res.codePage(1252류)로 UTF-8 바디를 잘못 디코딩
Changes:
- _readResponseBody: 항상 toString("utf-8") 우선
- Studio unmatched 안내 문구 보강
Changed files: new_ver/js/testWooLlm.js, new_ver/html/testWooAiStudio.js, new_ver/jssp/testWooAiStudioJs.jssp, docs/log/log.md

45. 2026-08-04 wait 완전제거 + ACC Rhino 전수조사
Purpose: `typeof wait==function`인데 호출 실패 → 동일 에러 재발. wait 분기 완전 삭제. 서버 JS Rhino 금지 API 전수 정리
Changes:
- Llm: 동기 execute만(wait 코드 경로 삭제), _trim regex
- Common/Gates: trim→regex; Repository e.message fallback
- 가이드: ACC Rhino 허용/금지 표 (map/forEach/wait/Promise 등)
Changed files: new_ver/js/testWoo{Llm,Common,Gates,Repository}.js, docs/report/01_개발가이드.md, docs/log/log.md

44. 2026-08-04 LLM sync execute (wait 미존재 대응)
Purpose: `HttpClientRequest.wait is not a function` — 해당 ACC 빌드에 wait 없음. MemoryBuffer UTF-8 유지, 동기 execute 기본
Changes:
- _postJson: wait 있을 때만 async; 없으면 req.execute(useProxy)
Changed files: new_ver/js/testWooLlm.js, docs/log/log.md

43. 2026-08-04 ACC Rhino Array.map/forEach 제거 + err detail
Purpose: Studio Generate `처리 중 오류 errId=TW…` — ACC 서버 JS에 map/forEach 없어 TypeError가 화이트리스트 밖 500으로 가려짐
Changes:
- Llm/Fragments: map·forEach·filter → for 루프
- handleApiError: detail 항상 포함 + TypeError/Cannot find function 노출
- Studio: detail 표시
Changed files: new_ver/js/testWoo{Llm,Fragments,Common}.js, new_ver/html/testWooAiStudio.js, new_ver/jssp/testWooAiStudioJs.jssp, docs/log/log.md

42. 2026-08-04 P0/P1 검수 반영 (MemoryBuffer·CSRF·gates·errId)
Purpose: urlPermission 직후 터질 P0(UTF-8 MemoryBuffer·max_tokens·charset·CSRF) 및 P1(에러 노출·IP·dialect·fragment 계약·Studio UX) 반영
Changes:
- Llm: MemoryBuffer utf-8 요청/응답, async+wait 타임아웃, max_tokens 4096, slim truncate, stop_reason/error 분리
- Common: CSRF host 정확일치 fail-closed, handleApiError errId, AllowedCidr, TW_TITLE_MAX
- Gates: fragmentSqlContract (SELECT=grain, no WITH); Compiler: Oracle MINUS, maxSlots||40, contract 호출
- API JSSP: setContentType 최상단; Studio: 안내 로그인 페이지; X-Security-Token 제거
- 가이드: AllowedCidr/UseProxy/TimeoutMs + logon 존 우회 주의
Changed files: new_ver/js/testWoo{Common,Llm,Gates,Compiler,Config}.js, new_ver/jssp/testWooAi{Generate,Validate,Register,Studio,StudioJs}.jssp, new_ver/html/testWooAiStudio.js, docs/report/01_개발가이드.md, docs/log/log.md

41. 2026-08-04 urlPermission Anthropic 허용 가이드 보강
Purpose: JST-310026 확정 — basis용 serverConf urlPermission XML 예시 가이드에 명시
Changes:
- 01_개발가이드: api.anthropic.com dnsSuffix/urlRegEx 예시 + Hosted Control Panel 안내
Changed files: docs/report/01_개발가이드.md, docs/log/log.md

40. 2026-08-04 LLM _postJson 에러 메시지 보강 (urlPermission)
Purpose: Studio Generate에서 `[testWoo.llm._postJson] failed: undefined` — ACC 예외 message 공백·urlPermission 원인 가시화
Changes:
- _errText / host 포함 에러; JST-310026 시 urlPermission 안내
- 가이드 섹션1에 serverConf urlPermission 주석
Changed files: new_ver/js/testWooLlm.js, docs/report/01_개발가이드.md, docs/log/log.md

39. 2026-08-04 Cookie 헤더 우선 파싱 (AuthDebug BOUND_OK)
Purpose: AuthDebug에서 cookies=[]·Cookie 헤더로 logon→hiwoo 확인. request.cookies 대신 Cookie 헤더 우선
Changes:
- Common.twSessionTokenFromRequest / Studio._twCookie: Cookie 헤더 우선
Changed files: new_ver/js/testWooCommon.js, new_ver/jssp/testWooAiStudio.jssp, docs/log/log.md

38. 2026-08-04 AuthDebug Cookie 헤더 보강 (진단)
Purpose: AuthDebug 결과가 cookies=[]·sessionToken 없음 — Cookie 헤더 길이/이름·hint 필드로 다음 분기 명확화
Changes:
- cookieHeaderLen / cookieHeaderNames 항상 수집
- hint: NO_COOKIE | COOKIE_OK_LOGIN_EMPTY | BOUND_OK
Changed files: new_ver/jssp/testWooAiAuthDebug.jssp, docs/log/log.md

37. 2026-08-04 검수 반영 (logon·게이트·UTF-8·Register sql 무시)
Purpose: Anonymous=보안존(sessionTokenOnly) 원인에 맞춰 logon(sessionToken) 바인딩, Host 인젝션 Logon 폐기, allowedNames 무력화·한글·계약 통일
Changes:
- Common: twBindOperator/logon, getUTF8Parameter, handleApiError(AUTH/FORBIDDEN), requireStudioCsrf
- Gates: allowedNames 제거 → DB fragment active 존재 검사; runAll(plan,sql)
- Compiler: grain IS NOT NULL wrap; chipsFromPlan 서버 단일 소스; exclude는 UNION 후 EXCEPT 1회 유지
- Generate/Validate/Register: {ok,passed,…} 통일; Register는 plan 재컴파일만 저장
- Studio: nl logon.jsp + logon(tok); CSRF 헤더; 클라 chipsFromPlan 삭제
- Logon.jssp → 폐기 스텁; AuthDebug.jssp 추가; 가이드 v1.4.6
Changed files: new_ver/js/testWoo{Common,Gates,Compiler}.js, new_ver/jssp/testWooAi{Generate,Validate,Register,Studio,StudioJs,Logon,AuthDebug}.jssp, new_ver/html/testWooAiStudio.js, docs/report/01_개발가이드.md, docs/log/log.md

36. 2026-08-03 testWooAiLogon.jssp (xtk:session#Logon 토큰 발급)
Purpose: nl logon.jsp가 커스텀 JSSP에 Anonymous만 남기는 문제 — 공식 SOAP Logon으로 session+security token 발급
Changes:
- 신규 testWooAiLogon.jssp: Logon → Set-Cookie __sessiontoken + redirect ?__securitytoken=
- Studio: 미인증 시 Logon JSSP로 리다이렉트 (authRetry 종료 페이지 제거)
- 가이드 배포 6개
Changed files: new_ver/jssp/testWooAiLogon.jssp, testWooAiStudio.jssp, docs/report/01_개발가이드.md, docs/log/log.md

35. 2026-08-03 Studio ACC 웹인증 (logon redirect + X-Security-Token)
Purpose: JSSP Anonymous(login 공백) — session+security token 공식 웹 인증 반영
Changes:
- Studio.jssp: 미로그인 시 logon.jsp?target= 리다이렉트, 토큰/login 페이지 주입
- StudioJs: fetch에 X-Security-Token 헤더
- Common requireRight: Anonymous면 named-right와 구분되는 메시지
Changed files: new_ver/jssp/testWooAiStudio.jssp, testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, new_ver/js/testWooCommon.js, docs/report/01_개발가이드.md, docs/log/log.md

34. 2026-08-03 requireRight 에러에 login 표시
Purpose: JSSP missing right 시 웹 세션 운영자 식별
Changes:
- requireRight throw 메시지에 currentLogin() 포함
Changed files: new_ver/js/testWooCommon.js, docs/log/log.md

33. 2026-08-03 Common JST-310000 response is not defined 수정
Purpose: loadLibrary(Common) 시 JSSP 전역 response 직접 참조로 컴파일 실패(JST-310000) 수정. 예방성 forEach/StudioJs 진단 변경은 포함하지 않음
Changes:
- Common: response/request/document → TW_* 바인드
- 배포 JSSP 3개(+로컬 스텁): loadLibrary 전 TW_RESPONSE/REQUEST/DOCUMENT 할당
Changed files: new_ver/js/testWooCommon.js, new_ver/jssp/testWooAi{Generate,Validate,Register,Catalog,Count,CodemapSync}.jssp, docs/log/log.md

32. 2026-08-03 Studio JSSP 한글 인코딩(엔티티/\u) 수정
Purpose: Client Console 붙여넣기 시 한글이 ? 로 깨지는 문제 방지
Changes:
- Studio.jssp: charset=utf-8 + UI 한글을 HTML &#x…; 엔티티로 교체
- StudioJs/html JS: 런타임 한글 메시지를 \\uXXXX 이스케이프
- 개발가이드 인코딩 주의 문구 추가
Changed files: new_ver/jssp/testWooAiStudio.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.js, docs/report/01_개발가이드.md, docs/log/log.md

31. 2026-08-03 JSSP 5개로 축소 (Validate가 count/catalog 흡수)
Purpose: 배포·관리 효율 — Catalog/Count를 Validate action 분기로 통합
Changes:
- Validate: action=validate|count|catalog, action별 loadLibrary 최소화
- Catalog/Count: 미배포 스텁(DEPRECATED 안내)
- 가이드 섹션4: 배포 5개 + API 계약 갱신
Changed files: new_ver/jssp/testWooAiValidate.jssp, testWooAiCatalog.jssp, testWooAiCount.jssp, docs/report/01_개발가이드.md, docs/report/00_ReportIndex.md, docs/log/log.md

30. 2026-08-03 JS 전역 woo→testWoo (스키마 namespace 충돌 해소)
Purpose: ACC에서 woo.cfg 가 스키마 woo:cfg 로 해석되는 XFR-180000 방지
Changes:
- 서버 JS 전역 객체 woo.* → testWoo.* (cfg/fragments/llm/compiler/gates/repo/codemap)
- loadLibrary·스키마 namespace woo: 는 유지
- JSSP 호출부 및 개발가이드 반영
Changed files: new_ver/js/testWoo{Config,Fragments,Llm,Compiler,Gates,Repository,Codemap,WorkflowIo}.js, new_ver/jssp/testWooAi{Generate,Validate,Register,Catalog,Count,CodemapSync}.jssp, docs/report/01_개발가이드.md, docs/log/log.md

29. 2026-08-03 섹션4 JSSP·Studio `/woo/` 적용 가이드
Purpose: Dynamic JavaScript Pages로 API·Studio UI 배포 절차 고정 (CNF + ai_sql_id)
Changes:
- 가이드 섹션4: 7개 JSSP 배포표·API 계약·스모크 체크
- Studio를 `/woo/testWooAiStudio.jssp` + `testWooAiStudioJs.jssp`로 서빙
- CodemapSync 미배포 명시; Register는 ai_sql_id만
Changed files: docs/report/01_개발가이드.md, docs/report/00_ReportIndex.md, new_ver/jssp/testWooAiStudio.jssp, new_ver/jssp/testWooAiStudioJs.jssp, new_ver/html/testWooAiStudio.html, new_ver/html/testWooAiStudio.js, docs/log/log.md

28. 2026-08-03 Phase3 스키마 과수정 철회 + CNF 게이트 보강
Purpose: 공식문서 정정 — memo는 attribute 유지, GetDate(Write 미적용) 철회, formatDate 사용; unmatched/key_column 하드 fail
Changes:
- schema/form: attribute memo + @xpath 복원, default=GetDate 제거
- Repository: formatDate nowStr, @memo Write, update read-back 제거
- Gates: unmatched non-empty fail; key_column 필수 일치
- Compiler: key_column 필수
Changed files: new_ver/schema/testWooAiSql.xml, new_ver/input_form/testWooAiSql.xml, new_ver/js/testWooRepository.js, testWooGates.js, testWooCompiler.js, testWooLlm.js, Rebuild/PRD.md, docs/report/01_개발가이드.md, docs/log/log.md

27. 2026-08-03 CNF 컴파일러 + WorkflowIo 폐기
Purpose: silent data error 제거 — CNF plan 고정, WF XML Write 폐기, 이력 id 계약
Changes:
- Compiler: include[].any[] INTERSECT/UNION + exclude EXCEPT; summary from compile
- Llm Pass1 / Gates: CNF + 리터럴/도메인/allowedNames 필수
- Schema/Repo: GetNewIds→id 반환 (memo/GetDate는 28에서 정정)
- WorkflowIo stub 폐기; Register→ai_sql_id; Generate/Validate/Studio 정합
- PRD v1.5 · 가이드 JS 7개
Changed files: new_ver/js/testWooCompiler.js, testWooLlm.js, testWooGates.js, testWooRepository.js, testWooWorkflowIo.js, new_ver/schema/testWooAiSql.xml, new_ver/input_form/testWooAiSql.xml, new_ver/jssp/testWooAiGenerate.jssp, testWooAiValidate.jssp, testWooAiRegister.jssp, new_ver/html/testWooAiStudio.js, Rebuild/PRD.md, docs/report/01_개발가이드.md, 00_ReportIndex.md, docs/log/log.md

26. 2026-08-03 LLM 미설정 안내 메시지 개선
Purpose: 옵션 누락 시 기술 옵션명 대신 사용자용 안내 문구로 실패
Changes:
- Llm _requireLlmOpts: "LLM 연결이 설정되어 있지 않습니다…" + 누락 항목, logWarning에 상세
Changed files: new_ver/js/testWooLlm.js, docs/log/log.md

25. 2026-08-03 LLM 옵션 JS fallback 제거
Purpose: model/endpoint/apiKey 코드 대체값 삭제 — 옵션 미설정 시 명시적 실패
Changes:
- Config: getStr만, claude/anthropic URL 하드코딩 제거
- Llm: _requireLlmOpts(apiKey/model/endpoint)
- 가이드: 옵션 3개 필수·JS 기본값 없음 명시
Changed files: new_ver/js/testWooConfig.js, testWooLlm.js, docs/report/01_개발가이드.md, docs/log/log.md

24. 2026-08-03 공식문서 교차검증 수정 (setStatus·getOption·스키마순서)
Purpose: Adobe 공식 API/스키마 문서와 불일치한 반영분을 정정
Changes:
- Common: setStatus 제거(HttpServletResponse에 없음) → JSON body + optional code
- Config: getOption 기본=캐시미사용 반영, false 인자 제거
- schema: index→key→attribute 공식 순서로 복원
- 가이드: cryptString deprecated, extAccount/decryptPassword 권장
Changed files: new_ver/js/testWooCommon.js, testWooConfig.js, new_ver/schema/*.xml, docs/report/01_개발가이드.md, docs/log/log.md

23. 2026-08-03 섹션3 JS 검수 반영 (권한·StageA·Pass0)
Purpose: 권한 fail-open 수정, Stage A 비용 절감, Pass0 도메인 하드코딩 제거. JSSP charset은 jsonOut이 담당
Changes:
- Common: application.operator.hasRight/login, errOut setStatus try/catch, requireRight fail-closed
- Config: MAX_TOKENS=8, apiKey getOption no-cache, Pass0Examples 옵션
- Fragments: description LIKE 제외, 토큰 8, 멀티필드 스코어+길이정규화
- Llm: 추상 searchKeywords 규칙, matchedSlots, Array 판별 교체
- Generate.jssp: unmatched 응답에 matchedSlots
Changed files: new_ver/js/testWooCommon.js, testWooConfig.js, testWooFragments.js, testWooLlm.js, new_ver/jssp/testWooAiGenerate.jssp, docs/report/01_개발가이드.md, docs/log/log.md

22. 2026-08-03 스키마 attribute→index/key 하단 배치
Purpose: ACC 실무 관례(속성 먼저, index/key 하단)로 맞춤. 상단 배치는 검수 권고였으나 동작 차이 없음
Changes:
- fragment/sql/codemap/queue: attribute 블록 뒤 dbindex·key
Changed files: new_ver/schema/*.xml, docs/log/log.md

21. 2026-08-03 스키마·폼 name 카멜 + sqltable 통일
Purpose: Adobe 기본 카멜 네이밍으로 스키마/폼을 맞추고, sqltable=스키마 name으로 물리 테이블명을 단순화
Changes:
- schema/form: test_woo_ai_* → testWooAiFragment|Sql|Codemap|RequestQueue
- sqltable을 스키마 name과 동일하게 지정
- JS E4X/queryDef 스키마 참조·가이드·PRD 8장 동기화
Changed files: new_ver/schema/*.xml, new_ver/input_form/*.xml, new_ver/js/testWooFragments.js, testWooRepository.js, testWooCodemap.js, new_ver/jssp/testWooAiCodemapSync.jssp, docs/report/01_개발가이드.md, 00_ReportIndex.md, Rebuild/PRD.md, docs/log/log.md

20. 2026-08-03 스키마 검수 반영 (autopk/sqltable/enum)
Purpose: 외부 검수 P0(autopk+internal 충돌)·sqltable·status enum을 DB 구조 업데이트 전에 반영. API키·memo검색은 보류
Changes:
- fragment: byName에서 internal 제거, idx_name 중복 삭제, sqltable=WooAiFragment, fragmentStatus enum, index→key 순서
- sql: sqltable=WooAiSql, sqlHistoryStatus enum
- deferred codemap/queue: 동일 P0·sqltable·enum 선반영
- 가이드: DB 확인 항목·API키 평문 주의 문구
Changed files: new_ver/schema/testWooAiFragment.xml, testWooAiSql.xml, testWooAiCodemap.xml, testWooAiRequestQueue.xml, docs/report/01_개발가이드.md, docs/log/log.md

19. 2026-08-03 StageA 도메인 토큰 하드코딩 제거
Purpose: 1020세대 등 정규식 확장을 코드에서 제거하고, 표현 다양성은 Pass0 searchKeywords + fragment 메타로 이전
Changes:
- Fragments: _keywordsFromSlot (범용 분할만), 도메인 규칙 삭제
- Llm Pass0: searchKeywords[] 출력 계약
- PRD 4.1.2 반영
Changed files: new_ver/js/testWooFragments.js, new_ver/js/testWooLlm.js, Rebuild/PRD.md, docs/log/log.md

18. 2026-08-03 queryDef lineCount·StageA 가드레일 전면 수정
Purpose: ACC queryDef 기본 ~10000/대량 로드 위험을 반영해 loadAll 제거, 페이지 5000·단건 getByName·검색 시 sql_text 미로드로 재구성
Changes:
- testWooFragments.js: 페이지네이션 Stage A, getByName lineCount=1, listCategories
- testWooConfig.js: QUERY_PAGE_SIZE=5000, maxSlots 등 가드레일
- Llm/Compiler/Catalog: 슬롯 상한, 후보 slim, Anthropic content 파싱, Config 선행 로드
Changed files: new_ver/js/testWooFragments.js, testWooConfig.js, testWooLlm.js, testWooCompiler.js, new_ver/jssp/testWooAiCatalog.jssp, testWooAiValidate.jssp, Rebuild/PRD.md, docs/report/01_개발가이드.md, docs/log/log.md

17. 2026-08-03 섹션3 JS 라이브러리 적용 가이드
Purpose: 섹션2 이후 서버 JS 8개 배포 순서·식별키·제외(Codemap)를 가이드에 고정
Changes:
- docs/report/01_개발가이드.md 섹션3 추가
Changed files: docs/report/01_개발가이드.md, docs/log/log.md

16. 2026-08-03 입력 폼 height 속성 제거 (xtk:form 준수)
Purpose: XML-110013 — xtk:form /input에 height·type=text 없음. 공식 문서대로 xpath만 사용
Changes:
- fragment/sql/codemap/request_queue 폼에서 height·type=text 제거
- memo는 스키마 type으로 자동 멀티라인
Changed files: new_ver/input_form/*.xml, docs/report/01_개발가이드.md, docs/log/log.md

15. 2026-08-03 입력 폼 name=스키마 스네이크 재정리
Purpose: Adobe navtree 암시 규칙(폼 name=스키마 name)에 맞게 섹션2 입력 폼을 재정리
Changes:
- form name: test_woo_ai_fragment / test_woo_ai_sql (카멜 폼 name 폐기)
- 가이드: 파일명 카멜 vs Campaign name 스네이크 구분, 폼 등록 표 재작성
Changed files: new_ver/input_form/testWooAiFragment.xml, new_ver/input_form/testWooAiSql.xml, docs/report/01_개발가이드.md, docs/log/log.md

14. 2026-08-03 입력 폼 name 카멜 표기 정정
Purpose: (철회) 카멜 폼 name 시도 — Adobe 암시 연결과 충돌하여 15에서 스키마 동일로 복원
Changes:
- 일시적 카멜화 후 철회
Changed files: (superseded by 15)

13. 2026-08-03 섹션2 데이터 모델 적용 가이드
Purpose: 캠페인 콘솔에 fragment/sql 스키마·폼만 배포하도록 섹션2 절차·변경점·샘플을 가이드에 고정
Changes:
- 배포 대상: woo:test_woo_ai_fragment, woo:test_woo_ai_sql (+ forms)
- DEFERRED: codemap, request_queue 명시
- 이전 대비: expr→sql_text, ir_json→plan_json, 필드 삭제/추가 표
Changed files: docs/report/01_개발가이드.md, docs/report/00_ReportIndex.md, Rebuild/PRD.md, docs/log/log.md

12. 2026-08-03 화이트박스 정합 + 섹션1 안내 정리
Purpose: 검수에서 나온 문서 불일치를 맞추고 섹션1 적용 정보를 변경점과 함께 재공지
Changes:
- PRD v1.4.1: Pass0 다이어그램, include 리셋 주의, 구expr 문구 제거, 부록C 완료표, 부록D P0전제
- 가이드: 섹션1 필수/권장 권한, LLM옵션3만, 삭제된 옵션 목록, Count=스텁
Changed files: Rebuild/PRD.md, docs/report/01_개발가이드.md, docs/report/00_ReportIndex.md, docs/log/log.md

11. 2026-08-03 모호 NL 계약 + new_ver v1.4 코어 정합
Purpose: 마케터 모호 NL에도 슬롯 분해가 되도록 설계를 고정하고, 섹션 적용보다 먼저 new_ver 엔진을 v1.4에 맞춤
Changes:
- PRD v1.4: Pass0 LLM 슬롯분해 + Pass1 재분할, `+` 휴리스틱 비주력 명시
- schema: sql_text/tags/synonyms, plan_json; codemap/queue DEFERRED
- js: searchBySlot, generatePlan, set-op compiler, minimal gates, slim config/repo
- jssp/Studio: plan 기반 generate→validate→register
Changed files: Rebuild/PRD.md, new_ver/schema|input_form|js|jssp|html/*, docs/report/01_개발가이드.md, docs/report/00_ReportIndex.md, docs/log/log.md

10. 2026-08-03 PRD v1.3 설계 점검 완료 (섹션1 Go)
Purpose: 100k·10+조건·최소 API 요구를 기준으로 전체 설계를 재점검하고 남은 구멍을 메운 뒤 섹션1 착수 가능을 확정
Changes:
- Rebuild/PRD.md v1.3: 슬롯별 Stage A, SELECT sql_text 계약, set-op 컴파일러 규칙, 평가 지표, new_ver 정합 체크리스트
- 코드 대비: WHERE-AND·전체 catalog LLM·과다 게이트는 섹션2 전 교체 대상임을 문서화
- 가이드/인덱스 동기화. 섹션1(권한3·LLM옵션3) Go 확정
Changed files: Rebuild/PRD.md, docs/report/01_개발가이드.md, docs/report/00_ReportIndex.md, docs/log/log.md

9. 2026-08-03 PRD v1.2 정확도·신뢰도 아키텍처 점검 보완
Purpose: 100k fragment·10+조건·최소 외부연동 요구를 반영해 설계 구멍을 메우고 섹션1 착수 가능 여부 판정
Changes:
- Rebuild/PRD.md v1.2: Stage A(내부검색)→Stage B(LLM)→조합계획→결정론적 컴파일러, 벡터DB 배제
- 신뢰도: grain키·실재 fragment·params·최소검증·사람승인. 과다 게이트/codemap 유지 제외
- 판정: 문서 Go / new_ver 코드 No-Go(정합 필요). 섹션1(권한·LLM옵션3)만 즉시 가능
- docs/report/01_개발가이드.md v1.2 동기화
Changed files: Rebuild/PRD.md, docs/report/01_개발가이드.md, docs/report/00_ReportIndex.md, docs/log/log.md

8. 2026-08-03 PRD 단순화 재작성 (fragment SELECT 조합 알고리즘 확정)
Purpose: 사용자 확정 알고리즘과 기존 과설계를 대조해 PRD를 단순·정확하게 재작성
Changes:
- Rebuild/PRD.md v1.1: CDP/마트/라이브러리 적재는 '참고', LLM 일은 NL→fragment 선택·집합연산 조합→SQL→커스텀 액티비티 주입
- fragment를 WHERE 조각이 아닌 SELECT 조각+union/join/exclude/intersect로 정정
- codemap·퍼널·무거운 Config/게이트·IR 필수화는 MVP 제외 또는 보류로 명시
Changed files: Rebuild/PRD.md, docs/log/log.md

7. 2026-08-03 Test Woo 네이밍 전환 (testWoo/woo/test_woo_*)
Purpose: 테스트 적용을 위해 파일명·네임스페이스·옵션/권한·스키마명을 운영(uplus)과 명확히 분리
Changes:
- 파일명: woo_* → testWoo* 카멜표기 (27개)
- 네임스페이스: uplus → woo, JS 심볼 uplus.* → woo.*
- 스키마 name: test_woo_ai_sql|fragment|codemap|request_queue, label 영어
- 옵션/권한: testWooAi* / testWooAiSqlGenerate|Register|LibraryManage (uplus 제거)
- URL 별칭: /woo/, loadLibrary("woo:testWoo….js")
- docs/report/01_개발가이드.md·00_ReportIndex 전면 동기화
Changed files: new_ver/**, docs/report/01_개발가이드.md, docs/report/00_ReportIndex.md, docs/log/log.md

6. 2026-07-31 new_ver 코드 파일명 woo_ 접두사 통일 및 연동 점검
Purpose: new_ver 전 파일에 woo_ 접두사를 적용하고 loadLibrary/URL/문서 참조를 일치시켜 연동 깨짐을 방지
Changes:
- 공통 헬퍼를 jssp/woo__common.jssp.js → js/woo_common.js 로 정리, 전 JSSP loadLibrary를 uplus:woo_common.js 로 통일
- JSSP 6종·html·workflow 버튼/계약 샘플의 파일명·엔드포인트·script src 모두 woo_ 기준으로 확인
- docs/report/01_개발가이드.md 매니페스트·명령어·흐름도·연결 점검 매트릭스(10장) 반영, 00_ReportIndex 갱신
- schema/input_form 주석 경로 및 js 모듈 헤더명 동기화. 스키마 entity name(ai_*)은 파일명과 분리 유지
Changed files: new_ver/** (전 파일 woo_*), docs/report/01_개발가이드.md, docs/report/00_ReportIndex.md, docs/log/log.md

5. 2026-07-31 개발 가이드 리포트 + new_ver 구현 스캐폴드 제작
Purpose: 통합 PRD를 실제 Adobe Campaign에 반영하기 위한 개발 가이드 작성과 경로별 구현 코드 스캐폴드 생성
Changes:
- docs/report/00_ReportIndex.md, 01_개발가이드.md 신규 (개발 순서 S1~S12, 배포 경로, 흐름도(mermaid), 명령어, 옵션/권한, 완료기준 매핑)
- new_ver/schema: srcSchema 4종(ai_sql/ai_fragment/ai_codemap/ai_request_queue)
- new_ver/input_form: 관리/조회 폼 4종(xtk:form)
- new_ver/js: 서버사이드 JS 라이브러리 8종(config/repository/codemap/fragments/llm/compiler/gates/workflow_io)
- new_ver/jssp: 엔드포인트 7종(_common/catalog/generate/count/validate/register/codemap_sync)
- new_ver/html: ai_studio.html + ai_studio.js (조건칩/퍼널/코드보기/등록)
- new_ver/workflow: 캔버스 버튼 주입 패치 + 커스텀 액티비티 계약 샘플
- 원칙: 브라우저 직접 LLM 호출/키 하드코딩/LLM 자유 SQL 생성 폐기, 제약 기반 생성으로 재구현. env 의존부는 TODO 표기
Changed files: docs/report/00_ReportIndex.md, docs/report/01_개발가이드.md, new_ver/** (schema/input_form/js/jssp/html/workflow), docs/log/log.md

4. 2026-07-31 통합 PRD codemap 수기부담 축소 확정 (raw 자동적재 / group 수기)
Purpose: ai_codemap 전량 수기 입력 우려 해소. 추천안을 단일 방향으로 확정하고 선택지 표현 제거
Changes:
- 6.4 Mapping 레이어: codemap을 raw(자동 적재)/group(수기)로 분리, 원시 코드는 Campaign enumeration·디멘션에서 배치 자동 적재 명시
- 7.4 ai_codemap 스키마: kind(raw/group)·source 속성 추가, 예시/해설 갱신
- 9장 결정 로그 D-7 추가, 10장 Phase 1에 raw 자동적재 배치 포함
Changed files: Rebuild/PRD.md, docs/log/log.md

3. 2026-07-31 통합 PRD 재작성 (v1+v2 병합, 제약 기반 생성 원칙)
Purpose: v1(자연어→SQL 직접 생성 초안)과 v2(fragment 기반 초안)를 하나의 온전한 PRD로 병합하고 Manual_add_Info(AI SQL 자유생성 금지, config/mapping 하드 세팅) 원칙을 1급 설계로 반영
Changes:
- Rebuild/ 폴더 신규 생성 후 통합 PRD 단일 문서(PRD.md) 작성
- 설계 원칙 '제약 기반 생성(Config/Mapping/Fragment 3레이어)' 신설, AI는 사전 세팅 값 안에서만 조립
- 신규 스키마 4종 정의(ai_sql / ai_fragment / ai_codemap / ai_request_queue) — 코드값 매핑 ai_codemap 추가(D-6)
- 검증 게이트 축소(G2 삭제·G1 축소, G3/G4/G5 유지), 미커버 방식 A(실패+큐), 결정 로그 D-1~D-6
- v1의 상세 서술(사용자 여정/용어집/쉬운 설명/전체 흐름) 유지, old_ver 관계 부록 포함
Changed files: Rebuild/PRD.md, docs/log/log.md

2. 2026-07-31 AI 대상자 추출 시스템 PRD 초안 작성 (fragment 기반)
Purpose: 이전 PRD 가안을 fragment 라이브러리 기반 조립 방식으로 전환하여 초안 PRD 신규 작성
Changes:
- docs/main/ 폴더 신규 생성 후 PRD.md 초안 작성
- 설계 전환 반영: AI가 SQL 직접 생성 대신 검증된 fragment 선택+파라미터 채움, IR→SQL 결정론적 컴파일
- 신규 스키마 3종 정의(uplus:ai_sql 이력 / uplus:ai_fragment 라이브러리 / uplus:ai_request_queue 미커버 큐)
- 검증 게이트 축소 반영(G2 삭제, G1 축소, G3/G4/G5 유지)
- 미커버 조건 처리 방식 A 확정(실패+요청 큐 적립), 화이트리스트 문서 폐기(D-1~D-5 결정 로그)
- Phase 재정의(fragment 방식이 MVP, LLM 자유생성 폴백은 Phase 2), old_ver 자산 관계 부록 추가
Changed files: docs/main/PRD.md, docs/log/log.md

1. 2026-07-31 old_ver 시스템 구조 분석 문서 작성
Purpose: old_ver 하위 코드 전수 분석 후 Adobe Campaign LLM 질의 생성기 구조를 문서화
Changes:
- old_ver/ 5개 파일(html 1, jssp 3, workflow xml 1) 전체 분석
- 시스템 아키텍처/데이터 흐름/의존성/보안 소견 정리한 ARCHITECTURE.md 신규 작성
Changed files: old_ver/ARCHITECTURE.md, docs/log/log.md
