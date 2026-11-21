'use strict';

// BOJ 는 채점 결과를 Pusher 이벤트로 제출 현황 표에 반영한다(status.js 의 display_solution). 이벤트가 오지 않으면 맨 위 행이
// "채점 준비 중"에서 멈추고, 로더는 이 표만 보고 기다리므로 새 제출이 올라가지 않는다(2026-11-20 실제 페이지에서 11분 넘게 멈췄다).
// 로더는 페이지를 다시 받지 않고, 페이지 컨텍스트의 statusrefresh.js 에 그 제출을 지켜봐 달라고 부탁한다.
// 실제 baekjoon.js 를 vm 에 로드하고 로더의 2초 주기를 직접 돌린다.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://acmicpc.net';
const PAGE = `${ORIGIN}/status?user_id=tester1&problem_id=1000&from_mine=1`;

// 페이지 컨텍스트에서 도는 statusrefresh.js 는 manifest 의 "world" 키(Chrome 111 이상) 대신 로더가 <script> 요소로 넣는다.
// 요소는 처음 부탁할 때만, 페이지에 이미 있으면(확장을 다시 불러와 로더가 한 번 더 뜬 경우) 넣지 않는다.
function loadLoader(state, { existing = false } = {}) {
  const context = vm.createContext({
    console,
    window: { location: { href: PAGE, origin: ORIGIN }, postMessage: (message, origin) => state.asks.push({ message, origin }) },
    chrome: { runtime: { getURL: (file) => `chrome-extension://abcdef/${file}` } },
    document: {
      head: { appendChild: (el) => state.added.push(el) },
      getElementById: (id) => state.added.find((el) => el.id === id) || (existing ? { id } : null),
      createElement: (tag) => ({ tag }),
    },
    setInterval: (fn) => { state.tick = fn; return 1; },
    clearInterval: () => { state.tick = async () => {}; },
    checkEnable: async () => true,
    findUsername: () => 'tester1',
    isExistResultTable: () => true,
    findFromResultTable: () => [{ elementId: 'solution-100000001', username: 'tester1', result: '', resultCategory: state.category }],
    findHtmlDocumentByUrl: async (url) => { state.fetched.push(url); throw new Error('페이지를 다시 받으면 안 된다'); },
    startUpload: () => state.calls.push('startUpload'),
    findData: async () => { state.calls.push('findData'); return {}; }, // 빈 값이면 beginUpload 는 아무것도 올리지 않는다
  });
  for (const file of ['scripts/util.js', 'scripts/baekjoon/variables.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'scripts/baekjoon/baekjoon.js'), 'utf8'), context, { filename: 'baekjoon.js' });
}

test('채점 중인 맨 위 행은 지켜봐 달라고 부탁하고 페이지를 다시 받지 않으며, 스크립트 요소는 처음 부탁할 때 한 번만 넣고, 맞았습니다가 보이면 업로드를 시작한다', async () => {
  const state = { tick: null, asks: [], added: [], fetched: [], calls: [], category: 'wa' };
  loadLoader(state);

  await state.tick(); // 채점 중이 아니면 요소도 부탁도 없다
  assert.deepEqual([state.added.length, state.asks.length], [0, 0]);

  state.category = 'compile';
  for (let i = 0; i < 10; i++) await state.tick(); // 20초 동안 채점 준비 중
  assert.ok(state.asks.length > 0, '지켜봐 달라고 부탁한다');
  // vm 안에서 만든 객체라 프로토타입이 달라 JSON 으로 옮겨 비교한다
  for (const ask of state.asks) assert.deepEqual(JSON.parse(JSON.stringify(ask)), { message: { type: 'BaekjoonHub:watch-solution', id: '100000001' }, origin: ORIGIN });
  assert.deepEqual(state.added.map((el) => ({ ...el })), [{ tag: 'script', id: 'baekjoonhub-statusrefresh', src: 'chrome-extension://abcdef/scripts/baekjoon/statusrefresh.js' }], '요소는 한 번, 확장의 URL 로');
  assert.deepEqual(state.fetched, [], '페이지를 다시 받지 않는다');
  assert.deepEqual(state.calls, []);

  state.category = 'ac'; // 페이지 쪽 스크립트가 결과를 화면에 그렸다
  await state.tick();
  assert.deepEqual(state.calls, ['startUpload', 'findData']);
  assert.deepEqual(state.fetched, []);

  const again = { tick: null, asks: [], added: [], fetched: [], calls: [], category: 'compile' }; // 이미 요소가 있는 페이지
  loadLoader(again, { existing: true });
  await again.tick();
  assert.deepEqual([again.added.length, again.asks.length > 0], [0, true], '이미 있으면 넣지 않고 부탁은 한다');
});
