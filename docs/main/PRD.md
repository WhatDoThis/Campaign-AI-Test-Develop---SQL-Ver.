# AI 대상자 추출 시스템 PRD (Test Woo)

`v1.6` · 2026-08-05 · Adobe Campaign · LG U+ · **테스트 적용본**

> **가치의 핵심 두 가지**  
> 1) fragment가 수만~십만 개여도 NL에 맞는 조각을 **정확히 고른다** (검색 정확도)  
> 2) 고른 조각들을 조합한 SQL이 **의도한 타겟만** 뽑는다 (추출 신뢰도)  
>
> 보안상 **외부 연동은 최소화**한다 (원칙적으로 LLM API만 outbound).  
> 벡터 DB/외부 검색 엔진은 쓰지 않고, Campaign DB 안에서의 검색 + LLM 재선택으로 간다.

> **설계 점검 상태 (v1.4.1)**  
> 문서·`new_ver` 코어 정합 완료. 화이트박스 검수 반영(문서 잔여 불일치 정리).  
> 캠페인 **섹션 1**(권한·LLM 옵션)부터 적용 가능.

> **v1.6 변경** — `Rebuild/PRD.md`(v1.5)를 본 문서 위치로 이관·통합했다.  
> 기존 `docs/main/PRD.md`(v0.1 초안, `uplus` 네이밍 · IR · WF XML 주입)는 폐기하고,
> 그 중 유효한 부록(용어집·쉬운 설명·`old_ver` 관계)만 현행 설계에 맞춰 병합했다.
> 이후 PRD는 본 문서 하나만 갱신한다.

---

## 0. 만드는 것 / 참고만 할 것

| 구분 | 내용 |
|---|---|
| **참고** | CDP → Campaign 데이터 마트 적재 |
| **참고** | SQL 라이브러리에 fragment 데이터를 쌓는 작업(운영·데이터 팀). 본 시스템은 **소비** |
| **만듦** | NL 입력 → (대규모) fragment 검색·선택 → 조합 계획 → 결정론적 SQL 조립 → 최소 검증 → 커스텀 액티비티 주입 |

---

## 1. 개요와 목적

| 항목 | 내용 |
|---|---|
| 문제 | 조건 변경마다 요청→SQL 개발→검수→워크플로우 반영이 느림 |
| 해결 | NL → 검증된 fragment 조합 SQL → 커스텀 액티비티 반영 |
| 성공 기준 | **정확도**(맞는 fragment) + **신뢰도**(조합 SQL이 의도 타겟) + 주입·실행 가능 |

타겟 조건은 단순할 수도, **10개 이상** 붙을 수도 있다.

예) *최근 한달 신규 가입 + 10~20대 + Y요금제 + 푸시 미수신 + 마케팅수신동의 + …*

이 시스템은 “SQL을 잘 쓰는 AI”가 아니라 **틀린 SQL이 등록되지 않게 막는 파이프라인**이다.

---

## 2. 확정 알고리즘

```
[참고] CDP → 데이터 마트
[참고] SQL 라이브러리 (검증된 SELECT fragment들, 장기적으로 ~100,000)

(3) NL 입력 (모호 한 문장 가능)
(4a) Pass0: LLM 슬롯 분해 (fragment ID 금지)
(4b) Stage A: Campaign 내부 슬롯별 검색 → Top-N 후보 (카탈로그 통째 LLM 주입 금지)
(4c) Pass1: LLM이 후보만 보고 선택 + params + op (+ merge/split)
(4d) 조립: 결정론적 컴파일러가 set-op으로 최종 SQL 생성 (LLM이 SQL 자유 작성 금지)
(5) 최소 검증 → 사람 확인 → 이력 등록(ai_sql_id) → 커스텀 액티비티가 런타임 조회·실행

[참고] Workflow Run → 커스텀 액티비티 실행 → Change Dimension(다음 액티비티) → …
```

### 2.1 LLM이 할 일

1. NL을 조건 슬롯 단위로 분해  
2. **검색으로 좁혀진 후보** 안에서 fragment 선택 (누락 시 창작 금지)  
3. 파라미터 채움 (fragment 스펙 안)  
4. 조각 간 연산 지정: `intersect` · `union` · `exclude` · `include`  
5. 결과를 **조합 계획(JSON)** 으로 반환 → 컴파일러가 SQL 생성  

