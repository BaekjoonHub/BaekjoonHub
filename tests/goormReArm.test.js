'use strict';

// 구름LEVEL 재제출 감지 검증.
// 예전 goormlevel.js 는 첫 정답을 처리한 뒤 감지를 멈춰, 페이지를 새로고침하지 않으면 재제출이 업로드되지 않았다.
// 구름LEVEL 은 제출할 때마다 결과 블록(결과 문단 + 테스트 케이스 표)을 목록 맨 위에 새로 쌓고 이전 블록을 지우지
// 않는다(2026-09-24 실측: 재제출 2회 후 블록 3개, 최신이 맨 위, 채점 중에는 '처리중...'). 여기서는
// goormlevel/util.js 와 goormlevel.js 원문을 작은 가짜 DOM 위에 로드해 그 동작을 재현한다.
// parseData 는 스텁하되, 블록 단위 행 읽기는 parsing.js 원문으로 따로 검증한다.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const HOOK = 'tester/algorithm';
const RESULT_P_CLASS = '_47a86f0a result';
const isNull = (v) => v === null || v === undefined;

/* ─────────── 가짜 DOM: 코드가 쓰는 selector(태그/#id/.class/[attr], 자손·자식 결합자)만 해석한다 ─────────── */

function parseSelector(selector) {
  const parts = [];
  let comb = null;
  for (const token of selector.trim().split(/\s*(>)\s*|\s+/).filter((t) => t !== undefined && t !== '')) {
    if (token === '>') { comb = '>'; continue; }
    const compound = { tag: null, id: null, classes: [], attrs: [] };
    const re = /^([a-zA-Z][a-zA-Z0-9-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)\]/g;
    let m;
    while ((m = re.exec(token)) !== null) {
      if (m[1]) compound.tag = m[1].toLowerCase();
      if (m[2]) compound.id = m[2];
      if (m[3]) compound.classes.push(m[3]);
      if (m[4]) compound.attrs.push(m[4]);
    }
    parts.push({ compound, comb: parts.length === 0 ? null : (comb || ' ') });
    comb = null;
  }
  return parts;
}

function matchCompound(node, { tag, id, classes, attrs }) {
  if (tag && node.tagName.toLowerCase() !== tag) return false;
  if (id && node.id !== id) return false;
  const own = node.className.split(/\s+/).filter(Boolean);
  if (!classes.every((c) => own.includes(c))) return false;
  return attrs.every((a) => (a === 'class' ? node.hasClassAttr : node.attributes[a] !== undefined));
}

function matchFrom(node, parts, i) {
  if (!matchCompound(node, parts[i].compound)) return false;
  if (i === 0) return true;
  if (parts[i].comb === '>') return !isNull(node.parentElement) && matchFrom(node.parentElement, parts, i - 1);
  for (let a = node.parentElement; !isNull(a); a = a.parentElement) if (matchFrom(a, parts, i - 1)) return true;
  return false;
}

