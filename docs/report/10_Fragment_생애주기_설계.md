# 10. Fragment 생애주기 설계 — 승인 게이트 → 라벨 + 사후 큐레이션

`v1.0` · 2026-08-06 · Test Woo (`woo` / `testWoo*`)  
관련: `new_ver/schema/testWooAiFragment.xml` · `docs/main/PRD.md` · log #98

> 본 문서는 **설계 + 스키마 필드 정의**만 다룬다. Foundry 발행·Stage A·승인 런타임 코드 변경은 별도 단계에서 한다.  
> (구 파일명 `10_승인시스템전면교체.md` — 채팅 원문·시점 오류를 제거하고 본 문서로 개명·재작성)

---

## 1. 문제 정의

사전 승인 비용은 **O(생성량)** 이다. Foundry가 성공할수록 사람이 더 바빠지는 구조적 모순이다.

큐레이션 비용은 **O(라이브러리 크기)** 이며, write-time dedup 때문에 라이브러리는 **포화**한다. 조직이 묻는 조건 종류는 유한하다.

### 현행 경로 (코드 기준)

1. Foundry 게이트 통과 → `status=verified` 로 publish  
2. Request Queue → `awaiting_approval`  
3. 사람 승인 → `status=active` (+ `active` 플래그)  
4. Stage A / 컴파일러는 **`active`만** 통과 (`testWooFragments.js` · 스키마 정의서)

대부분 fragment는 한두 번 쓰이고 끝나는데, 생성 시점마다 사람이 막는 것이 병목의 정체다.

---

## 2. 업계 선례

| 선례 | 요지 | URL |
|---|---|---|
| Databricks Unity Catalog `system.certification_status` | 값 2개(`certified` / `deprecated`). pending 없음. 인증은 **라벨**이지 write 게이트가 아님 | https://docs.databricks.com/aws/en/data-governance/unity-catalog/certify-deprecate-data |
| Snowflake Cortex Analyst VQR | 검증 쿼리는 **랭킹 근거**. VQR 없이도 답할 수 있음 | https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst/verified-query-repository |
| Cortex Verified Query Suggestions | 제안 기준 = high frequency / semantic info / novelty. **자동 적용 안 함**, 사람 검토 큐로만 제시 | https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst/verified-query-suggestions |
| Looker content certification | **90일 미조회** ≈ Unused Content 판정 기준 차용 | https://docs.cloud.google.com/looker/docs/content-certification |
| Vanna AI (반례) | 무검증 Q–SQL 학습 데이터 주입 리스크가 반복 지적됨 | (커뮤니티·이슈 논의) |

**결론:** 게이트(실행·문법·grain)는 유지하고, **사람만 기본 write-path에서 제거**한다. “그냥 다 저장”은 안 된다.

---

## 3. 검수 트리거 전환 (핵심)

| 잘못된 트리거 | 올바른 트리거 |
|---|---|
| 새로 만들어졌다 (novelty) → 사람 검수 | **많이 쓰인다 (frequency)** → 사후 검수 |
| near dedup → 사람 비교 | near → **배치 청소(병합 제안)**. 사람 눈 불필요 |

게이트를 통과하는 **의미 오류**(예: “서울”을 수도권으로 해석)는 near로 잡히지 않는다.  
한 번 쓰이고 죽을 fragment를 사람이 보는 대신, **재사용이 증명된 소수**를 본다. 검수량이 생성량의 몇 %로 떨어진다.

---

## 4. 상태 매핑표 (병렬 `lifecycleState` 금지)

기존 `fragmentStatus` enum을 유지하고 **`certified` 값 1개만 추가**한다. `status`가 단일 상태 필드다.

| 현행 | 전환 후 의미 | 비고 |
|---|---|---|
| `draft` | 게이트 실패. Stage A 제외 | 변경 없음 |
| `verified` | **민감 컬럼** 참조로 blocking 승인 대기 | 의미 축소. 일반 슬롯은 여기 안 옴 |
| `active` | 게이트 통과 시 **자동 진입**. 기본 상태 | 승인 제거의 핵심 |
| `certified` | **신규**. Stage A 랭킹 가산점. 사용 조건 아님 | enum 값 추가 |
| `deprecated` | 상위 버전 발행으로 현행에서 밀림 | **기존 의미 유지**. 큐레이터 폐기 용도 금지 |
| `revoked` | 큐레이터 폐기 · **킬스위치**. 참조 차단 | `revoked_reason` / `by` / `at` 재사용 |
| `rejected` | 민감 경로 반려 | 변경 없음 |

**마이그레이션:** 기존 `verified` 잔여분은 1회 수기로 `active` 또는 `rejected`로 정리한다.

### 필드 지뢰 (반드시 지킬 것)

