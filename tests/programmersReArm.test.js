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
    parseImpl = null,
    statefulCache = false,
    enabled = true,
  } = options;

  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'programmers', 'programmers.js'), 'utf8');
  const clock = makeClock();
  const modal = { text: null, open: false };
  const calls = { parseData: 0, startUpload: 0, upload: 0, markUploaded: 0, markFailed: 0 };
  // 시도(attempt)별 결과 기록: 앞 시도의 콜백이 뒤 시도의 아이콘을 건드리지 않는지 검증한다
  const marks = [];
  const enableRef = { value: enabled };
  const codeRef = { value: CODE };
  const uploaded = []; // 실제로 커밋된(업로드 스텁이 받은) 코드 순서
  const countdowns = []; // 워치독이 켜진 시도 순서
  const cache = new Map(); // statefulCache: 업로드가 기록한 SHA 를 다음 조회가 읽는다

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
    getStatsSHAfromPath: async (p) => (p === HOOK ? {} : (cache.has(p) ? cache.get(p) : cachedSHA)),
    updateLocalStorageStats: async () => ({}),

    // scripts/Github.js
    getFile: async () => remoteFile,

    // scripts/programmers/variables.js
    uploadState: { queue: Promise.resolve() },

    // scripts/programmers/util.js
    startUpload: () => { calls.startUpload += 1; return { id: calls.startUpload }; },
    markUploadedCSS: (branches, directory, attempt) => { calls.markUploaded += 1; marks.push(['uploaded', attempt && attempt.id]); },
    markUploadFailedCSS: (attempt) => { calls.markFailed += 1; marks.push(['failed', attempt && attempt.id]); },
    startUploadCountDown: (attempt) => { countdowns.push(attempt.id); },
    insertUploadAllButton: () => {},

    // scripts/programmers/parsing.js
    // 파싱 시점의 코드를 그대로 싣는다 — 재제출마다 에디터 코드가 바뀌는 상황을 codeRef 로 재현한다.
    // DOM 은 첫 await 전에 동기로 읽으므로, 코드는 호출 즉시 떠 두고 parseImpl 로 그 뒤의 지연/실패를 재현한다.
    parseData: async () => {
      calls.parseData += 1;
      const data = { ...bojData, code: codeRef.value };
      if (parseImpl) await parseImpl(calls.parseData);
      return data;
    },

    // scripts/programmers/uploadfunctions.js
    uploadOneSolveProblemOnGit: async (data, cb) => {
      calls.upload += 1;
      uploaded.push(data.code);
      if (uploadImpl) {
        await uploadImpl(calls.upload);
      }
      if (statefulCache) cache.set(`${HOOK}/${data.directory}/${data.fileName}`, 'sha1-' + data.code.length);
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
    marks,
    uploaded,
    countdowns,
    codeRef,
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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// E2E(2026-09-23)에서 재현한 시나리오: GitHub 응답이 느려 20초 워치독이 빨간 체크를 띄운 뒤,
// 사용자가 모달을 닫고 코드를 고쳐 재제출하면 1차 업로드가 끝날 때까지 감지가 막혀 2차 코드가 사라졌다.
describe('느린 업로드 도중 재제출 (#348 후속)', () => {
  async function submitSecondWhileFirstInFlight(env) {
    env.codeRef.value = 'E1';
    env.openModal();
    await env.clock.tick(); // 1차 감지 → 파싱 → 업로드 진행 중
    assert.equal(env.calls.upload, 1);

    env.closeModal();
    await env.clock.tick(); // 1차 업로드가 끝나지 않았어도 모달이 닫혔으니 재무장된다

    env.codeRef.value = 'E2';
    env.openModal();
    await env.clock.tick(); // 2차 감지 → 즉시 파싱
  }

  test('1차 업로드가 끝나기 전에 모달을 닫고 재제출해도 2차 코드가 업로드된다', async () => {
    const first = deferred();
    const env = loadProgrammersJs({ uploadImpl: (n) => (n === 1 ? first.promise : undefined) });
    await submitSecondWhileFirstInFlight(env);
    assert.equal(env.calls.parseData, 2, '2차 정답이 감지되어야 한다');

    first.resolve();
    await env.clock.tick();
    assert.deepEqual(env.uploaded, ['E1', 'E2']);
  });

  test('업로드는 한 번에 하나씩 실행된다 (force PATCH 로 앞 커밋이 지워지지 않도록)', async () => {
    const first = deferred();
    const env = loadProgrammersJs({ uploadImpl: (n) => (n === 1 ? first.promise : undefined) });
    await submitSecondWhileFirstInFlight(env);
    assert.equal(env.calls.upload, 1, '1차가 끝나기 전에 2차 업로드가 시작되면 안 된다');

    first.resolve();
    await env.clock.tick();
    assert.equal(env.calls.upload, 2);
  });

  test('2차 모달을 1차 업로드가 끝나기 전에 닫아도 2차는 업로드된다', async () => {
    const first = deferred();
    const env = loadProgrammersJs({ uploadImpl: (n) => (n === 1 ? first.promise : undefined) });
    await submitSecondWhileFirstInFlight(env);

    env.closeModal(); // 사용자가 아이콘이 안 바뀌는 것을 보고 모달을 닫아버린 경우
    env.codeRef.value = '에디터에서 다시 고친 코드';
    await env.clock.tick();

    first.resolve();
    await env.clock.tick();
    assert.deepEqual(env.uploaded, ['E1', 'E2'], '감지 시점에 파싱한 코드(방금 정답을 받은 코드)를 올린다');
  });

  test('1차 업로드가 실패해도 줄 서 있던 2차 업로드는 실행된다', async () => {
    const first = deferred();
    const env = loadProgrammersJs({ uploadImpl: (n) => (n === 1 ? first.promise : undefined) });
    await submitSecondWhileFirstInFlight(env);

    first.reject(new Error('GitHub API error: 500'));
    await env.clock.tick();
    assert.deepEqual(env.uploaded, ['E1', 'E2']);
    assert.deepEqual(env.marks, [['failed', 1], ['uploaded', 2]]);
  });

  test('각 시도의 완료 표시는 자기 아이콘에만 적용된다', async () => {
    const first = deferred();
    const env = loadProgrammersJs({ uploadImpl: (n) => (n === 1 ? first.promise : undefined) });
    await submitSecondWhileFirstInFlight(env);

    first.resolve();
    await env.clock.tick();
    assert.deepEqual(env.marks, [['uploaded', 1], ['uploaded', 2]]);
  });

  test('워치독은 줄을 기다린 시간이 아니라 자기 업로드가 시작될 때부터 잰다', async () => {
    const first = deferred();
    const env = loadProgrammersJs({ uploadImpl: (n) => (n === 1 ? first.promise : undefined) });
    await submitSecondWhileFirstInFlight(env);
    assert.deepEqual(env.countdowns, [1], '1차 뒤에서 기다리는 2차는 아직 실패 판정 대상이 아니다');

    first.resolve();
    await env.clock.tick();
    assert.deepEqual(env.countdowns, [1, 2]);
  });

  test('1차 파싱이 늦어져도 커밋 순서는 감지 순서를 따른다', async () => {
    const firstParse = deferred();
    const env = loadProgrammersJs({ parseImpl: (n) => (n === 1 ? firstParse.promise : undefined) });
    env.codeRef.value = 'E1';
    env.openModal();
    await env.clock.tick(); // 1차 감지 → 파싱이 멈춰 있음
    env.closeModal();
    await env.clock.tick();
    env.codeRef.value = 'E2';
    env.openModal();
    await env.clock.tick(); // 2차 감지 → 파싱은 바로 끝남
    assert.equal(env.calls.parseData, 2);
    assert.equal(env.calls.upload, 0, '1차 파싱이 끝나기 전에 2차가 먼저 커밋되면 안 된다');

    firstParse.resolve();
    await env.clock.tick();
    assert.deepEqual(env.uploaded, ['E1', 'E2'], '순서가 뒤집히면 이전 코드가 최신 코드를 덮는다');
  });

  test('파싱이 실패하면 즉시 실패로 표시하고 업로드하지 않으며, 재제출은 계속 감지된다', async () => {
    const env = loadProgrammersJs({
      parseImpl: (n) => {
        if (n === 1) throw new Error('DOM 변경');
        return undefined;
      },
    });
    env.openModal();
    await env.clock.tick();
    assert.equal(env.calls.upload, 0);
    assert.deepEqual(env.marks, [['failed', 1]]);
    assert.deepEqual(env.countdowns, [], '이미 실패로 확정된 시도에 워치독을 켜지 않는다');

    env.closeModal();
    await env.clock.tick();
    env.openModal();
    await env.clock.tick();
    assert.equal(env.calls.upload, 1);
    assert.deepEqual(env.marks, [['failed', 1], ['uploaded', 2]]);
  });

  test('1차 업로드 도중 같은 코드를 재제출하면 1차 커밋을 확인하고 중복 커밋하지 않는다', async () => {
    const first = deferred();
    const env = loadProgrammersJs({ statefulCache: true, uploadImpl: (n) => (n === 1 ? first.promise : undefined) });
    env.openModal();
    await env.clock.tick(); // 1차 업로드 진행 중
    env.closeModal();
    await env.clock.tick();
    env.openModal(); // 같은 코드로 재제출
    await env.clock.tick();

    first.resolve();
    await env.clock.tick();
    assert.deepEqual(env.uploaded, [CODE], '2차는 1차가 기록한 캐시 SHA 와 같아 커밋하지 않는다');
    assert.deepEqual(env.marks, [['uploaded', 1], ['uploaded', 2]]);
  });
});

describe('업로드 아이콘과 워치독 (시도 단위)', () => {
  /* startUpload 가 쓰는 DOM 은 모달 footer 하나와 createElement/getElementById 뿐이다. */
  function makeDom() {
    const footer = { children: [], parent: null };
    const makeElement = () => ({
      id: '',
      className: '',
      style: {},
      children: [],
      parent: null,
      listeners: {},
      appendChild(child) { this.children.push(child); child.parent = this; },
      remove() {
        if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
        this.parent = null;
      },
      addEventListener(type, fn) { this.listeners[type] = fn; },
    });
    footer.prepend = (child) => { footer.children.unshift(child); child.parent = footer; };
    const findById = (node, id) => {
      for (const child of node.children) {
        if (child.id === id) return child;
        const found = findById(child, id);
        if (found) return found;
      }
      return null;
    };
    return {
      footer,
      document: {
        createElement: makeElement,
        querySelector: (selector) => (selector.includes('modal-footer') ? footer : null),
        getElementById: (id) => findById(footer, id),
      },
    };
  }

  function loadUtilJs() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'programmers', 'util.js'), 'utf8');
    const clock = makeClock();
    const dom = makeDom();
    const sandbox = {
      console,
      isNull,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
      document: dom.document,
      window: { location: {} },
    };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: 'util.js' });
    return { sandbox, clock, footer: dom.footer };
  }

  const BRANCHES = { [HOOK]: 'main' };

  test('시도마다 새 아이콘을 만들고, 이전 시도의 아이콘은 떼어낸다', () => {
    const { sandbox, footer } = loadUtilJs();
    const first = sandbox.startUpload();
    const second = sandbox.startUpload();
    assert.equal(footer.children.length, 1);
    assert.equal(footer.children[0].children[0], second.elem);
    assert.equal(first.elem.parent.parent, null, '이전 시도의 아이콘은 화면에서 빠진다');
  });

  test('앞 시도가 늦게 성공해도 새 시도의 아이콘은 바뀌지 않는다', () => {
    const { sandbox } = loadUtilJs();
    const first = sandbox.startUpload();
    const second = sandbox.startUpload();
    sandbox.markUploadedCSS(BRANCHES, DIRECTORY, first);
    assert.equal(first.elem.className, 'markuploaded');
    assert.equal(second.elem.className, 'BaekjoonHub_progress');
  });

  test('startUpload 만으로는 워치독이 켜지지 않는다 (줄을 기다리는 동안은 로딩 아이콘 유지)', async () => {
    const { sandbox, clock } = loadUtilJs();
    const attempt = sandbox.startUpload();
    assert.equal(clock.pending(), 0);
    await clock.tick();
    assert.equal(attempt.elem.className, 'BaekjoonHub_progress');
  });

  test('워치독은 시도마다 따로 돌고, 완료된 시도의 워치독은 해제된다', async () => {
    const { sandbox, clock } = loadUtilJs();
    const first = sandbox.startUpload();
    const second = sandbox.startUpload();
    sandbox.startUploadCountDown(first);
    sandbox.startUploadCountDown(second);
    assert.equal(clock.pending(), 2);
    sandbox.markUploadedCSS(BRANCHES, DIRECTORY, second);
    assert.equal(clock.pending(), 1);
    await clock.tick(); // 남은 워치독(1차)만 발화
    assert.equal(first.elem.className, 'markuploadfailed');
    assert.equal(second.elem.className, 'markuploaded', '다른 시도의 워치독이 완료 표시를 실패로 덮어쓰면 안 된다');
  });

  test('워치독이 실패로 표시한 뒤 업로드가 성공하면 완료로 바뀐다', async () => {
    const { sandbox, clock } = loadUtilJs();
    const attempt = sandbox.startUpload();
    sandbox.startUploadCountDown(attempt);
    await clock.tick();
    assert.equal(attempt.elem.className, 'markuploadfailed');
    sandbox.markUploadedCSS(BRANCHES, DIRECTORY, attempt);
    assert.equal(attempt.elem.className, 'markuploaded');
  });

  test('완료된 시도는 실패로 되돌리지 않는다', () => {
    const { sandbox } = loadUtilJs();
    const attempt = sandbox.startUpload();
    sandbox.markUploadedCSS(BRANCHES, DIRECTORY, attempt);
    sandbox.markUploadFailedCSS(attempt);
    assert.equal(attempt.elem.className, 'markuploaded');
  });

  test('아이콘이 없거나 시도가 없어도 예외를 던지지 않는다', () => {
    const { sandbox } = loadUtilJs();
    assert.doesNotThrow(() => sandbox.markUploadedCSS(BRANCHES, DIRECTORY, undefined));
    assert.doesNotThrow(() => sandbox.markUploadFailedCSS(undefined));
    assert.doesNotThrow(() => sandbox.markUploadedCSS(BRANCHES, DIRECTORY, { elem: null, done: false, countdown: null }));
  });
});
