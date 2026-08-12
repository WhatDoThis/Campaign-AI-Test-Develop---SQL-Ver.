# #167 — Foundry fragment 원자화 · 파라미터화

> **이 문서가 정답이다.** 코드가 어긋나면 코드를 고친다.  
> AI가 HUMAN 검증을 PASS로 자체 처리하지 않음.

---

## 1. 원래 설계 의도 (도서관 비유)

| 잘못된 산출 | 있어야 할 산출 |
|---|---|
| 『경기도 Y요금제 여성 명부』 1회용 책 | 「지역 조회 양식(지역: ___)」 재사용 양식 |
| 요청마다 새 책 | 축 한 번 등록 후 **값 사전만 늘림** |

입력 예: `경기에 사는 10대 남성 고객`  
기대 frag **3건** (조합 1건 아님):

```
woo__customer__region     … WHERE sRegion = {{region}}
woo__customer__ageGroup   … WHERE iAge >= {{ageMin}} AND iAge < {{ageMax}}
woo__customer__gender     … WHERE sGender = {{gender}}
```

다음에 `서울 20대 여성` → **신규 frag 0건**, `param_domain`에 매핑만 추가.

---

## 2. 헌법 (위반 코드 작성 금지)

| ID | 원칙 |
|---|---|
| P1 | frag 1건 = 조건 축 1개 = **참조 컬럼 1개** |
| P2 | AND 판정 = **컬럼 개수**. 같은 컬럼 범위 AND 허용 · 다른 컬럼 AND 금지 |
| P3 | 값은 name에 굽지 말고 `params` / `param_domain`. name=`woo__<table>__<axis>` |
| P4 | `param_domain` = NL표현→컬럼값 **값 사전** (없으면 바인딩이 매번 LLM 즉흥) |
| P5 | 축 간 AND 결합은 **Generate 조립** 책임. frag SQL에 넣지 않음 |

### P2 예시

| sql_text | 판정 |
|---|---|
| `iAge >= {{ageMin}} AND iAge < {{ageMax}}` | 허용 (컬럼 1) |
| `sRegion = {{r}} AND sGender = {{g}}` | 거부 (컬럼 2) |

---

## 3. 연령 컬럼 실체 (0-4)

대상: `woo:testWooSampleCustomer` (`new_ver/schema/testWooSampleCustomer.xml`)

| 논리명 | 물리명(관례) | 타입 | #167 사용 |
|---|---|---|---|
| `age` | `iAge` | long | **ageGroup 축 — 범위 비교** |
| `birth_date` | `dBirthDate` | date | 보조. iAge 없을 때만 날짜 연산 재설계 |
| `gender` | `sGender` | string(M/F/U) | gender 축 |
| `region` | `sRegion` | string | region 축 |

- `iAge/10` 등 컬럼 연산 금지 (non-sargable).
- nms:recipient 운영 전환 시 생년월일만 있으면 ageGroup SQL을 날짜형으로 다시 짠다.

---

## 4. 저장 계약

- Compiler 치환: `{{param}}` (`testWooCompiler._substitute`)
- Foundry는 검증 시에만 샘플 바인딩 SQL로 `validateFragment`/`probe` 통과 → **저장본은 `{{param}}` 유지**
- `param_domain` 예:

```json
{
  "gender": {
    "required": true,
    "type": "string",
    "enum": ["F", "M"],
    "nlMap": { "여성": "F", "여자": "F", "남성": "M", "남자": "M" }
  },
  "ageMin": { "required": true, "type": "int" },
  "ageMax": { "required": true, "type": "int" },
  "_bucket": {
    "nlMap": {
      "10대": { "ageMin": 10, "ageMax": 20 },
      "20대": { "ageMin": 20, "ageMax": 30 }
    }
  }
}
```

축 name이 이미 있으면 **INSERT 없이** `nlMap`/`enum` merge (기존 키 덮어쓰기 금지).

---

## 5. 구현 위치

| 항목 | 위치 |
|---|---|
| 프롬프트·few-shot | `testWooFoundry.js` `_foundrySystemPrompt` · `FRAGMENT_SCHEMA_EXAMPLE` |
| 원자성 게이트 | `assertAtomicFrag` / `_assertAtomicFrag` |
| 축 재사용·domain merge | `processQueueItem` |
| 수동 검토 대상 | `woo__customer__gyeonggi__yplan_f` (코드 삭제 금지) |

---

## 6. HUMAN 검증표

| # | 절차 | 통과 |
|---|---|---|
| V1 | `경기에 사는 10대 남성 고객` | frag 3 · tags 축1 · name에 값토큰 없음 · ageGroup=범위 |
| V2 | 이어서 `서울에 사는 20대 여성 고객` | **신규 frag 0** · domain만 추가 |
| V3 | `부천에 사는 여성 고객` | gender 재사용 · 부천 frag 없음 · gap · 무단 대체 없음 |
| V4 | `sRegion=:r AND sGender=:g` | skip + `non_atomic_frag` evidence |
| V5 | `iAge >= :a AND iAge < :b` | **통과** (같은 컬럼 범위) |

V2가 핵심 합격선이다.