### 2.2 LLM이 하지 않는 일

- 라이브러리 밖 테이블/SQL 창작  
- 10만 개 카탈로그 전체를 한 번에 읽고 고르기  
- CDP/마트/CD/제외/발송  

---

## 3. 왜 이전 MVP만으로는 부족한가 (점검 결과)

| 요구 | v1.1 PRD만으로 | 판정 |
|---|---|---|
| fragment ~100,000 | 카탈로그를 LLM에 넣는 전제 → **불가능·부정확** | **보완 필수** |
| 조건 10개+ | 조합 규칙·키 정합·연산자 모델 부족 | **보완 필수** |
| 외부 연동 최소화 | 벡터 DB 없이 가는 경로 미기술 | **보완 필수** |
| 과설계 금지 | 게이트/codemap/퍼널 과다였음 → 이미 축소 | 유지 |
| 커스텀 액티비티 주입 | 방향 맞음 | OK |

**결론:** 방향( fragment 조합, 자유 SQL 금지 )은 맞지만,  
**“대규모에서도 맞게 고르고, 많이 붙여도 믿을 수 있게 합치는” 설계가 v1.1에는 비어 있었다.**  
v1.2~v1.3가 그 구멍을 메운다.

---

## 4. 아키텍처 — 정확도 + 신뢰도 (핵심 설계)

보안 제약: **outbound ≈ LLM API만**. 벡터 DB·외부 검색 SaaS 없음.

업계에서도 대규모 카탈로그는 **1차 어휘/메타 검색(Top-K) → 2차 LLM(또는 재랭크) 선택**이 표준이다.  
벡터 없이 가도 **taxonomy + keyword + sample_questions + LLM 슬롯 선택**으로 동일 파이프를 유지한다.

### 4.1 정확도: 2단계 검색 (Retrieve → Select)

100k를 LLM context에 넣는 것은 금지.

```
NL (명확한 "+" 나열일 수도, 한 문장으로 뭉친 모호 표현일 수도 있음)
 → [Pass 0 · LLM 슬롯 분해] 조건 단위 문자열만 추출 (fragment ID 금지)
 → [Stage A · Campaign 내부] 슬롯별 후보 검색 (외부 API 없음)
 → [Pass 1 · LLM 선택+재분할] 후보 카드 보고 fragment/params/op 확정
      · 필요 시 슬롯 merge/split (라이브러리 경계에 맞게 재분할)
 → 매칭 실패는 창작하지 않고 unmatched 안내
```

| 단계 | MVP에서 구현 | 규모 확장 시 |
|---|---|---|
| Stage A | `category` + `tags` + label/description/`sample_questions` LIKE | DB 전문검색·동의어 사전·사용빈도 가중 |
| Stage B | LLM이 후보만 보고 선택 | 슬롯별 병렬 선택, 프롬프트 캐시 |
| 벡터 검색 | **안 함** (보안) | 정책 허용 시에만 **내부** 임베딩 검토 |

> **설계는 지금**, 데이터 10만 개는 **참고로 나중에** 쌓여도 Stage A→B 파이프 모양이 같으면 된다.  
> MVP는 fragment 수십~수백 개로 동일 파이프를 검증한다.

### 4.1.1 모호한 NL과 슬롯 분해 (핵심 리스크)

마케터 NL은 예시처럼 깔끔하지 않을 수 있다.

예) *최근 한달 Y요금 가입한 1020세대 중 수신동의하고 마케팅 메시지를 한번도 받지않은 …*

| 현실 | 잘못된 가정 | 올바른 설계 |
|---|---|---|
| `+`/`그리고`로 안 나뉨 | 구분자 휴리스틱으로 슬롯 분리 | **LLM Pass 0이 주 분해기**. `+` 분리는 보조일 뿐 |
| 표현이 사용자마다 다름 (1020세대 / 10~20대) | label 정확 일치 | `sample_questions`·`synonyms`·`tags`에 별칭 적재 |
| 경계 모호 (한달+Y요금 = 1조각? 2조각?) | 항상 단어 단위 분리 | 라이브러리 단위에 맞게 **Pass 1에서 merge/split** |
| 한 문장에 조건 다수 | 전역 1회 검색 | **슬롯별** Stage A 후 선택 |

