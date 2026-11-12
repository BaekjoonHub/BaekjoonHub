const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup({ realUpload = false } = {}) {
  let finishUpload;
  let failUpload;
  let calls = 0;
  const timers = new Map();
  const notices = [];
  let nextTimer = 0;
  const context = vm.createContext({
    window: { location: { href: 'https://swexpertacademy.com/', origin: 'https://swexpertacademy.com' } },
    document: { querySelector: () => ({ innerText: '축하합니다. Pass입니다.' }) },
    chrome: { runtime: { id: 'test-extension' } },
    console: { error() {} },
    Toast: { raiseToast: (message) => {
      const notice = { message, removed: false };
      notice.element = { remove: () => { notice.removed = true; } };
      notices.push(notice);
      return notice;
    } },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
    clearInterval() {}, log() {},
    checkEnable: async () => true,
    parseCode: async () => ({ contestProbId: 'abc' }),
    getNickname: () => 'my-user',
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../scripts/swexpertacademy/swexpertacademy.js'), 'utf8'), context);
  const deferredUpload = () => {
    calls += 1;
    return new Promise((resolve, reject) => { finishUpload = resolve; failUpload = reject; });
  };
  if (realUpload) context.tryUploadInPlace = deferredUpload;
  else context.uploadSolvedResult = deferredUpload;
  let clicks = 0;
  const button = { isConnected: true, click: () => { clicks += 1; } };
  function clickEvent() {
    return {
      target: { closest: () => button },
      prevented: false,
      stopped: false,
      preventDefault() { this.prevented = true; },
      stopImmediatePropagation() { this.stopped = true; },
    };
  }
  function elapseWaitLimit() {
    for (const [id, timer] of timers) {
      assert.equal(timer.delay, 10000);
      timers.delete(id);
      timer.callback();
    }
  }
  return { context, button, clickEvent, timers, notices, elapseWaitLimit, finish: (result) => finishUpload(result), fail: () => failUpload(new Error('upload failed')), calls: () => calls, clicks: () => clicks };
}

test('Pass 확인을 바로 눌러도 업로드 완료 후 한 번만 원래 클릭을 실행한다', async () => {
  const s = setup();
  const pending = s.context.handleSolvedResult();
  assert.equal(s.context.handleSolvedResult(), pending);
  assert.equal(s.calls(), 1);
  const first = s.clickEvent();
  const waiting = s.context.waitForSolvedUploadBeforeClose(first);
  const second = s.clickEvent();
  await s.context.waitForSolvedUploadBeforeClose(second);
  assert.equal(first.prevented && first.stopped, true);
  assert.equal(second.prevented && second.stopped, true);
  assert.equal(s.clicks(), 0);
  assert.equal(s.notices.length, 1);
  assert.match(s.notices[0].message, /마무리/);
  s.finish();
  await waiting;
  assert.equal(s.clicks(), 1);
  assert.equal(s.timers.size, 0);
  assert.equal(s.notices[0].removed, true);
  const after = s.clickEvent();
  await s.context.waitForSolvedUploadBeforeClose(after);
  assert.equal(after.prevented, false);
});

test('업로드 완료 전에 제거된 결과 버튼은 다시 클릭하지 않는다', async () => {
  const s = setup();
  s.context.handleSolvedResult();
  const waiting = s.context.waitForSolvedUploadBeforeClose(s.clickEvent());
  s.button.isConnected = false;
  s.finish();
  await waiting;
  assert.equal(s.clicks(), 0);
});

test('업로드가 실패해도 결과창을 닫을 수 있다', async () => {
  const s = setup();
  s.context.handleSolvedResult();
  const waiting = s.context.waitForSolvedUploadBeforeClose(s.clickEvent());
  s.fail();
  await waiting;
  assert.equal(s.clicks(), 1);
});

test('10초가 지나도 업로드를 끊는 강제 이동 없이 완료를 기다린다', async () => {
  const s = setup();
  s.context.handleSolvedResult();
  const waiting = s.context.waitForSolvedUploadBeforeClose(s.clickEvent());
  s.elapseWaitLimit();
  assert.equal(s.clicks(), 0);
  assert.equal(s.notices[0].removed, true);
  assert.match(s.notices[1].message, /중단될 수/);
  s.finish();
  await waiting;
  assert.equal(s.clicks(), 1);
  assert.equal(s.notices[1].removed, true);
});

test('10초 후 다시 누르면 이동을 허용하고 늦은 완료 때 클릭을 중복 실행하지 않는다', async () => {
  const s = setup();
  s.context.handleSolvedResult();
  const waiting = s.context.waitForSolvedUploadBeforeClose(s.clickEvent());
  s.elapseWaitLimit();
  const leave = s.clickEvent();
  await s.context.waitForSolvedUploadBeforeClose(leave);
  assert.equal(leave.prevented, false);
  assert.equal(leave.stopped, false);
  s.finish();
  await waiting;
  assert.equal(s.clicks(), 0);
});

test('제자리 업로드가 실패해 결과 페이지로 이동할 때 보류한 클릭이 이동을 덮어쓰지 않는다', async () => {
  const s = setup({ realUpload: true });
  const pending = s.context.handleSolvedResult();
  const waiting = s.context.waitForSolvedUploadBeforeClose(s.clickEvent());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(s.calls(), 1);
  s.finish(false);
  await pending;
  await waiting;
  assert.match(s.context.window.location.href, /problemSolver\.do\?contestProbId=abc&nickName=my-user&extension=BaekjoonHub/);
  assert.equal(s.clicks(), 0);
  assert.equal(s.timers.size, 0);
});
