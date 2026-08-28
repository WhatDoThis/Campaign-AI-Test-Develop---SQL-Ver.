# Report Index

`docs/report/` 하위 문서 목록. upgrade_plan 통합(2026-08-26) 반영.

| 파일 | 용도 |
|---|---|
| `00_ReportIndex.md` | 본 인덱스 |
| `11_고도화_추적표.md` | 고도화 ID 전수 · 판정 · 구/신 차수 매핑 |
| `01_개발가이드.md` | Test Woo 배포·ACC 제약 |
| `10_Fragment_생애주기_설계.md` | Fragment 승인·게이트 설계 |
| `02`~`09_SQL생성추가*.md` | Foundry/Pass0/LLM 디버깅 이력 |

## upgrade_plan (`00`~`14`)

| 파일 | 용도 |
|---|---|
| `upgrade_plan/00_INDEX.md` | AI 라우팅 · 키→가이드 |
| `upgrade_plan/01_진행판.md` | **진행 단일본** |
| `upgrade_plan/02_[완료]_베이스라인_Studio진입.md` | 0~1차 · ACC 가드 · Tools/embed |
| `upgrade_plan/03_[완료]_Program캠페인_WKF생성.md` | Program→Campaign→WKF · clone/lock |
| `upgrade_plan/04_[완료]_Fragment_자동승인.md` | auto-active · dedup 필드 |
| `upgrade_plan/05_[완료]_조건_SQL등록_주입.md` | Match dedup · ShellBind |
| `upgrade_plan/06_[완료]_PoC_조사결론_반영.md` | PoC-M/S/V → 코드 반영 |
| `upgrade_plan/07_[완료]_임베딩_DedupL2.md` | #155 embed OFF · dedup L2 |
| `upgrade_plan/08_[완료]_운영회귀_SpanOrphan_StudioUX.md` | Span · Orphan · Studio UX |
| `upgrade_plan/09_[완료]_SQLFirst_셸_여정.md` | ST0~ST6 · R0~R8 |
| `upgrade_plan/10_[완료]_추출_파이프라인_164-174.md` | #164~#174 EN-Pivot |
| `upgrade_plan/11_[완료]_값확장_프롬프트_상용UX.md` | #175 · #176 · UX-ST |
| `upgrade_plan/12_[완료]_배포정합_완료선.md` | #160/161 · 완료선 · R8 |
| `upgrade_plan/13_미구현_Match_임bedding_HUMAN.md` | C1~C6 · Match/embed ON · HUMAN |
| `upgrade_plan/14_미구현_DEFERRED_로드맵.md` | #178 · S-1 · 금지·선택 |
| `upgrade_plan/[별도]_고도화_개발아이디어_관리자작성본.md` | 관리자 원문 (삭제 금지) |

> **구 16~44번** 개별 가이드는 2026-08-26 통합으로 **`02`~`14`에 흡수·삭제**됨.  
> ID·판정 원본은 `11_고도화_추적표.md` 유지.

## tools/

| 파일 | 용도 |
|---|---|
| `tools/checkRhinoSyntax.js` | Rhino+E4X 구문 점검 |
| `tools/checkDialectSql.js` | 방언 SQL 문자열 대조 |

## docs/main/

| 파일 | 용도 |
|---|---|
| `docs/main/PRD.md` | 단일 PRD |
| `docs/main/Info_mask.md` | 설정 마스킹 샘플 |
| `docs/main/(민감)Info.md` | 실제 접속 — git 제외 |