**답:** 구분자 기반 분해만으로는 불가하다.  
**LLM 슬롯 분해(Pass 0) + 후보 기반 재분할(Pass 1) + fragment 별칭 메타**면 모호 NL도 같은 파이프로 처리한다.  
벡터 없이도 “표현 다양성”은 **메타데이터 품질**이 좌우한다 (라이브러리 운영 계약).

Pass 0 출력 예 (아직 fragment 고르지 않음):

```json
{
  "slots": [
    { "id": "s1", "text": "최근 한달 이내 Y요금제 가입", "hintedCategory": "plan" },
    { "id": "s2", "text": "1020세대(10~20대)", "hintedCategory": "demo" },
    { "id": "s3", "text": "마케팅 수신동의", "hintedCategory": "consent" },
    { "id": "s4", "text": "마케팅 메시지를 한 번도 받지 않음", "hintedCategory": "fatigue" }
  ]
}
```

Pass 1에서 라이브러리에 `signup_recent`와 `plan_y`가 분리돼 있으면 s1을 **split** 할 수 있다.  
반대로 하나의 compound fragment만 있으면 **merge** 한다. SQL은 쓰지 않는다.

### 4.1.2 Stage A — 슬롯별 검색 (10+ 조건용 필수)

10개+ 조건을 **한 번의 전역 LIKE**로 처리하면 후보가 오염된다.  
반드시 **슬롯 단위 검색**한다.

1. **슬롯 분해 (Pass 0)** — LLM 필수. 각 슬롯에 `searchKeywords[]`(동의·별칭·정규화 표현)를 채움  
   - **코드에 도메인 토큰 사전/정규식을 하드코딩하지 않음** (1020세대 등)  
2. **슬롯별 Stage A**  
   - 검색어 = Pass0 `searchKeywords` (없으면 범용 분할만)  
   - `status='active'` · category 힌트 · meta 필드 LIKE  
   - fragment 쪽 표현 커버는 `sample_questions` / `synonyms` / `tags`  
   - Top-N 유지 (기본 30)  
3. **슬롯별 후보를 Pass 1에 전달** (전역 단일 리스트로 뭉개지 않음)  
4. **실패 정책** — Top-N이 0이거나 Pass 1이 고르지 못하면 unmatched → **SQL 창작 금지**

Campaign queryDef로 구현 가능. 외부 검색 엔진 불필요.

### 4.1.3 Stage B / Pass 1 — LLM 선택·재분할 계약

- 입력: 원문 NL + 슬롯 text + 슬롯별 후보 카드(메타만, `sql_text` 제외 가능)  
- 출력: **CNF 조합 계획**만 (`include` / `exclude` / `unmatched` / `grainKey`). `op` 필드 없음  
- **재분할 허용:** 후보를 본 뒤 merge/split 가능. 단 최종 fragment는 **반드시 해당 검색 후보 합집합 안**  
- 후보에 없는 `fragment` name → 서버 **거부**  
- 조건 개수 하드캡을 낮게 두지 않음 (10+ 허용)

### 4.2 신뢰도: CNF 조합 계획 + 결정론적 조립

10개+ 조건을 LLM이 **최종 SQL 문자열로** 쓰게 하면 신뢰도가 깨진다.  
대신 LLM 출력은 **CNF 조합 계획**만, SQL은 **컴파일러**가 만든다.  
좌결합 `slots[]+op`는 **폐기** — 중간 `include` 리셋·괄호 모호성(silent data error) 원천 제거.

**CNF 계획 예시** — “최근 가입 AND (10~20대) AND 동의 EXCEPT 푸시미수신”

```json
{
  "grainKey": "customer_id",
  "include": [
    { "any": [ { "fragment": "signup_recent", "params": { "days": 30 } } ] },
    { "any": [ { "fragment": "age_band", "params": { "min": 10, "max": 29 } } ] },
    { "any": [ { "fragment": "mkt_consent_yes", "params": {} } ] }
  ],
  "exclude": [ { "fragment": "push_never", "params": {} } ],
  "unmatched": []
}
```

