/*
 * checkDialectSql.js (방언별 생성 SQL 문자열 대조 · 로컬 개발 도구)
 * ================================================================
 * testWooProbe.js 의 `dialectFor` 본문을 파일에서 그대로 떼어내 실행하고, PostgreSQL /
 * Oracle / MSSQL 3종의 생성 SQL 문자열을 기대값과 대조한다. DB 접속이 필요 없다.
 * ACC v7 은 3종을 모두 지원하지만 본 시스템은 PostgreSQL 에서만 실동 검증되므로,
 * Oracle/MSSQL 은 이 문자열 정합 검사까지만 보증한다.
 * M-1(MSSQL `SELECT TOP n DISTINCT …` 구문 오류, 파생 테이블 ORDER BY) 재발 방지용.
 *
 * [Main Functions]
 * ===========
 * - loadDialectFor() : testWooProbe.js 에서 dialectFor 본문 추출 후 함수화
 * - main : DISTINCT 3종 + 파생 테이블 래핑 3종 대조 후 종료코드 반환
 *
 * [Dependencies]
 * =========
 * - node fs (외부 패키지 없음)
 * - new_ver/js/testWooProbe.js (dialectFor 본문 · E4X 없는 순수 JS 구간)
 * - 실행: node tools/checkDialectSql.js
 */
'use strict';

const fs = require('fs');

const PROBE_FILE = 'new_ver/js/testWooProbe.js';
const DEFAULT_SAMPLE = 20;

// 0. dialectFor 본문 추출 — 코드 사본을 두지 않고 실제 파일을 검사 대상으로 삼는다.
function loadDialectFor() {
  const src = fs.readFileSync(PROBE_FILE, 'utf8');
  const start = src.indexOf('function dialectFor(');
  const end = src.indexOf('\n  function dialect() {');
  if (start < 0 || end < 0 || end < start)
    throw new Error('dialectFor 본문을 찾을 수 없음 — ' + PROBE_FILE + ' 구조 변경 확인');
  const body = src.slice(start, end);
  if (/=\{|\bnew XML\b|<\w+ /.test(body))
    throw new Error('dialectFor 본문에 E4X 가 포함되어 node 실행 불가');
  return new Function('DEFAULT_SAMPLE', body + '\nreturn dialectFor;')(DEFAULT_SAMPLE);
}

// 1. DISTINCT + 상한 (probe_values 경로)
const DISTINCT_CASES = [
  {
    dbms: 'mssql',
    expect: 'SELECT DISTINCT TOP 50 col AS tw_val FROM tbl ' +
      'WHERE col IS NOT NULL ORDER BY 1'
  },
  {
    dbms: 'oracle',
    expect: 'SELECT DISTINCT col AS tw_val FROM tbl ' +
      'WHERE col IS NOT NULL ORDER BY 1 FETCH FIRST 50 ROWS ONLY'
  },
  {
    dbms: 'postgresql',
    expect: 'SELECT DISTINCT col AS tw_val FROM tbl ' +
      'WHERE col IS NOT NULL ORDER BY 1 LIMIT 50'
  }
];

// 2. 전수 대조
function main() {
  let dialectFor;
  try {
    dialectFor = loadDialectFor();
  } catch (e) {
    console.log('FAIL load: ' + e.message);
    process.exit(2);
  }

  let failed = 0;
  let checked = 0;

  for (const c of DISTINCT_CASES) {
    const got = dialectFor(c.dbms).limitSelect(
      'col AS tw_val', 'tbl', 'col IS NOT NULL', 50, { distinct: true });
    checked++;
    if (got === c.expect) {
      console.log('OK   distinct/' + c.dbms + ': ' + got);
      continue;
    }
    failed++;
    console.log('FAIL distinct/' + c.dbms);
    console.log('       got:      ' + got);
    console.log('       expected: ' + c.expect);
  }

  // 파생 테이블 래핑은 외부 ORDER BY 를 만들지 않아야 한다 (MSSQL 이 거부).
  const INNER = '(SELECT 1 AS a ORDER BY 1) tw_lim';
  for (const dbms of ['mssql', 'oracle', 'postgresql']) {
    const got = dialectFor(dbms).limitSelect('*', INNER, '', 10, { orderBy: null });
    const outer = got.split(INNER).join('');
    checked++;
    if (outer.indexOf('ORDER BY') < 0) {
      console.log('OK   wrap/' + dbms + ': ' + got);
      continue;
    }
    failed++;
    console.log('FAIL wrap/' + dbms + ' — orderBy:null 인데 외부 ORDER BY 가 생성됨');
    console.log('       got: ' + got);
  }

  console.log('\nchecked=' + checked + ' failed=' + failed);
  process.exit(failed ? 1 : 0);
}

main();
