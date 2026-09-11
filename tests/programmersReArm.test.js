'use strict';

// 프로그래머스 재제출 감지 재무장 검증 (#348).
// programmers.js 는 classic script 라 export 가 없으므로, 스텁을 넣은 vm 컨텍스트에 원문을 로드해
// 최상위 함수 선언(startLoader / handleSolvedResult / beginUpload ...)을 샌드박스 속성으로 꺼내 쓴다.
// beginUpload 은 스텁하지 않고 실물을 그대로 태워 SHA dedup 게이트까지 함께 검증한다.
// 타이머는 가짜 시계로 대체해 2초 폴링을 실제로 기다리지 않는다.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const LESSON_URL = 'https://school.programmers.co.kr/learn/courses/30/lessons/12345';
const HOOK = 'tester/algorithm';
const DIRECTORY = '프로그래머스/2/12345. 두 수의 합';
const FILE_NAME = '두 수의 합.py';
const CODE = 'def solution(a, b):\n    return a + b\n';

const isNull = (v) => v === null || v === undefined;

/* 등록된 타이머를 수동으로 흘려보내는 가짜 시계.
   tick() 은 지연시간과 무관하게 현재 등록된 타이머를 등록 순서대로 1회씩 실행한다. */
function makeClock() {
  let nextId = 1;
  const timers = new Map();
  return {
    setInterval(fn) { const id = nextId++; timers.set(id, { fn, once: false }); return id; },
    clearInterval(id) { timers.delete(id); },
    setTimeout(fn) { const id = nextId++; timers.set(id, { fn, once: true }); return id; },
    clearTimeout(id) { timers.delete(id); },
    pending() { return timers.size; },
    async tick() {
      for (const [id, entry] of [...timers]) {
        if (entry.once) timers.delete(id);
        entry.fn();
      }
      // 스텁이 전부 즉시 resolve 되므로 몇 턴만 돌리면 마이크로태스크가 모두 비워진다.
      for (let i = 0; i < 20; i += 1) await new Promise((r) => setImmediate(r));
    },
  };
}

/* getSolvedResult() 가 쓰는 querySelector 한 개가 DOM 요구사항의 전부다.
   modal.open === false 는 "닫혔지만 텍스트는 그대로 읽히는" 실제 상황을 재현한다
   (렌더링되지 않는 요소의 innerText 는 textContent 로 폴백된다). */
function makeDocument(modal) {
  const element = {
    get innerText() { return modal.text; },
    get offsetWidth() { return modal.open ? 400 : 0; },
    get offsetHeight() { return modal.open ? 200 : 0; },
    getClientRects() { return modal.open ? [{}] : []; },
  };
  return {
    querySelector(selector) {
      if (selector === 'div.modal-header > h4') return modal.text === null ? null : element;
      return null;
    },
    querySelectorAll: () => [],
    getElementById: () => null,
  };
}

function loadProgrammersJs(options = {}) {
  const {
    url = LESSON_URL,
    cachedSHA = null,
    remoteFile = null,
    uploadImpl = null,
    enabled = true,
  } = options;

  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'programmers', 'programmers.js'), 'utf8');
  const clock = makeClock();
  const modal = { text: null, open: false };
  const calls = { parseData: 0, startUpload: 0, upload: 0, markUploaded: 0, markFailed: 0 };
  const enableRef = { value: enabled };

  const bojData = {
    problemId: '12345',
    directory: DIRECTORY,
    fileName: FILE_NAME,
    message: 'commit message',
    readme: 'readme',
    code: CODE,
  };

  const sandbox = {
    console: { log: () => {}, error: () => {} },
    chrome: { runtime: { id: 'test-extension-id' } },
    window: { location: { href: url } },
    document: makeDocument(modal),
    MutationObserver: class { observe() {} disconnect() {} },
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,

    // scripts/util.js
    isNull,
    isNotEmpty: (o) => !isNull(o),
    log: () => {},
    getVersion: () => '1.4.19',
    calculateBlobSHA: (content) => 'sha1-' + content.length,

    // scripts/enable.js
    checkEnable: async () => enableRef.value,

    // scripts/storage.js
    getStats: async () => ({ version: '1.4.19', branches: { [HOOK]: 'main' }, submission: {}, problems: {} }),
    saveStats: async () => {},
    getHook: async () => HOOK,
    getToken: async () => 'token',
    getStatsSHAfromPath: async (p) => (p === HOOK ? {} : cachedSHA),
    updateLocalStorageStats: async () => ({}),

    // scripts/Github.js
    getFile: async () => remoteFile,

    // scripts/programmers/variables.js
    uploadState: { uploading: false, countdown: null },

    // scripts/programmers/util.js
    startUpload: () => { calls.startUpload += 1; sandbox.uploadState.uploading = true; },
    markUploadedCSS: () => { calls.markUploaded += 1; sandbox.uploadState.uploading = false; },
    markUploadFailedCSS: () => { calls.markFailed += 1; sandbox.uploadState.uploading = false; },
    insertUploadAllButton: () => {},

    // scripts/programmers/parsing.js
    parseData: async () => { calls.parseData += 1; return bojData; },

    // scripts/programmers/uploadfunctions.js
    uploadOneSolveProblemOnGit: async (data, cb) => {
      calls.upload += 1;
      if (uploadImpl) return uploadImpl(calls.upload);
      cb({ [HOOK]: 'main' }, data.directory);
      return undefined;
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'programmers.js' });

  return {
    sandbox,
    clock,
    calls,
    enableRef,
    openModal(text = '정답입니다.') { modal.text = text; modal.open = true; },
    closeModal() { modal.open = false; }, // 텍스트는 일부러 남겨둔다
  };
}

