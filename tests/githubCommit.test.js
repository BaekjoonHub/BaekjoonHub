'use strict';

// GitHub 업로드 커밋 경합·타임아웃·문자 인코딩 검증.
// 예전 업로드는 "ref 조회 → tree → commit → ref 갱신(force: true)" 이라, 그 사이 같은 브랜치에 다른 커밋이
// 올라가면(다른 탭·다른 플랫폼·다른 기기) 그 커밋이 브랜치 이력에서 사라졌다. 이제 ref 는 fast-forward 로만
// 옮기고, GitHub 가 거절하면(422 Update is not a fast forward, 2026-09-24 TIL2 에서 실측) 최신 ref 위에
// 다시 커밋한다. Github.js 는 classic script 라 util.js 와 함께 fetch 스텁을 넣은 vm 에 원문을 로드한다.
// 일부러 다루지 않는 것: AbortSignal.timeout 이 없는 브라우저(Chrome 103 미만)의 AbortController 대체 경로
// (Chrome 111 미만은 지원하지 않는다).

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const HOOK = 'tester/algorithm';
const API = `https://api.github.com/repos/${HOOK}`;

function jsonResponse(status, body, headers = {}) {
  return { status, ok: status >= 200 && status < 300, json: async () => body, headers: { get: (name) => headers[name.toLowerCase()] ?? null } };
}

/**
 * util.js + Github.js 를 로드한다. AbortSignal.timeout 은 테스트가 직접 발화시키는 가짜다.
 * @param {(req: {url: string, method: string, body: any, init: object}) => any} route - 응답(jsonResponse) 또는 throw
 */
