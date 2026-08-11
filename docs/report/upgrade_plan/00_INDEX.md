# 고도화 로드맵 INDEX (for AI) — 단일 진입점

이 파일만 `@`로 지정하고 사용자가 **차수명만** 말하면, Agent는 아래 표에서 가이드를 찾아 **스스로 읽고 그 차수만** 진행한다.  
사람용 설명서가 아니라 **Chat 라우팅 + 실행 프로토콜**이다.

---

## 0. 사용자 입력 → Agent 동작 (필수)

사용자가 예: `@docs/report/upgrade_plan/00_INDEX.md` + `PoC-0 진행` / `2차` / `5차 해줘` 라고 하면:

1. **이 INDEX를 전부 읽는다.**
2. 아래 [§2 차수 라우팅표]에서 해당 행의 **가이드 경로**를 연다 (`Read` 필수 — 추측 금지).
3. 동시에 [§1 공통 필수 문서]를 순서대로 읽는다.
4. 가이드 파일 상단 `## 0. 실행 프롬프트` 블록을 이번 Chat의 작업 지시로 채택한다.
5. 가이드의 선행조건이 미충족이면 **구현하지 말고** 막힌 선행(예: PoC-0 RESULT)만 안내하고 중단한다.
6. Plan 모드로 `docs/plan/<차수>_plan.md`에 계획을 저장한 뒤 구현한다 (PoC·문서전용 차수는 plan 생략 가능, 가이드 지시 우선).
7. 코드 변경 후 `/acc-id-tracer` + `/acc-verifier` (또는 동등 자체검증)로 종료 게이트를 통과한다.
8. `## HUMAN_CONSOLE` 항목은 **절대 PASS로 자체 완료 처리하지 않는다.** 대기 체크리스트로 남기고 사용자에게 콘솔 작업을 요청한다.

### 별칭 해석

| 사용자가 말한 것 | 라우팅 키 |
|---|---|
| PoC-0, 피오씨0, 0-pre, navtree PoC | **PoC-0** |
| 0차, 제로차, 베이스라인 | **0차** |
| 1차 … 9차 | 동일 숫자 차수 |
| PoC, 3a, PoC-1~3, 워크플로우 PoC | **PoC-1~3** (같은 파일, PoC-0과 섹션 구분) |
| 폐기, 정리, cleanup | **9차** |
| 테스트, 반영테스트, 캠페인테스트, TG-n, 게이트n | **§8 테스트 게이트** (구현 Chat 종료 시 자동 제공 · 또는 단독 요청) |
| 배포, 재배포, 배포목록, deploy | **§3.5 배포/재배포 목록** (해당 차수·TG 기준 표 출력, 코드 변경 없음) |

한 Chat에 차수 여러 개를 요청하면 **거절**하고 한 개만 다시 말하게 한다.  
`테스트`만 요청하면: 사용자가 명시한 게이트(예: `TG-C`) 또는 **마지막으로 HUMAN PASS한 차수**에 해당하는 §8 게이트 가이드를 출력한다(코드 변경 없음).

---

## 1. 공통 필수 문서 (매 Chat · 차수 가이드 읽기 직전)

| 순서 | 경로 | 왜 |
|---|---|---|
| 1 | 본 파일 `00_INDEX.md` | 라우팅·프로토콜 |
| 2 | 해당 차수 가이드 (§2 표) | 단독 완결 지시서 |
| 3 | `docs/report/11_고도화_추적표.md` | 커버 ID · 판정 · 유실 방지 |
| 4 | `.cursor/rules/00-acc-guardrails.mdc` | 절대 금지 |
| 5 | `docs/log/log.md` 최신 10건 Index | 최근 회귀·버전 |
| 6 | (권장) `docs/report/upgrade_plan/00_고도화 개발 아이디어_관리자 작성본.md` | 원문 대조 |

가이드가 “다른 차수 문서를 읽지 말라”고 하면 **다른 차수 md는 열지 않는다.** 선행 충족 여부만 INDEX·추적표·PoC RESULT로 확인한다.

---

## 2. 차수 라우팅표 (찾아갈 파일)

경로 루트: `docs/report/upgrade_plan/`

