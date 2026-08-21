# SQL-First 여정 정본 (#146R · 작업1)

> **문서 전용**. `new_ver/` 변경 없음.  
> 근거 조사: `18_[완료]_PoC-S_SQLFirst타당성.md` (#145R)  
> 원문: `[별도]_고도화_개발아이디어_관리자작성본.md` (2026-08-12 추가 수정 방향 · 2026-08-13 EN-Pivot은 ST0 **내부**)  
> 임계 정책: 원문 “95%”는 **채택하지 않음** — containment Top-10 + 동일 배지 (`12_PoC-S` · VLDB 근거).  
> ST0 Generate 좌표계: `#174` EN-Pivot (`37_…`). 여정 ST0~ST6 순서는 D-1 유지.

---

## 1. 목표 (한 줄)

조건을 먼저 뽑고 → 유사 SQL을 보고 → 그다음 프로그램/캠페인/WKF에 매핑·반영한다.  
뽑기(ST0)의 내부 좌표계는 `#174` EN-Pivot이다. 셸 순서(ST0~ST6)는 바꾸지 않는다.

---

## 2. 상태 정본 (ST0~ST6)

| 상태 | 이름 | 진입 | 이탈 | 표시 요소 |
|---|---|---|---|---|
| **ST0** | 조건입력 | 최초 진입 · 초기화 후 | 조건 제출 성공 → ST1 | 좌: 입력 활성. 우: 빈 패널 + 안내. 브레드크럼: 조건만 강조 |
| **ST1** | SQL목록 | ST0 제출 · ST2+에서 뒤로/브레드크럼 | 신규생성→ST2(캐시) · 기존선택→ST2(확정) | 우: 상위 10건(+캐시 상단 병합). 0건이면 “유사 없음”+[새 SQL 생성]만 |
| **ST2** | SQL확정 | ST1에서 생성/선택 | 분기 A→ST3 · 분기 B→ST3~ST5 점프 | 확정 SQL 요약·배지. 캐시면 “미반영(임시)” |
| **ST3** | 프로그램선택 | ST2(신규) · “다른 WKF에도 반영” | 선택 → ST4 | `listAiFolders` 재사용. 헤더 “프로그램 선택” |
| **ST4** | 캠페인선택/생성 | ST3 | 선택/생성 → ST5 | `listCampaigns` / `createCampaign` 재사용 |
| **ST5** | WKF선택/생성 | ST4 · 분기 B 점프 착지 | 선택/생성 → 반영 요청 | `listWkfs` / `createWkfFromTemplate` (+복제 보조는 R7) |
| **ST6** | 반영완료 | 커밋 트랜잭션 성공 | [다른 WKF에도 반영]→ST3 · 초기화→ST0 | 성공 배너 · 브레드크럼 전체 활성 · [WKF 열기] |

### 분기

| 분기 | 조건 | 경로 |
|---|---|---|
| **A · 신규 SQL** | 목록 0건 또는 [새 SQL 생성] · 캐시에 draft | ST2 → ST3 → ST4 → ST5 → ST6 |
| **B · 기존 SQL** | ST1에서 registered 항목 선택 | ST2에서 해당 SQL의 program/campaign/workflow로 **즉시 점프**. 점프 후에도 ST5에서 **다른 WKF로 변경 가능** |

intent 버튼(create/reuse)은 **폐기**. 분기는 목록 데이터로만 결정한다.

---

## 3. 네비게이션 규칙 (원문 반영 · 축약 금지)

### 브레드크럼
선택 단계 또는 SQL 목록 단계로 이동. 목록에선 여전히 캐시 저장된 생성한 SQL 보임.

구현 해석:
- 선형: `조건 > SQL > 프로그램 > 캠페인 > 워크플로우`
- 완료 단계만 클릭 가능
- ST1 또는 임의 선택단계(ST3~ST5)로 이동 가능
- 이동해도 캐시 SQL은 목록에 유지

### 뒤로가기
선택 단계 또는 SQL 목록까지 뒤로가기 가능. 목록에선 여전히 캐시 저장된 생성한 SQL 보임.

구현 해석:
- ST1까지 pop 가능 (기존 `goBack` 스택 재사용 · 신규 스택 금지)
- 캐시 유지

### 초기화
빈 SQL 목록. 즉, 초기 진입단계로 이동되며 워크플로우 선택 후 반영까지 완료되지 않은 SQL 또한 목록에서 제거됨.

구현 해석:
- ST0 복귀
- 캐시 전체 삭제
- 서버 registered 코퍼스는 건드리지 않음

### 창 종료 또는 콘솔 종료 등
반영까지 완료되지 않은 SQL 휘발.

구현 해석:
- sessionStorage(가용 시) 또는 JS 전역 소멸에 위임
- 별도 beforeunload 서버 삭제 없음 (`12_PoC-S` S7/S8)
- Foundry 큐 잔여물은 별도 정책(§5)

---

## 4. 캐시 SQL 표시 규칙

| 규칙 | 내용 |
|---|---|
| 저장 | 미반영 SQL은 `woo:testWooAiSql`에 **쓰지 않음**. 기록 시점은 ST6 성공만 (`12_PoC-S` S3) |
| 구조 | `{ cacheId, createdAt, nl_request, plan, sql, usedFragments, sqlHash, status:"draft" }` · `cacheId` 접두어로 DB id와 구분 |
| 배지 | 목록에서 **「미반영(임시)」** — registered와 시각 구분 |
| 매칭 | 캐시 항목은 매칭 코퍼스 **아님** · containment 수치 계산·표시 **금지** |
| 병합 | ST1 재렌더 시 캐시를 **상단**에 붙이고, 그 아래 서버 discover Top-10 |
| 반영 성공 | 해당 `cacheId` 삭제 |

저장처 우선순위 (`12_PoC-S` S8):
1. `sessionStorage` — **HUMAN_CONSOLE 확인 후**만 채택
2. JS 전역 — 불가 시. 리로드 소실을 한계로 명시 + 상시 안내

네임스페이스: `twStudioCache` + schema version 필드.

---

## 5. 매칭·목록 규칙 (화면)

| 규칙 | 내용 |
|---|---|
| 지표 | containment = \|Q∩X\| / \|Q\| (VLDB). Jaccard는 보조 정렬만 |
| 컷오프 | 비율 임계 **없음**. `intersectionCount >= 1` only |
| 개수 | Top-10 (`DISCOVER_TOP_N=10`) |
| 동일 | 정규화 SQL 해시 일치 시에만 **「동일」** 배지 |
| 카드 문구 | nl_request · “내 조건 N개 중 M개 포함” · “이 WKF엔 조건 K개가 더 있음”(K>0) · program/campaign/workflow · 점유 배지 |
| 금지 | “유사도 95%” 수치 노출 · 가짜 최종실행일/대상건수 자리 |

현행 코드(#147)는 `containment == 1.0` · Top-20 — **본 정본과 불일치**. R1(#147R)에서 정본에 맞춤.

---

## 6. 커밋(반영) 규칙 요약

유일한 커밋 지점 = ST6.

1. 락 획득 (soft-fail **불가** — 조회 단계와 다름)
2. customActivity SQL 주입 (기존 있으면 2단계 클릭 후 덮어쓰기)
3. `woo:testWooAiSql` 기록 (workflow 참조 포함 · WKF당 신규 행)
4. 락 해제

실패 시 캐시 유지. 부분 기록 금지. Spawn 금지. J-9-5-2 불가 유지.

상세: R6 `#150R` 가이드.

---

## 7. 큐 잔여물 정책 (문서화 · 구현은 R8)

`12_PoC-S` S7: 폴링 중 창 종료 시 큐 행 잔존. TTL 삭제 없음.

| 항목 | 정책 |
|---|---|
| 사용자 약속 | “미반영 SQL은 마케팅 이력에 남지 않음”(AiSql 미기록) |
| 서버 현실 | Foundry 큐에는 요청 흔적 가능 (최대 폴링 10분 + stale 30분) |
| R2 | 문서화만 · **큐 잔여물 정리 구현은 R8로 연기** |
| R8 | (a) 운영: 주기적 queue status 점검 절차 **또는** (b) stale/`queued` 장기 방치 행 정리 배치 — 구현 가능하면 코드, 불가하면 운영 절차 |

---

## 8. 상대시점 (R7)

용어: Adobe 표준 **relative / absolute**만 사용 (`time_basis` 등 조어 금지).  
현행 fragment는 absolute 리터럴 (`12_PoC-S` S11). 개정은 R7.

배지:
- relative → “실행 시점 기준 재계산”
- absolute → “고정 기간 · 재실행해도 대상 동일”

---

## 9. 기존 자산 재사용 맵

| ST | API / 모듈 |
|---|---|
| ST0~ST1 | Generate(`plan_only`) · Match(`mode=discover`) |
| ST2 신규 | Generate(풀) → 캐시 (Register 금지) |
| ST3 | `listAiFolders` |
| ST4 | `listCampaigns` / `createCampaign` |
| ST5 | `listWkfs` / `createWkfFromTemplate` · (보조) Duplicate* 또는 템플릿 폴백 |
| ST6 | acquireLock → inject → `saveAiSql` → releaseLock |

상세 판정: `20_전환_자산판정표.md`.
