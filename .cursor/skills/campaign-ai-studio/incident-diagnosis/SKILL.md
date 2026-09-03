---
name: campaign-ai-incident-diagnosis
description: >-
  Campaign AI Studio 버그·장애 대응 알고리즘. 증상 재현·근거 수집·가설 검증·롤백/유지 판정·
  downstream 회귀 검수. 동일 증상 반복·원인 오판·추측 패치 누적 시 사용.
---

# Incident Diagnosis (Campaign AI Studio)

버그/장애 시 **추측 패치 → 증상 동일 → 또 패치** 루프를 끊는다.  
`.cursor/rules/fix-downstream-review.mdc`는 **Fix 이후** downstream 검수.  
본 Skill은 **Fix 이전·이후의 원인 판별·롤백 판정**을 담당한다.

---

## 0. 언제 발동

- 동일 증상이 **2턴 이상** 지속
- 사용자가 “여전히 같다” / 캡처·errId·gate code 제공
- **다른 증상**이 새로 생겼고, 직전 패치와 인과 가능
- Explorer PASS vs Studio FAIL 등 **경로 비교**가 필요할 때
- “왜 이걸 고쳤는지” / “롤백해야 하나” 질문

**발동 전 금지:** 로그·errId·API 경로 비교 없이 “아마 ~일 것”으로 코드 수정.

---

## 1. 알고리즘 (REPRO → PROBE → FIX → VERIFY → ADJUDICATE)

```
REPRO  ── 증상·입력·litmus·errId 고정
  │
PROBE  ── 가설 목록 + 반증 가능 진단 (코드 변경 최소·0도 OK)
  │
FIX    ── 단일 가설만 · 최소 diff · root cause 1줄
  │
VERIFY ── 동일 REPRO 재실행 + downstream + sibling path
  │
ADJUDICATE ── Keep / Rollback / Defer · log # · Skill/Rule 갱신
```

### 1-A. REPRO (재현 고정)