의미: 그룹 간 AND(`INTERSECT`), 그룹 내 OR(`UNION`), exclude는 전부 OR 후 **한 번** `EXCEPT`.

### 4.2.1 Fragment SQL 계약 (신뢰도의 뿌리)

| 규칙 | 내용 |
|---|---|
| 형태 | 각 fragment는 **완전한 SELECT 조각** (`sql_text`). WHERE 절 조각(`expr`)만 있는 모델은 **폐기** |
| Grain | SELECT 결과에 **동일 `key_column`** 포함 (예: customer_id) |
| Params | `{{param}}` 플레이스홀더만 허용. 도메인은 `params`/`param_domain` |
| 금지 | DDL/DML/`<%` / 다중 문장 / 쌍따옴표 식별자 |
| 조합 가능 | 서로 다른 테이블이어도 **키가 같으면** set-op으로 합침 |

### 4.2.2 컴파일러 규칙 (CNF · 결정론)

1. 각 fragment: `sql_text` + params 치환 → 서브쿼리  
2. `include[i].any[]` → `UNION` (그룹 내 OR), 피연산자 괄호  
3. `include[]` 그룹들 → `INTERSECT` (그룹 간 AND), 피연산자 괄호  
4. `exclude[]` → 전부 `UNION` 후 `EXCEPT` **1회**  
5. 최종: `SELECT grainKey FROM (…)` (set-op이 DISTINCT 시맨틱)  
6. `key_column` ≠ `grainKey` → 컴파일 실패  
7. 같은 계획 → 항상 같은 SQL. LLM이 SQL을 고쳐 쓰지 못함  
8. **요약문은 compile 결과에서만 생성** (plan을 따로 reverse하지 않음)

### 4.3 신뢰도: 검증 (최소 · 가치 있는 것만)

| 검증 | MVP | 이유 |
|---|---|---|
| 금지 토큰 `<%` / DDL·DML / `;` (리터럴·주석 제거 후) | ✅ | 보안·CTAS |
| 모든 fragment에 grain 키 존재 | ✅ | CD·조합 전제 |
| 조합 계획의 fragment가 라이브러리에 실재 | ✅ | 환각 ID 차단 |
| 후보 밖 fragment 거부 (`allowedNames` 필수) | ✅ | Stage A 우회 차단 |
| 파라미터 도메인(필수·타입·enum·range) | ✅ | 경계 오류 |
| 최종 SQL 단일 grain 투영 | ✅ | CD 계약 |
| 사람 승인 후 이력 등록 (`ai_sql_id`) | ✅ | 의도 최종 확인 |
| 유일성 COUNT/규모%/EXPLAIN | 이후 | set-op dedup으로 **정확성 리스크 없음**, 비용만 후순위 |

---

## 5. Fragment 라이브러리 메타 (100k를 위한 필수 필드)

데이터가 **참고로 쌓인다** 해도, **필드 규격은 지금 고정**해야 검색이 산다.

| 필드 | 필수 | 용도 |
|---|---|---|
| `name` | ✅ | 안정 ID |
| `label` / `description` | ✅ | 검색·LLM 카드 |
| `sample_questions` | ✅ | NL 유사 표현 매칭 |
| `category` | ✅ | Stage A 필터 |
| `tags` | ✅ | Stage A 필터 (콤마/JSON) |
| `synonyms` | 권장 | 동의어(내부 사전). 외부 API 아님 |
| `sql_text` | ✅ | 검증된 **SELECT** 조각 |
| `params` / `param_domain` | ✅ | 플레이스홀더 스펙 |
| `key_column` | ✅ | 조합·CD용 grain 키 |
| `status` | ✅ | active만 검색 |

선택(이후): 사용 빈도, 금지 조합 규칙.

