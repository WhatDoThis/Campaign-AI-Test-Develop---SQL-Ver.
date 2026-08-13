# #174 — EN-Pivot Canonical Layer

> **상태:** `[ ]` 미착수 · **다음 = 0단계 조사 (코드 수정 금지)**  
> **이 문서가 추출 좌표계의 정답이다.** 코드가 어긋나면 코드를 고친다.  
> AI가 HUMAN 검증을 PASS로 자체 처리하지 않음.  
> 5단계(한국어 사전 제거)는 V1~V5 통과 전에 **절대 앞당기지 않는다.**

원문: `[별도]_고도화_개발아이디어_관리자작성본.md` 2026-08-13  
선행 헌법: `#167` 축1=컬럼1 · `#168-A` `_source` · `#169` 서가 우선 · `#172` 공유 모듈  
재개: `#170` · `#168-B` · `#172` 매칭 · (`#167` 도메인 형상 · `#169-P0` 히트 술어)

---

## 0. 결론 3줄

1. **표층 한국어가 유일한 매칭 좌표계라서 조사/어미 사전이 무한 증식 중이다.** `nlMap`은 이미 한→영 번역표인데, 시스템이 번역을 하고 있으면서 LLM에게는 안 시키고 손으로 쌓고 있었다. `param_domain`에 `{db, en[]}` 쌍으로 저장하면 “번역하면 DB와 못 만난다”는 문제는 애초에 없다.
2. **번역의 효용은 “영어가 낫다”가 아니라 형태소 정규화·어간 추출·어절 분리를 공짜로 얻는 것이다.** `JOSA_TAIL`+`NOISE_WORD` 손코딩은 조사·어미 조합이 유한하지 않아 점근적으로 지는 싸움이다. 로그 #234/#235(렉시콘·조사 어간)가 그 증거다.
3. **양쪽을 영어로 올려 영어 공간에서 만나고, DB 바인딩은 항상 원본 `db` 값이다.** 미지 스키마는 `concept`(영어 canonical)로 같은 축을 만난다. 새 값은 컬럼 단위 heal, 못 풀면 `unresolved`로 명시(조용히 삭제 금지).

V7 비용 실측은 **부록**이다. 차수 합격은 기능(V1~V6)이다.

---

## 1. 왜 (원문 08-13 + 운영 요구)

표현은 다른데 의미는 같은 입력:

| NL | 번역 결과(예시) |
|---|---|
| 서울에 사는 10대 고객 | Teenage customers living in Seoul |
| 서울에 거주하는 10대들 | Teenagers residing in Seoul |
| 서울 10대 사람 | Teenagers in Seoul |
| 서울사는 10대 회원 | Teenage members living in Seoul |
| 서울살이하는 10대 | Teenagers living in Seoul |

한국어 표층에서 `서울살이하는`을 `서울`로 깎는 사전은 끝이 없다. EN 공간에서는 `Seoul` + `teenagers`로 만난다.

DB 값은 이미 영어인 경우가 많다 (`BASIC` / `PREMIUM` / `STUDENT` / `Y_PLAN` / `Z_PLAN`). 운영 `nms` 스키마는 컬럼명도 영어(`@email`, `@birthDate`, `@blackList`)인데 사용자는 한국어로 묻는다. **번역 레이어 없이는 운영에서 반드시 터진다.**

운영 요구:

| ID | 요구 | #174 대응 |
|---|---|---|
| R1 | 스키마·속성이 사전에 정해지지 않음 | 컬럼명/값 하드코딩 전면 금지 · `concept` canonical |
| R2 | frag 생성 이후 새 데이터 추가 | 컬럼 단위 `probe_values` heal + EN 번역 merge |
| R3 | 해결 못 한 슬롯이 조용히 사라지면 안 됨 | `unresolved[]` + reason 3종만 · Studio 원문 표시 |

---

## 2. 설계 요약 (EN Pivot Layer)

번역과 추출은 **한 콜**로 묶는다. EN 문장은 로그에 남긴다 (디버깅). temperature 0.

```
NL "서울살이하는 10대 회원"
  ↓ translateAndExtract (1콜, structured output)
{ en:"Teenage members living in Seoul",
  slots:[
    {surface:"서울살이하는", concept:"residential_region",
     en_literal:"Seoul", kind:"categorical"},
    {surface:"10대",        concept:"age_group",
     en_literal:"teenagers", kind:"range"}]}
  ↓ param_domain EN 공간 매칭
region: {"서울":{db:"서울", en:["Seoul"]}}      → 히트
age:    {"10대":{ageMin:10, ageMax:20, en:["teenager","teens"]}} → 히트
  ↓ 바인딩 (원본 값만)
WHERE sRegion = '서울' AND iAge >= 10 AND iAge < 20
```