describe('프로그래머스 채점 결과 감지 (#348)', () => {
  test('레슨 URL에서는 로더가 자동으로 시작된다', () => {
    const env = loadProgrammersJs();
    assert.equal(env.clock.pending(), 1);
  });

  test('레슨 URL이 아니면 감지 로더가 붙지 않는다', async () => {
    const env = loadProgrammersJs({ url: 'https://school.programmers.co.kr/learn/challenges' });
    env.openModal();
    await env.clock.tick();
    assert.equal(env.calls.parseData, 0);
  });

  test('정답 모달이 뜨면 한 번 처리한다', async () => {
    const env = loadProgrammersJs();
    env.openModal();
    await env.clock.tick();
    assert.equal(env.calls.parseData, 1);
    assert.equal(env.calls.upload, 1);
  });

  test('같은 모달이 떠 있는 동안에는 중복 트리거되지 않는다', async () => {
    const env = loadProgrammersJs();
    env.openModal();
    await env.clock.tick();
    await env.clock.tick();
    await env.clock.tick();
    assert.equal(env.calls.parseData, 1);
    assert.equal(env.calls.upload, 1);
  });

  test('#348: 모달을 닫고 재제출하면 다시 감지되어 업로드한다', async () => {
    const env = loadProgrammersJs();
    env.openModal();
    await env.clock.tick();
    assert.equal(env.calls.upload, 1);

    // 닫아도 innerText 는 '정답입니다.' 그대로다. 렌더링 여부로 판정해야 재무장된다.
    env.closeModal();
    await env.clock.tick();

    env.openModal();
    await env.clock.tick();
    assert.equal(env.calls.parseData, 2);
    assert.equal(env.calls.upload, 2);
  });

  test('1차 업로드가 예외로 실패해도 재제출이 감지된다', async () => {
    const env = loadProgrammersJs({
      uploadImpl: (attempt) => {
        if (attempt === 1) throw new Error('GitHub API error: 401');
        return undefined;
      },
    });
    env.openModal();
    await env.clock.tick();
    assert.equal(env.calls.upload, 1);
    assert.equal(env.calls.markFailed, 1, '확정된 실패는 워치독을 기다리지 않고 즉시 표시된다');

    env.closeModal();
    await env.clock.tick();
    env.openModal();
    await env.clock.tick();
    assert.equal(env.calls.upload, 2, '예외가 감지를 영구히 막으면 안 된다');
  });

  test('오답 모달은 무시한다', async () => {
    const env = loadProgrammersJs();
    env.openModal('실패했습니다.');
    await env.clock.tick();
    assert.equal(env.calls.parseData, 0);
  });

  test('캐시된 SHA가 같으면 업로드하지 않고 완료 표시만 한다', async () => {
    const env = loadProgrammersJs({ cachedSHA: 'sha1-' + CODE.length });
    env.openModal();
    await env.clock.tick();
    assert.equal(env.calls.upload, 0, '동일 코드 재제출은 중복 커밋을 만들지 않는다');
    assert.equal(env.calls.markUploaded, 1);
  });

  test('원격에 동일한 파일이 있으면 업로드를 건너뛴다', async () => {
    const env = loadProgrammersJs({ remoteFile: { sha: 'sha1-' + CODE.length } });
    env.openModal();
    await env.clock.tick();
    assert.equal(env.calls.upload, 0);
    assert.equal(env.calls.markUploaded, 1);
  });

  test('기능이 꺼져 있으면 로더가 중단된다', async () => {
    const env = loadProgrammersJs({ enabled: false });
    env.openModal();
    await env.clock.tick();
    assert.equal(env.clock.pending(), 0);
    assert.equal(env.calls.parseData, 0);
  });

  test('확장 컨텍스트가 무효화되면 로더가 조용히 중단된다', async () => {
    const env = loadProgrammersJs();
    env.sandbox.chrome.runtime = {}; // id 소멸 = 컨텍스트 무효화
    env.openModal();
    await env.clock.tick();
    assert.equal(env.clock.pending(), 0);
    assert.equal(env.calls.parseData, 0);
  });
});

describe('업로드 워치독 (#348 재제출 경로)', () => {
  function loadUtilJs() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'programmers', 'util.js'), 'utf8');
    const clock = makeClock();
    const sandbox = {
      console,
      isNull,
      uploadState: { uploading: false, countdown: null },
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
      document: { getElementById: () => null },
      window: {},
    };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: 'util.js' });
    return { sandbox, clock };
  }

  test('재시도 시 이전 워치독이 해제되어 중첩되지 않는다', () => {
    const { sandbox, clock } = loadUtilJs();
    sandbox.startUploadCountDown();
    assert.equal(clock.pending(), 1);
    sandbox.startUploadCountDown();
    assert.equal(clock.pending(), 1, '1차 워치독이 남아 있으면 2차 시도를 실패로 덮어쓴다');
  });

  test('markUploadedCSS 는 아이콘이 사라진 경우에도 예외를 던지지 않는다', () => {
    const { sandbox } = loadUtilJs();
    assert.doesNotThrow(() => sandbox.markUploadedCSS({ [HOOK]: 'main' }, DIRECTORY));
  });
});