| 키 | 가이드 파일 | 코드? | 선행(막히면 중단) | 한 줄 고유 지시 |
|---|---|---|---|---|
| **PoC-0** | `04_3a_PoC.md` → 섹션 **PoC-0** | 없음 | — | navtree Tools URL뷰 실측. RESULT 기입. 1차 전 필수 |
| **0차** | `01_0차_베이스라인안정화.md` | 검증 위주 | `git diff main -- new_ver/` 비어 있음 | #141 베이스라인. 신규 기능 금지 |
| **1차** | `02_1차_진입점과셸.md` | 있음 | **PoC-0 RESULT** | Tools 진입(분기) + 3분할 셸 더미 |
| **2차** | `03_2차_상태머신과캠페인폴더.md` | 있음 | 1차 PASS | NONE→FOLDER. `@isAiFolder`. nodeModel 금지 |
| **PoC-1~3** | `04_3a_PoC.md` → PoC-1·2·3 | 없음 | 0차(권장 2차) | open / 클론 / lockedBy. RESULT. 3차 전 |
| **3차** | `05_3차_WKF라이프사이클.md` | 있음 | PoC-1~3 RESULT + 2차 | **Spawn 금지**. 클론·잠금·열기 |
| **4차** | `06_4차_Fragment자동승인.md` | 있음 | 0차 (UI 선행 불요) | Studio UI 미변경. active 자동. navtree 주석 정합 |
| **5차** | `07_5차_조건매칭과SQL목록.md` | 있음 | 3차+4차 | Jaccard **0.9**. 95% 텍스트유사도 금지 |
| **6차** | `08_6차_SQL주입과등록.md` | 있음 | 5차 | SQL **본문**+ai-sql-id. J-9-5-2 구현 금지. 2단계 클릭 |
| **7차** | `09_7차_중복Fragment관리.md` | 있음 | 4차 | JSSP 신규 금지. navtree list+삭제 |
| **8차** | `10_8차_확장폼폐기.md` | 있음 | 6차+**6개월** 안정 | embed 제거. UI-1-2 완결 |
| **9차** | `11_9차_미사용코드폐기정리.md` | 있음 | 8차+E2E 안정 | `_폐기` 개명 → **콘솔 삭제** |

### 병렬 허용

- **4차** ↔ 1~3차 동시 가능 (별 Chat)
- **7차** ↔ 5~6차 동시 가능 (별 Chat)
- 그 외는 표의 선행 순서 엄수

---

## 3. 새 Chat 진행 프로토콜 (상세)

### 3.0 운영자 응답 계약 (필수 · 전 Chat)

운영자는 **코드/diff 리뷰를 하지 않는다.** Agent가 가이드·`git diff`·가드레일 기준으로 반영 내용을 **스스로 재검토**한 뒤, 사용자에게는 아래만 전달한다.

| # | 전달 | 설명 |
|---|---|---|
| 1 | **§3.5 배포/재배포 목록** | 콘솔에 올릴 경로·조치·순서만 (추측 금지) |
| 2 | **§8 HUMAN 테스트 가이드** | 해당 게이트 전문(배포표+테스트 체크리스트+회신 형식). 없으면 “다음 게이트: TG-x” 한 줄 |
| 3 | **다음 개발** | 라우팅 키만 (예: `PoC-0 진행` / `1차` / `4차`). 장문 로드맵 재설명 금지 |

금지(운영자 응답에서): 파일별 코드 설명·정적 스캔 증거 나열·장문 DoD 기술 근거.  
예외: 사용자가 “코드/원인 설명해”라고 **명시 요청**할 때만.  
시작 체크리스트(§3.1) 4줄은 유지해도 된다.

### 3.1 시작 체크리스트 (Agent가 메시지 첫머리에 요약)

```
차수: <키>
가이드: <경로>
선행: PASS | BLOCKED(<무엇>)
모드: PoC(문서만) | 구현 | 검증만
```

`BLOCKED`면 코드/문서 변경 없이 사용자에게 선행만 요청하고 종료한다.

### 3.2 구현 중

- 가이드 §커버 ID를 빠짐없이 다룰 것 (`11_고도화_추적표.md` 대조).
- `.cursor/rules/00-acc-guardrails.mdc` 위반 설계·코드 금지.
- `new_ver/` 변경 시 관련 skill 적용:  
  - jssp/html → `acc-jssp-ie-safe`  
  - input_form → `acc-input-form`  
  - schema/js → `acc-schema-soap`
- 문서 커밋과 `new_ver/` 코드 커밋을 **섞지 말 것**.
- 후속 수정 프롬프트가 **3회를 넘으면** 추가 땜질 금지 → 변경 revert → plan 재작성.

### 3.3 종료 체크리스트

