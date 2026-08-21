# #164 P0 — Foundry 슬롯 삼킴 (색인 오염 · AND 커버리지 · 큐 이어달리기)

> 사고/패치 기록. AI가 HUMAN 검증을 PASS로 자체 처리하지 않음.  
> **#174 영향:** `[x]` **유지**. AND 게이트·큐 이어달리기는 EN과 독립. 추출 좌표계 변경으로 재개하지 않음.

---

## 1. 증상

- 큐 **1건당 fragment 1건**만 생성되고 종료된다.
- Studio에 **"5분 대기"** 화면이 반복된다.
- 조건 N개 NL을 넣으면 큐가 N회 생기거나, 사용자가 조건을 다시 입력해야 한다.

---

## 2. 재현 경로

1. 큐 테이블을 비운다.
2. Studio에 다음을 **1회** 입력한다:  
   `서울에 사는 Y요금제 사용하는 20대 여성 고객`
3. Foundry 배치를 1회 실행한다.
4. (버그 시) fragment 1건만 생기고 나머지 슬롯이 pending에서 사라지거나 `needs_human_design`으로 끝난다.

---

## 3. 원인 — 2단 결합

### (a) `_fragDocFromLlm` 의 `nlText` 색인 주입

신규 fragment의 `sample_questions` / `synonyms`에 **요청문 전체(`nlText`)** 를 넣었다.  
그 결과 "서울 거주" fragment 색인에 `y요금제`, `20대`, `여성` 등 형제 슬롯 토큰이 들어갔다.

```javascript
// 버그 당시 (요약)
if (_trim(nlText) && String(nlText) !== String(slotText))
  samples.push(String(nlText));
var synTok = _stageATokens(slotText, nlText);
```

### (b) `_resolveRemainingBySearch` 의 무조건 `cands[0]` 채택

Stage A LIKE **부분 히트**만으로 `cands[0]`을 재사용으로 확정하고 pending에서 제거했다.  
(a)로 오염된 색인에 형제 슬롯이 전부 걸려 while 루프가 조기 종료된다.

```javascript
// 버그 당시 (요약)
if (!cands.length) { stillMissing.push(pending[k]); continue; }
resolved++; // 커버 검증 없음
```

---

## 4. 왜 #206 에서 생겼나