class El {
  constructor(tag, { id = '', className, text = null, attributes = {} } = {}) {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this._className = className === undefined ? '' : className;
    this.hasClassAttr = className !== undefined;
    this.text = text;
    this.attributes = attributes;
    this.children = [];
    this.parentElement = null;
    this.style = {};
    this.listeners = [];
  }
  get className() { return this._className; }
  set className(value) { this._className = value; this.hasClassAttr = true; }
  // 자기 텍스트는 자식 요소 앞의 텍스트 노드처럼 다룬다 (아이콘을 붙여도 '정답입니다.' 가 남는다)
  get textContent() { return (this.text || '') + this.children.map((c) => c.textContent).join(''); }
  set textContent(value) { this.text = value; for (const c of this.children) c.parentElement = null; this.children = []; }
  get childNodes() { return this.children; }
  get isConnected() { let n = this; while (n.parentElement) n = n.parentElement; return n.tagName === 'HTML'; }
  append(...nodes) { for (const n of nodes) this.appendChild(n); }
  appendChild(node) { node.remove(); node.parentElement = this; this.children.push(node); return node; }
  prepend(node) { node.remove(); node.parentElement = this; this.children.unshift(node); return node; }
  remove() { if (this.parentElement) { const s = this.parentElement.children; s.splice(s.indexOf(this), 1); this.parentElement = null; } }
  addEventListener(type, fn) { this.listeners.push([type, fn]); }
  closest(selector) { const parts = parseSelector(selector); for (let n = this; !isNull(n); n = n.parentElement) if (matchFrom(n, parts, parts.length - 1)) return n; return null; }
  querySelectorAll(selector) {
    const parts = parseSelector(selector);
    const out = [];
    const walk = (n) => { for (const c of n.children) { if (matchFrom(c, parts, parts.length - 1)) out.push(c); walk(c); } };
    walk(this);
    return out;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function h(tag, opts = {}, children = []) {
  const node = new El(tag, opts);
  for (const c of children) node.appendChild(c);
  return node;
}

/** 테스트 케이스 표 한 행: childNodes[1] 결과, [5] 메모리(KB), [6] 시간(ms) — 실제 goorm 표 열 순서 */
function row(result, memory, runtime) {
  return h('tr', {}, ['1', result, '', '', '', String(memory), String(runtime)].map((text) => h('td', { text })));
}

/** goorm 문제 페이지: 탭 두 개 + 제출 결과 패널(결과 블록 스택) */
function makePage() {
  const html = new El('html');
  const stack = h('div', { className: 'ca37ebaf' });
  const submitPane = h('div', { className: 'tab-pane active' }, [stack]);
  const runTab = h('a', { className: 'nav-link', text: '실행 결과' });
  const submitTab = h('a', { className: 'nav-link active', text: '제출 결과' });
  // 제출 버튼: 글자가 자식 요소에 들어 있으면 클릭 대상이 버튼 안쪽 요소가 된다
  const submitLabel = h('span', { text: '제출' });
  const submitButton = h('button', { id: 'btn-submit', className: 'Tour__submitBtn' }, [submitLabel]);
  submitButton.disabled = false;
  const frame = h('div', { id: 'FrameBody' }, [
    submitButton,
    h('ul', {}, [h('li', { className: 'nav-item' }, [runTab]), h('li', { className: 'nav-item' }, [submitTab])]),
    h('div', { className: 'tab-content' }, [submitPane]),
  ]);
  html.appendChild(h('body', {}, [frame]));

  const listeners = [];
  const page = {
    html,
    stack,
    submitTab,
    runTab,
    submitButton,
    submitLabel,
    listeners,
    /** 문서에 등록된 click 리스너에 클릭을 흘린다 */
    click(target) {
      for (const { type, fn } of [...listeners]) if (type === 'click') fn({ target });
    },
    /**
     * 새 제출: 제출 버튼을 누르고(click: false 면 버튼을 거치지 않은 제출), 결과 블록을 맨 위에 쌓아 채점 중
     * 상태로 둔다. 채점 중에는 goorm 처럼 버튼을 비활성화한다. 반환값의 finish() 로 채점을 끝낸다.
     */
    submit(rows = [['PASS', 1024, 10]], { click = true } = {}) {
      if (click) page.click(submitLabel);
      submitButton.disabled = true;
      const paragraph = h('p', { className: RESULT_P_CLASS, text: '처리중...' });
      const table = h('table', {}, [h('tbody', {}, rows.map(([r, m, t]) => row(r, m, t)))]);
      const block = h('div', {}, [h('div', {}, [paragraph]), table]);
      stack.prepend(block);
      return {
        block,
        table,
        finish(verdict = '정답입니다.') {
          paragraph.textContent = '';
          const span = h('span', { text: verdict });
          paragraph.appendChild(span);
          submitButton.disabled = false;
          return span;
        },
      };
    },
    showTab(which) {
      runTab.className = which === 'run' ? 'nav-link active' : 'nav-link';
      submitTab.className = which === 'submit' ? 'nav-link active' : 'nav-link';
    },
  };
  return page;
}

function makeDocument(page) {
  return {
    createElement: (tag) => new El(tag),
    querySelectorAll: (selector) => page.html.querySelectorAll(selector),
    querySelector: (selector) => page.html.querySelector(selector),
    getElementById: () => { throw new Error('결과 블록이 쌓이므로 id 로 아이콘을 찾으면 안 된다'); },
    addEventListener: (type, fn, capture) => page.listeners.push({ type, fn, capture }),
    removeEventListener: (type, fn, capture) => {
      const index = page.listeners.findIndex((l) => l.type === type && l.fn === fn && l.capture === capture);
      if (index !== -1) page.listeners.splice(index, 1);
    },
  };
}

/* 등록된 타이머를 수동으로 흘려보내는 가짜 시계 (programmersReArm.test.js 와 같은 방식) */
function makeClock() {
  let nextId = 1;
  const timers = new Map();
  return {
    timers,
    setInterval(fn) { const id = nextId++; timers.set(id, { fn, once: false }); return id; },
    clearInterval(id) { timers.delete(id); },
    setTimeout(fn, ms) { const id = nextId++; timers.set(id, { fn, once: true, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    /** 폴링(2초) 한 번: 인터벌만 실행한다. 워치독은 fireTimeouts() 로 따로 흘린다. */
    async tick() {
      for (const [, entry] of [...timers]) if (!entry.once) entry.fn();
      await flush();
    },
    async fireTimeouts() {
      for (const [id, entry] of [...timers]) if (entry.once) { timers.delete(id); entry.fn(); }
      await flush();
    },
  };
}

async function flush() {
  for (let i = 0; i < 30; i += 1) await new Promise((r) => setImmediate(r));
}

function loadGoorm({ parseImpl = null, uploadImpl = null, cachedSHA = null, enabled = true } = {}) {
  const page = makePage();
  const clock = makeClock();
  const calls = { parse: [], upload: [], submitted: [] };
  const errors = [];
  const codeRef = { value: 'print(1)\n' };
  const cache = new Map();

  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: (...args) => errors.push(args) },
    chrome: { runtime: { id: 'test-extension-id' } },
    window: { location: { pathname: '/exam/1234/abc/quiz/1', href: 'https://level.goorm.io/exam/1234/abc/quiz/1' } },
    document: makeDocument(page),
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,

    // scripts/util.js
    isNull,
    isNotEmpty: (o) => !isNull(o) && Object.keys(o).length > 0,
    log: () => {},
    getVersion: () => '1.4.20',
    calculateBlobSHA: (content) => `sha:${content}`,
    // scripts/enable.js
    checkEnable: async () => enabled,
    // scripts/storage.js
    getStats: async () => ({ version: '1.4.20', branches: { [HOOK]: 'main' }, submission: {} }),
    getHook: async () => HOOK,
    getToken: async () => 'token',
    getStatsSHAfromPath: async (p) => (p === HOOK ? {} : (cache.has(p) ? cache.get(p) : cachedSHA)),
    updateLocalStorageStats: async () => ({}),
    saveStats: async () => {},
    // scripts/Github.js
    getFile: async () => null,
    // scripts/goormlevel/parsing.js — 실제 parseData 처럼 제출 기록이 있으면 그 코드를, 없으면 지금 에디터를 읽는다
    readGoormEditor: () => ({ language: 'Python 3', code: codeRef.value }),
    parseData: async (resultBlock, submitted = null) => {
      calls.parse.push(resultBlock);
      calls.submitted.push(submitted);
      if (parseImpl) return parseImpl(resultBlock, calls.parse.length, submitted);
      const code = isNull(submitted) ? codeRef.value : submitted.code;
      return { examId: 1234, quizNumber: 1, message: 'msg', directory: 'goormlevel/1234/1. 제목', fileName: '제목.py', readme: 'readme', code };
    },
    // scripts/goormlevel/uploadfunctions.js
    uploadOneSolveProblemOnGit: async (data, cb) => {
      calls.upload.push(data.code);
      if (uploadImpl) await uploadImpl(data, calls.upload.length);
      cache.set(`${HOOK}/${data.directory}/${data.fileName}`, `sha:${data.code}`);
      cb({ [HOOK]: 'main' }, data.directory);
    },
  };
  vm.createContext(sandbox);
  // uploadState(업로드 줄)는 스텁하지 않고 실제 번들의 선언을 쓴다
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'scripts', 'goormlevel', 'variables.js'), 'utf8'), sandbox, { filename: 'goormlevel/variables.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'scripts', 'goormlevel', 'util.js'), 'utf8'), sandbox, { filename: 'goormlevel/util.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'scripts', 'goormlevel', 'goormlevel.js'), 'utf8'), sandbox, { filename: 'goormlevel.js' });
  return { sandbox, page, clock, calls, errors, codeRef };
}

