# Report Index

`docs/report/` 하위 문서의 목록과 용도. 파일 생성·삭제 시 본 인덱스를 갱신한다.

| 파일 | 용도 |
|---|---|
| `00_ReportIndex.md` | 리포트 폴더 인덱스 (본 문서) |
| `10_Fragment_생애주기_설계.md` | Fragment 승인 모델 게이트→라벨 전환 설계 — 현행 enum 매핑 · 빈도 기반 검수 · 야간 게이트 재실행 · 킬스위치는 revoked 재사용 |
| `09_SQL생성추가_디버깅3.md` | F-0~F-5 반영 검증 후 잔여 C-1·E-1·E-2·A-1 — sanitize/compress 순서·phase 예산 누수·tokenBudget·자격 검증·스모크 9c |
| `08_SQL생성추가_디버깅2.md` | Foundry 생성 단계 근원 진단 F-0~F-5 — 출력 계약 부재·루프 종료 불일치·자가진단 알고리즘·dryRunSlot 계측기 |
| `07_SQL생성추가_디버깅1.md` | Pass0 `max_tokens` 소진 근원 해결 R-1~R-4 + LLM 계열 검수 L-1~L-3 — `json_object` 반복 루프·length 진단 강화·스모크 LLM 스텝·단계별 토큰 상한 |
| `06_SQL생성추가_추가5.md` | M-1~M-3 개정판 — 추가4 에 **방언 지원 정책**(PG 만 실동 검증) + 수정 D(미검증 DBMS 런타임 가드) · 수정 E(FDA 확장 주석) 추가. 번호 중복은 아래 참고 |
| `06_SQL생성추가_추가4.md` | 잔여 결함 M-1~M-3 — limitSelect 방언 조립(DISTINCT TOP 순서·파생 테이블 ORDER BY)·스모크 검출력(6a/6b 분리·전역 부재 메시지) |
| `05_SQL생성추가_추가3.md` | 신규 결함 N-1~N-6 + 스모크(S-1) — getIfExists 반환형·Schema toDocument·물리명 추정 금지·샘플 재현성·used_fragments 정확 비교 |
| `04_SQL생성추가_추가2.md` | 코드 점검 결함 수정 요청 P0~P2 (sqlSelect 규약·sql right·큐 선점·E4X 전환) |
| `03_SQL생성추가_추가1.md` | Feasibility Triage / 불가 보고 / GapLog (Foundry 보강) |
| `02_SQL생성추가.md` | Fragment Foundry 통합 스펙 (툴킷·dedup·생애주기·큐) |
| `01_개발가이드.md` | Test Woo 가이드 — 섹션1~7(7a soapCall·7b listSql 코드반영, 7d CA 남음), JSSP·ai_sql_id |

> **번호 중복 안내**: `06_…추가4` 와 `06_…추가5` 가 접두 번호를 공유한다(추가5 는 추가4 의 개정판).
> 명명 규칙(순번 접두)상 후자는 `07_` 이 되어야 하나, 문서 파일 개명은 요청 시에만 수행한다.

## 로컬 점검 도구 (`tools/`)

| 파일 | 용도 |
|---|---|
| `tools/checkRhinoSyntax.js` | ACC Rhino+E4X 구문 사전 점검 (괄호 균형 · E4X 보간 미종료) |
| `tools/checkDialectSql.js` | 방언 3종 생성 SQL 문자열 대조 (DB 접속 불필요 · M-1 회귀 방지) |

## 관련 상위 문서 (docs/ 및 프로젝트 루트)

| 파일 | 용도 |
|---|---|
| `docs/main/PRD.md` | **단일 PRD** (v1.6). 개발 가이드의 근거 문서. 구 `Rebuild/PRD.md` 이관·통합 |
| `docs/main/Info_mask.md` | Campaign/LLM 접속 설정 마스킹 샘플 (커밋 대상) |
| `docs/main/(민감)Info.md` | 실제 접속 정보 — **git 제외** |
| `old_ver/ARCHITECTURE.md` | 이전 프로토타입 구조 분석 (참고/재사용 근거) |
| `new_ver/` | 테스트 구현 스캐폴드. 파일/스키마/폼/sqltable `testWoo*` 카멜, ns `woo` |
