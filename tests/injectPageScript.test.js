'use strict';

// injectPageScript 의 <script src> 는 파일을 못 불러와도(CSP, 확장 재로드로 무효가 된 URL) 예외가 없어 try/catch 가 못 본다.
// 실패하면 onerror 가 한 번 경고만 남기고, 요소는 그대로 두어 다시 시도하지 않는다(로더가 2초마다 부르므로 재시도하면 실패가 반복된다).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const UTIL = path.join(__dirname, '..', 'scripts', 'baekjoon', 'util.js');

test('injectPageScript: 불러오기에 실패하면 파일 이름이 든 경고를 한 번 남기고, 요소는 두고 다시 넣지 않는다', () => {
  const added = [];
  const warns = [];
  const context = vm.createContext({
    console: { warn: (...args) => warns.push(args.join(' ')) },
    chrome: { runtime: { getURL: (file) => `chrome-extension://abcdef/${file}` } },
    document: {
      head: { appendChild: (el) => added.push(el) },
      getElementById: (id) => added.find((el) => el.id === id) || null,
      createElement: (tag) => ({ tag }),
    },
  });
  vm.runInContext(fs.readFileSync(UTIL, 'utf8'), context);

  vm.runInContext("injectPageScript('page-script', 'scripts/baekjoon/statusrefresh.js')", context);
  assert.equal(added.length, 1);
  assert.equal(typeof added[0].onerror, 'function');

  assert.doesNotThrow(() => added[0].onerror());
  assert.equal(warns.length, 1);
  assert.match(warns[0], /scripts\/baekjoon\/statusrefresh\.js/);
  assert.equal(added.length, 1);

  vm.runInContext("injectPageScript('page-script', 'scripts/baekjoon/statusrefresh.js')", context);
  assert.equal(added.length, 1);
});