1. (내부) 가이드 §DoD·가드레일·ID 커버를 Agent가 자체 판정 — **운영자 응답에는 §3.0만**  
2. `/acc-id-tracer` — 커버 ID 누락 0  
3. `/acc-verifier` — 가드레일 위반 0  
4. **§3.5 배포/재배포 목록 필수 출력** — 빠지면 종료 FAIL (PoC·문서만 변경이면 “콘솔 배포 대상 없음” + 근거 1줄)  
5. **§8 테스트 게이트** 전문 또는 “다음 게이트: TG-x”  
6. `docs/log/log.md`에 차수 완료 로그 (번호 규칙: 기존 최신+1, 임의 증가 금지) — 사용자/가이드가 로그를 요구하거나 파일 변경이 있을 때  
7. **다음 개발** 라우팅 키 한 줄 (§3.0-3)

### 3.4 사용자가 할 일 (Agent가 매 종료 시 상기)

- **§3.5 배포 목록**대로 콘솔에 신규 등록 또는 덮어쓰기  
- §8 테스트 체크리스트 수행  
- 결과를 Chat에 `N차 HUMAN: PASS|FAIL + 메모` / `TG-x HUMAN: PASS|FAIL` 로 회신  
- 다음 Chat: `@00_INDEX.md` + Agent가 알려준 **다음 개발** 키만 입력

### 3.5 배포/재배포 목록 (매 구현 Chat 필수)

코드·스키마·폼·JSSP·navtree·WF 패치가 **하나라도** 바뀌면, 종료 응답에 아래 표를 **반드시** 넣는다.  
근거는 `git diff` / 가이드 §변경 파일 — **추측으로 파일명을 채우지 말 것.**

#### 출력 템플릿 (그대로 사용)

```
## 캠페인 배포/재배포 목록 — <차수 또는 TG-ID>

배포 순서(고정): schema → JS library → form/navtree → JSSP → (WF patch) → 클라이언트 재시작/캐시 클리어 → v= 확인

| # | repo 경로 | ACC 콘솔 위치(등록명) | 조치 | 비고 |
|---|---|---|---|---|
| 1 | new_ver/schema/....xml | Data schemas / woo:… | 신규등록 \| 덮어쓰기 \| 삭제 | Update database structure: Y/N |
| 2 | new_ver/js/....js | JavaScript codes / … | 신규등록 \| 덮어쓰기 | loadLibrary 의존 … |
| 3 | new_ver/input_form/....xml | Input forms / woo:… | 신규등록 \| 덮어쓰기 \| 연결해제 | |
| 4 | new_ver/navtree/....xml | Navigation hierarchies / woo:… | 덮어쓰기 | URL 치환 |
| 5 | new_ver/jssp/....jssp | JSSP /woo/….jssp | 덮어쓰기 | v= |
| 6 | new_ver/html/....js | (JSSP와 동기·또는 정적) | 덮어쓰기/동기확인 | StudioJs와 동일본 |
| 7 | new_ver/workflow/....xml | WF form patch 등 | 적용\|역패치\|삭제 | |

미배포(의도적): <경로> — 이유
Option/권한 추가: <name> — 신규|수정
```

#### 조치 값 정의

| 조치 | 의미 |
|---|---|
| **신규등록** | 콘솔에 없는 객체 — Create/Import 후 저장 |
| **덮어쓰기** | 기존 객체 내용을 repo 파일로 교체(재배포) |
| **연결해제** | 폼/버튼/ref만 제거, 파일은 나중에 `_폐기` |
| **삭제** | 콘솔 객체 제거 (9차·확정분만) |
| **적용/역패치** | xtk:workflow 등 코어 폼 패치 |
| **DB구조갱신** | schema 필드 추가 시 Tools > Update database structure (표 비고에 Y) |

#### 규칙

- html `testWooAiStudio.js`는 **콘솔 배포 대상 아님**(repo 동기본). 런타임은 `testWooAiStudioJs.jssp`만 덮어쓰기. 표에 html을 넣을 때는 조치=`동기확인(콘솔X)`  

- schema 변경 시 같은 행 또는 다음 행에 **Update database structure Y/N**  
- “관련 파일 전부 재배포” 같은 뭉 tung 문구 **금지** — 경로 단위로만  
- 배포 목록 없이 “콘솔에 올려주세요”만 쓰면 **프로토콜 위반**

---

## 4. 절대 금지 (INDEX 요약 · 전문은 가드레일)

