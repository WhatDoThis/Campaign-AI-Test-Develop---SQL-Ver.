# 08 · 운영 회귀 · Span / Orphan / Studio UX [완료]

> **상태:** `[x]` repo + HUMAN PASS (Span/Orphan) · UX repo `[x]` / litmus `[H]`  
> **흡수:** `44_[완료]_운영회귀_SpanOrphan_StudioUX.md`  
> **트랙:** 파도1~3 이후 운영 회귀 묶음

---

## 1. Span YMS (추출)

| 항목 | 내용 |
|---|---|
| 증상 | `2023년 1~6월` FAIL · compact `2023 1~6월` compile fail |
| Fix | `healYearMonthSpanDomain` · compact induce · `libraryHitPredicate` |
| HUMAN | B~E PASS · E2E Register #361 |
| litmus | fragContract **204** · llm **200** · foundry **179** · compiler **168** |

**동결:** compiler gates · EnPivot few-shot · span 카탈로그 heal 경로만

---

## 2. Orphan SQL (셸)

| 항목 | 내용 |
|---|---|
| 정책 | WKF 삭제 후 `woo:testWooAiSql` **보존** · `orphan` 배지 · Match 제외 |
| UI | `_reuseOrphanSql` · validate(plan) · stale chips 제거 |
| 흐름 | putDraft + `_beginMapping(fromOrphan)` — Generate 재호출 없음 |
| HUMAN | getSql→Program→Register **41472** (#366) |
| litmus | Studio **v=197** |

---

## 3. Studio UX

| 항목 | 내용 |
|---|---|
| 진단 | 기본 **닫힘** · 「클릭하여 열기/접기」 |
| 이전 질문 | max **10** · `(HH:MM) 질문` |
| 저장 | Option `testWooAiNlRecent_{login}` (twStudioCache **무관**) |
| litmus | Studio **v=198** · Validate `pushRecentNl` |

---

## 4. 배포 묶음

1. JS: fragContract 204 · llm 200 · foundry 179 · compiler 168 · match 160  
2. JSSP: testWooAiStudio **v=198** · StudioJs · Validate  
3. Context: expectedByMod 정합

---

## 5. 회귀 금지

- span 축·값 JS 하드코딩
- orphan 시 Generate 강제
- Match ON · #178 cold-start (별도 키)
