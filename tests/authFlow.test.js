'use strict';

// GitHub 인증 흐름: authorize.js(GitHub 콜백 탭의 content script) → background.js → welcome.html

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const WELCOME = 'chrome-extension://id/welcome.html';

function loadBackground() {
  const calls = { set: [], update: [], create: [] };
  const listeners = {};
  const chrome = {
    runtime: {
      getURL: (p) => `chrome-extension://id/${p}`,
      onMessage: { addListener: (fn) => { listeners.message = fn; } },
      onInstalled: { addListener: (fn) => { listeners.installed = fn; } },
    },
    storage: { local: { set: (items, cb) => { calls.set.push({ ...items }); cb(); } } },
    tabs: {
      update: (id, props) => calls.update.push([id, props.url]),
      create: (props) => calls.create.push(props.url),
    },
  };
  const sandbox = { console, chrome };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'scripts/background.js'), 'utf8'), sandbox);
  return { calls, listeners };
}

test('성공하면 토큰과 사용자 이름을 저장하고 파이프를 닫은 뒤 그 탭을 welcome 으로 돌린다', () => {
  const { calls, listeners } = loadBackground();
  listeners.message({ closeWebPage: true, isSuccess: true, token: 't', username: 'u' }, { tab: { id: 7 } }, () => {});
  assert.deepEqual(calls.set, [{ BaekjoonHub_username: 'u', BaekjoonHub_token: 't', pipe_baekjoonhub: false }]);
  assert.deepEqual(calls.update, [[7, WELCOME]]);
  assert.deepEqual(calls.create, []);
});

test('실패하면 파이프를 닫고 사유를 붙여 welcome 으로 보낸다 (모르는 사유는 failed)', () => {
  for (const [reason, expected] of [['denied', 'denied'], ['failed', 'failed'], ['<x>', 'failed'], [undefined, 'failed']]) {
    const { calls, listeners } = loadBackground();
    listeners.message({ closeWebPage: true, isSuccess: false, reason }, { tab: { id: 3 } }, () => {});
    assert.deepEqual(calls.set, [{ pipe_baekjoonhub: false }]);
    assert.deepEqual(calls.update, [[3, `${WELCOME}?auth_error=${expected}`]]);
  }
});

test('보낸 탭이 없으면 새 탭을 연다', () => {
  const { calls, listeners } = loadBackground();
  listeners.message({ closeWebPage: true, isSuccess: false, reason: 'denied' }, {}, () => {});
  assert.deepEqual(calls.create, [`${WELCOME}?auth_error=denied`]);
  assert.deepEqual(calls.update, []);
});

test('처음 설치할 때만 welcome 을 연다', () => {
  const { calls, listeners } = loadBackground();
  listeners.installed({ reason: 'update' });
  assert.deepEqual(calls.create, []);
  listeners.installed({ reason: 'install' });
  assert.deepEqual(calls.create, [WELCOME]);
});

/** authorize.js 를 주어진 주소와 파이프 상태로 실행한다. tokenBody: 토큰 교환 응답 본문 */
function runAuthorize(href, pipe, tokenBody) {
  const messages = [];
  class XMLHttpRequest {
    addEventListener(_, fn) { this.fn = fn; }
    open(method, url) { this.url = url; }
    setRequestHeader() {}
    send() {
      this.readyState = 4;
      this.status = 200;
      this.responseText = this.url.includes('access_token') ? tokenBody : '{"login":"u"}';
      this.fn();
    }
  }
  const sandbox = {
    window: { location: { href } },
    URL,
    FormData: class { append() {} },
    XMLHttpRequest,
    chrome: {
      storage: { local: { get: (key, cb) => cb({ pipe_baekjoonhub: pipe }) } },
      runtime: { sendMessage: (m) => messages.push(m) },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'scripts/authorize.js'), 'utf8'), sandbox);
  return messages.map((m) => ({ ...m }));
}

const REDIRECT = 'https://github.com/BaekjoonHub/BaekjoonHub';

test('authorize.js: 취소는 denied, 토큰 없는 응답은 failed, 성공은 토큰과 이름을 보낸다', () => {
  assert.deepEqual(runAuthorize(`${REDIRECT}?error=access_denied&error_description=x&state=s1`, 's1'), [
    { closeWebPage: true, isSuccess: false, reason: 'denied' },
  ]);
  assert.deepEqual(runAuthorize(`${REDIRECT}?code=abc&state=s1`, 's1', 'error=bad_verification_code'), [
    { closeWebPage: true, isSuccess: false, reason: 'failed' },
  ]);
  assert.deepEqual(runAuthorize(`${REDIRECT}?code=abc&state=s1`, 's1', 'access_token=tok&scope=repo'), [
    { closeWebPage: true, isSuccess: true, token: 'tok', username: 'u' },
  ]);
});

test('authorize.js: 파이프가 닫혔거나 state 가 다르거나 콜백 주소가 아니면 아무것도 하지 않는다', () => {
  assert.deepEqual(runAuthorize(`${REDIRECT}?code=abc&state=s1`, false, 'access_token=tok'), []);
  assert.deepEqual(runAuthorize(`${REDIRECT}?code=abc&state=other`, 's1', 'access_token=tok'), []);
  assert.deepEqual(runAuthorize(`${REDIRECT}?code=abc`, 's1', 'access_token=tok'), []);
  // 예전 버전은 파이프를 닫지 못해 true 가 남아 있다. 그 값으로는 남이 만든 링크가 통과하면 안 된다.
  assert.deepEqual(runAuthorize(`${REDIRECT}?code=abc&state=true`, true, 'access_token=tok'), []);
  assert.deepEqual(runAuthorize('https://github.com/other/repo?code=abc&state=s1', 's1', 'access_token=tok'), []);
  assert.deepEqual(runAuthorize('https://www.acmicpc.net/?error=x&state=s1', 's1'), []);
});

test('oauth2.js: 요청마다 새 state 를 파이프에 저장하고 같은 값을 인증 주소에 붙인다', () => {
  const run = (selectAccount) => {
    const sandbox = {
      window: { location: {} },
      crypto: require('node:crypto').webcrypto,
      chrome: { storage: { local: { set: (items, cb) => { sandbox.stored = { ...items }; cb(); } } } },
    };
    vm.createContext(sandbox);
    vm.runInContext(`${fs.readFileSync(path.join(ROOT, 'scripts/oauth2.js'), 'utf8')}\noAuth2.begin(${selectAccount});`, sandbox);
    return { pipe: sandbox.stored.pipe_baekjoonhub, url: new URL(sandbox.window.location.href) };
  };
  const first = run(false);
  assert.match(first.pipe, /^[0-9a-f]{32}$/);
  assert.equal(first.url.searchParams.get('state'), first.pipe);
  assert.equal(first.url.searchParams.get('prompt'), null);
  assert.equal(first.url.searchParams.get('scope'), 'repo');
  const second = run(true);
  assert.notEqual(second.pipe, first.pipe);
  assert.equal(second.url.searchParams.get('prompt'), 'select_account');
});