> **구현 상태:** `new_ver`는 `sql_text` + set-op 컴파일러로 정합됨. WHERE-`expr` 모델은 폐기.  
> Stage A: queryDef **lineCount=5000 페이지** + DB LIKE 필터, 검색 시 **sql_text 미로드**, `getByName`만 단건.  
> (ACC: lineCount 미지정 시 ~10000 — 전량 loadAll 금지. KCS KA-28003)

---

## 6. 전제와 계약

### 6.1 커스텀 액티비티 (별도 · ai_sql_id 계약)

워크플로우 XML에 SQL을 주입하지 않는다 (전체 entity Write 금지).

| | |
|---|---|
| 속성 | `ai_sql-id` (long) — `woo:testWooAiSql.@id` |
| 런타임 | 이력에서 `sql_query` 로드 → 실행 → work table |
| 출력 | transition `tableName` / `schema` / `recCount` |
| 금지 | Campaign 측에서 workflow XML 전체 Write / script CDATA 패치 |

Change Dimension = **다음 액티비티**. 본 시스템 비범위.

### 6.2 SQL 최소 규칙

- C1: DDL/DML/`<%` 금지  
- C2: 최종 결과에 grain 키 포함·유일 단위  
- C3: fragment SQL만 사용 (자유 생성 없음)

---

## 7. 범위

### MVP에서 만듦

1. fragment 라이브러리 스키마(소비) + 이력 스키마  
2. Stage A 검색 (슬롯별 category/tags/LIKE) — 외부 검색 없음  
3. Stage B LLM 선택 → 조합 계획 JSON  
4. 결정론적 set-op SQL 컴파일러  
5. 최소 검증 + 승인 UI + 이력 등록(`ai_sql_id`)  
6. 서버사이드 LLM만 (옵션에 API 키)  
7. (개발용) fake CNF 계획으로 LLM 없이 컴파일 E2E — **예정**

### MVP에서 안 만듦

- 벡터 DB / 외부 임베딩 API  
- CDP·마트 적재, CD/제외/발송  
- codemap 전용 스키마, 퍼널 UI, 무거운 비용 게이트  
- LLM 자유 SQL 폴백  

### 나중에 (파이프 유지한 채 강화)

- DB 전문검색·동의어 사전 고도화  
- 슬롯별 검색 병렬화  
- 유일성/규모 게이트, 실행 dry-run  
- (정책 허용 시) **내부** 임베딩 — 외부 벡터 SaaS 아님  

---

## 8. 데이터 모델 (테스트 네이밍)

namespace `woo`, schema/form/sqltable **카멜** (`testWooAi*`), label 영어.

| 스키마 | 용도 |
|---|---|
| `woo:testWooAiFragment` (`sqltable=testWooAiFragment`) | SQL 라이브러리 (5장 필드, `sql_text`/`tags`) |
| `woo:testWooAiSql` (`sqltable=testWooAiSql`) | 생성·등록 이력 (NL, **조합계획 JSON**, 최종 SQL, status) |

보류(초기 생성 안 함): `testWooAiCodemap`, `testWooAiRequestQueue`.

---

## 9. 보안·비기능

| | |
|---|---|
| outbound | LLM API만 (JSSP 서버). 브라우저 직접 호출 금지 |
| 프롬프트 | 고객 행 데이터 금지. fragment 카드(메타)만. **OpenRouter는 라우터이므로 제3자 프로바이더로 중계됨** |
| 권한(섹션1) | **필수** `testWooAiSqlGenerate`, `testWooAiSqlRegister` · **권장** `testWooAiLibraryManage`(fragment 관리·향후) |
| 옵션(섹션1) | **필수** `testWooAiLlmApiKey` / `testWooAiLlmModel` / `testWooAiLlmEndpoint` · **선택** `testWooAiLlmProvider`(기본 `openrouter`) |

---

## 10. UI (초기)

1. NL 입력  
2. 선택된 조건 목록(슬롯) + unmatched 안내 + 최종 SQL(토글)  
3. 승인 → 등록  

퍼널·고도화 UI는 이후.

---

## 11. 완료 기준 · 정확도/신뢰도 측정

### 11.1 기능 완료