/** 결과 span 옆에 붙은 아이콘 상태('BaekjoonHub_progress' 로딩 / markuploaded / markuploadfailed) */
function iconOf(span) {
  const anchor = span.children.find((c) => c.id === 'BaekjoonHub_progress_anchor_element');
  return anchor ? anchor.children[0].className : null;
}

describe('구름LEVEL — 새로고침 없이 재제출을 감지한다', () => {
  test('정답 → 코드 수정 → 재제출 정답이면 두 번 모두 업로드한다', async () => {
    const { page, clock, calls, codeRef } = loadGoorm();
    const first = page.submit().finish();
    await clock.tick();
    assert.deepEqual(calls.upload, ['print(1)\n']);
    assert.equal(iconOf(first), 'markuploaded');

    codeRef.value = 'print(2)\n';
    const second = page.submit().finish();
    await clock.tick();
    assert.deepEqual(calls.upload, ['print(1)\n', 'print(2)\n']);
    assert.equal(iconOf(second), 'markuploaded');
    assert.equal(iconOf(first), 'markuploaded', '이전 제출의 아이콘은 그 결과 옆에 그대로 남는다');
    assert.ok(clock.timers.size >= 1, '감지 루프는 계속 돈다');
  });

  test('같은 결과는 폴링마다 다시 처리하지 않는다', async () => {
    const { page, clock, calls } = loadGoorm();
    page.submit().finish();
    await clock.tick();
    await clock.tick();
    await clock.tick();
    assert.equal(calls.parse.length, 1);
    assert.equal(calls.upload.length, 1);
  });

  test('같은 코드로 재제출하면 캐시 비교로 커밋 없이 완료 표시만 한다', async () => {
    const { page, clock, calls } = loadGoorm();
    page.submit().finish();
    await clock.tick();
    const again = page.submit().finish();
    await clock.tick();
    assert.equal(calls.parse.length, 2);
    assert.equal(calls.upload.length, 1);
    assert.equal(iconOf(again), 'markuploaded');
  });

  test('최신 제출이 채점 중이거나 오답이면 아래에 남은 이전 정답을 다시 올리지 않는다', async () => {
    // 이전 정답이 처리되기 전에 재제출해 최신 블록이 '처리중...' 인 상황(새로고침 없이 연달아 제출)
    const { page, clock, calls, codeRef } = loadGoorm();
    page.submit().finish();
    const grading = page.submit();
    codeRef.value = '# 채점 중인 새 코드\n';
    await clock.tick();
    assert.equal(calls.parse.length, 0, '최신 결과가 채점 중이면 이전 정답을 집지 않는다');

    grading.finish('틀렸습니다.');
    await clock.tick();
    assert.equal(calls.parse.length, 0, '최신 결과가 오답이면 올리지 않는다 (에디터에는 오답 코드가 있다)');

    const fixed = page.submit().finish();
    await clock.tick();
    assert.equal(calls.parse.length, 1);
    assert.equal(calls.parse[0], fixed.parentElement.parentElement.parentElement, '최신 블록을 넘긴다');
  });

  test('실행 결과 탭이 열려 있으면 처리하지 않고, 제출 결과 탭으로 돌아오면 처리한다', async () => {
    const { page, clock, calls } = loadGoorm();
    page.submit().finish();
    page.showTab('run');
    await clock.tick();
    assert.equal(calls.parse.length, 0);
    page.showTab('submit');
    await clock.tick();
    assert.equal(calls.parse.length, 1);
  });

  test('parseData 에는 그 결과의 블록을 넘긴다 (이전 제출의 표가 섞이지 않게)', async () => {
    const { page, clock, calls } = loadGoorm();
    page.submit([['PASS', 9999, 999]]).finish();
    await clock.tick();
    const latest = page.submit([['PASS', 1024, 10]]);
    latest.finish();
    await clock.tick();
    assert.equal(calls.parse.length, 2);
    assert.equal(calls.parse[1], latest.block);
    assert.equal(calls.parse[1].querySelectorAll('table tbody tr').length, 1);
  });

  test('파싱이 실패하면 다음 폴링에 다시 시도하고, 상한을 넘으면 실패 표시 후 멈춘다', async () => {
    const { page, clock, calls, errors } = loadGoorm({ parseImpl: () => { throw new Error('DOM changed'); } });
    const span = page.submit().finish();
    for (let i = 0; i < 8; i += 1) await clock.tick();
    assert.equal(calls.parse.length, 5, 'GOORM_MAX_PARSE_RETRY 회까지만 시도한다');
    assert.equal(calls.upload.length, 0);
    assert.equal(iconOf(span), 'markuploadfailed');
    assert.equal(span.children.filter((c) => c.id === 'BaekjoonHub_progress_anchor_element').length, 1, '재시도할 때 아이콘이 쌓이지 않는다');
    assert.ok(errors.some((args) => String(args[0]).includes('5회 연속 실패')));

    // 새로 제출하면 그 결과는 다시 시도한다
    page.submit().finish();
    await clock.tick();
    assert.equal(calls.parse.length, 6);
  });

  test('렌더링 지연으로 한 번 실패해도 다음 폴링에 성공하면 업로드한다', async () => {
    const { page, clock, calls } = loadGoorm({
      parseImpl: (block, n) => {
        if (n === 1) throw new Error('not rendered yet');
        return { examId: 1, quizNumber: 1, message: 'm', directory: 'goormlevel/1/1. t', fileName: 't.py', readme: 'r', code: 'x\n' };
      },
    });
    const span = page.submit().finish();
    await clock.tick();
    assert.equal(iconOf(span), null, '실패한 시도의 아이콘은 떼어 낸다');
    await clock.tick();
    assert.equal(calls.upload.length, 1);
    assert.equal(iconOf(span), 'markuploaded');
  });

  test('업로드는 감지 순서대로 한 번에 하나씩 하고, 앞 업로드가 실패해도 뒤 업로드는 진행한다', async () => {
    const order = [];
    let releaseFirst;
    const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
    const { page, clock, calls, codeRef } = loadGoorm({
      uploadImpl: async (data, n) => {
        order.push(`start:${data.code.trim()}`);
        if (n === 1) {
          await firstGate;
          order.push(`fail:${data.code.trim()}`);
          throw new Error('network');
        }
        order.push(`end:${data.code.trim()}`);
      },
    });
    codeRef.value = 'a\n';
    const first = page.submit().finish();
    await clock.tick();
    codeRef.value = 'b\n';
    const second = page.submit().finish();
    await clock.tick();
    assert.deepEqual(order, ['start:a'], '앞 업로드가 끝나기 전에는 뒤 업로드를 시작하지 않는다');
    assert.equal(iconOf(second), 'BaekjoonHub_progress', '줄을 기다리는 동안은 로딩 아이콘');
    await clock.fireTimeouts();
    assert.equal(iconOf(second), 'BaekjoonHub_progress', '워치독은 줄을 기다린 시간을 세지 않는다');
    assert.equal(iconOf(first), 'markuploadfailed', '앞 업로드는 제한 시간이 지나 잠정 실패로 표시된다');

    releaseFirst();
    await flush();
    assert.deepEqual(order, ['start:a', 'fail:a', 'start:b', 'end:b']);
    assert.deepEqual(calls.upload, ['a\n', 'b\n'], '뒤 업로드는 감지 시점의 코드를 올린다');
    assert.equal(iconOf(first), 'markuploadfailed');
    assert.equal(iconOf(second), 'markuploaded');
  });

  test('워치독은 시도마다 따로 돌고, 늦게 끝난 업로드는 실패 표시를 완료로 바꾼다', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const { page, clock } = loadGoorm({ uploadImpl: () => gate });
    const span = page.submit().finish();
    await clock.tick();
    assert.equal(iconOf(span), 'BaekjoonHub_progress');
    await clock.fireTimeouts();
    assert.equal(iconOf(span), 'markuploadfailed');
    release();
    await flush();
    assert.equal(iconOf(span), 'markuploaded');
  });

  test('기능을 끄면 감지를 멈추고 제출 버튼 리스너도 뗀다', async () => {
    const { page, clock, calls } = loadGoorm({ enabled: false });
    assert.equal(page.listeners.length, 1);
    page.submit().finish();
    await clock.tick();
    assert.equal(calls.parse.length, 0);
    assert.equal(clock.timers.size, 0);
    assert.equal(page.listeners.length, 0);
  });

  test('워치독은 감지 시점이 아니라 업로드가 시작될 때 켠다', async () => {
    const { sandbox, clock } = loadGoorm();
    const onceTimers = () => [...clock.timers.values()].filter((t) => t.once).length;
    const before = onceTimers();
    sandbox.startUpload(null);
    assert.equal(onceTimers(), before);
  });
});

