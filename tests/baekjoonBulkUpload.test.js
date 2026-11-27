'use strict';

// 백준 전체제출 업로드 (2026-11-26 실제 계정에서 확인한 문제와 그 뒤의 개선).
// - 백준은 요청이 몰리면 한동안 403 을 준다. 예전에는 그 응답 본문(134바이트 HTML)을 풀이 코드로, 문제 페이지의 403 을
//   "삭제된 문제"로 저장해 SUCCESS 로 끝났다(464문제 중 11문제의 코드가 "403 Forbidden" 으로 커밋됐다).
// - 올리지 않는 대회 문제를 파싱 실패로 세어, 그것만 남으면 실행할 때마다 FAILED 가 됐다.
// - 요청은 간격을 두고 보내고, 끝내 막히면 전체 업로드를 멈췄다가 이어 한다. 받은 문제·코드는 저장해 다시 요청하지 않는다.
// - 확인 질문, 진행 상황, 결과(가져오지 못한 문제와 이유, 다시 시도)는 모달로 보여 준다(toast.js 의 confirmModal · progressModal).
// 실제 스크립트를 vm 에 로드해 확인한다. 기다림은 가짜 시계로 바로 넘긴다.
// 일부러 다루지 않는 것: 모달·안내 문구, 시작 전 어림 안내(describeBulkUpload), 남은 시간 표시.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const { normalizePath } = require('../scripts/utils/pathNormalize.js');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const SOURCE = 'print(sum(map(int, input().split())))';
const BLOCKED = '<!doctype html><meta charset="utf-8"><meta name=viewport content="width=device-width, initial-scale=1"><title>403</title>403 Forbidden';
/** 밀린 마이크로태스크와 저장소 콜백이 끝나기를 기다린다. */
const settle = async () => { for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setImmediate(resolve)); };

/** respond(url, n) 은 n 번째 요청의 { status, body } 를 정한다. */
function loadParsing(respond, cachedCode = {}) {
  const state = { clock: 1_000_000, waits: [], requested: [] };
  const context = vm.createContext({
    debug: false,
    console: { ...console, warn: () => {} },
    TextEncoder,
    Date: { now: () => state.clock },
    setTimeout: (fn, ms) => { state.waits.push(ms); state.clock += ms; fn(); },
    DOMParser: class { parseFromString() { return { getElementById: () => null }; } },
    getSubmitCodeFromStats: async (id) => cachedCode[id],
    updateSubmitCodeFromStats: () => {},
    fetch: async (url) => {
      state.requested.push(url);
      const { status, body } = respond(url, state.requested.length);
      return { ok: status === 200, status, text: async () => body };
    },
  });
  for (const file of ['scripts/util.js', 'scripts/upload.js', 'scripts/baekjoon/variables.js', 'scripts/baekjoon/util.js', 'scripts/baekjoon/parsing.js']) vm.runInContext(read(file), context, { filename: file });
  return { context, state };
}

/** 모달이 쓰는 만큼만 흉내 낸 문서. 만든 요소는 made 에 쌓인다. */
function fakeDocument(made) {
  return {
    body: { appendChild: () => {} },
    createElement: (tag) => {
      const el = {
        tag,
        style: {},
        children: [],
        append: (...nodes) => el.children.push(...nodes),
        setAttribute: () => {},
        addEventListener: (type, fn) => { el[`on${type}`] = fn; },
        remove: () => { el.removed = true; },
        showModal: () => { el.shown = (el.shown || 0) + 1; },
        focus: () => { el.focused = true; },
      };
      made.push(el);
      return el;
    },
  };
}

/** made 에서 n 번째(0부터) 진행 모달의 부분을 꺼낸다. progressModal 이 요소를 만드는 순서와 같다. */
function modalParts(made, n = 0) {
  const [dialog, heading, status, bar, fill, count, note, list, form, pause, retry, ok] = made.slice(n * 12);
  return { dialog, heading, status, bar, fill, count, note, list, form, pause, retry, ok };
}

test('백준이 요청을 막으면(403) 쉬었다가 다시 받고, 막힌 응답을 풀이 코드로 돌려주지 않는다', async () => {
  const { context, state } = loadParsing((url, n) => (n <= 2 ? { status: 403, body: BLOCKED } : { status: 200, body: SOURCE }));
  assert.equal(await context.fetchSubmitCodeById(123), SOURCE);
  assert.deepEqual(state.waits, [5000, 10000]);
  assert.deepEqual(state.requested, ['/source/download/123', '/source/download/123', '/source/download/123']);
});