function loadGithub(route) {
  const requests = [];
  const delays = [];
  const signals = [];
  const sandbox = {
    console,
    TextEncoder,
    btoa,
    AbortSignal: { timeout: (ms) => { const signal = { aborted: false, timeoutMs: ms }; signals.push(signal); return signal; } },
    // 재시도 대기는 기록만 하고 즉시 흘려보낸다
    setTimeout: (fn, ms) => { delays.push(ms); fn(); return 0; },
    debug: false, // util.js 의 log() 가 읽는다
    fetch: async (url, init = {}) => {
      const req = { url, method: (init.method || 'GET').toUpperCase(), body: init.body ? JSON.parse(init.body) : null, init };
      requests.push(req);
      return route(req);
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ['util.js', 'Github.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'scripts', file), 'utf8'), sandbox, { filename: file });
  // 클래스·const 는 전역 렉시컬 스코프에 있어 샌드박스 속성이 아니므로 꺼내 둔다
  const exported = vm.runInContext('({ GitHub, GitHubApiError, GitHubTimeoutError, GITHUB_COMMIT_MAX_ATTEMPTS, GITHUB_TREE_CHUNK_ITEMS })', sandbox);
  return { sandbox, requests, delays, signals, ...exported };
}

/**
 * 브랜치를 흉내 내는 GitHub 서버. PATCH 는 force 가 아니면 fast-forward(부모가 현재 ref)일 때만 받는다.
 * beforePatch(n) 가 true 를 돌려주면 n 번째 PATCH 직전에 "다른 탭" 커밋이 끼어든다.
 */
function makeServer({ beforePatch = () => false, patchError = null } = {}) {
  const state = { head: 'c0', commits: { c0: { parents: [] } }, patches: 0, trees: 0 };
  let seq = 0;
  const route = ({ url, method, body }) => {
    if (method === 'GET' && url === `${API}/git/ref/heads/main`) return jsonResponse(200, { ref: 'refs/heads/main', object: { sha: state.head } });
    if (method === 'POST' && url === `${API}/git/trees`) return jsonResponse(201, { sha: `t${state.trees += 1}`, tree: [] });
    if (method === 'POST' && url === `${API}/git/commits`) {
      seq += 1;
      state.commits[`n${seq}`] = { parents: body.parents };
      return jsonResponse(201, { sha: `n${seq}` });
    }
    if (method === 'PATCH' && url === `${API}/git/refs/heads/main`) {
      state.patches += 1;
      if (patchError) return patchError(state.patches);
      if (beforePatch(state.patches)) {
        const other = `other${state.patches}`;
        state.commits[other] = { parents: [state.head] };
        state.head = other;
      }
      if (!body.force && !state.commits[body.sha].parents.includes(state.head)) return jsonResponse(422, { message: 'Update is not a fast forward' });
      state.head = body.sha;
      return jsonResponse(200, { ref: 'refs/heads/main', object: { sha: body.sha } });
    }
    throw new Error(`unexpected request ${method} ${url}`);
  };
  /** head 에서 부모를 따라 내려가며 도달 가능한 커밋 */
  state.history = () => {
    const out = [];
    for (let sha = state.head; sha; sha = state.commits[sha].parents[0]) out.push(sha);
    return out;
  };
  return { state, route };
}

const ITEMS = [{ path: '프로그래머스/1/1. 문제/문제.py', mode: '100644', type: 'blob', sha: 'blob1' }];

function timeoutError(gh) {
  gh.signals[gh.signals.length - 1].aborted = true;
  const error = new Error('The operation was aborted due to timeout');
  error.name = 'TimeoutError';
  return error;
}

describe('commitTreeItems — ref 는 fast-forward 로만 옮긴다', () => {
  test('그 사이 다른 커밋이 올라가면 최신 ref 위에 tree·commit 을 새로 만들어 두 커밋을 모두 남긴다', async () => {
    const server = makeServer({ beforePatch: (n) => n === 1 });
    const gh = loadGithub(server.route);
    const result = await new gh.GitHub(HOOK, 'token').commitTreeItems('main', ITEMS, 'msg');

    const patches = gh.requests.filter((r) => r.method === 'PATCH');
    assert.equal(patches.length, 2);
    assert.ok(patches.every((r) => r.body.force === false), 'force 로 옮기면 끼어든 커밋이 사라진다');
    // 두 번째 시도는 끼어든 커밋을 base/parent 로 삼는다 (blob 은 다시 만들지 않는다)
    const trees = gh.requests.filter((r) => r.url.endsWith('/git/trees'));
    const commits = gh.requests.filter((r) => r.url.endsWith('/git/commits'));
    assert.deepEqual(trees.map((r) => r.body.base_tree), ['c0', 'other1']);
    assert.deepEqual(commits.map((r) => r.body.parents[0]), ['c0', 'other1']);
    assert.equal(gh.requests.filter((r) => r.url.endsWith('/git/blobs')).length, 0);
    // vm 의 객체는 프로토타입이 달라 deepStrictEqual 이 다르다고 본다 — 이쪽 객체로 옮겨 비교한다
    assert.deepEqual({ ...result }, { commitSHA: 'n2', parentSHA: 'other1' });
    assert.deepEqual(server.state.history(), ['n2', 'other1', 'c0']);
    assert.deepEqual(gh.delays, [500]);
  });

  test('계속 밀리면 정해진 횟수만 시도하고 422 를 그대로 던진다 (브랜치는 건드리지 않는다)', async () => {
    const server = makeServer({ beforePatch: () => true });
    const gh = loadGithub(server.route);
    await assert.rejects(new gh.GitHub(HOOK, 'token').commitTreeItems('main', ITEMS, 'msg'), (error) => {
      assert.ok(error instanceof gh.GitHubApiError);
      assert.equal(error.status, 422);
      return true;
    });
    assert.equal(gh.GITHUB_COMMIT_MAX_ATTEMPTS, 4);
    assert.equal(server.state.patches, 4);
    // 우리 커밋은 하나도 반영되지 않았고, 끼어든 커밋은 모두 남아 있다
    assert.deepEqual(server.state.history(), ['other4', 'other3', 'other2', 'other1', 'c0']);
    assert.deepEqual(gh.delays, [500, 1000, 1500]);
  });

  test('fast-forward 거절이 아닌 오류는 다시 시도하지 않는다', async () => {
    for (const [label, status, message, errorName] of [
      ['보호 브랜치 422', 422, 'Changes must be made through a pull request.', 'GitHubApiError'],
      ['브랜치 없음 404', 404, 'Not Found', 'GitHubApiError'],
      ['토큰 만료 401', 401, 'Bad credentials', 'TokenExpiredError'],
    ]) {
      const server = makeServer({ patchError: () => jsonResponse(status, { message }) });
      const gh = loadGithub(server.route);
      await assert.rejects(new gh.GitHub(HOOK, 'token').commitTreeItems('main', ITEMS, 'msg'), (error) => error.name === errorName, label);
      assert.equal(server.state.patches, 1, label);
      assert.deepEqual(gh.delays, [], label);
    }
  });

  test('ref 갱신이 타임아웃되면 GitHubTimeoutError 로 끊고 다시 커밋하지 않는다 (이미 반영됐을 수 있어 중복 커밋이 생긴다)', async () => {
    let gh;
    const server = makeServer({ patchError: () => { throw timeoutError(gh); } });
    gh = loadGithub(server.route);
    await assert.rejects(new gh.GitHub(HOOK, 'token').commitTreeItems('main', ITEMS, 'msg'), (error) => {
      assert.equal(error.name, 'GitHubTimeoutError');
      assert.ok(error instanceof gh.GitHubApiError, 'GitHubApiError 로 잡는 기존 catch 가 그대로 동작해야 한다');
      return true;
    });
    assert.equal(server.state.patches, 1);
  });

  // #388: 전체 업로드가 모든 파일을 트리 생성 요청 하나에 실어, GitHub 가 10초 처리 제한으로 끊었다
  // (2026-11-27 TIL2 실측: content 항목 3,600개 → 422 "Sorry, your request timed out").
  test('항목이 많으면 앞 묶음의 tree 를 base 로 삼아 나눠 쌓고, 커밋은 마지막 tree 로 하나만 만든다', async () => {
    const server = makeServer();
    const gh = loadGithub(server.route);
    const chunk = gh.GITHUB_TREE_CHUNK_ITEMS;
    const items = Array.from({ length: 2 * chunk + 1 }, (_, i) => ({ path: `백준/${i}.py`, mode: '100644', type: 'blob', content: `${i}` }));
    await new gh.GitHub(HOOK, 'token').commitTreeItems('main', items, 'msg');

    const trees = gh.requests.filter((r) => r.url.endsWith('/git/trees'));
    assert.deepEqual(trees.map((r) => [r.body.base_tree, r.body.tree.length]), [['c0', chunk], ['t1', chunk], ['t2', 1]]);
    assert.deepEqual(trees.flatMap((r) => r.body.tree.map((item) => item.path)), items.map((item) => item.path), '빠지거나 겹치는 항목이 없다');
    const commits = gh.requests.filter((r) => r.url.endsWith('/git/commits'));
    assert.deepEqual(commits.map((r) => [r.body.tree, r.body.parents]), [['t3', ['c0']]]);
    assert.deepEqual(server.state.history(), ['n1', 'c0']);
  });
});

test('403 은 요청 한도 초과(x-ratelimit-remaining 이 0 이거나 retry-after 가 있음)와 토큰 문제를 가려 던지고, 안내 문구도 다르다', async () => {
  for (const [label, status, headers, errorName] of [
    ['남은 요청 수가 0', 403, { 'x-ratelimit-remaining': '0' }, 'GitHubRateLimitError'],
    ['retry-after 가 있다', 403, { 'x-ratelimit-remaining': '4990', 'retry-after': '60' }, 'GitHubRateLimitError'],
    ['한도와 무관한 403', 403, { 'x-ratelimit-remaining': '4990' }, 'TokenExpiredError'],
    ['401 은 헤더와 상관없이 토큰 문제', 401, { 'x-ratelimit-remaining': '0', 'retry-after': '60' }, 'TokenExpiredError'],
  ]) {
    const gh = loadGithub(() => jsonResponse(status, { message: 'from GitHub' }, headers));
    await assert.rejects(new gh.GitHub(HOOK, 'token').getDefaultBranchOnRepo(), (error) => {
      assert.equal(error.name, errorName, label);
      assert.equal(error.status, status, label);
      assert.ok(error instanceof gh.GitHubApiError, label);
      assert.equal(/요청 한도/.test(error.message), errorName === 'GitHubRateLimitError', `${label}: ${error.message}`);
      return true;
    });
  }
});

describe('githubRequest·getReference·getFile', () => {
  test('GET 은 브라우저 HTTP 캐시를 쓰지 않고 재검증한다 (다른 탭이 옮긴 ref 를 60초 동안 못 보는 문제)', async () => {
    const gh = loadGithub((req) => jsonResponse(200, req.method === 'GET' ? { ref: 'refs/heads/main', object: { sha: 'c0' } } : { sha: 's' }));
    await gh.sandbox.getReference(HOOK, 'token', 'main');
    await gh.sandbox.createCommit(HOOK, 'token', 'm', 't', 'c0');
    assert.equal(gh.requests[0].init.cache, 'no-cache');
    assert.equal(gh.requests[1].init.cache, undefined, 'POST 에는 캐시 옵션을 붙이지 않는다');
  });

  // 복수 엔드포인트(git/refs/heads/<이름>)는 정확히 일치하는 브랜치가 없으면 이름으로 시작하는 ref 배열을 200 으로 준다
  test('getReference 는 배열·object 없는 응답을 TypeError 가 아니라 GitHubApiError(404)로 알린다', async () => {
    for (const [label, body] of [
      ['배열 응답', [{ ref: 'refs/heads/main-v2', object: { sha: 'c9' } }]],
      ['object 가 없는 응답', { ref: 'refs/heads/main' }],
    ]) {
      const gh = loadGithub(() => jsonResponse(200, body));
      await assert.rejects(gh.sandbox.getReference(HOOK, 'token', 'main'), (error) => error instanceof gh.GitHubApiError && error.status === 404, label);
    }
  });

  test('getFile 은 404 를 null 로, 다른 API 는 404 를 오류로 돌려준다', async () => {
    const gh = loadGithub(() => jsonResponse(404, { message: 'Not Found' }));
    assert.equal(await gh.sandbox.getFile(HOOK, 'token', 'a/b.py'), null);
    await assert.rejects(gh.sandbox.getReference(HOOK, 'token', 'main'), (error) => error instanceof gh.GitHubApiError && error.status === 404);
  });
});

describe('외톨이 서러게이트 — 올리는 바이트와 캐시 SHA 가 같아야 한다', () => {
  // GitHub 는 JSON 문자열 content 의 외톨이 서러게이트를 '?' 로 저장하고(2026-09-24 TIL2 실측, blob ad01dda8),
  // calculateBlobSHA 는 U+FFFD 기준으로 계산한다. 올리는 쪽이 U+FFFD 로 맞추지 않으면 같은 코드도 매번 새 코드로 보인다.
  const LONE = 'a\uD800b\uDC00c\n';
  const FIXED = 'a\uFFFDb\uFFFDc\n';

  test('createTree 는 content 항목의 외톨이 서러게이트를 U+FFFD 로 바꿔 보낸다', async () => {
    const gh = loadGithub(() => jsonResponse(201, { sha: 't' }));
    const items = [
      { path: 'a.py', mode: '100644', type: 'blob', content: LONE },
      { path: 'b.py', mode: '100644', type: 'blob', content: '정상 \u{1F600}\n' },
      { path: 'c.py', mode: '100644', type: 'blob', sha: 'blob-sha' },
    ];
    await gh.sandbox.createTree(HOOK, 'token', 'c0', items);
    const sent = gh.requests[0].body.tree;
    assert.equal(sent[0].content, FIXED);
    assert.equal(sent[1].content, '정상 \u{1F600}\n');
    assert.deepEqual(sent[2], items[2]);
    assert.equal(items[0].content, LONE, '호출한 쪽의 배열은 바꾸지 않는다 (캐시 기록이 같은 항목을 쓴다)');
  });

  test('createBlob 의 base64 는 U+FFFD 로 바꾼 UTF-8 바이트이고, 큰 입력도 스택 넘침 없이 보낸다', async () => {
    const gh = loadGithub(() => jsonResponse(201, { sha: 's' }));
    const big = '가나다 abc \u{1F600}\r\n'.repeat(40000);
    await gh.sandbox.createBlob(HOOK, 'token', LONE, 'a.py');
    await gh.sandbox.createBlob(HOOK, 'token', big, 'b.py');
    const decoded = gh.requests.map((r) => Buffer.from(r.body.content, 'base64').toString('utf8'));
    assert.equal(gh.requests[0].body.encoding, 'base64');
    assert.deepEqual(decoded, [FIXED, big]);
  });
});