#206은 Foundry 완료 후 Studio가 SQL로 못 가고 대기로 되돌아가던 **재큐잉 루프**를 막기 위해,  
Stage A가 신규 fragment를 바로 잡도록 `sample_questions`·`synonyms`에 슬롯/**NL** 토큰을 기록하고  
publish 후 잔여 슬롯을 Stage A로 resolve 하도록 했다.  
그 패치가 **색인에 NL 전체를 넣는 부작용**을 남겼고, resolve 경로에 커버 게이트가 없어 슬롯 삼킴으로 결합됐다.

---

## 5. 조치

| 커밋 | 해시 | 내용 |
|---|---|---|
| #164-A | `e7dab7f` | 색인=자기 슬롯만 · `_coversSlot` AND 게이트 · 부분 히트는 pending 유지 |
| #164-B | `09e75c9` | `maxNewFragments=10` · `tokenBudget=200000` · `totalCallBudget=384` · created>0 시 `queued` 이어달리기 |

- 대상 코드: `new_ver/js/testWooFoundry.js`, `new_ver/js/testWooEnv.js`
- litmus/`__v` bump는 별도 지시 후 (본 문서 작성 시점에 임의 미실시)

---

## 6. HUMAN_CONSOLE — 배포 목록 + 단계별 검증

> **AI는 이 절을 PASS 처리하지 않는다.** 운영자만 체크.  
> 배포 방식 출처: `docs/report/01_개발가이드.md` G§3 (JavaScript codes) · 섹션 6 (Foundry WF).  
> #161 전체 재배포와 겹치면 `28_배포정합_진단.md` §3을 먼저 보고, 아래 **#164 필수 2종**은 반드시 포함.

### 6-0. 시작 전 알아둘 것

| 항목 | 내용 |
|---|---|
| 이번 repo 변경 | `testWooFoundry.js` (#164-A+B) · `testWooEnv.js` (#164-B만) |
| 커밋 | A=`e7dab7f` · B=`09e75c9` · 문서=`681c23d` |
| litmus/`__v` | **아직 159 유지** (bump 미지시). 화면 `libs: …=159` 만으로는 **#164 코드 반영 여부를 증명할 수 없다** |
| 반영 증명 | 아래 **V4 synonyms 오염 없음**이 리트머스. Env는 스모크 `9c`의 total 분모가 **384**인지로 보조 확인 |
| 스키마/JSSP | #164는 JS lib만 변경 — **스키마·JSSP 재배포 불필요**(단, #161이 아직이면 JSSP는 28 문서대로) |
| 오염 잔여 | 예전에 잘못 생성된 fragment는 DB에 남을 수 있음 → V2 전에 **테스트용 Foundry fragment를 비우거나 name으로 구분**할 것 |

### 6-1. 배포 목록 (콘솔 재등록)

경로: `Administration > Configuration > JavaScript codes`  
각 항목: 로컬 `new_ver/js/<파일>` 본문 **전체 복사** → 콘솔 동명 Code에 붙여넣기 → **Save**.  
`namespace=woo`, 이름 문자열은 `loadLibrary("woo:…")` 와 **一字 일치**.

#### A. #164 필수 (이번 패치 본체 — 빠지면 검증 무의미)

| 순서 | Campaign 이름 | 로컬 파일 | 왜 필수인가 | 배포 후 눈으로 확인할 문자열(본문 검색) |
|---|---|---|---|---|
| 1 | `woo:testWooEnv.js` | `testWooEnv.js` | 상한 10·토큰 20만·toolkit 384 | `maxNewFragments: 10` · `tokenBudget: 200000` · `totalCallBudget: 384` |
| 2 | `woo:testWooFoundry.js` | `testWooFoundry.js` | 색인 오염 차단 + AND 게이트 + 큐 이어달리기 | `[#164 P0]` · `function _coversSlot` · `reason: "continued"` |

> Env를 안 올리면 Foundry는 옛 `maxNew=3` / `totalCallBudget=132`로 돌아간다.  
> Foundry만 올리고 Env를 안 올리면 슬롯 삼킴은 고쳐져도 **4번째 슬롯부터 또 막힐 수 있다**.

#### B. #161 잔여(배너에 이름이 남은 모듈만) — 불일치 0 만들 때

`28` §3 B그룹 8종. Studio 진단 `libs:` / 상단 배너에 **이름이 나온 것만** 재등록:

`testWooMatch.js` · `testWooProbe.js` · `testWooDedup.js` · `testWooToolkit.js` ·  
`testWooFeasibility.js` · `testWooStudioContext.js` · `testWooWorkflowClone.js` · `testWooWorkflowUi.js`

이미 allMatch면 **스킵**.

#### C. 이번 #164에서 건드리지 않는 것

- JSSP / html / schema XML — 재배포 대상 아님  
- Match Option · `llm.embedEnabled` — **건드리지 말 것**(기본 OFF 유지)  
- litmus `v=` / `__v` — **지금 올리지 말 것**(별도 지시 후)

### 6-2. 배포 직후 빠른 확인 (V1)

| 단계 | 어디 | 무엇을 | 통과 |
|---|---|---|---|
| V1-a | Studio 재오픈 → `#twDiagLog` | `libs:` 행 | 불일치 모듈 **0** (배너 없음). `__v`는 여전히 159여도 OK |
| V1-b | (선택) Foundry 스모크 WF / `testWooFoundrySmoke` | `9c.foundry.budget` 로그 | `…/384` 또는 total budget 384 언급. 옛 `/132`면 **Env 미반영** |
| V1-c | 콘솔 JS Code 본문 검색 | Foundry에 `_coversSlot`, Env에 `maxNewFragments: 10` | 둘 다 보이면 배포 OK |

### 6-3. E2E 검증 (V2~V6) — 한 줄씩 진행

테스트 NL(슬롯 약 3개 예상):

```text
서울에 사는 Y요금제 사용하는 20대 여성 고객
```

#### V2 — 큐 1건만

1. Explorer / queryDef로 `woo:testWooAiRequestQueue` 의 테스트 잔여 행을 정리(또는 status≠queued·processing 인 것만 남기기).  
2. Studio에서 위 NL을 **한 번만** 입력 → [생성].  
3. 큐 테이블에서 해당 NL의 행 수를 센다.

| 통과 | 실패 시 의심 |
|---|---|
| **큐 1건** | Generate/JSSP 옛버전·재큐잉 루프(#206 미배포) · 입력을 여러 번 누름 |

#### V3 — Foundry 배치 1회 → fragment 여러 건

1. `WKF_testWooFoundry` 를 **1회** Start (동시 실행 금지 · 오퍼레이터에 `sql` right).  
2. 큐 행: `status=done`, `missing_slots_json` 가 `[]` 또는 빈 배열.  
3. 같은 배치에서 신규 fragment가 **슬롯 수만큼**(이 NL이면 보통 **3건**) 생겼는지 Explorer `woo:testWooAiFragment` (`origin=foundry` · 최근 `source_request_id`)로 확인.

| 통과 | 실패 시 의심 |
|---|---|
| fragment ≥3 · done · missing `[]` | Foundry 미배포 → 또 1건만 / Env 미배포 → 3건 후 `needs_human_design`·남은 슬롯 / token·toolkit 예산 |

`reason: continued` / `maxNewFragments(10) 도달` 로그가 보이면: 이번 배치에서 상한까지 만들고 **queued로 되돌린 것** → 배치를 **한 번 더** 돌리면 이어서 처리된다(실패 아님).

#### V4 — synonyms 리트머스 (가장 중요)

1. 방금 생긴 **서울/region/seoul** 계열 fragment 1건을 연다.  
2. 필드 `synonyms` · `sample_questions` 를 읽는다.

| 통과 | 실패(오염) |
|---|---|
| 슬롯 관련 토큰만 (예: 서울·거주·region·seoul) | `y요금제` · `여성` · `20대` · NL 전문이 **seoul 카드**에 들어 있음 → **Foundry(#164-A) 미반영** 또는 **옛 오염 행을 보고 있음** |

옛 오염 행을 보고 있다면: 해당 name의 Foundry fragment를 비활성/삭제 후 V2부터 다시.

#### V5 — Studio 재조회 (5분 대기 소멸)

1. Studio에서 같은 세션을 새로고침하거나 동일 NL로 다시 [생성](afterFoundry 경로).  
2. 기대: unmatched 0 · SQL 미리보기/계획 진행 · **"5분 정도 기다려"** 류 대기 화면 **미출현**.

| 통과 | 실패 시 의심 |
|---|---|
| SQL 쪽 진행 | Fragments Stage A 미배포 · 큐 미완료 · Match OFF와 무관한 unmatched |

#### V6 — 조건 5개 NL (이어달리기·상한)

예:

```text
서울에 사는 Y요금제 사용하는 20대 여성 고객 중 최근 3개월 내 가입
```

(슬롯이 4~5개로 쪼개지는지만 Pass0에 따름)

| 통과 | 실패 시 의심 |
|---|---|
| 큐 **1건** · 사용자에게 조건 재입력 강요 없음 · 배치 1~2회로 fragment가 채워짐 | Env 상한/이어달리기 미반영 → `needs_human_design` 조기 종료 |

### 6-4. 검증표 요약 (한눈에)

| # | 절차 | 통과 기준 |
|---|---|---|
| 1 | §6-1 배포 + §6-2 V1 | libs 불일치 0 · Env/Foundry 본문 문자열 확인 |
| 2 | V2 | 큐 **1건**만 |
| 3 | V3 | fragment **복수**(예: 3) · done · `missing_slots_json="[]"` |
| 4 | V4 | seoul 카드에 `y요금제`·`여성` **없음** ← **리트머스** |
| 5 | V5 | unmatched 0 · SQL 미리보기 · 5분 대기 없음 |
| 6 | V6 | 큐 1건 · 재입력 요구 없음 |

### 6-5. HUMAN 회신 칸

| 항목 | 결과 (운영자 기입) |
|---|---|
| Env 재등록 시각 · 본문에 `maxNewFragments: 10` 확인 | |
| Foundry 재등록 시각 · 본문에 `_coversSlot` 확인 | |
| #161 B그룹 추가 재등록 여부 | [ ] 해당없음 / [ ] 완료 |
| V1 libs 불일치 0 | [ ] Y / [ ] N |
| V2 큐 1건 | [ ] Y / [ ] N |
| V3 fragment 건수 · queue status | 건수: ___ · status: ___ |
| V4 synonyms 오염 없음 | [ ] Y / [ ] N (보이면 토큰: ) |
| V5 5분 대기 없음 · SQL 진행 | [ ] Y / [ ] N |
| V6 5조건 큐1건 | [ ] Y / [ ] N / [ ] 미실시 |
| #164 HUMAN PASS | [ ] PASS / [ ] FAIL (사유: ) |
| litmus bump 지시 요청 | [ ] v=160 진행해 달라 / [ ] 보류 |

---

## 7. 미해결

Pass1(LLM) 판정과 Stage A(LIKE) 판정의 기준 불일치는 구조적 과제로 남는다(#152 연계).  
본 P0는 삼킴·상한·이어달리기만 다룬다.