- `fetch` / `Promise` / `confirm` / `alert` / ES6 / `flex`·`grid`·`vh`·CSS변수·`calc`
- `xtk:workflow#Spawn` (WKF 생성·클론에 사용 금지)
- 템플릿 실파일명 `old_ver/workflow/tamplate.xml` 을 `template.xml`로 “교정” 금지
- navtree `view`/`viewType`: PoC-0 PASS 전에는 공식 경로로 의존 금지 (FAIL 시 `form=` 런처)
- J-9-5-2 (열린 WKF 창 실시간 반영) 구현 금지
- FLOW-5-3을 텍스트 95% 유사도로 구현 금지 → Jaccard ≥ 0.9
- #133 / #135 / #137 / #141 되돌리기 금지
- 문서 브랜치에 무관 `new_ver` 혼입 커밋 금지 (`fix/embed-layout`은 0차 DoD 전 병합 금지)

---

## 5. 운영자 확정 (전 차수 유효)

- **UI-3-2**: folder `@isAiFolder` 확장 (prefix `AI_Folder*` 매칭 금지)
- **J-9-5-2**: 구현 불가 — 6차에 경량 언급만
- **INJ-8-2**: SQL 코드편집기 **본문 반영 승인** (2026-08-11). registered SQL만 주입 + `ai-sql-id` 병행
- **브랜치**: 로드맵 문서는 `docs/roadmap-v2` 계열. 구현 시 차수 브랜치 분리 권장

---

## 6. 권장 착수 순서 (한눈에)

```
PoC-0 → 0차 → 1차 → 2차 → PoC-1~3 → 3차
                ↘ 4차(병렬) ↗
                              → 5차 → 6차
                         7차(4차 후, 5~6과 병렬 가능)
                                    → 8차(6개월) → 9차
```

**테스트 게이트 위치(요약)**

```
PoC-0 ──TG-A──► 0차 ──TG-B──► 1차+2차 ──TG-C──► 3차(+PoC) ──TG-D──►
4차 ──TG-E──► 5차 ──TG-F──► 6차 ──TG-G(풀E2E)──► 7차 ──TG-H──►
8차 ──TG-I──► 9차 ──TG-J──► 종료
```

**지금 기본 시작점**: 새 Chat에서 `@00_INDEX.md` + `PoC-0 진행`

---

## 8. 캠페인 반영·테스트 게이트 (필수)

구현만 하고 콘솔에 안 올리면 다음 차가 거짓 PASS가 된다.  
아래 게이트는 **그 차수(들) 완료 + HUMAN_CONSOLE 배포 후**에만 “테스트 진행 가능”이다.

### 8.0 Agent 출력 규칙

차수 Chat 종료 시 또는 사용자가 `TG-C 테스트` / `테스트` / `배포 목록`이라고 하면, 해당 게이트를 아래 형식으로 **전문 출력**한다(요약만 하고 끝내지 말 것).

```
## 캠페인 반영·테스트 가이드 — <TG-ID> <제목>
완료 조건: ...

### 배포/재배포 목록 (필수 · §3.5 표)
| # | repo 경로 | ACC 콘솔 위치 | 조치(신규/덮어쓰기/…) | 비고 |
|---|---|---|---|---|
| … | … | … | … | … |

### 반영(배포) 순서
1. schema → 2. JS → 3. form/navtree → 4. JSSP → 5. 캐시 클리어 → 6. v=

### 테스트 목록
- [ ] ...
### 실패 시
- ...
### 회신 형식
TG-x HUMAN: PASS|FAIL — <메모>
```

공통 배포 순서: **schema → JS library → form/navtree → JSSP** → 클라이언트 재시작/캐시 클리어 → `v=` 리트머스.  
**배포 목록 표가 없는 테스트 가이드는 무효** — 다시 출력한다.

### 8.1 게이트 총괄표

| ID | 진행 가능 시점 | 무엇을 검증 | 다음 차 착수 조건 |
|---|---|---|---|
| **TG-A** | **PoC-0** RESULT 후 | Tools 메뉴→Studio 진입 | 1차 전 필수 |
| **TG-B** | **0차** HUMAN 후 | 기존 embed 흰화면·#141 회귀 | 1차 전 권장 |
| **TG-C** | **1차+2차** 완료 후 | Tools 셸·폴더 선택·입력 활성 | 3차 UI 의존 |
| **TG-D** | **PoC-1~3 + 3차** 완료 후 | WKF 클론·잠금·열기 (Spawn 없음) | 5차 전 필수 |
| **TG-E** | **4차** 완료 후 (1~3과 병렬 가능) | frag 자동 active·승인 없이 SQL 경로 | 5차 전 필수 |
| **TG-F** | **5차** 완료 후 (TG-D+E 이후) | 경로 A/B·Jaccard·SQL 목록·중복해시 | 6차 전 필수 |
| **TG-G** | **6차** 완료 후 | **풀 E2E**: 등록→본문+ID→재오픈→열기 | 운영 후보 / 8차 안정기간 시작 |
| **TG-H** | **7차** 완료 후 | Dedup 목록·삭제 | 운영 병행 |
| **TG-I** | **8차** 완료 후 | Tools-only · embed 버튼 제거 | 9차 전 |
| **TG-J** | **9차** 완료 후 | `_폐기`·콘솔 잔존 0 · E2E 유지 | 로드맵 종료 |

