'use strict';

// 정올 채점 결과창 처리(scripts/jungol/jungol.js)를 vm 에 로드하고, 정올 페이지 받기와 업로드를 가짜로 바꿔 확인한다.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ME = { id: 7, handle: 'me' };
const DETAIL = {
  m_reason: 'AC',
  m_time: 3,
  m_memory: 0,
  language: 'CPP',
  source: [{ source: 'int main(){}\n' }],
  problemId: 1001,
  additional: { time: 1, contestId: null },
  problemInfo: { title: '강아지와 병아리', tier: { tier: 3 }, fTier: null },
};

/** 정올 페이지에 실린 데이터와 같은 모양: [{ type: 'data', data: { 이름: { data } } }] */
const nodes = (loaded) => [{ type: 'data', data: Object.fromEntries(Object.entries(loaded).map(([key, data]) => [key, { data }])) }];

/** pages: 주소 → 받을 때마다 차례로 돌려줄 데이터 목록 */
function loadJungol(pages) {
  const fetched = [];
  const uploaded = [];
  const errors = [];
  const context = vm.createContext({
    console: { log() {}, warn() {}, error: (...args) => errors.push(args) },
    document: { body: {}, querySelector: () => null, createElement: () => ({ dataset: {}, append() {} }) },
    location: { pathname: '/problem/1001' },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    setInterval: () => 0,
    clearInterval() {},
    setTimeout: (fn) => fn(), // 다시 보기 전의 기다림을 건너뛴다
    chrome: { runtime: { id: 'test' } },
  });
  for (const file of ['scripts/util.js', 'scripts/jungol/variables.js', 'scripts/jungol/parsing.js', 'scripts/jungol/jungol.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  Object.assign(context, {
    checkEnable: async () => true,
    getHook: async () => 'owner/repo',
    buildDirectory: async (platform, variables) => variables._defaultDir,
    fetchLoaded: async (url) => {
      fetched.push(url);
      return nodes(pages[url].shift());
    },
    uploadUnlessSame: async (bojData) => uploaded.push(bojData),
    Toast: class {
      static raiseToast() {}
    },
    ToastType: {},
  });
  return { context, fetched, uploaded, errors };
}

test('채점 중이던 제출을 다시 볼 때 그사이 낸 다음 제출이 아니라 같은 제출을 번호로 찾아 올린다', async () => {
  const { context, fetched, uploaded, errors } = loadJungol({
    '/submission?problem=1001': [{ '$/account/my': ME, '$/submission?problem=1001': { list: [{ id: 11, r: 'PD', accountInfo: { id: 7 } }] } }],
    // 다시 볼 때는 11번이 정답이 되었고, 그 위에 같은 문제의 오답 12번이 새로 있다
    '/submission?problem=1001&account=me': [
      { '$/account/my': ME, '$/submission?problem=1001&account=me': { list: [{ id: 12, r: 'WA', accountInfo: { id: 7 } }, { id: 11, r: 'AC', accountInfo: { id: 7 } }] } },
    ],
    '/problem/1001/submission?sid=11': [{ '$/account/my': ME, '$/submission/11': DETAIL }],
  });

  await context.handleResult({ querySelector: () => null }, '1001');

  assert.deepEqual(errors, []);
  assert.deepEqual(fetched, ['/submission?problem=1001', '/submission?problem=1001&account=me', '/problem/1001/submission?sid=11']);
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0].code, 'int main(){}\n');
  assert.equal(uploaded[0].problemId, '1001');
});

test('정올 제출자 u handle로 내 제출을 찾아 올린다', async () => {
  const { context, uploaded, errors } = loadJungol({
    '/submission?problem=1001': [{ '$/account/my': ME, '$/submission?problem=1001': { list: [{ id: 11, u: 'me', r: 'AC' }] } }],
    '/problem/1001/submission?sid=11': [{ '$/submission/11': DETAIL }],
  });
  await context.handleResult({ querySelector: () => null }, '1001');
  assert.deepEqual(errors, []);
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0].problemId, '1001');
});