1. NL → Stage A 후보 → Stage B 선택 → 조합 SQL 생성  
2. 10개 슬롯 예시가 **조합 계획 + 컴파일**로 처리 가능(라이브러리에 해당 fragment 있을 때)  
3. 없는 조건은 창작하지 않고 실패/안내  
4. 최소 검증 후 커스텀 액티비티 주입, 실행 시 transition 전달  
5. 카탈로그를 LLM에 통째로 넣지 않음 (검색 경유)

### 11.2 MVP 평가셋 (가치 검증용 · 라이브러리 소규모여도 동일)

| 지표 | 목표(초기) | 측정 |
|---|---|---|
| Slot recall | 평가 NL의 각 슬롯에 정답 fragment가 Stage A Top-N에 포함 | 골든셋 |
| Selection accuracy | Stage B가 정답 fragment를 고름 | 골든셋 |
| Composition fidelity | 컴파일 SQL이 기대 set-op 트리와 동일 | 스냅샷 |
| No-hallucination | 없는 조건에서 신규 SQL/미등록 ID 0건 | 네거티브 케이스 |

골든셋 예: “한달 신규 + 10~20대 + Y요금제 + 푸시미수신 + 수신동의” (5~12 슬롯).

---

## 12. 설계 점검 판정 (Go / No-Go)

| 항목 | 상태 |
|---|---|
| 비즈니스 알고리즘 (NL→fragment 조합→주입) | ✅ |
| 100k 검색 전략 (슬롯별 내부 검색→LLM) | ✅ |
| 모호 NL 슬롯 분해 (Pass 0/1 + 별칭 메타) | ✅ v1.4 |
| 10+ 조건 조합 신뢰도 (SELECT + set-op) | ✅ |
| 최소 외부연동 (벡터 없음) | ✅ |
| Fragment 필드 계약 (`sql_text`/`tags`/grain) | ✅ |
| `new_ver` 코어 엔진이 v1.4와 일치 | ✅ 스키마·Pass0/A/Pass1·set-op·최소게이트·Studio 반영 |
| 캠페인 섹션 1 (권한·옵션) | ✅ 가이드 제공 |
| 캠페인 섹션 2 (스키마·폼) | ✅ 가이드 제공 · 콘솔 적용 중 |

**종합:** 설계·코어 정합 완료. 캠페인 적용은 섹션 1→2 진행.

---

## 부록 A. 한 줄

**십만 fragment 안에서도 슬롯별 내부 검색으로 후보를 줄인 뒤 LLM이 고르고, SELECT 조각을 set-op으로 결정론적으로 합쳐 커스텀 액티비티에 넣는 시스템.**

## 부록 B. 용어

### B.1 본 시스템 고유 용어

| 용어 | 설명 |
|---|---|
| Stage A | Campaign 내부 fragment 후보 검색 (슬롯별) |
| Stage B | LLM이 후보 중 선택·파라미터 → CNF 계획 |
| Pass 0 | LLM이 NL을 조건 슬롯 단위로 분해하는 단계. fragment ID는 고르지 않음 |
| Pass 1 | 슬롯별 후보 카드를 보고 fragment·params를 확정하고 필요 시 merge/split 하는 단계 |
| 슬롯(slot) | NL에서 분해된 조건 하나의 단위. Stage A 검색의 입력 |
| 조합 계획 | CNF: `include[].any[]` + `exclude[]` + params |
| CNF | 논리곱 표준형. 그룹 간 AND, 그룹 내 OR. 괄호 모호성을 없애기 위해 채택 |
| 컴파일러 | CNF → INTERSECT/UNION/EXCEPT SQL (결정론) |
| set-op | 집합 연산(`UNION`/`INTERSECT`/`EXCEPT`). 조각 조합의 유일한 수단 |
| grain 키 | 고객 단위 키. 조합·CD 전제 |
| sql_text | fragment의 완전한 SELECT 조각 |
| unmatched | 라이브러리에 대응 fragment가 없어 처리하지 못한 슬롯. 창작 없이 사용자에게 안내 |
| `ai_sql_id` | 이력 레코드 PK. 워크플로우 액티비티가 런타임에 이 ID로 SQL을 조회한다 |

### B.2 Adobe Campaign 일반 용어