describe('구름LEVEL — 채점받은 코드를 올린다 (제출 버튼을 누른 순간의 코드)', () => {
  test('채점을 기다리는 동안 코드를 고쳐도 제출한 코드를 올린다', async () => {
    const { page, clock, calls, codeRef } = loadGoorm();
    codeRef.value = 'graded';
    const grading = page.submit();
    codeRef.value = 'edited while grading';
    grading.finish();
    await clock.tick();
    assert.deepEqual(calls.upload, ['graded']);
  });

  test("'실행 결과' 탭에서 고친 뒤 돌아와도 제출한 코드를 올린다", async () => {
    const { page, clock, calls, codeRef } = loadGoorm();
    codeRef.value = 'graded';
    const grading = page.submit();
    page.showTab('run');
    grading.finish();
    codeRef.value = 'edited in run tab';
    await clock.tick();
    assert.equal(calls.parse.length, 0);
    page.showTab('submit');
    await clock.tick();
    assert.deepEqual(calls.upload, ['graded']);
  });

  test('채점 중(비활성) 버튼 클릭은 제출 기록을 바꾸지 않는다', async () => {
    const { page, clock, calls, codeRef } = loadGoorm();
    codeRef.value = 'graded';
    const grading = page.submit();
    codeRef.value = 'edited';
    page.click(page.submitLabel);
    grading.finish();
    await clock.tick();
    assert.deepEqual(calls.upload, ['graded']);
  });

  test('제출 버튼이 아닌 클릭은 기록하지 않는다', async () => {
    const { page, clock, calls, codeRef } = loadGoorm();
    codeRef.value = 'graded';
    const grading = page.submit();
    grading.finish();
    codeRef.value = 'edited';
    page.click(page.runTab);
    page.click({}); // 텍스트 노드처럼 closest 가 없는 대상
    await clock.tick();
    assert.deepEqual(calls.upload, ['graded']);
  });

  test('오답 제출의 기록은 다음 제출이 덮어, 다음 정답에 섞이지 않는다', async () => {
    const { page, clock, calls, codeRef } = loadGoorm();
    codeRef.value = 'wrong';
    page.submit().finish('오답입니다.');
    await clock.tick();
    codeRef.value = 'right';
    page.submit().finish();
    await clock.tick();
    assert.deepEqual(calls.upload, ['right']);
  });

  test('파싱을 다시 시도해도 같은 제출 기록을 쓴다', async () => {
    const { page, clock, calls, codeRef } = loadGoorm({
      parseImpl: (block, n, submitted) => {
        if (n === 1) throw new Error('not rendered yet');
        return { examId: 1, quizNumber: 1, message: 'm', directory: 'goormlevel/1/1. t', fileName: 't.py', readme: 'r', code: submitted.code };
      },
    });
    codeRef.value = 'graded';
    page.submit().finish();
    await clock.tick();
    codeRef.value = 'edited after first parse failure';
    await clock.tick();
    assert.equal(calls.submitted.length, 2);
    assert.equal(calls.submitted[1], calls.submitted[0]);
    assert.deepEqual(calls.upload, ['graded']);
  });

  test('버튼을 거치지 않은 제출은 감지 시점의 에디터를 읽는다 (예전 동작)', async () => {
    const { page, clock, calls, codeRef } = loadGoorm();
    page.submit([['PASS', 1024, 10]], { click: false }).finish();
    codeRef.value = 'at detection';
    await clock.tick();
    assert.equal(calls.submitted[0], null);
    assert.deepEqual(calls.upload, ['at detection']);
  });
});