| 항목 | 기록 |
|------|------|
| Symptom | 사용자 한 줄 + UI 위치 (#err / hint / Explorer) |
| Input | NL, Program/Campaign/WKF id, 클릭 순서 |
| Evidence | 진단로그, `errId`, `res.code`, server `debugTrace` |
| Litmus | `v=`, `wfClone=`, `libs: allMatch` |
| Baseline | **Explorer 동작** / PoC PASS / 이전 log # |

**완료 기준:** 같은 REPRO를 HUMAN 또는 agent가 다시 실행할 수 있음.

### 1-B. PROBE (가설·반증)

가설은 **레이어**로 쓴다 (한 번에 하나만 FIX):

| Layer | 예 |
|-------|-----|
| L0 Config | Option 미로드, cfg/env 혼동 |
| L1 API | `CreateOperationFromModelId` vs `CreateInstanceFromModel` |
| L2 Data | queryDef shape, `@isModel`, orphan WKF |
| L3 UI | optimistic UI, sessionStorage, err flash |
| L4 Contract | pipeline hop, Register inject |

각 가설에 **반증** 1줄:

- “맞다면 진단로그에 X가 보여야 한다”
- “틀리면 Explorer에서도 같은 API를 써야 한다”

**PROBE 수단 (코드 변경 없이 우선):**

- grep caller / sibling consumer
- `template_diagnostics`, `create_source`, `wkfCountAfterClone` 등 **이미 있는** 진단 필드
- Explorer vs Studio **API 경로 표** (같은 template id인지)

### 1-C. FIX (단일 가설)

- **한 턴 · 한 root cause · 한 FIX**
- 진단-only 추가는 FIX와 **같은 커밋/배포**에 넣되, “가설 미확정” 상태에서 행동 변경과 섞지 않음
- `fix-downstream-review.mdc` 형식으로 downstream 표 작성 **후** 완료 선언

### 1-D. VERIFY

| 검사 | Pass 조건 |
|------|-----------|
| Same symptom | REPRO 재실행 시 증상 없음 |
| Root path | errId / gate / SQL / Register E2E |
| Downstream | pipeline hop 표 Pass |
| Sibling | **다른 진입점** (Explorer, createCampaign vs createWkf) 회귀 없음 |
| Negative | 의도적으로 깨지면 안 되는 경로 1개 smoke |

### 1-E. ADJUDICATE (Keep / Rollback / Defer)

**증상 동일 2회 실패** → FIX 중단 → PROBE부터 재시작.  
**원인 오판 확정** → 아래 롤백 매트릭스.

---

## 2. 롤백 매트릭스

| 상황 | 행동 |
|------|------|
| **단일 가설 FIX** + REPRO 동일 + 새 증거로 **가설 반증** | 해당 FIX **롤백** → PROBE 재실행 → **다른** 단일 FIX |
| FIX가 **진단만** 추가 (행동 동일) | 롤백 불필요 |
| FIX A 오판 + FIX B가 **A 위에** 동작 | A의 **행동 변경**만 롤백; B가 A 없이도 성립하면 A 제거 |
| **복합 장애** (증상 2개+, 다른 레이어) | **전체 롤백 금지** — fault tree로 레이어별 bisect |
| FIX 후 **새 증상** + 직전 FIX와 API/상태 공유 | 직전 FIX **부분 롤백** 또는 guard 추가 후 VERIFY |
| 방어 코드 (fallback) + **정본 경로 PASS** | Defer: “미발동 fallback”으로 표시, log에 **Prune 후보** |

**롤백 ≠ git revert 전체.**  
`new_ver/`에서 **가설별 hunk** 단위. baseline #133/#135/#137/#141 금지.

---

## 3. “동일 문제 3번” 사용자 알고리즘 ↔ agent 매핑

| 사용자 단계 | Agent |
|-------------|--------|
| (1) 문제 → 수정 | REPRO + PROBE + FIX (가설 1) |
| (2) 동일 → 수정 | **STOP**: 가설 1 **Rejected** · PROBE 강화 · FIX 가설 2 |
| (3) 동일 → 수정 | **Escalate**: HUMAN에 REPRO packet · Explorer 비교 요청 · **행동 변경 FIX 금지** |
| (4) 다른 문제 | fault tree: (1)~(3) FIX **인과** 표 · 무관하면 별 트랙 |
| 오판 확정 | **롤백 매트릭스** · log에 `Superseded hypothesis` |

---

## 4. 복합 장애 (단순 롤백 위험)

1. 증상을 **독립 항목**으로 쪼갬 (예: 날짜 오표시 ≠ WKF 탭 없음 ≠ WKF_NO_AI_ACTIVITY)
2. 레이어 **bisect**: Config → API → UI
3. 각 항목에 **별도** Keep/Rollback
4. 한 FIX가 두 증상을 동시에 해결한다고 **주장 금지** — 항목별 VERIFY

---

## 5. 추측 패치 누적 방지 (코드·log)

### FIX 전 (필수)

- [ ] REPRO packet (Symptom / Evidence / Baseline)
- [ ] 가설 1줄 + 반증 1줄
- [ ] Explorer vs Studio **같은 template id·다른 API** 여부 확인

### FIX 후 (필수)

- [ ] `docs/log/log.md` — Purpose에 **가설** + **Rejected/Confirmed**
- [ ] downstream 표 (`fix-downstream-review.mdc`)
- [ ] 오판 FIX → log body `Superseded by #NNN` (삭제 대신 추적)

### Prune 후보 태그 (헤더 또는 log)

- `Defensive:` — 정본 경로 PASS 시 미발동
- `Superseded:` — 더 정확한 FIX 존재; 향후 제거 검토
- `Diag-only:` — 행동 변경 없음

---

## 6. REPRO packet (사용자·HUMAN 전달 템플릿)

```text
Symptom:
Evidence: (errId / diag line / screenshot)
Repro steps:
Litmus: v= wfClone=
Baseline: Explorer PASS? PoC #?
Hypothesis:
Falsifier:
```

---

## 7. Campaign AI 자주 틀리는 분기 (Probe 체크리스트)

| 증상 | 먼저 의심 | 반증 |
|------|-----------|------|
| Explorer O / Studio X | **API 경로** 다름 (CreateOperationFromModelId vs CreateInstanceFromModel) | `create_source` / `afterClone` |
| 빨간 err **반짝** | UI race vs **server err** | errId·Network response body |
| WKF 탭 없음 | WKF 0건 vs campaign type | `wkfCountAfterClone` |
| aiStudioSql 없음 | T3b template clone 한계 | sibling WKF `_wfCanvasHasAiActivity` |
| recentNl 날짜 틀림 | legacy `nl_recent_at` | `>=1700000000` 초 vs ms |
| Option 안 먹음 | **Config 미로드** | `src=option` in diagnostics |

---

## 8. 2026-09-02 감사 예시 (교훈)

| # | 가설 | 판정 | 조치 |
|---|------|------|------|
| 437 | recentNl ts 깨짐 | **Confirmed** | Keep |
| 437 | template_diagnostics | Diag-only | Keep |
| 438 | Config 미로드 | **Confirmed** (방어) | Keep `_ensureCfgLoaded` |
| 438 | createCampaign WKF 0 | **Rejected** on lgu-test (`afterClone=1`) | Keep `_ensureDefaultWkf` as **Defensive** |
| 439 | err flash = UI race | **Rejected** (실제 `WKF_NO_AI_ACTIVITY`) | Keep selectWkf (**아키텍처 개선**, 무해) |
| 440 | T3b aiStudioSql 미복제 | **Confirmed** | Keep `_createWkfFromReference` (**정본 FIX**) |

**롤백 불필요.** Prune 검토: `_ensureDefaultWkf` 내 CreateInstanceFromModel fallback — lgu-test에서 `afterClone=1`이면 미발동.

---

## 9. 다른 문서와 관계

| 문서 | 역할 |
|------|------|
| `fix-downstream-review.mdc` | FIX **후** downstream |
| `pipeline-downstream-review.md` | NL→SQL hop |
| 본 Skill | FIX **전** PROBE · FIX **후** ADJUDICATE · 롤백 |
| `acc-deploy-verify/SKILL.md` | 배포 후 litmus |

**순서:** incident-diagnosis (PROBE) → fix-downstream-review (FIX+trace) → acc-deploy-verify (배포).
