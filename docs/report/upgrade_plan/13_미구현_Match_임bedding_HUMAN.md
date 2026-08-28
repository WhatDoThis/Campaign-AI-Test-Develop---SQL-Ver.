# 13 · 미구현 · Match · 임bedding · HUMAN

> **상태:** 미착수 / 운영자 승인 전  
> **흡수:** 구 `09` 잔여 A/B · `22` 후속 · `26` C1~C6 · `40` C4-B

---

## A. HUMAN · 배포 게이트

| ID | 항목 | 선행 | 비고 |
|---|---|---|---|
| UX-v198 | Studio UX litmus | `08` §3 | 진단 닫힘 · timed recent NL |
| EMB-SMOKE | publish `@emb_source_hash` · 재check 0회 | `07` | embed ON 전 |
| C1~C6 | Match 값매칭 6시나리오 | #154 배포 | Option **잠시 ON** 후 검증 |

### C1~C6 요지 (구 `26`)

| 케이스 | 기대 |
|---|---|
| SAME | 이름+값 일치 → 목록 |
| CONFLICT | 서울 vs 인천 → **제외** |
| MISSING | 후보에 값 없음 → 대조표 표시 |
| 동일 SQL | sqlContentHash → 「동일」 배지 |

전부 PASS + **사용자 승인** 후에만 Option 상시 ON.

---

## B. Match · 임bedding (코드 있음 · OFF)

| ID | 항목 | 근거 |
|---|---|---|
| Match-ON | `testWooAiMatchEnabled=true` | #152/#154 |
| C4-B | 접두 3값 clarify 칩 | #176 · 샘플 축 없음 |
| EMB-ON | `embedEnabled=true` | #155 · dedup L2만 |
| EMB-3-3 | 기존 후보 fragment emb DB 배치 | publish 경로만 반영 |

---

## C. PoC · 설계 한계 (구현 안 함)

| ID | 항목 | 비고 |
|---|---|---|
| DOMAIN-SYN | param_domain 동의어 정규화 | **불가** 판정 |
| RANGE-DISC | 범위형 discover | **제외** 정책 |
| LEGACY-V | plan_json 공란 registered | 값매칭 비노출 |
| MATCH-500 | registered>500 WKF 누락 | 설계 한계 |
| DUP-* | session.Duplicate WKF | CreateInstanceFromModel 유지 |
| WKF-META | 실행일·건수 UI | 스키마 미연동 |

---

## D. 사용법

1. Chat = **ID 1개**  
2. `[완료]` `09`~`12`와 **중복 구현 금지**  
3. 완료 시 log + `01` 갱신 (별도 작업)
