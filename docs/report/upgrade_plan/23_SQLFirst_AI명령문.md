# SQL-First · AI 명령문 정본 (#145R~#151R)

> Chat에서 `@docs/report/upgrade_plan/00_INDEX.md` + 라우팅 키만 말해도 되지만,  
> **세부 구현 지시**는 아래 블록을 해당 Chat에 그대로 붙인다.  
> `new_ver/` 변경은 feat 브랜치 · 문서 커밋과 혼합 금지.

| 키 | 명령 | 상태 |
|---|---|---|
| PoC-S | #145R | [x] 문서 완료 · S8 HUMAN만 [ ] |
| (문서) | #146R | [x] 19/20/21/27/INDEX/추적표 |
| R0 | 전환준비 | [x] 문서 · S8 회신만 [ ] |
| **P0** | #152 | [x] repo·배포 · HUMAN 확인[ ] |
| PoC-V | #153 | [x] `24_[완료]_PoC-V_값인식매칭.md` |
| **#154** | 값매칭 | [x] repo+배포 · C1~C6=`26_…` HUMAN[ ] · Option[ ] |
| **#155** | 임베딩 | [x] OFF+영속화 코드 · true는 스모크+승인[ ] |
| **다음** | **R4** (#149R 셸) | R3 배포 HUMAN 후 · Match Option 병렬 |
| R1 | #147R | **[S] 단독 스킵 → #154 흡수** (Match OFF 중 R1 금지) |
| R2 | #148R | [x] repo v=156 · S8 HUMAN confirm [ ] |
| R3 | #149R | [x] repo v=157 · 배포/Tools입력 [`H`] |
| R4 | #149R 셸 | [ ] 별도 Chat |
| R5 | 매핑 | [ ] |
| R6 | #150R | [ ] |
| R7/R8 | #151R | [ ] Chat 분리 |

상태 정본: `01_진행판.md`

---

## #145R — PoC-S · SQL-First 타당성 (읽기 전용)

산출물: `18_[완료]_PoC-S_SQLFirst타당성.md` — **작성 완료**. 재실행 시 코드 변경 금지·사실 갱신만.

---

## #146R — 로드맵 재설계 (문서 전용)

산출물: `19`/`20`/`21`/`27` · SUPERSEDED · 추적표 열 — **작성 완료**.

---

## #147R — R1 · 매칭 승격

```
[#147R — R1 · 매칭 승격 (탐색 주경로화)]
선행: #146R 완료.
대상: new_ver/js/testWooMatch.js , new_ver/jssp/testWooAiMatch.jssp

설계 근거 (문서에 인용)
  Jaccard 는 교집합 크기 측정에 편향되어 큰 집합이 penalize 된다.
  대안은 containment = |Q∩X| / |Q| (Q = 사용자 입력 조건 집합).
  http://www.vldb.org/pvldb/vol9/p1185-zhu.pdf
  https://ekzhu.com/datasketch/lshensemble.html
  용어는 학계 표준어 containment 로 통일한다(coverage 등 조어 금지).

작업 1 — 지표 추가 (기존 jaccard 함수 유지 · 삭제 및 수정 금지)
  containment(setQ, setX) 신규 추가.
  반환에 intersectionCount / queryCount / candidateCount 포함.
  ES5 집합 연산만 사용. 임베딩 · 벡터 · MinHash · 외부 라이브러리 금지
  (500건 규모에서 근사 색인은 불필요하며 정확 계산으로 충분).

작업 2 — 모드 분리
  matchByPlan(plan, campaignId, opts) 에 opts.mode 추가.
  mode="dedup" (기본값 · 미지정 시 현행과 100% 동일 동작 보장)
    Jaccard >= JACCARD_THRESHOLD(0.9) 유지. 임계·정렬·응답 필드 변경 금지.
  mode="discover" (SQL-First 목록의 주경로)
    전 후보 containment 계산.
    정렬: containment 내림차순 → jaccard 내림차순 → name 오름차순.
    DISCOVER_TOP_N = 10 상수 선언 후 상위 10건만 반환.
    비율 기반 하한 임계값을 두지 말 것.
    유일한 컷오프는 intersectionCount >= 1.
    사유: containment 임계는 집합 크기 분포에 종속되어 고정 상수로 정당화 불가하며,
          목록이 메인 화면이 되는 구조에서 높은 임계는 상시 0건을 유발한다.
  ※ "유사도 95% 이상만 노출"은 채택하지 않는다. 대신 100% 동일(정규화 SQL 해시 일치)
     항목에만 "동일" 배지를 부여해 사용자가 구분하게 한다.
  ※ 현행 #147 코드의 containment==1.0 · Top-20 은 정본과 불일치(D-2) — 본 차수에서 교정.

작업 3 — 값 인식 (#145R/PoC-M 에서 값 필드 존재 확인됨: plan.params)
  MATCH_KEY 유지한 채 복합키 집합 병행 생성: name + "=" + 정규화 value.
  discover 응답에 nameContainment / valueContainment 동시 제공.
  dedup 모드의 키 구성은 절대 변경 금지.

작업 4 — 엔드포인트
  testWooAiMatch.jssp 가 payload 의 mode 를 통과. 미지정 시 "dedup".
  requireRight("testWooAiSqlGenerate") 현행 유지.
  discover 응답: items[].containment, items[].jaccard, items[].intersectionCount,
  items[].queryCount, items[].candidateCount, items[].nl_request, items[].isIdentical,
  기존 enrichment(program/campaign/workflow/locked/locked_by) 유지.

금지
  JACCARD_THRESHOLD 0.9 변경 금지. 텍스트 LIKE 검색·임베딩 도입 금지.
  Spawn · alert/confirm · fetch/Promise/classList/forEach · flex/grid/vh 금지.
  #133/#135/#137/#141 회귀 금지. FormatDate 금지.

DoD
  mode 미지정 결과가 변경 전과 동일(회귀 0).
  Q 3개 / X 11개 / 교집합 3 → containment 1.0 · jaccard 약 0.27 · discover 최상단.
  Q 11개 / X 3개 / 교집합 3 → containment 약 0.27 · 하위 랭크.
  교집합 0 → 목록 제외. 후보 12건 → 정확히 10건 반환.
```

---

## #148R — R2 · 캐시 계층

```
[#148R — R2 · 캐시 계층 (미반영 SQL 보관)]
선행: #147R 완료 + #145R S8/S9 결론 확보.
      S8 이 HUMAN_CONSOLE 대기 상태면 구현하지 말고 사용자에게 확인 요청 후 중단.

원칙
  미반영 SQL 은 woo:testWooAiSql 에 기록하지 않는다.
  기록 시점은 오직 반영(ST6) 성공 순간이다.

작업 1 — 저장처 결정 (조사 결과에 따름 · 추측 구현 금지)
  1순위: sessionStorage (S8 에서 가용 확인된 경우).
         urlViewer 리로드 후에도 동일 세션에서 유지되어 캐시 유실을 막는다.
  2순위: JS 전역 객체 (sessionStorage 불가 시).
         이 경우 리로드로 캐시가 소실됨을 12_PoC-S 와 13_여정정본 에 한계로 명시하고,
         화면에 "새로고침 시 임시 SQL 이 사라질 수 있음" 안내를 상시 노출한다.
  키 네임스페이스는 twStudioCache 로 고정하고 스키마 버전 필드를 포함한다.

작업 2 — 캐시 레코드 구조
  { cacheId, createdAt, nl_request, plan, sql, usedFragments, sqlHash, status:"draft" }
  cacheId 는 클라이언트 생성 임시 식별자이며 DB id 와 혼동되지 않게 접두어를 붙인다.

작업 3 — 생명주기 구현
  브레드크럼 이동 · 뒤로가기: 캐시 유지. 목록 재렌더 시 캐시 항목을 상단에 병합 표시.
  초기화: 캐시 전체 삭제 후 ST0 복귀.
  창/콘솔 종료: 별도 처리 없이 휘발(sessionStorage 특성 또는 전역변수 소멸).
  반영 성공: 해당 cacheId 항목 삭제.

작업 4 — 목록 병합 규칙
  캐시 항목은 "미반영(임시)" 배지와 함께 서버 매칭 결과 위에 표시.
  캐시 항목은 매칭 코퍼스가 아니므로 containment 수치를 계산·표시하지 않는다.

작업 5 — 큐 잔여물 정책
  #145R S7 결과가 "잔여물 발생"이면 정리 정책을 13_여정정본 에 문서화한다.
  구현이 필요하면 R8 로 미루고 이번 차수에서는 문서화만 한다.

금지
  미반영 SQL 을 DB 에 insert 하는 어떤 경로도 만들지 말 것.
  localStorage 사용 금지(휘발 요구와 충돌).
  ES6 문법 · JSON 미지원 환경 가정 없이 JSON 사용 전 가용성 확인.
```

---

## #149R — R3/R4 · 상태머신 · 셸

한 Chat에 R3만, 다음 Chat에 R4. 전문은 사용자 원문 `#149R` 블록과 동일 — `15` R3/R4 절 참고.

핵심: ST0~ST6 · 입력 즉시 활성 · 단일 목록 패널 · SQL 카드 · 브레드크럼 · litmus v= · embed 회귀.

---

## #150R — R6 · 커밋 트랜잭션

전문은 사용자 원문 `#150R`과 동일.  
S6 결론(확정): 동일 SQL 다중 WKF = **신규 행**. soft-fail로 반영 금지.

---

## #151R — R7/R8 · 상대시점 · 정리

한 Chat에 R7, 다음 R8. 전문은 사용자 원문 `#151R`과 동일.  
relative/absolute 용어만. Duplicate* 미확인 시 createWkfFromTemplate 폴백.
