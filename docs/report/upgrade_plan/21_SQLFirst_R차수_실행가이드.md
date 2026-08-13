# SQL-First · R차수 실행 가이드 (#146R · 작업3)

> **단일 라우팅 문서**. INDEX 키 `R0`…`R8` / `PoC-S` / `SQLFirst` → 본 파일.  
> 기존 `01`~`11` 가이드는 삭제하지 않음([SUPERSEDED BY 19/20/21]).  
> 브랜치: 코드=feat · 문서≠코드 혼합 커밋 금지. R차수마다 독립 커밋.

선행 조사: `18_[완료]_PoC-S_SQLFirst타당성.md`  
여정 정본: `19_SQLFirst_여정정본.md`  
자산 판정: `20_전환_자산판정표.md`

---

## 라우팅 요약

| 키 | 별칭 | 코드? | 선행 | 한 줄 |
|---|---|---|---|---|
| **PoC-S** | #145R | 없음 | — | SQL-First 타당성 조사 (완료본=`18_[완료]_PoC-S_…`) |
| **R0** | 전환준비 | 문서/git | PoC-S | 조사 반영·브랜치·회귀 기준선 |
| **R1** | #147R 매칭승격 | 있음 | R0+#154 | **[S] 단독스킵·#154 흡수** (17 체크리스트) |
| **R2** | #148R 캐시 | 있음 | R1 + S8 | 미반영 SQL 보관. S8 HUMAN 대기면 중단 |
| **R3** | #149R 상태머신 | 있음 | R2 | ST0~ST6 |
| **R4** | #149R 셸 | 있음 | R3 | [등록]=SQL목록(WKF 불필요) · 브레드크럼 · v=160 |
| **R5** | 매핑재사용 | 있음 | R4 | ST3~ST5 API 연결 |
| **R6** | #150R 커밋 | 있음 | R5 | 락→주입→기록→해제 |
| **R7** | #151R 상대시점 | 있음 | R6 | relative/absolute · 복제 보조 |
| **R8** | #151R 정리 | 있음 | R7 | 큐 잔여물 · 폐기 잔재 · 회귀 |

R3/R4는 `#149R`로 묶여 있음 — 한 Chat에 둘 다 요청 시 INDEX “한 차수만” 규칙과 충돌하므로 **`R3` 먼저**, 다음 Chat `R4`.  
R7/R8도 `#151R` 묶음 — **`R7` 다음 `R8`**.

---

## R0 — 전환 준비

### 0. 실행 프롬프트
```
[#146R-R0 — 전환 준비 (문서·브랜치 · new_ver 기능 변경 금지)]
선행: 18_PoC-S 결론 (a)(b) 확인.
1) 13/14/15/98/추적표 열이 존재하는지만 검증. 누락 시 #146R 작업 재개.
2) feat/sql-first 계열 브랜치 권장 문구만 문서화(강제 checkout 금지 — 사용자 승인 후).
3) 회귀 기준선: litmus v= 현재값 · mode=dedup Match 동작 · embed=1 경로를
   docs/report/upgrade_plan/15 본 절 DoD에 체크리스트로 고정.
4) HUMAN_CONSOLE: S8 sessionStorage 확인 요청문을 사용자에게 출력하고 대기.
금지: new_ver 기능 패치. discover 임계 변경은 R1.
```

### 선행
- `18_[완료]_PoC-S_SQLFirst타당성.md` 존재 · (a)(b)=가능

### DoD
- [x] 13/14/15/98/추적표 “신규 차수 재배정” 열 존재
- [x] 기존 01~11에 SUPERSEDED 배너
- [x] INDEX에 R0~R8 라우팅
- [~] S8 HUMAN 체크리스트 문서화됨 · **운영자 회신 대기**

### 롤백
문서 커밋 revert. 코드 없음.

### HUMAN_CONSOLE
`18_PoC-S` S8 체크리스트 (documentMode · sessionStorage).

---

## R1 — 매칭 승격 (#147R)