| 용어 | 설명 |
|---|---|
| **모수** | 캠페인 대상자 집합. 이 시스템의 최종 산출물 |
| **워크플로우** | Campaign에서 대상 추출·제외·발송을 순서대로 엮은 자동화 흐름 |
| **액티비티** | 워크플로우를 구성하는 개별 블록 (쿼리, 제외, 발송 등) |
| **커스텀 액티비티** | 표준 제공(OOTB)이 아닌, 직접 만들어 추가한 액티비티 |
| **transition** | 액티비티와 액티비티를 잇는 화살표. 모수를 다음 단계로 전달한다 |
| **work table** | 액티비티가 결과를 담아두는 임시 테이블. transition은 이 테이블 이름을 들고 다닌다 |
| **Change Dimension** | 결과 집합의 단위를 다른 차원으로 바꾸는 OOTB 액티비티. 본 시스템 다음 단계 |
| **OOTB** | Out Of The Box. Adobe가 기본 제공하는 기능. 업그레이드 시 안전하다 |
| **JSSP** | Campaign 서버에서 실행되는 JavaScript 페이지. 서버 사이드 로직을 여기 둔다 |
| **JST** | 액티비티 스크립트에 쓰이는 템플릿 문법. `<% %>` 형태이며 SQL에 섞이면 안 된다 |
| **queryDef** | Campaign의 XML 질의 정의. Stage A 검색을 이것으로 구현한다 |

### B.3 데이터 신뢰도 용어

| 용어 | 설명 |
|---|---|
| **fragment** | 재사용 가능한 조건 조각. "최근 N일 이내 구매" 같은 단위. 사람이 검증해 라이브러리에 등록 |
| **param_domain** | fragment 파라미터의 도메인/코드값 매핑. "수도권"=서울+경기 같은 의미를 못 박는다 |
| **팬아웃** | 1:N 조인으로 결과 행이 중복 증가하는 현상. 인원수가 부풀려진다. set-op 조합은 DISTINCT 시맨틱이라 구조적으로 방지된다 |
| **grain** | 결과 한 행이 무엇을 의미하는지의 단위. "1행 = 1고객"인지 "1행 = 1주문"인지 |
| **검증 게이트** | 등록 전 통과해야 하는 자동 검사 단계 (4.3) |
| **명명된 권한** | Campaign의 기능 단위 권한. 생성·등록·fragment 관리 권한을 분리한다 |

> **폐기된 용어** — `IR`(→ 조합 계획), `expr`(→ `sql_text`), `scope`/`anyRow`/`sameRow`(→ set-op),
> `md5 검사`(→ WF XML 미기록), `퍼널 카운트`(→ 보류), `미커버 요청 큐`(→ `unmatched` 안내로 대체·스키마 보류).

## 부록 C. `new_ver` 정합 체크리스트

| # | 항목 | 상태 |
|---|---|---|
| 1 | fragment: `sql_text` / `tags` / `synonyms` | ✅ |
| 2 | `searchBySlot()` — 전체 catalog LLM 주입 제거 | ✅ |
| 3 | Pass0 슬롯분해 + Pass1 조합계획 | ✅ |
| 4 | CNF set-op 컴파일러 + compile.summary | ✅ |
| 5 | 최소 gates (리터럴/도메인/allowedNames) | ✅ |
| 6 | codemap / request_queue 보류 | ✅ |
| 7 | config: LLM 옵션 3개 (JS fallback 없음) | ✅ |
| 8 | 이력: `plan_json` + GetNewIds + attribute memo + formatDate | ✅ |
| 9 | WorkflowIo 폐기 · Register=`ai_sql_id` | ✅ |
| 10 | fake plan E2E 엔드포인트 | ⏸ 예정 |
| 11 | Stage A 100k DB 검색 강화 | ⏸ 규모 확장 시 |

## 부록 D. 캠페인 적용 전제 (P0)

섹션 적용·E2E 전에 환경에서 확인할 것:

1. 커스텀 액티비티가 `ai_sql-id` → `woo:testWooAiSql.sql_query` 로드 → work table → transition  
2. Campaign 서버 → LLM endpoint outbound 허용  
3. fragment `key_column` = Change Dimension 링크 키와 동일 합의  
4. web alias `/woo/`, `loadLibrary("woo:…")` 배포 (WorkflowIo 제외)  