test('끝내 막혀 있으면 코드도 문제 설명도 오류로 끝난다 (403 을 삭제된 문제로 보지 않는다)', async () => {
  const { context, state } = loadParsing(() => ({ status: 403, body: BLOCKED }));
  const blocked = (error) => /백준이 요청을 막고 있습니다 \(403\)/.test(error.message);
  await assert.rejects(context.fetchSubmitCodeById(123), blocked);
  assert.equal(state.requested.length, 5, '처음 한 번과 다시 네 번');
  await assert.rejects(context.fetchProblemDescriptionById(25176), blocked);
});

test('삭제된 문제(404)는 기다리지 않고 안내용 값을 돌려준다', async () => {
  const { context, state } = loadParsing(() => ({ status: 404, body: '' }));
  assert.equal((await context.fetchProblemDescriptionById(32767)).deleted, true);
  assert.deepEqual(state.waits, []);
  await assert.rejects(context.fetchSubmitCodeById(1), (error) => /백준 요청 실패 \(404\)/.test(error.message));
});

test('예전 버전이 캐시한 403 응답은 코드로 쓰지 않고 다시 받는다', async () => {
  const { context } = loadParsing(() => ({ status: 200, body: SOURCE }), { 123: BLOCKED, 124: 'cached' });
  assert.equal(await context.getSubmitCodeById(123), SOURCE);
  assert.equal(await context.getSubmitCodeById(124), 'cached');
});

test('요청은 시작 시각을 띄워 보내고, 막힌 뒤에는 간격을 두 배로 늘린다', async () => {
  const { context, state } = loadParsing((url) => (url === '/source/download/9' && state.requested.length === 4 ? { status: 403, body: BLOCKED } : { status: 200, body: SOURCE }));
  await Promise.all([1, 2, 3].map((id) => context.fetchSubmitCodeById(id)));
  assert.deepEqual(state.waits, [200, 200], '세 요청이 한꺼번에 와도 200ms 씩 띄운다');
  state.waits.length = 0;
  await context.fetchSubmitCodeById(9); // 한 번 막혔다가 풀린다
  await Promise.all([4, 5].map((id) => context.fetchSubmitCodeById(id)));
  assert.deepEqual(state.waits, [200, 5000, 400, 400]);
});

test('fetch 로 받은 제출 목록에서도 제출 시각을 읽는다 (예전에는 전체 업로드의 README 제출 일자가 올린 시각이 됐다)', () => {
  const { context } = loadParsing(() => ({ status: 200, body: '' }));
  context.Date = Date; // 가짜 시계 대신 실제 Date (new Date 를 쓴다)
  const cell = (text, found = {}) => ({ innerText: text, querySelector: (selector) => found[selector] || null });
  const parse = (attrs) => context.parsingResultTableList({ getElementById: () => ({ rows: [
    { cells: [cell('제출 번호'), cell('제출한 시간')] },
    { id: 'solution-10', cells: [cell('10'), cell('6일 전', { 'a.show-date': { getAttribute: (name) => attrs[name] ?? null } })] },
  ] }) })[0].submissionTime;

  // 화면에 그려진 표: 백준의 툴팁 스크립트가 넣은 값을 그대로 쓴다
  assert.equal(parse({ 'data-original-title': '2026년 11월 20일 11:38:30', 'data-timestamp': '1795142310' }), '2026년 11월 20일 11:38:30');
  // fetch 로 받은 표: title 과 data-timestamp 만 있다
  const fetched = parse({ title: '2026-11-20 11:38:30', 'data-timestamp': '1795142310' });
  assert.match(fetched, /^\d{4}년 \d{2}월 \d{2}일 \d{2}:\d{2}:\d{2}$/);
  assert.equal(fetched, context.getDateString(new Date(1795142310 * 1000)));
  assert.equal(parse({}), null);
});