### 0. 실행 프롬프트
사용자 메시지 `#147R` 블록 전문을 채택한다. 요약 금지 — Chat에서 해당 블록을 그대로 따른다.

핵심 DoD 앵커:
- `mode` 미지정 = 변경 전 dedup와 동일
- discover: containment 정렬 · Top-10 · intersection≥1 · 비율 임계 없음
- Q3/X11∩3 → containment 1.0 최상단; 역방향 하위; 교집합0 제외; 12건→10건
- 기존 jaccard 함수 삭제 금지. Spawn/ES6/95% 임계 금지

### 선행
R0 · `14`에서 Match=개조 확인

### DoD
`#147R` DoD 전부 + `/acc-verifier`

### 롤백
`testWooMatch.js` / `testWooAiMatch.jssp` 해당 커밋 revert

### HUMAN_CONSOLE
Match discover 샘플 3건 육안 (카드 문구 · Top-10)

---

## R2 — 캐시 계층 (#148R)

### 0. 실행 프롬프트
사용자 메시지 `#148R` 블록 전문 채택.

게이트: S8이 HUMAN_CONSOLE 대기면 **구현 중단**하고 사용자 확인 요청.

### 선행
R1 PASS + S8 결론(sessionStorage 가능/불가)

### DoD
- 미반영 SQL의 `saveAiSql` 경로 0
- 초기화/휘발/브레드크럼 유지 규칙 (`13` §3~4)
- localStorage 금지

### 롤백
캐시 모듈 커밋 revert · 안내 문구 제거

### HUMAN_CONSOLE
Reload 후 캐시 유지(sessionStorage 채택 시) 또는 소실 안내(전역 폴백 시)

---

## R3 — 상태머신 반전 (#149R 작업1~2)

### 0. 실행 프롬프트
`#149R` 중 상태머신·진입 화면·버전 동기화 부분. 셸 패널은 R4.

### 선행
R2

### DoD
- `ctx.phase` = ST0~ST6 (`19`) — **[x] repo v=157**
- 기존 goBack/resetCtx 스택 재사용 — **[x]**
- 최초 진입 입력 활성 (폴더 선지정 게이트 제거 · intent UI 폐기 · D-1) — **[x] repo**
- embed=1 회귀 — **배포 후 HUMAN**

### 롤백
StudioJs/html/Studio.jssp v=157 커밋 revert

### HUMAN_CONSOLE
Tools 진입 → 조건 즉시 입력 가능 · URL `v=157` · embed=1 NL 활성

---

## R4 — 셸 재구성 (#149R 작업3~7)

### 0. 실행 프롬프트
`#149R` 우측 단일 목록 · SQL 카드 · 브레드크럼 · 0건 · litmus v=

### 선행
R3

### DoD
- table+고정px · flex/grid/vh 금지
- 브레드크럼 `조건 > SQL > Program/Campaign/WKF` (48px)
- ST0 우측 = SQL 빈 패널(폴더 선로드 금지)
- **[등록]** WKF 없으면 SQL 목록(ST1/ST2) · `Register.jssp` 호출 금지 · “먼저 WKF…” 금지
- 0건 UI · “이 새 SQL로 진행 (프로그램 선택)” → ST3 (`loadAiFolders`)
- alert/confirm 금지
- litmus `v=160` (Studio.jssp + StudioJs + html 동기)

### 롤백
Studio.jssp + StudioJs 커밋 revert

### HUMAN_CONSOLE
Tools → 조건 [생성] → **[등록]** → 우측 SQL 목록(WKF 에러 없음) · “이 새 SQL로 진행” → Program 목록 · URL `v=160`

---

## R5 — 매핑 재사용

### 0. 실행 프롬프트
```
[#R5 — ST3~ST5 기존 API 연결]
선행: R4. 서버 신규 최소화.
ST3 listAiFolders / ST4 listCampaigns·createCampaign / ST5 listWkfs·createWkfFromTemplate
를 ST 전환에 연결. Context.jssp action 이름은 기존 유지.
분기 B 점프 후 ST5에서 WKF 변경 가능해야 함.
금지: Spawn · nodeModel · 신규 SOAP.
DoD: 신규 SQL 경로로 Program→Campaign→WKF까지 선택 완료 · 기존 SQL 점프 경로 1회.
```

