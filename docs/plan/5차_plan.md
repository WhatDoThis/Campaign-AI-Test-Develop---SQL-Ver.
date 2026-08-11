# 5차 plan — 조건매칭과 SQL 목록

| 항목 | 값 |
|---|---|
| 가이드 | `docs/report/upgrade_plan/07_5차_조건매칭과SQL목록.md` |
| 선행 | 3차 PASS + 4차/TG-E PASS (log #180·#184) |
| Studio litmus | `v=149` (현재 148 → bump) |
| 상태 | 구현 완료(+전역매칭 v=150) · HUMAN/TG-F 대기 |

## 고유 규칙

- FLOW-5-3: fragment **name** 집합 Jaccard ≥ **0.9** (텍스트 95%/임베딩 금지)
- J-9-3-4: SQL `normalizeSql` 후 해시 + 동일 `workflow_name` → skip + div 안내
- UI-3-5: 폴더/캠페인 전체 WKF 스캔 금지 → 매칭 결과(+새 WKF)만

## 변경 요지

| 경로 | 내용 |
|---|---|
| `new_ver/js/testWooMatch.js` | 신규 · exact + Jaccard · overlap 필드 |
| `new_ver/jssp/testWooAiMatch.jssp` | 신규 · Match JSON API |
| `new_ver/js/testWooRepository.js` | hash lookup · used_fragments 목록 조회 |
| `new_ver/js/testWooLifecycle.js` | (재사용) normalizeSql / hash — 필요시 sqlHash 공개 |
| `new_ver/jssp/testWooAiRegister.jssp` | 동일 해시 skip · `created:false` |
| `new_ver/jssp/testWooAiStudioJs.jssp` + html + Studio shell | 경로 A/B · MATCHED 목록 · 정보바 SQL ID · v=149 |
| `docs/log/log.md` | #185 |

## UX 플로우

### 경로 A (새 WKF 후 조건)
1. 캠페인 선택 → WKF 모드: 매칭 전엔 **새 WKF만** (전체 listWkfs 제거)
2. 새 WKF 생성 → NL → Generate→Register → SQL 사이드 목록 갱신
3. 정보바에 SQL ID

### 경로 B (조건 후 WKF)
1. 캠페인 선택 후 NL Generate (WKF 없어도 허용 — match용 plan)
2. Match API → **전역** registered SQL Jaccard≥0.9(+exact) + 항상 새 WKF
3. 기존 WKF 선택 → Program/Campaign 자동 반영 → SQL 목록 / 새 WKF → **현재** 캠페인에 clone 후 Register
4. 목록 행 3줄: WKF(label/name) · 캠페인(label/name)|Program · NL 조건 (ellipsis+title)

## 상수

- `MATCH_KEY = fragment.name`
- `JACCARD_THRESHOLD = 0.9`
- 임계 미만: 목록 제외 (하위 섹션 없음)

## DoD

- [ ] 경로 A/B
- [ ] Jaccard 필드 + 0.9 미만 제외
- [ ] 동일 SQL 재등록 skip + 안내
- [ ] 새 WKF SQL 빈 목록
- [ ] 정보바 SQL ID
- [ ] `0.95`/95% 텍스트유사도 로직 0