/** 실제 upload.js · toast.js · uploadfunctions.js 까지 올린 전체 업로드 하네스. rows 는 맞은 제출 목록, submission 은 이 레포의 업로드 캐시다. */
function loadBulk(respond, rows, submission = {}) {
  const calls = [];
  const committed = [];
  const made = [];
  const { context, state } = loadParsing(respond);
  Object.assign(context, {
    document: fakeDocument(made),
    location: { reload: () => calls.push('reload') },
    JSZip: class { constructor() { this.files = {}; } file() {} },
    GitHub: class {
      async getReference() {}
      async getDefaultBranchOnRepo() { return 'main'; }
      async createBlob(content, path) { return { path }; } // 예제 업로드가 쓴다
      // Array.from: vm 안에서 만든 배열은 프로토타입이 달라 deepEqual 이 다르다고 본다
      async commitTreeItems(branch, items) { committed.push(Array.from(items, (item) => item.path)); calls.push('commit'); }
    },
    chrome: { runtime: { sendMessage: async () => ({ titleKo: 'A+B', level: 1, tags: [] }) } },
    updateLocalStorageStats: async () => ({ branches: { 'me/repo': 'main' }, submission: { me: { repo: submission } } }),
    getHook: async () => 'me/repo',
    getToken: async () => 'token',
    getProblemFromStats: async () => null,
    getSolvedACFromStats: async () => undefined,
    updateSolvedACFromStats: () => {},
    buildDirectory: async (platform, variables) => variables._defaultDir,
    getSaveExamplesOption: async () => false,
    recordUploadInStats: async () => { calls.push('recorded'); },
  });
  for (const file of ['scripts/toast.js', 'scripts/baekjoon/uploadfunctions.js']) vm.runInContext(read(file), context, { filename: file });
  // 스크립트가 선언한 함수는 로드한 뒤에 바꾼다
  Object.assign(context, {
    findUsername: () => 'tester',
    findUniqueResultTableListByUsername: async () => { calls.push('list'); return rows; },
  });
  return { context, state, calls, committed, made };
}

const ROW = { language: 'Java 11', result: '맞았습니다!!', memory: '14000', runtime: '120', submissionTime: '2026년 11월 26일 22:50:00' };
const ROWS = [{ ...ROW, problemId: '1000', submissionId: '10' }, { ...ROW, problemId: '25176', submissionId: '20' }];
// 폴더 이름의 번호 뒤 공백은 U+2005 다 (makeDetailMessageAndReadme)
const filesOf = (id) => [`백준/Bronze/${id}. A＋B/A＋B.java`, `백준/Bronze/${id}. A＋B/README.md`];

test('전체 업로드: 올리지 않는 대회 문제만 남으면 실패가 아니라 새로 올릴 문제가 없다고 알린다', async () => {
  const { context, state, made } = loadBulk(() => ({ status: 200, body: SOURCE }), [{ problemId: '1', submissionId: '10' }, { problemId: null, submissionId: '11' }]);
  await context.uploadAllSolvedProblem();
  const { status, retry } = modalParts(made);
  assert.equal(status.style.color, undefined, '실패 색이 아니다');
  assert.match(retry.style.cssText, /display:none/);
  assert.deepEqual(state.requested, []);
});

test('전체 업로드: 가져오지 못한 문제는 번호와 이유를 보여 주고, 다시 시도하면 그 문제만 목록을 다시 읽지 않고 올린다', async () => {
  let sourceStatus = 404; // 25176 의 제출 코드(20)만 가져오지 못한다
  const { context, calls, committed, made } = loadBulk((url) => (url === '/source/download/20' ? { status: sourceStatus, body: SOURCE } : { status: 200, body: SOURCE }), ROWS);
  await context.uploadAllSolvedProblem();
  const first = modalParts(made);
  assert.deepEqual(committed, [filesOf(1000)]);
  assert.match(first.list.textContent, /^25176: /);
  assert.deepEqual([first.list.style.display, first.retry.style.display, first.ok.style.display], ['block', '', '']);
  assert.deepEqual(calls, ['list', 'commit', 'recorded']);

  sourceStatus = 200;
  first.dialog.returnValue = 'retry'; // 다시 시도 버튼(method="dialog")이 남기는 값
  first.dialog.onclose();
  await settle();
  const second = modalParts(made, 1);
  assert.deepEqual(committed, [filesOf(1000), filesOf(25176)]);
  assert.deepEqual(calls, ['list', 'commit', 'recorded', 'commit', 'recorded'], '새로 고치지 않았고 제출 목록도 다시 읽지 않았다');
  second.dialog.returnValue = 'ok';
  second.dialog.onclose();
  assert.equal(calls.at(-1), 'reload', '올린 문제가 있으면 확인을 누를 때 새로 고친다');
});

