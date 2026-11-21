'use strict';

// #367: 문제 페이지 상단 탭("1000번", "질문 게시판") 뒤에 업로드 체크 아이콘이 붙어 탭 아래 줄에 따로 보였다.
// 실제 statusicons.js 를 vm 에 로드하고, 실제 문제 페이지(fixtures/boj/problem-1000.html)의 링크에 아이콘이 어디 붙는지 본다.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const PAGE = 'https://acmicpc.net/problem/1000';
const EXTRA = [
  '<a href="https://www.acmicpc.net/problem/1000">www 주소</a>',
  '<a href="https://example.com/problem/1000">외부 사이트</a>',
  '<a href="/board/search/all/problem/1000">탭 밖의 게시판 링크</a>',
].join('');

/** a[href] 만 읽는 최소한의 문서. shortcut: closest 는 .problem-menu 만 안다, 다른 선택자가 필요해지면 DOM 라이브러리로 바꾼다. */
function fakeDocument(html) {
  const menuStart = html.indexOf('problem-menu');
  const menuEnd = html.indexOf('</ul>', menuStart);
  const icons = [];
  const links = [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => {
    const href = m[1].replace(/&amp;/g, '&');
    const url = new URL(href, PAGE);
    const inMenu = m.index > menuStart && m.index < menuEnd;
    return {
      dataset: {},
      getAttribute: () => href,
      hostname: url.hostname,
      pathname: url.pathname,
      closest: (selector) => (selector === '.problem-menu' && inMenu ? {} : null),
      insertAdjacentElement: (position) => icons.push(`${position} ${href}`),
    };
  });
  return { icons, querySelectorAll: () => links, createElement: () => ({}) };
}

test('문제 페이지 상단 탭에는 아이콘을 붙이지 않고, 본문의 업로드한 문제 링크에만 붙인다', async () => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures/boj/problem-1000.html'), 'utf8') + EXTRA;
  const document = fakeDocument(html);
  const stats = { submission: { tester: { repo: { 백준: { '1000.A+B': {}, '1001.A-B': {} } } } } };
  const context = vm.createContext({
    document,
    location: new URL(PAGE),
    isNull: (v) => v === null || v === undefined,
    checkEnable: async () => true,
    getStats: async () => stats,
    getHook: async () => 'tester/repo',
  });
  const src = fs.readFileSync(path.join(ROOT, 'scripts/baekjoon/statusicons.js'), 'utf8');
  // 파일 끝의 자동 실행 한 줄을 빼고 로드해서 끝날 때까지 기다린다
  vm.runInContext(src.slice(0, src.lastIndexOf('injectUploadStatusIcons();')), context, { filename: 'statusicons.js' });
  await vm.runInContext('injectUploadStatusIcons()', context);

  assert.deepEqual(document.icons, [
    'afterend /problem/1001', // 문제 본문 아래 "비슷한 문제" 목록
    'afterend https://www.acmicpc.net/problem/1000',
  ]);
});