| 금지 | 이유 | 대안 |
|---|---|---|
| `lifecycleState` 신설 | `status`와 이중 상태 | enum에 `certified`만 추가 |
| `useCount` / `lastUsedAt` 신설 | 이미 `usage_count` / `last_used_at` 존재 | 기존 컬럼 재사용 |
| `supersedes_id`를 병합용으로 확장 | 같은 `name` **버전 계보**용. `idx_name_version` + `is_current` 의존 | 이름 다른 fragment 간 병합은 **`merged_into_id`** |
| `deprecated`를 킬스위치로 사용 | 이미 “정상 버전 교체” 의미 | 킬스위치 = **`revoked`** |

---

## 5. `certified` 자동 승격 규칙

| 경로 | 내용 | 도입 단계 |
|---|---|---|
| (a) | `usage_count >= N` + 야간 게이트 재실행 무사고 | **1차** |
| (b) | 사람 승인 | 예외·민감·다이제스트 |
| (c) | 교차 모델 일치(동일 슬롯 보조 모델 재생성 → 행수/키 집합 대조) | **3단계 이후**. 현재 단일 OpenRouter 경로라 1단계 필수 조건 아님 |

근거(연구): CM-SQL(BIRD dev EX 65.65%), ExCoT(BIRD 57.37→68.51).  
`certified`는 **사용 조건이 아니라 랭킹 가중치**다.

---

## 6. 사람 개입 지점 (2곳만)

1. **민감 컬럼 allowlist** 참조 fragment → `status=verified`로 blocking 유지  
   - 대상 컬럼 목록 = **TBD** (수신거부·마케팅 수신동의·개인식별 계열 예정, 임의 추정 금지)
2. **월 1회 다이제스트** — 고빈도 미인증 상위 10건 + 병합 제안 + 미사용 목록  
   - Cortex Suggestions의 “1회 최대 10건·자동 적용 안 함”을 차용

Explorer 승인 UI(폼 Radio / 목록 커맨드 / FragmentReview HTML)는 폐기하지 않고  
**민감 예외 · 킬스위치(revoked) 전용**으로 격하한다.

---

## 7. 야간 큐레이터 배치

**주기: 일 1회(야간).** 1시간 주기 금지.

사유: 공유 라이브러리 mutation → 생성 경로와 동시성 충돌; near는 write-time dedup이 이미 처리.

| Phase | 내용 |
|---|---|
| 1 | `active`/`certified` fragment **게이트 재실행** → 회귀 검출 (최우선). ACC 스키마 변경으로 조용히 0건이 되는 사고는 사전 승인으로 못 막음 |
| 2 | `last_used_at` 기준 90일 미사용 **표시만** (상태 변경 아님) |
| 3 | near 클러스터 병합 **제안만**. 자동 병합은 로드맵 4단계까지 보류 |

물리 삭제(DELETE) 금지. 병합은 tombstone + `merged_into_id` 별칭. `hardDelete`는 운영 기본값으로 쓰지 않는다.

---

## 8. 킬 스위치

- 원클릭 → `status=revoked` + `revoked_reason` 필수  
- 해당 fragment를 참조한 워크플로/SQL 이력 **역조회** (`listImpact` 등)  
- **신규 상태 불필요.** 기존 `revoked`로 충분

---

## 9. 도입 로드맵

| 단계 | 내용 | 완료 판정 |
|---|---|---|
| **1** | Foundry 발행: 일반 슬롯 `verified`→**`active` 직행** + 민감 컬럼만 `verified` | Studio에서 일반 NL이 승인 대기 없이 SQL까지; 민감 슬롯만 큐/승인 |
| **2** | 야간 큐레이터 Phase 1~2 | 회귀 검출 저널 + 90일 미사용 표시 |
| **3** | `certified` 승격 + Stage A 랭킹 가중치 | 고빈도 fragment가 후보 상위에 노출 |
| **4** | 월간 다이제스트 UI + 병합 제안 | 관리자 30분 이내 검토 루틴 |

오늘(문서 작성일 기준) NL 라운드트립(T1–T3)은 **현행 코드 + 잔여 verified 1건 수기 Active**로 진행한다. 1단계 코드 전환은 T3(2슬롯·예산 132) 실증 후 별도 브랜치.

---

## 10. 미해결 (TBD)

- 민감 컬럼 allowlist 목록  
- `certified` 승격 임계 `N` (`usage_count`)  
- 야간 게이트 재실행 **과금 상한**

---

## 스키마 준비 요약 (이번 커밋)

정의만 추가. 읽기/쓰기 로직 없음.

| 항목 | 내용 |
|---|---|
| enum | `fragmentStatus`에 `certified` |
| 속성 | `certified_by` (string 64), `certified_at` (datetime), `merged_into_id` (long) |
| 재사용 | `usage_count`, `last_used_at`, `revoked_*`, `approved_*`, `supersedes_id`(버전 계보 전용) |