## 부록 E. 쉬운 설명

**한 문장으로.** 마케터가 "이런 사람들한테 보내고 싶어요"라고 말하면, 미리 검증해 둔 조건 조각들을
AI가 골라 조립해 SQL을 만들고 캠페인에 자동으로 넣어주는 기능입니다.

**어떻게 쓰나요.** AI Studio 화면에 원하는 조건을 평소 말하듯 적으면 됩니다. 잠시 뒤 어떤 조건으로
해석했는지 목록으로 보여줍니다. 맞으면 등록을 누르고, 아니면 조건을 고치면 됩니다.

**AI가 틀리면 어떡하죠.** AI는 SQL을 직접 쓰지 않습니다. 사람이 미리 검증해 둔 조건 조각 중에서
고르기만 하고, 실제 SQL 문장은 정해진 규칙대로 기계가 조립합니다. 같은 선택에는 항상 같은 SQL이
나오므로 AI가 몰래 문장을 바꿔 쓸 수 없습니다. 등록 전에는 자동 검사로 위험한 명령어가 섞였는지,
결과 단위가 고객 한 명씩 맞는지, 파라미터 값이 허용 범위 안인지를 먼저 걸러냅니다.

**없는 조건을 말하면요.** 아직 준비되지 않은 조건이면 비슷하게 지어내지 않고 "이 조건은 아직
등록되어 있지 않습니다"라고 그대로 알려줍니다. 커버리지보다 데이터 신뢰도를 우선한 결과입니다.

**SQL을 몰라도 되나요.** 네. 기본 화면에는 조건이 한글로 정리되어 나오고, 개발자가 확인하고 싶을
때만 "코드 보기"를 누르면 SQL 전문이 펼쳐집니다.

## 부록 F. `old_ver`와의 관계

`old_ver/`에는 자연어→Campaign 질의(queryDef/SQL) 변환 **프로토타입**이 있다.
본 시스템은 그 프로토타입과 **다른 시스템**이지만, 재사용·참고 가능한 부분은 아래와 같다.

| old_ver 자산 | 본 시스템에서의 활용 |
|---|---|
| SOAP 하부 계층 (`ensureSession`, `executeQuery`) | 서버사이드 질의·카운트 조회의 참고 구현 |
| `uplus:ai_sql` 저장 (`saveAiSqlRecord`/`verifyAiSqlSaved`) | 이력 저장 로직의 출발점 → `woo:testWooAiSql`로 재설계 |
| 스키마 파싱 (`parseSrcSchema`, 상속 병합) | fragment 대상 테이블 메타 확인 시 참고 |
| 카운트 조회 (`fetchRowCountViaSoap`, `buildCountFragment`) | 규모 게이트(보류) 도입 시 참고 |
| 워크플로우 템플릿 OP39 (`customActivity`) | 커스텀 액티비티 소비 지점(6.1)의 참고 구현 |

**본 시스템에서 반드시 바꾼 것**

- LLM을 **브라우저 직접 호출 금지** → JSSP 서버 사이드 호출 (9장 보안)  
- API 키·계정 **평문 하드코딩 금지** → 서버 사이드 옵션(`testWooAiLlmApiKey`)으로 분리  
- LLM이 **SQL/queryDef를 자유 생성하던 방식 폐기** → fragment 선택 + 결정론적 set-op 컴파일  
- 워크플로우 XML 전체 Write **폐기** → 이력 등록 후 `ai_sql_id` 참조 (6.1)  
- 단일 스키마 대상 → 키가 같으면 **다중 테이블 조합** 지원  

> **보안 주의.** `old_ver` 코드에 평문으로 있던 API 키·관리자 계정·접근 토큰은 placeholder로 치환했다.
> 실제 값은 `old_ver/secrets/OLD_VER_SECRETS.md`(git 제외)에 보관한다. 해당 자격증명은 재발급 권장.

---

_작성: v1.6 — `Rebuild/PRD.md` v1.5 이관 통합 + v0.1 부록 병합. 가이드: `docs/report/01_개발가이드.md`._
