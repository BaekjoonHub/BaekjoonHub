'use strict';

// BOJ 는 채점 결과를 Pusher 이벤트로 제출 현황 표에 반영한다(status.js 의 display_solution).
// 2026-11-20 실제 페이지에서, 제출 직후 열린 내 제출 현황의 맨 위 행이 "채점 준비 중"에서 11분 넘게 멈춰 있었다
// (BOJ 의 /status/ajax 는 200 으로 한 번 응답했고 그 뒤 이벤트가 오지 않았다. 같은 제출은 다른 페이지에서 "맞았습니다!!").
// 확장의 로더는 이 표만 보고 기다리므로 새 제출이 올라가지 않았다.
// 실제 baekjoon.js 를 vm 에 로드하고 로더의 2초 주기를 직접 돌려, 멈춘 행을 다시 받아 갱신하는지 확인한다.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const PAGE = 'https://acmicpc.net/status?user_id=tester1&problem_id=1000&from_mine=1';
const ROW_ID = 'solution-100000001';

// 실제 페이지의 행에서 가져온 칸(아이디와 제출 번호는 가짜 값). PENDING 은 멈춰 있던 화면, ACCEPTED 는 같은 주소를 다시 받은 응답이다.
const PENDING = '<td class="result"><span class="result-text result-compile " data-color="compile">채점 준비 중</span></td><td class="memory"></td><td class="time"></td><td class="judge-platform"></td>';
const ACCEPTED = '<td class="result"><span class="result-text result-ac " data-color="ac">맞았습니다!!</span></td><td class="memory">13728<span class="kb-text"></span></td><td class="time">33<span class="ms-text"></span></td><td class="judge-platform"><span title="GCP — 세대가 달라 실행 시간은 직접 비교되지 않습니다">2</span></td>';
// BOJ 의 App.result_colors() / result_names() 값으로 만든 행 (실제 응답을 가져온 것은 아니다)
const WRONG = '<td class="result"><span class="result-text result-wa " data-color="wa">틀렸습니다</span></td><td class="memory"></td><td class="time"></td><td class="judge-platform"><span title="GCP">2</span></td>';
const CELLS = ['result', 'memory', 'time', 'judge-platform'];

/** 칸을 class 로 찾는 최소한의 행. shortcut: td.<class> 선택자만 안다, 다른 선택자가 필요해지면 DOM 라이브러리로 바꾼다. */
function fakeRow(html) {
  const cells = {};
  for (const name of CELLS) cells[name] = { innerHTML: html.match(new RegExp(`<td class="${name}">([\\s\\S]*?)</td>`))[1] };
  return { cells, querySelector: (selector) => cells[selector.replace('td.', '')] || null };
}

function load(freshHtml) {
  const state = { now: 0, tick: null, fetched: [], calls: [], fresh: async () => freshHtml };
  const row = fakeRow(PENDING);
  const context = vm.createContext({
    console,
    Date: { now: () => state.now },
    window: { location: { href: PAGE } },
    document: { getElementById: (id) => (id === ROW_ID ? row : null) },
    setInterval: (fn) => { state.tick = fn; return 1; },
    clearInterval: () => { state.tick = async () => {}; },
    checkEnable: async () => true,
    findUsername: () => 'tester1',
    isExistResultTable: () => true,
    // 화면의 결과 칸을 parsingResultTableList 가 돌려주는 모양으로 읽는다
    findFromResultTable: () => {
      const html = row.cells.result.innerHTML;
      return [{ elementId: ROW_ID, username: 'tester1', result: html.replace(/<[^>]+>/g, '').trim(), resultCategory: html.match(/data-color="([^"]+)"/)[1] }];
    },
    findHtmlDocumentByUrl: async (url) => {
      state.fetched.push({ url, at: state.now });
      const html = await state.fresh();
      return { getElementById: (id) => (id === ROW_ID ? fakeRow(html) : null) };
    },
    startUpload: () => { state.calls.push('startUpload'); row.cells.result.innerHTML += '<span id="BaekjoonHub_progress_anchor_element"></span>'; },
    findData: async () => { state.calls.push('findData'); return {}; }, // 빈 값이면 beginUpload 는 아무것도 올리지 않는다
  });
  for (const file of ['scripts/util.js', 'scripts/baekjoon/variables.js', 'scripts/baekjoon/baekjoon.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  }
  /** 로더 주기를 stepMs 간격으로 untilMs 까지 돌린다 */
  const run = async (untilMs, stepMs = 2000) => {
    for (; state.now <= untilMs; state.now += stepMs) await state.tick();
  };
  return { state, row, run };
}

const shown = (row) => CELLS.map((name) => `<td class="${name}">${row.cells[name].innerHTML}</td>`).join('');

test('채점 중인 채 멈춘 행을 5초 뒤 다시 받아 갱신하고, 이어서 업로드를 시작한다', async () => {
  const { state, row, run } = load(ACCEPTED);
  await run(4000);
  assert.deepEqual(state.fetched, [], '5초가 지나기 전에는 받지 않는다');
  await run(6000);
  assert.deepEqual(state.fetched, [{ url: PAGE, at: 6000 }]);
  assert.equal(shown(row), ACCEPTED);
  assert.deepEqual(state.calls, [], '갱신한 주기에는 아직 올리지 않는다');
  await run(8000);
  assert.deepEqual(state.calls, ['startUpload', 'findData']);
  await run(600000);
  assert.equal(state.fetched.length, 1, '끝난 뒤에는 다시 받지 않는다');
});

test('채점이 아직 끝나지 않았으면 간격을 늘려 가며 10번까지만 받는다', async () => {
  const { state, run } = load(PENDING);
  await run(900000, 1000);
  assert.deepEqual(state.fetched.map((f) => f.at / 1000), [5, 15, 35, 75, 135, 195, 255, 315, 375, 435]);
  assert.deepEqual(state.calls, []);
});

test('화면의 결과가 바뀌는 동안(실시간 갱신이 살아 있음)에는 받지 않는다', async () => {
  const { state, row, run } = load(ACCEPTED);
  for (let percent = 0; percent <= 100; percent += 10) {
    row.cells.result.innerHTML = `<span class="result-text result-judging " data-color="judging">채점 중 (${percent}%)</span>`;
    await run(state.now + 4000);
  }
  assert.deepEqual(state.fetched, []);
});

test('채점이 끝났지만 맞지 않은 결과면 화면만 갱신하고 더 받지 않는다', async () => {
  const { state, row, run } = load(WRONG);
  await run(600000);
  assert.equal(shown(row), WRONG);
  assert.equal(state.fetched.length, 1);
  assert.deepEqual(state.calls, []);
});

test('받는 사이 실시간 갱신이 도착해 업로드가 시작됐으면 결과 칸을 덮어쓰지 않는다', async () => {
  const { state, row, run } = load(ACCEPTED);
  let respond;
  state.fresh = () => new Promise((resolve) => { respond = () => resolve(ACCEPTED); });
  await run(4000);
  const refreshing = state.tick(); // 6초: 다시 받기 시작, 응답은 아직 오지 않음
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.fetched.length, 1);
  row.cells.result.innerHTML = fakeRow(ACCEPTED).cells.result.innerHTML; // BOJ 의 실시간 갱신이 도착
  state.now = 8000;
  await state.tick();
  assert.deepEqual(state.calls, ['startUpload', 'findData']);
  respond();
  await refreshing;
  assert.match(row.cells.result.innerHTML, /BaekjoonHub_progress_anchor_element/);
});