### 8.2 게이트별 반영·테스트 목록

#### TG-A — PoC-0 후 (진입 가능 여부)

**완료 후**: PoC-0 RESULT 기입  
**반영**: `woo:testWooAiNav` navtree 등록 · `__CAMPAIGN_SERVER_URL__` 치환  
**테스트 목록**

- [ ] Tools에 Studio 메뉴가 보인다
- [ ] 클릭 시 JSSP가 렌더된다(제목 가시)
- [ ] FAIL이면 1차는 `form=` 런처 분기로만 설계

#### TG-B — 0차 후 (베이스라인)

**완료 후**: 0차  
**반영**: form/JSSP 변경 시 schema→js→form→JSSP (변경분만)  
**테스트 목록**

- [ ] WF → AI Studio → 흰화면 아님
- [ ] URL에 `v=` 보임
- [ ] Reload/Apply 행 좌측 거대 공백 없음(#141)
- [ ] `fetch`/`Promise` 클라이언트 잔존 0

#### TG-C — 1~2차 후 (셸·캠페인 폴더) ★첫 고도화 UI 게이트

**완료 후**: 1차 + 2차  
**반영**: navtree(rights) · Studio JSSP/JS · folder 확장 schema(`@isAiFolder`) · list API · **Update database structure** · AI 폴더 2개에 플래그 ON  
**테스트 목록**

- [ ] Tools(또는 런처)로 Studio 열림 · 정보바·좌AI·우목록 골격
- [ ] 최초 진입: NL 입력 **disabled** + 안내 div
- [ ] `@isAiFolder=1` 폴더만 목록 · 플래그 0은 없음
- [ ] 폴더 선택 → 정보바에 Label/InternalName · 입력 활성
- [ ] 뒤로가기/초기화 동작
- [ ] “새 캠페인” 버튼 없음
- [ ] 기존 WF embed 회귀(아직 존치)

#### TG-D — PoC-1~3 + 3차 후 (WKF 라이프사이클) ★사용자 예시(0~3)에 해당

**완료 후**: PoC-1~3 RESULT + 3차 (실질적으로 0~3 UI 축 완료)  
**반영**: 템플릿 WF+Option · Clone/Lock API·JS · (PoC-3 분기) `testWooWorkflowExt` 또는 `testWooAiWkfLock` · Studio UI · 기술 WF 재시작(해당 시)  
**테스트 목록**

- [ ] 목록 첫 행 “새 WKF” → 생성 → 정보바 name/label
- [ ] 생성 WKF **실행 중 아님**(중지) · Spawn 미사용
- [ ] 템플릿 액티비티 보존(콘솔에서 열어 확인)
- [ ] 계정 B로 잠금 WKF 선택 차단+안내
- [ ] 열기 버튼: PoC-1 경로 또는 폴백 문구대로 동작
- [ ] 폴더 전체 WKF 나열이 아님(매칭 전이라 플레이스홀더/생성 위주여도 OK — 전체 스캔이면 FAIL)

#### TG-E — 4차 후 (Fragment 자동승인 · 백엔드)

**완료 후**: 4차 (UI 차수와 별 Chat 가능)  
**반영**: Foundry/Lifecycle/Repository/Fragments JS · navtree Fragments sysFilter 주석 정합 · Foundry WF 재시작  
**테스트 목록**

- [ ] 신규 Foundry frag `@status=active`, `@active=true`
- [ ] 사람 승인 없이 Generate→SQL 진행
- [ ] near가 awaiting_approval에 안 남음
- [ ] 킬스위치 OFF 시 안전 동작(또는 문서화된 fail)
- [ ] Studio 파일 diff 없음(4차 범위)

#### TG-F — 5차 후 (조건 매칭·SQL 목록)

**완료 후**: 5차 (= TG-D+E 만족 후)  
**반영**: Match/Register API·JS · Studio  
**테스트 목록**

- [ ] 경로 A: 새 WKF → NL → SQL이 해당 WKF 목록에 추가
- [ ] 경로 B: NL → 유사 WKF(겹침/Jaccard 표시) → 선택 → SQL 목록
- [ ] 임계 미만 제외(또는 문서화된 하위 섹션)
- [ ] 동일 SQL 재등록 시 새 ID 없음 + 안내 div
- [ ] 새 WKF SQL 목록 초기 상태 = 빈 목록
- [ ] 정보바에 SQL ID 표시
- [ ] 코드에 텍스트 “95%” 유사도 로직 없음

#### TG-G — 6차 후 (풀 E2E · 운영 후보) ★핵심 게이트

**완료 후**: 6차  
**반영**: WorkflowUi Inject · schema · Register/Studio · 계약 XML 개정 · (xpath HUMAN 확정)  
**테스트 목록**

- [ ] SQL 선택→등록 → WKF **닫았다 재오픈** → 편집기에 **SQL 본문** 보임
- [ ] `ai-sql-id`도 저장됨
- [ ] 빈 액티비티 1클릭 / 기존 내용 2단계 클릭만 덮어쓰기
- [ ] 등록 전 열기 disabled · 등록 후 enabled
- [ ] 잠금 WKF 등록 거부
- [ ] 백업 스냅샷 ≥1
- [ ] 열린 창 실시간 반영 시도 없음(J-9-5-2)

#### TG-H — 7차 후 (중복 관리)

**완료 후**: 7차  
**반영**: navtree Dedup node · (필요 시) fragment form  
**테스트 목록**

- [ ] Explorer에 Dedup 노드 · 후보만 필터
- [ ] 삭제(또는 revoked) 1건 성공
- [ ] 신규 JSSP 파일 없음
- [ ] Stage A에서 삭제분 제외

#### TG-I — 8차 후 (Tools-only)

**완료 후**: 8차 (+6개월 증빙)  
**반영**: embed 역패치 · tag `pre-8차-embed`  
**테스트 목록**

- [ ] WF 툴바에 AI Studio 버튼 없음
- [ ] Tools → Studio로 TG-G 수준 E2E 통과
- [ ] 롤백 리허설 1회(스테이징)

#### TG-J — 9차 후 (폐기 정리)

**완료 후**: 9차  
**반영**: `_폐기` 개명분 콘솔 삭제 · tag `pre-9차-cleanup`  
**테스트 목록**

- [ ] 폐기목록 확정 행 ↔ `_폐기` 파일 1:1
- [ ] 콘솔에 구 객체 잔존 없음(HUMAN 확인)
- [ ] Tools Studio E2E 유지
- [ ] 구 basename `rg` 0(목록/로그 제외)

### 8.3 권장 묶음 (사용자가 “언제 반영?” 물을 때)

| 묶음 | 포함 | 한 줄 |
|---|---|---|
| 최소 진입 | TG-A → TG-B | Tools/embed가 살아있는지만 |
| **UI 중간 점검** | **TG-C** (1~2차 후) | 폴더 선택까지 콘솔 검증 |
| **WKF 중간 점검** | **TG-D** (≈0~3차 축) | 클론·잠금·열기 |
| 백엔드 병행 | TG-E (4차) | 자동승인 — UI와 별도 배포 가능 |
| 매칭 | TG-F (5차) | 경로 A/B |
| **출시 직전** | **TG-G** (6차) | 본문 주입 풀 E2E |
| 운영 마감 | TG-H → TG-I → TG-J | 관리·폐기·청소 |

---

## 9. 관련 경로 빠른 참조

| 용도 | 경로 |
|---|---|
| 추적표 | `docs/report/11_고도화_추적표.md` |
| 가드레일 | `.cursor/rules/00-acc-guardrails.mdc` |
| 검증 Agent | `.cursor/agents/acc-verifier.md` |
| ID 추적 | `.cursor/agents/acc-id-tracer.md` |
| PoC RESULT 기입 | `04_3a_PoC.md` 하단 RESULT 표 |
| 9차 폐기 실측표 | `11_9차_폐기목록.md` (9차 착수 시 생성) |
| Plan 저장 | `docs/plan/<차수>_plan.md` |
| 캠페인 테스트 게이트 | 본 파일 **§8** (`TG-A`…`TG-J`) |
| 배포/재배포 목록 | 본 파일 **§3.5** (매 구현 종료·TG 가이드 필수) |