`param_domain` 확장 (스키마 XML 변경 금지 · JSON 안만):

```json
{
  "sRegion": {
    "서울": { "db": "서울", "en": ["Seoul"] }
  },
  "sPlan_code": {
    "학생요금": { "db": "STUDENT", "en": ["student fare", "student plan"] }
  },
  "_source": {
    "concept": "residential_region",
    "enRefreshedAt": "ISO-Z",
    "enModel": "…"
  }
}
```

기존 `nlMap` 키는 **삭제하지 않고 병존**(하위호환 · M1 폴백).

번역 비결정성 가드 (3중): temperature 0 · EN 별칭 배열 복수 저장 · EN 매칭 실패 시 원문 literal 대조(M1).

---

## 3. 전체 설계 순서 (점검 결과)

08-12 원문: **조건(타겟)을 잘 뽑는 것이 최우선**, 그다음 캠페인 매핑.  
08-13 원문: 뽑기의 좌표계를 한국어 표층에서 EN pivot으로 바꾼다.

두 트랙을 섞지 않는다. 추출이 흔들리면 R4~R8 셸은 빈 SQL만 보여 준다.

```
트랙 A · 타겟 추출 (최우선)
  #164 슬롯삼킴 P0          [x] 유지 (버그픽스 · EN과 독립)
  #167 원자화 헌법          [x] 유지 · 도메인 형상만 #174-3
  #168-A _source 탐색캐시   [x] 유지 · EN 사전화는 #174-3
  #169 서가 우선            [x] 유지 · 히트 술어는 #174-4
  #170 Pass0 원자분할       [ ] 재개 ← 추출 입력이 KO 힌트 → EN slots
  #168-B 값 바인딩          [ ] 재개 ← 입력=EN slots · unresolved
  #172 FragContract 매칭    [ ] 재개 ← M1/M2/M3 · abstain
  ▶ #174 EN-Pivot           [ ] 지금 · 0→5단계
       0 조사 (코드 금지)
       1 출력 계약 고정
       2 EN 추출 (신규 testWooEnPivot.js)
       3 도메인 EN 사전화
       4 매칭+heal+abstain
       5 한국어 사전 제거 (V1~V5 후만)

트랙 B · SQL-First 셸 (추출과 병렬 HUMAN · 신규 구현은 A보다 뒤)
  R2 캐시 [x] · R3 상태머신 [x] · R4 SQL목록 [x]
  R5 매핑 [~] 배포 HUMAN · R6 커밋 · R7 relative · R8 정리
```

R5 배포 HUMAN은 막지 않는다. **R6 코드 착수는 #174 0단계 보고 승인 전이라도 가능**하되, 추출 결함(#170/#172 재개분)을 R6으로 우회 구현하지 말 것.

---

## 4. 폐기 (전략 · 단계)

문서 파일은 삭제하지 않는다. **앞으로 이 방향으로 구현·증식하지 않는다.**

| 폐기 대상 | 사유 | 코드 삭제 시점 |
|---|---|---|
| `JOSA_TAIL` / `NOISE_WORD` / `stemToken` / `isNoiseResidue` **증식** | 조사·어미는 유한하지 않음. #234/#235가 같은 싸움의 연장 | **5단계** (V1~V5 후). 그 전엔 M1 폴백으로 병존 |
| `#170` S5 한국어 축 힌트(지역명·성별 리터럴)를 슬롯 분할 **주경로**로 쓰는 것 | R1 위반 · EN `concept`가 대체 | 5단계 |
| `nlMap` 수기 한→영을 **주 매칭 좌표계**로 유지 | 이미 번역표인데 손쌓기. LLM 번역+#174-3이 대체 | 주경로 즉시 폐기 · 키 삭제는 5단계 이후도 금지(하위호환) |
| `collectLexicon`/`splitByLexicon`을 조사 정규화의 **영구 해법**으로 확장 | 렉시콘은 M1 보조. EN 추출이 주경로 | 증식 즉시 중지 · 함수 삭제는 5단계 |
| `#170` `normalizeAtomicSlots`의 KO 정규화를 Pass0 **정본**으로 고정 | 원자 슬롯 원칙(S1)만 남김. 쪼개기는 EN extract | 주경로 2단계부터 EnPivot · KO 정규화는 5단계 삭제 |
| V7 비용 실측을 차수 **합격 게이트**로 두는 것 | 기능이 정본. 비용은 부록 | 게이트에서 제외 (조사 생략 허용) |

