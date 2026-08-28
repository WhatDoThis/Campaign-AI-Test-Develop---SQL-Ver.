# 07 · Fragment 임베딩 (Dedup L2) [완료]

> **상태:** `[x]` 실 반영 (#155)  
> **흡수:** `25_[완료]_임베딩경로_실태점검.md`

---

## 1. 범위 (한 줄)

임bedding은 **Foundry fragment dedup L2 정렬**에만 쓰인다. **WKF Match(`testWooMatch`)와 무관.**

---

## 2. 구현 요약

| 항목 | 상태 |
|---|---|
| `testWooEmbedding.js` | `[x]` embed · cosine · embedTextOf |
| 대상 텍스트 | `label` + `description` + `tags` (**sql_text/nl 제외**) |
| 소비처 | `testWooDedup.js` L2 rerank only |
| `embedEnabled` | **`false`** (`testWooEnv.js`) — 기본 OFF |
| publish 시 `emb_*` Write | `[x]` #155 Task3 |
| `_embedEndpoint` / postEmbedding 오류 처리 | `[x]` #155 |
| Match/Studio 임베딩 호출 | **0건** |

### dedup L2 동작

L0 hash → L1 jaccard → **L2 embedding(정렬)** → L3 대칭차 → verdict.  
L2는 **최종 duplicate 판정을 바꾸지 않음**. `vec==null` → `l2:0` 진행.

---

## 3. 핵심 자산

| 경로 | 역할 |
|---|---|
| `new_ver/js/testWooEmbedding.js` | 임베딩 API |
| `new_ver/js/testWooDedup.js` | L2 소비 |
| `new_ver/js/testWooLifecycle.js` | publish emb_* |
| `new_ver/schema/testWooAiFragment.xml` | emb_vector 등 5필드 |

---

## 4. HUMAN·log

- #155: embed OFF · publish 영속화 · 서울/인천 Match 오탐과 **인과 없음** 확인

---

## 5. 회귀 금지

- Match 품질 문제를 임bedding ON으로 “해결” 서술 금지
- AI가 `embedEnabled=true` 전환 금지 (운영자 승인+스모크)