describe('구름LEVEL parseData — 결과 블록의 표만 읽는다', () => {
  function loadParsing(page) {
    const sandbox = {
      console: { log: () => {}, warn: () => {}, error: () => {} },
      window: { location: { href: 'https://level.goorm.io/exam/1234/abc/quiz/1', pathname: '/exam/1234/abc/quiz/1' } },
      document: {
        querySelector: (selector) => {
          if (selector.startsWith('div[aria-label^=')) return { ariaLabel: 'title-두 수의 합' };
          if (selector === '.Tour__selectLang button') return { textContent: 'Python 3.12' };
          return page.html.querySelector(selector);
        },
        querySelectorAll: (selector) => {
          if (selector.includes('#fileEditor')) return [{ querySelectorAll: () => [{ textContent: 'print(1)' }] }];
          if (selector.includes('menuitem')) return [{ textContent: 'Python 3.12' }];
          return page.html.querySelectorAll(selector);
        },
      },
      isNull,
      convertSingleCharToDoubleChar: (s) => s,
      resolveLanguageExtension: () => 'py',
      buildDirectory: async (platform, vars) => vars._defaultDir,
      getDateString: () => 'date',
      languages: {},
      difficultyLabels: { 보통: 3 },
    };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'scripts', 'goormlevel', 'parsing.js'), 'utf8'), sandbox, { filename: 'parsing.js' });
    return sandbox;
  }

  test('블록을 주면 그 블록의 PASS 행만 평균낸다', async () => {
    const page = makePage();
    page.submit([['PASS', 10240, 100], ['PASS', 10240, 100]]).finish();
    const latest = page.submit([['PASS', 2048, 10], ['PASS', 1024, 20], ['FAIL', 99999, 999]]);
    latest.finish();
    const sandbox = loadParsing(page);
    const data = await sandbox.parseData(latest.block);
    assert.match(data.message, /Time: 15\.00 ms, Memory: 1\.50 MB/);
    assert.match(data.readme, /메모리: 1\.50 MB, 시간: 15\.00 ms/);
  });

  test('제출 기록이 있으면 에디터 대신 그 언어·코드로 만든다', async () => {
    const page = makePage();
    const latest = page.submit([['PASS', 1024, 10]], { click: false });
    latest.finish();
    const sandbox = loadParsing(page);
    const fromEditor = await sandbox.parseData(latest.block);
    assert.equal(fromEditor.code, 'print(1)');
    const submitted = await sandbox.parseData(latest.block, { language: 'Python 3.12', code: 'print(2)' });
    assert.equal(submitted.code, 'print(2)');
    assert.deepEqual({ ...sandbox.readGoormEditor() }, { language: 'Python 3.12', code: 'print(1)' });
  });

  test('블록이 없으면 예전처럼 활성 패널 전체를 읽는다 (그래서 블록을 넘겨야 한다)', async () => {
    const page = makePage();
    page.submit([['PASS', 10240, 100]]).finish();
    page.submit([['PASS', 1024, 10]]).finish();
    const sandbox = loadParsing(page);
    const data = await sandbox.parseData();
    assert.match(data.message, /Time: 55\.00 ms/);
  });
});