유지 (폐기 아님):

- `#167` P1~P5 (축1=컬럼1, `{{param}}`, 값은 name에 안 굽기)
- `#168-A` classifyField · `_source` · fingerprint
- `#169` 서가 히트 시 스키마 툴 0
- `#164` AND 게이트 · 큐 이어달리기
- M1 원문 literal 매칭 (무료 폴백 · 5단계 후에도 유지)

---

## 5. 재개 · 보강

완료로 남아 있으면 EN pivot이 “이미 끝난 매칭”을 건드리지 못해 이중 좌표계가 고착된다. **수정이 필요한 차수는 미완료로 되돌린다.** 해당 차수 가이드의 #174 절을 닫으면 다시 `[x]`.

| 키 | 재개 범위 | 닫는 조건 |
|---|---|---|
| `#170` | Pass0 입력을 `translateAndExtract` 슬롯으로. S1 원자 원칙만 헌법. KO 힌트 분할은 5단계에서 삭제 | V1 동일 slots 5패러프레이즈 |
| `#168-B` | `plan.params` 입력을 EN 매칭 결과로. `unresolved`면 SQL 생성 안 함(R3) | V2 바인딩 + V5 abstain |
| `#172` | `domainMatchSlot` → M1→M2→M3. `unresolved` reason 3종. 축 regex에 한국어 값 추가 금지 | V2~V5 · V6 grep 0 |
| `#167` 도메인 | `param_domain` 값 = `{db, en[]}` 병존. `_source.concept` | #174-3 후 V2 |
| `#169-P0` | 히트 술어가 “슬롯 한국어 ⊂ nlMap 키”만이면 EN 슬롯에서 미스. M2/concept 정합으로 보강 | #174-4 후 V3 library hit |

보강만 하고 재개하지 않는 것: `#164`(P0 유지), `#168-A` 탐색 규칙(EN은 3단계에서 `_source` 필드 추가).

---

## 6. 단계

### 0단계 — 조사만 (코드 수정 금지)

D1~D5를 파일:함수:라인으로 보고. 확인 못 한 것은 `확인 불가`만. 추정 금지. **이 보고 승인 전에 어떤 파일도 수정하지 말 것.**

| ID | 조사 |
|---|---|
| D1 | `testWooFragContract.js` 전문: `JOSA_TAIL` / `NOISE_WORD` / `stemToken` / `isNoiseResidue` 정의·참조. 한국어 값 리터럴(지역명·성별 등) 또는 컬럼명이 코드에 박힌 곳 전부 |
| D2 | `testWoo.llm` structured output(tool calling / JSON schema 강제) 지원 여부. 지원 시 호출 시그니처, 아니면 `미지원`만 |
| D3 | frag 생성 응답 최상위 JSON이 2개 이상일 때 `_fragDocFromLlm` 실제 코드 경로 |
| D4 | `param_domain` heal의 현재 트리거 조건과 갱신 범위 |
| D5 | 위 보고 전에는 파일 수정 금지 (게이트) |

### 1단계 — 출력 계약 고정 (D2/D3 반영)

- fragment 생성은 슬롯 1개당 JSON 1개. 산문/표/경고문 금지를 프롬프트 명시.
- 최상위 JSON이 2개 이상이면 파싱 실패로 죽이지 말고 **첫 번째 채택** + `extra_fragment_dropped` 로그 + 나머지 축은 미처리 슬롯 반환.
- structured output 지원 시 스키마 강제 경로 우선.

### 2단계 — EN Pivot 추출 (신규 `testWooEnPivot.js`)

`translateAndExtract(nlText, candidateCards)` → 단일 LLM 호출.

```
{ en: "<전체 영역 영문 번역>",
  slots: [{ surface, concept, en_literal, kind, polarity }] }
```

- `concept` = 영어 snake_case canonical. 후보 카드에 concept이 있으면 그중 선택, 없으면 신규 제안 + `is_new:true`.
- `en_literal` = 값의 영문 표현. 원문은 `surface`에 보존.
- 해당 없으면 slots에서 빼지 말고 `concept:null` + `reason` (R3).
- temperature 0. 실패 시 배치를 죽이지 말고 `slots:[]` + 로그.

### 3단계 — 도메인 EN 사전화 (스키마 변경 금지)

컬럼당 1회, distinct/enum 값 전체를 한 번에 번역해 `"<원문키>": { "db": <DB값>, "en": ["별칭1","별칭2"] }` 로 저장.

- `en`은 배열. fare/plan 모호성은 둘 다.
- range tier는 버킷 라벨 번역 (`10대` → `["teenager","teens","10s"]`).
- `_source`에 `concept`, `enRefreshedAt`, `enModel`.
- 기존 `nlMap` 키 삭제 금지.