test('전체 업로드: 백준이 끝내 막으면 실패로 넘기지 않고 멈췄다가, 이어하기를 누르면 계속한다', async () => {
  let blocked = true;
  const { context, state, committed, made } = loadBulk((url) => (blocked && url === '/source/download/20' ? { status: 403, body: BLOCKED } : { status: 200, body: SOURCE }), ROWS);
  const run = context.uploadAllSolvedProblem();
  await settle();
  const { pause } = modalParts(made);
  assert.match(pause.style.cssText, /^(?!.*display:none)/);
  assert.deepEqual(state.waits.filter((ms) => ms >= 5000), [5000, 10000, 20000, 40000]);
  assert.deepEqual(committed, [], '멈춘 동안에는 커밋하지 않는다');
  const requestedWhilePaused = state.requested.length;
  await settle();
  assert.equal(state.requested.length, requestedWhilePaused, '멈춘 동안에는 요청하지 않는다');

  blocked = false;
  pause.onclick();
  await run;
  assert.deepEqual(committed, [[...filesOf(1000), ...filesOf(25176)]]);
});

test('전체 업로드: 예전 버전이 403 응답을 풀이로 올린 문제는 올린 문제로 치지 않고 같은 경로에 다시 올린다', async () => {
  // 실제 403 응답 본문의 git blob sha (확장 코드의 상수와 따로 계산한다)
  const body = Buffer.from(BLOCKED, 'utf8');
  const blockedSha = crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${body.length}\0`), body])).digest('hex');
  const submission = { 백준: {
    '1000.A＋B': { 'A＋B.java': 'good-sha', 'README.md': 'readme-sha' },
    '25176.A＋B': { 'A＋B.java': blockedSha, 'README.md': 'readme-sha' },
  } };
  const { context, committed, made } = loadBulk(() => ({ status: 200, body: SOURCE }), ROWS, submission);
  const ids = (blocked) => [...context.extractUploadedProblemIds({ submission: { me: { repo: submission } } }, 'me/repo', '백준', blocked)];
  assert.deepEqual([ids(false), ids(true)], [['1000'], ['25176']]);
  await context.uploadAllSolvedProblem();
  assert.deepEqual(committed, [filesOf(25176)]);
});

test('예제 업로드는 풀이 업로드와 같은 폴더에 올린다 (예전에는 문제 번호 뒤 공백 문자가 달라 옆에 폴더가 하나 더 생겼다)', async () => {
  const { context, committed } = loadBulk(() => ({ status: 200, body: SOURCE }), ROWS);
  context.parseProblemDescription = () => ({ problemId: '1000' });
  const solution = await context.findDataOfSubmission(ROWS[0]);
  assert.equal(`${solution.directory}/${solution.fileName}`, filesOf(1000)[0]);
  await context.uploadExamplesFromProblemPage([{ input: '1 2', output: '3' }]);
  assert.deepEqual(committed, [[`${solution.directory}/input.txt`, `${solution.directory}/output.txt`]]);
});

function loadModal() {
  const made = [];
  const context = vm.createContext({ document: fakeDocument(made) });
  vm.runInContext(read('scripts/toast.js'), context, { filename: 'toast.js' });
  return { modal: context.progressModal('전체제출 업로드'), ...modalParts(made) };
}

test('진행 모달은 끝나기 전에는 닫히지 않고, 끝나면 확인 버튼을 보여 준 뒤 닫힐 때 누른 버튼의 onRetry · onClose 를 부른다', () => {
  for (const [returnValue, expected] of [['', 'close'], ['ok', 'close'], ['retry', 'retry']]) {
    const { modal, dialog, ok } = loadModal();
    let prevented = false;
    dialog.oncancel({ preventDefault: () => { prevented = true; } }); // Esc
    dialog.onclose(); // 그래도 닫혔다면 다시 띄운다
    assert.deepEqual([prevented, dialog.shown, dialog.removed], [true, 2, undefined], '끝나기 전에는 닫히지 않는다');
    const called = [];
    modal.finish('끝', { onRetry: () => called.push('retry'), onClose: () => called.push('close') });
    assert.equal(ok.style.display, '', '확인 버튼을 보여 준다');
    dialog.returnValue = returnValue; // Esc 로 닫으면 returnValue 가 없다
    dialog.onclose();
    assert.deepEqual([dialog.removed, called], [true, [expected]], `returnValue ${JSON.stringify(returnValue)}`);
  }
});

test('진행 모달의 일시정지는 running() 을 붙잡아 두고, 이어하기나 멈출 수 없는 단계로 넘어갈 때 풀린다', async () => {
  const { modal, pause } = loadModal();
  let passed = 0;
  const wait = () => modal.running().then(() => { passed += 1; });
  await wait();
  assert.equal(passed, 1, '멈춰 있지 않으면 바로 지나간다');
  modal.update({ pausable: true });
  pause.onclick();
  wait();
  modal.update({ value: 4, max: 10 }); // 이미 보낸 요청이 끝나며 진행 수를 바꿔도 멈춘 채다
  await settle();
  assert.equal(passed, 1, '일시정지를 누르면 붙잡는다');
  pause.onclick();
  await settle();
  assert.equal(passed, 2, '이어하기를 누르면 풀린다');
  modal.pause('막혔습니다');
  wait();
  await settle();
  assert.equal(passed, 2, 'pause() 도 붙잡는다');
  modal.update({ pausable: false });
  await settle();
  assert.equal(passed, 3, '멈출 수 없는 단계로 넘어가면 풀린다');
  assert.match(pause.style.cssText, /display:none/);
});

test('확인 모달은 확인을 누를 때만 true 이고, 취소·Esc 면 false 로 끝나고 닫히면 페이지에서 빠진다', async () => {
  const made = [];
  const context = vm.createContext({ document: fakeDocument(made) });
  vm.runInContext(read('scripts/toast.js'), context, { filename: 'toast.js' });
  for (const [returnValue, expected] of [['ok', true], ['cancel', false], ['', false]]) {
    made.length = 0;
    const answer = context.confirmModal('올릴까요?');
    const dialog = made.find((el) => el.tag === 'dialog');
    assert.equal(dialog.shown, 1, `${returnValue}: 띄운다`);
    dialog.returnValue = returnValue; // 버튼(method="dialog")이나 Esc 가 남기는 값
    dialog.onclose();
    assert.equal(await answer, expected, `returnValue ${JSON.stringify(returnValue)}`);
    assert.equal(dialog.removed, true, `${returnValue}: 빠진다`);
  }
});

/** 실제 storage.js · baekjoon/storage.js 를 올린다. 저장소 읽기·쓰기는 다음 매크로태스크에 끝나 겹친 저장이 실제처럼 엇갈리고, 타이머는 테스트가 직접 넘긴다. */
async function loadCaches() {
  const stored = { isSync: true, stats: { version: '1.7.2', branches: {}, submission: {}, problems: {} } };
  const timers = [];
  const counts = { cleared: 0 };
  const area = {
    get: (key, done) => setImmediate(() => done({ [key]: structuredClone(stored[key]) })),
    set: (values, done) => { const copy = structuredClone(values); setImmediate(() => { Object.assign(stored, copy); if (done) done(); }); },
  };
  const context = vm.createContext({
    debug: false,
    console: { log: () => {}, warn: console.warn, error: console.error },
    TextEncoder,
    normalizePath,
    chrome: { storage: { local: area, sync: area }, runtime: { getManifest: () => ({ version: '1.7.2' }) } },
    setTimeout: (fn) => { const timer = { fn }; timers.push(timer); return timer; },
    clearTimeout: (timer) => { counts.cleared += 1; if (timers.includes(timer)) timers.splice(timers.indexOf(timer), 1); },
  });
  for (const file of ['scripts/util.js', 'scripts/storage.js', 'scripts/baekjoon/storage.js']) vm.runInContext(read(file), context, { filename: file });
  await settle(); // storage.js 가 로드될 때 하는 초기 저장
  const fire = () => timers.splice(0).forEach((timer) => timer.fn());
  return { context, stored, timers, counts, fire };
}

test('받은 문제·코드 캐시는 항목이 계속 들어오는 중에도 저장되고, 캐시 셋이 서로의 항목을 지우지 않는다', async () => {
  const { context, stored, timers, counts, fire } = await loadCaches();
  for (const id of [1000, 1001, 1002]) {
    await context.updateProblemsFromStats({ problemId: id, problem_description: '설명', problem_input: '입력', problem_output: '출력' });
    await context.updateSubmitCodeFromStats({ submissionId: id + 10, code: SOURCE });
    await context.updateSolvedACFromStats({ problemId: id, jsonData: { titleKo: 'A+B' } });
  }
  assert.deepEqual([timers.length, counts.cleared], [1, 0], '처음 잡은 저장을 뒤에 들어온 항목이 미루지 않는다');
  fire();
  await settle();
  const ids = (name) => Object.keys(stored.stats[name]).filter((key) => key !== 'last_check_date');
  assert.deepEqual([ids('problem'), ids('scode'), ids('solvedac')], [['1000', '1001', '1002'], ['1010', '1011', '1012'], ['1000', '1001', '1002']]);
  assert.equal(stored.stats.scode['1010'].data, SOURCE);
});

test('캐시 저장과 업로드 기록이 겹쳐도 둘 다 남는다', async () => {
  const { context, stored, fire } = await loadCaches();
  await context.updateSubmitCodeFromStats({ submissionId: 10, code: SOURCE });
  fire(); // 캐시 저장이 stats 를 읽는 사이에 업로드 기록이 들어온다
  await context.recordUploadInStats('me/repo', 'main', [{ path: '백준/Bronze/1000. A＋B/A＋B.py', type: 'blob', sha: 'sha-1' }]);
  await settle();
  assert.equal(stored.stats.scode['10']?.data, SOURCE);
  assert.equal(await context.getStatsSHAfromPath('me/repo/백준/Bronze/1000. A＋B/A＋B.py'), 'sha-1');
  assert.equal(stored.stats.branches['me/repo'], 'main');
});

// #388: 커밋에 실패하면 올리려던 파일을 zip 으로 내려받는데, Windows 가 그 zip 을 "올바르지 않습니다" 라며 열지 못했다.
// 2026-11-27 Windows 11 실측(레포의 JSZip 으로 만든 zip): 항목 경로가 UTF-8 로 259바이트까지는 열리고, 260바이트인 항목이 하나라도 있으면
// zip 전체가 열리지 않는다. 한글 40자 제목이면 기본 경로가 265바이트다. (tar · 7-Zip 은 그 zip 을 읽는다)
test('전체 업로드의 zip: 경로가 너무 긴 문제는 zip 안에서만 줄이고, 그 문제의 파일은 한 폴더에 둔다', () => {
  const { context } = loadParsing(() => ({ status: 200, body: SOURCE }));
  const JSZip = require('../library/jszip.min.js');
  const bytes = (text) => Buffer.byteLength(text);
  const zip = new JSZip();
  const tree = [];
  const title = '가'.repeat(40);
  const long = `백준/Gold/12345. ${title}`;
  const short = '백준/Bronze/1000. A＋B';
  context.addBulkFiles(zip, tree, long, [[`${title}.py`, SOURCE], ['README.md', '# 긴 제목'], ['input1.txt', '1 2']]);
  context.addBulkFiles(zip, tree, short, [['A＋B.py', SOURCE], ['README.md', '# A+B']]);

  // 레포에 올리는 경로는 줄이지 않는다
  assert.deepEqual(tree.map((item) => item.path), [`${long}/${title}.py`, `${long}/README.md`, `${long}/input1.txt`, `${short}/A＋B.py`, `${short}/README.md`]);
  assert.equal(bytes(tree[0].path), 265);

  const names = Object.keys(zip.files);
  const files = names.filter((name) => !zip.files[name].dir);
  assert.ok(names.every((name) => bytes(name) <= 259), `259바이트를 넘는 항목: ${names.filter((name) => bytes(name) > 259)}`);
  assert.equal(files.length, 5);
  // 긴 문제: 문제 번호와 확장자가 남고, 세 파일이 같은 폴더에 있다
  const folder = path.posix.dirname(files[0]);
  assert.match(files[0], /^백준\/Gold\/12345\. 가+\/가+\.py$/);
  assert.deepEqual(files.slice(0, 3).map((name) => path.posix.dirname(name)), [folder, folder, folder]);
  assert.deepEqual(files.slice(1, 3).map((name) => path.posix.basename(name)), ['README.md', 'input1.txt']);
  // 짧은 문제는 레포 경로 그대로다
  assert.deepEqual(files.slice(3), [`${short}/A＋B.py`, `${short}/README.md`]);
});
