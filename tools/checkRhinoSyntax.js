/*
 * checkRhinoSyntax.js (ACC 서버 JS 구문 사전 점검 · 로컬 개발 도구)
 * ==================================================================
 * ACC Rhino + E4X 코드는 node --check 로 파싱할 수 없으므로, 문자열·주석·정규식을
 * 건너뛰는 스캐너로 (1) 괄호 균형 (2) E4X 속성 보간 `={ … }` 미종료 를 검사한다.
 * P0-1(testWooDedup/testWooLifecycle `expr={"…"/>` 미종료) 재발 방지용.
 *
 * [Main Functions]
 * ===========
 * - scan(src) : 토큰 단위 스캔 → {balance, e4xErrors}
 * - checkFile(path) : 파일 1개 검사 결과
 * - main : new_ver/js, new_ver/workflow, new_ver/tools 전수 검사 후 종료코드 반환
 *
 * [Dependencies]
 * =========
 * - node fs / path (외부 패키지 없음)
 * - 실행: node tools/checkRhinoSyntax.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const TARGET_DIRS = ['new_ver/js', 'new_ver/workflow', 'new_ver/tools'];
const PAIRS = { '}': '{', ')': '(', ']': '[' };

// 0. E4X XML 리터럴 구간을 건너뛴다 (내부 `{ … }` 보간은 균형만 확인)
function skipXmlLiteral(src, start, startLine) {
  const errors = [];
  let line = startLine;
  let depth = 0;
  let i = start;

  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }

    if (c === '<') {
      if (src[i + 1] === '/') {
        // 종료 태그
        i += 2;
        while (i < src.length && src[i] !== '>') { if (src[i] === '\n') line++; i++; }
        i++;
        depth--;
        if (depth <= 0) return { index: i, line: line, errors: errors };
        continue;
      }
      if (!/[A-Za-z_]/.test(src[i + 1] || '')) return null;
      // 시작 태그 — 속성 구간 파싱
      i++;
      let selfClose = false;
      while (i < src.length) {
        const a = src[i];
        if (a === '\n') { line++; i++; continue; }
        if (a === '"' || a === "'") {
          const q = a;
          i++;
          while (i < src.length && src[i] !== q) { if (src[i] === '\n') line++; i++; }
          i++;
          continue;
        }
        if (a === '{') {
          // JS 보간 — 문자열 인식하며 균형 맞춤
          let d = 1;
          const openLine = line;
          i++;
          while (i < src.length && d > 0) {
            const b = src[i];
            if (b === '\n') {
              line++;
              errors.push({ line: openLine, msg: 'E4X interpolation `{` not closed on same line' });
              break;
            }
            if (b === '"' || b === "'") {
              const q2 = b;
              i++;
              while (i < src.length && src[i] !== q2) { if (src[i] === '\\') i++; i++; }
            } else if (b === '{') d++;
            else if (b === '}') d--;
            else if (b === '>' || (b === '/' && src[i + 1] === '>')) {
              errors.push({ line: openLine, msg: 'E4X interpolation `{` not closed before tag end' });
              break;
            }
            i++;
          }
          continue;
        }
        if (a === '/' && src[i + 1] === '>') { selfClose = true; i += 2; break; }
        if (a === '>') { i++; break; }
        i++;
      }
      if (!selfClose) depth++;
      if (depth <= 0) return { index: i, line: line, errors: errors };
      continue;
    }
    i++;
  }
  return { index: i, line: line, errors: errors };
}

// 1. 문자열·주석·정규식을 건너뛰며 괄호 균형과 E4X 보간을 검사
function scan(src) {
  const stack = [];
  const errors = [];
  let line = 1;
  let i = 0;

  const prevMeaningful = () => {
    for (let j = i - 1; j >= 0; j--) {
      const c = src[j];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') continue;
      return c;
    }
    return '';
  };

  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    if (c === '\n') { line++; i++; continue; }

    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') line++;
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      const startLine = line;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '\n') { errors.push({ line: startLine, msg: 'unterminated string' }); break; }
        i++;
      }
      i++;
      continue;
    }
    // E4X XML 리터럴: 표현식 위치의 `<name` / `<ns:name`
    if (c === '<' && /[A-Za-z_]/.test(next || '')) {
      const p = prevMeaningful();
      if (p === '' || '(,=:[!&|?{};'.indexOf(p) >= 0) {
        const r = skipXmlLiteral(src, i, line);
        if (r) {
          errors.push.apply(errors, r.errors);
          i = r.index;
          line = r.line;
          continue;
        }
      }
    }

    // 정규식 리터럴: 직전 유의미 문자가 값이 아닐 때만
    if (c === '/') {
      const p = prevMeaningful();
      if (p === '' || '(,=:[!&|?{};+~*%<>^'.indexOf(p) >= 0) {
        const startLine = line;
        i++;
        let inClass = false;
        while (i < src.length) {
          if (src[i] === '\\') { i += 2; continue; }
          if (src[i] === '[') inClass = true;
          else if (src[i] === ']') inClass = false;
          else if (src[i] === '/' && !inClass) break;
          else if (src[i] === '\n') { errors.push({ line: startLine, msg: 'unterminated regex' }); break; }
          i++;
        }
        i++;
        while (i < src.length && /[a-z]/.test(src[i])) i++;
        continue;
      }
    }

    if (c === '{' || c === '(' || c === '[') {
      stack.push({ ch: c, line: line });
      i++;
      continue;
    }
    if (c === '}' || c === ')' || c === ']') {
      const top = stack.pop();
      if (!top) errors.push({ line: line, msg: 'unexpected ' + c });
      else if (top.ch !== PAIRS[c])
        errors.push({ line: line, msg: 'mismatched ' + c + ' (opened ' + top.ch + ' at line ' + top.line + ')' });
      i++;
      continue;
    }
    i++;
  }

  for (const left of stack) errors.push({ line: left.line, msg: 'unclosed ' + left.ch });
  return errors;
}

// 2. E4X 속성 보간 `attr={ … }` 가 태그 종료 전에 닫히는지
function checkE4xInterpolation(src) {
  const errors = [];
  const re = /=\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    let depth = 1;
    let i = m.index + 2;
    let closed = false;
    while (i < src.length) {
      const c = src[i];
      if (c === '"' || c === "'") {
        const q = c;
        i++;
        while (i < src.length && src[i] !== q) {
          if (src[i] === '\\') i++;
          i++;
        }
      } else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) { closed = true; break; }
      } else if (c === '>' && depth === 1) {
        break; // 보간이 닫히기 전에 태그가 끝남
      } else if (c === '\n') {
        break;
      }
      i++;
    }
    if (!closed) {
      const line = src.substring(0, m.index).split('\n').length;
      errors.push({ line: line, msg: 'E4X interpolation `={` not closed before tag/line end' });
    }
  }
  return errors;
}

// 3. 파일 1개 검사
function checkFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  return scan(src).concat(checkE4xInterpolation(src));
}

// 4. 전수 검사
function main() {
  const root = process.cwd();
  let failed = 0;
  let checked = 0;
  for (const dir of TARGET_DIRS) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) {
      if (!/\.js$/.test(name)) continue;
      const file = path.join(abs, name);
      const errors = checkFile(file);
      checked++;
      if (!errors.length) {
        console.log('OK   ' + dir + '/' + name);
        continue;
      }
      failed++;
      console.log('FAIL ' + dir + '/' + name);
      for (const e of errors) console.log('       line ' + e.line + ': ' + e.msg);
    }
  }
  console.log('\nchecked=' + checked + ' failed=' + failed);
  process.exit(failed ? 1 : 0);
}

main();
