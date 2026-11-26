'use strict';

// BOJ 가 다시 열리면서 페이지 주소가 https://www.acmicpc.net → https://acmicpc.net 으로 바뀌었다(www 는 301 로 넘긴다).
// - content script 는 manifest 의 matches 에 있는 호스트에서만 실행된다.
// - content script 의 fetch 는 페이지와 같은 CORS 규칙을 따른다. www 는 이제 다른 출처라 브라우저가 막는다
//   (실제 페이지에서 "TypeError: Failed to fetch").
// 실제 parsing.js 를 vm 에 로드하고, 실서버처럼 페이지와 같은 출처에만 응답하는 fetch 로 확인한다.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://acmicpc.net';
const PAGE = `${ORIGIN}/status?from_mine=1&problem_id=1000&user_id=tester`;
const SOURCE = 'print(sum(map(int, input().split())))';

/** id 로 요소 하나를 찾는 최소한의 문서. shortcut: 같은 태그가 중첩된 요소는 읽지 못한다, 그런 fixture 가 필요해지면 DOM 라이브러리로 바꾼다. */
function fakeDocument(html) {
  const byId = (id) => {
    const m = html.match(new RegExp(`<(\\w+)[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</\\1>`));
    // rows: 제출 표 파싱은 이 테스트의 대상이 아니라서 머리글만 있는 빈 표로 둔다
    return m && { tagName: m[1].toUpperCase(), innerHTML: m[2], innerText: m[2], rows: [{ cells: [] }], getElementsByTagName: () => [], getAttribute: (name) => (m[0].match(new RegExp('\\b' + name + '="([^"]*)"')) || [])[1] };
  };
  return {
    getElementById: byId,
    querySelector: (selector) => byId(selector.slice(1)),
    getElementsByTagName: (tag) => (html.match(new RegExp(`<${tag}>([^<]*)</${tag}>`)) || []).slice(1).map((textContent) => ({ textContent })),
  };
}

function load() {
  const requested = [];
  const pages = {
    '/problem/1000': fs.readFileSync(path.join(__dirname, 'fixtures/boj/problem-1000.html'), 'utf8'),
    '/source/download/123': SOURCE,
    '/status': '<table id="status-table"></table>',
  };
  const context = vm.createContext({
    debug: false,
    console,
    URL,
    setTimeout, // 요청 사이의 간격(fetchBoj)
    location: new URL(PAGE),
    DOMParser: class { parseFromString(html) { return fakeDocument(html); } },
    updateProblemsFromStats: () => {},
    fetch: async (input) => {
      const url = new URL(input, PAGE);
      requested.push(url.href);
      if (url.origin !== ORIGIN) throw new TypeError('Failed to fetch');
      const body = pages[url.pathname + url.search] ?? pages[url.pathname];
      return { ok: body !== undefined, status: body === undefined ? 404 : 200, text: async () => body };
    },
  });
  for (const file of ['scripts/util.js', 'scripts/upload.js', 'scripts/baekjoon/util.js', 'scripts/baekjoon/parsing.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  }
  return { context, requested, pages };
}

test('manifest 가 BOJ 페이지가 실제로 열리는 호스트에서 content script 를 실행한다', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const boj = manifest.content_scripts.find((entry) => entry.js.includes('scripts/baekjoon/baekjoon.js'));
  assert.ok(boj.matches.includes(`${ORIGIN}/*`), `matches: ${boj.matches}`);
  assert.ok(manifest.host_permissions.includes(`${ORIGIN}/`), `host_permissions: ${manifest.host_permissions}`);
});

test('문제 설명·제출 코드·제출 목록을 페이지와 같은 출처에 요청하고, 문제 설명을 파싱한다', async () => {
  const { context, requested } = load();
  const problem = await context.fetchProblemDescriptionById(1000);
  assert.equal(problem.problemId, '1000');
  assert.match(problem.problem_description, /A\+B를 출력하는 프로그램을 작성하시오/);
  assert.match(problem.problem_input, /첫째 줄에 A와 B가 주어진다/);
  assert.match(problem.problem_output, /첫째 줄에 A\+B를 출력한다/);
  assert.deepEqual(Array.from(problem.samples, (sample) => [sample.input.trim(), sample.output.trim()]), [['1 2', '3']]);
  assert.equal(await context.fetchSubmitCodeById(123), SOURCE);
  await context.findResultTableListByUsername('tester');
  assert.deepEqual(requested, [
    `${ORIGIN}/problem/1000`,
    `${ORIGIN}/source/download/123`,
    `${ORIGIN}/status?user_id=tester&result_id=4`,
  ]);
});

test('제출 목록은 다음 페이지 링크를 따라가며 모으고, 한 페이지뿐이면 그 페이지를 한 번만 담는다', async () => {
  const { context, requested, pages } = load();
  context.parsingResultTableList = (doc) => [doc.getElementById('status-table').innerHTML]; // 표 파싱 대신 어느 페이지를 읽었는지만 본다
  assert.deepEqual(Array.from(await context.findResultTableListByUsername('tester')), ['']);
  pages['/status?user_id=two&result_id=4'] = '<table id="status-table">p1</table><a id="next_page" href="/status?top=5">다음</a>';
  pages['/status?top=5'] = '<table id="status-table">p2</table>';
  assert.deepEqual(Array.from(await context.findResultTableListByUsername('two')), ['p1', 'p2']);
  assert.equal(requested.at(-1), ORIGIN + '/status?top=5');
});

test('전체 업로드는 문제마다 가장 좋은 제출을 고른다: 점수 → 시간 → 메모리 → 코드 길이 → 최신 순 (README 의 백준 제출 기준)', () => {
  const { context } = load();
  const row = (submissionId, problemId, result, runtime, memory, codeLength) => ({ submissionId, problemId, result, runtime, memory, codeLength });
  const best = context.selectBestSubmissionList([
    row('1', '1000', '맞았습니다!!', '8', '2020', '50'),
    row('2', '1000', '맞았습니다!!', '4', '9000', '90'), // 시간이 짧다
    row('3', '1001', '맞았습니다!!', '4', '2020', '50'),
    row('4', '1001', '맞았습니다!!', '4', '2020', '40'), // 코드가 짧다
    row('5', '1002', '맞았습니다!!', '4', '2020', '90'), // 메모리가 적다
    row('6', '1002', '맞았습니다!!', '4', '3000', '40'),
    row('7', '1003', '맞았습니다!!', '4', '2020', '40'),
    row('8', '1003', '맞았습니다!!', '4', '2020', '40'), // 모두 같으면 최신
    row('9', '1004', '100점', '9', '9000', '90'), // 점수가 높다
    row('10', '1004', '50점', '0', '1000', '10'),
  ]);
  assert.deepEqual(Array.from(best, (s) => s.submissionId), ['2', '4', '5', '8', '9']);
});