### 선행
R4

### DoD
- ST3 `listAiFolders` · ST4 `listCampaigns`/`createCampaign` · ST5 **`listWkfs`** (Match OFF여도 WKF 목록)
- 캠페인 진입 시 SQL 유지 (`_clearComposeState` 금지)
- 분기 B: `listRegisteredSql` 기존(반영됨) 클릭 → Program/Campaign/WKF 점프 · ST5에서 WKF 변경 가능
- 유사/포함 단정 문구 금지 (Match OFF)
- litmus `v=161`
- HUMAN: 분기 A Program→Campaign→WKF 1회 · 분기 B 점프 1회

### 롤백
Context/StudioJs/Repository listRecent 커밋 revert

### HUMAN_CONSOLE
Tools `v=161` → [등록] → **이 새 SQL로 진행** → Program → Campaign → **WKF 목록** (SQL 좌측 유지) → WKF 선택 → `[등록]을 누르면 반영` 배너.
기존(반영됨) 항목 클릭 시 해당 WKF로 점프.

---

## R6 — 커밋 트랜잭션 (#150R)

### 0. 실행 프롬프트
사용자 메시지 `#150R` 블록 전문 채택.

S6 미확인이면 중단(현재 PoC-S는 **확인됨**: WKF별 신규 행).

### 선행
R5 · S6 결론

### DoD
- 커밋 순서 고정 · soft-fail로 반영 금지
- 실패 시 캐시 유지 · 부분 기록 0
- [다른 WKF에도 반영] → ST3
- Spawn 금지 · J-9-5-2 불가 유지

### 롤백
Register/Repository/WorkflowClone 관련 커밋 revert

### HUMAN_CONSOLE
반영 성공 1 · 락 점유 실패 1 · 덮어쓰기 2단계 클릭 1

---

## R7 — 상대시점 · 복제 보조 (#151R 작업1~2)

### 0. 실행 프롬프트
`#151R` 작업1~2. 용어 relative/absolute만. FormatDate 금지.

S11=리터럴 → fragment 규칙 개정 시도. 스키마 확장 필요 시 설계만 문서화 후 중단.

S12 미확인 Duplicate* → `createWkfFromTemplate` 폴백.

### 선행
R6

### DoD
배지 표시 · 복제 보조 또는 폴백 · Max15 배너

### 롤백
해당 커밋 revert

### HUMAN_CONSOLE
absolute 배지 육안 · (relative 구현 시) 재실행 대상 변화 설명 가능 여부

---

## R8 — 정리 · 회귀 (#151R 작업3~4)

### 0. 실행 프롬프트
`#151R` 작업3~4.  
`14` 폐기 항목 실제거 · 큐 잔여물 구현 또는 운영 절차 · SUPERSEDED vs 코드 대조 ·  
`/acc-id-tracer` · `/acc-verifier` · HUMAN_CONSOLE 자체 PASS 금지.

### 선행
R7

### DoD
- intent 잔재 0
- 큐 정책 문서 또는 코드
- 추적표 SF-* 커버
- 회귀: dedup · embed · #133 계열

### 롤백
정리 커밋 단위 revert (삭제 전 `_폐기` 규칙 준수)

### HUMAN_CONSOLE
풀 E2E 1회 (ST0→ST6) + 초기화 휘발 + 창 재오픈

---

## 공통 금지 (전 R)

- `fetch` / `Promise` / `confirm` / `alert` / ES6 / `flex`·`grid`·`vh`·CSS변수·`calc`
- `xtk:workflow#Spawn`
- FormatDate / GetDate in form scripts
- #133 / #135 / #137 / #141 회귀
- 문서 커밋과 `new_ver/` 코드 커밋 혼합
- 공식문서 미확인 API를 “가능”으로 판정
- 원본 아이디어 항목 삭제·병합·재번호 (추적표 ID)
