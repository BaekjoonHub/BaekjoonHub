const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup() {
  let finishUpload;
  let failUpload;
  let calls = 0;
  const context = vm.createContext({
    window: { location: { href: 'https://swexpertacademy.com/' } },
    document: { querySelector: () => ({ innerText: '축하합니다. Pass입니다.' }) },
    chrome: { runtime: { id: 'test-extension' } },
    console: { error() {} },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../scripts/swexpertacademy/swexpertacademy.js'), 'utf8'), context);
  context.uploadSolvedResult = () => {
    calls += 1;
    return new Promise((resolve, reject) => { finishUpload = resolve; failUpload = reject; });
  };
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
  return { context, button, clickEvent, finish: () => finishUpload(), fail: () => failUpload(new Error('upload failed')), calls: () => calls, clicks: () => clicks };
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
  s.finish();
  await waiting;
  assert.equal(s.clicks(), 1);
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