### 4단계 — 매칭 + 자가치유 + abstain

위에서 걸리면 종료:

| ID | 규칙 |
|---|---|
| M1 | 원문 literal ⊂ NL (기존 `domainMatchSlot`, 최우선·무료) |
| M2 | `en_literal`이 `param_domain.en` 배열과 일치/포함 |
| M3 | `concept` 일치 + `kind` 호환 (값은 미해결로 남김) |

치유(R2): M1~M3 전부 실패 시 해당 컬럼 1개만 `probe_values` 재실행 (쿨다운 기본 10분) → 새 값이면 merge + EN 번역 후 즉시 재매칭 → 그래도 없으면 `_negative[값]=timestamp` (TTL 기본 1일).

abstain(R3): `unresolved[]` 반환. reason은 `concept_not_found` / `value_not_in_domain` / `ambiguous` 만. Studio는 원문 `surface`와 함께 표시. 임의 보정·삭제 금지.

### 5단계 — 한국어 사전 제거

2~4단계가 V1~V5 통과한 뒤에만 `JOSA_TAIL` / `NOISE_WORD` / `stemToken` / `isNoiseResidue` 및 지역명·성별 하드코딩을 제거한다. **먼저 지우면 실패 원인이 EnPivot인지 KO 사전인지 판별 불가.**

---

## 7. 제약

- 수정 허용: `new_ver/js/testWooFoundry.js`, `testWooFragContract.js`, `testWooFragments.js`, 신규 `new_ver/js/testWooEnPivot.js`  
  (1단계 출력 계약·Pass0 연결이 필요하면 `testWooLlm.js`는 0단계 보고에 명시 후 HUMAN 승인)
- ES5 + Rhino (화살표/`let`/`const`/템플릿리터럴/`map`/`forEach` 금지)
- 외부 번역 API 금지. 기존 연결된 LLM만.
- 스키마 XML 변경 금지. `param_domain` JSON 안에서만 확장.
- 컬럼명/스키마명/한국어 값 하드코딩 금지 (5단계 후 grep 0건)
- 번역 결과를 DB 바인딩에 직접 쓰지 말 것. 바인딩은 항상 `db` 필드의 원본 값.

---

## 8. 검증

| ID | 절차 | 합격 |
|---|---|---|
| V1 | "서울에 사는 10대 고객" / "서울에 거주하는 10대들" / "서울 10대 사람" / "서울사는 10대 회원" / "서울살이하는 10대" | 5건 모두 동일 slots(region=서울, age_group=10대). 신규 frag 0 |
| V2 | "서울에 사는 Z요금제 쓰는 20대 남성 고객" | frag 4개(region/plan/age/gender) Active, JSON parse error 0, unresolved 0 |
| V3 | V2 재실행 | 신규 0, library hit 4, LLM 번역 호출 0(캐시 히트) |
| V4 | DB에 신규 지역값 1건 삽입 후 그 값으로 요청 | `probe_values` 1회 → `param_domain` merge → SQL 생성 성공 |
| V5 | 존재하지 않는 값("판교요금제") | unresolved 1, reason=`value_not_in_domain`, `_negative` 기록, SQL 생성 안 함 |
| V6 | grep | 한국어 값 리터럴/컬럼명 하드코딩 0건 (**5단계 후**) |

### 부록 V7 (게이트 아님)

비용·호출 수 표. 어려우면 조사·계산·정리 생략 가능. 차수 PASS와 무관.

---

## 9. 산출물

0단계 보고(D1~D5) → HUMAN 승인 → 단계별 diff 요약 → V1~V6 결과표 → `docs/log/log.md` (구현 시 해당 번호) · 본 문서 상태 `[x]`.

재개 차수 `#170`/`#168-B`/`#172`는 각 가이드의 #174 절을 닫은 뒤 `01_진행판.md`에서 `[x]` 복귀.

---

## 10. Chat 한 줄

```
차수: #174 0단계 (조사만 · 코드 금지)
가이드: docs/report/upgrade_plan/37_ENPivot_CanonicalLayer_174.md
선행: #167/#168-A/#169 헌법 유지 · #170/#168-B/#172 는 재개 상태(닫지 말 것)
모드: 조사 D1~D5 → 보고는 결론 3줄 우선, 근거 표는 그 아래. 확인 불가면 '확인 불가'만.
금지: 파일 수정 · 5단계 선삭제 · 스키마 XML · 외부 번역 API · 번역값을 DB 바인딩 · V7을 게이트로 승격
```
