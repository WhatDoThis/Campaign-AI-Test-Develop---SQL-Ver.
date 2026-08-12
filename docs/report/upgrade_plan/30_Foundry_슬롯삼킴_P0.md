# #164 P0 — Foundry 슬롯 삼킴 (색인 오염 · AND 커버리지 · 큐 이어달리기)

> 사고/패치 기록. AI가 HUMAN 검증을 PASS로 자체 처리하지 않음.

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

## 6. 검증 절차

| # | 절차 | 통과 기준 |
|---|---|---|
| 1 | JS lib 8종 ACC 콘솔 재등록 (#161 목록) | litmus `libVersions` 불일치 0 |
| 2 | 큐 테이블 비우고 `서울에 사는 Y요금제 사용하는 20대 여성 고객` 1회 입력 | 큐 **1건**만 생성 |
| 3 | Foundry 배치 1회 실행 | fragment **3건**, status=done, `missing_slots_json="[]"` |
| 4 | 신규 fragment의 `synonyms` 확인 | `seoul` 카드에 `y요금제`·`여성` 토큰이 **없어야** 함 |
| 5 | Studio 재조회 | unmatched 0, SQL 미리보기 생성, "5분 대기" 화면 미출현 |
| 6 | 조건 5개짜리 입력 | 큐 1건, 재입력 요구 없음 |

4번이 이번 수정의 리트머스다. 오염 토큰이 보이면 A가 배포·적용되지 않은 것이다.

---

## 7. 미해결

Pass1(LLM) 판정과 Stage A(LIKE) 판정의 기준 불일치는 구조적 과제로 남는다(#152 연계).  
본 P0는 삼킴·상한·이어달리기만 다룬다.
