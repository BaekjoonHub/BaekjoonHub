'use strict';

// GitHub 업로드 커밋 경합·타임아웃·문자 인코딩 검증.
// 예전 업로드는 "ref 조회 → tree → commit → ref 갱신(force: true)" 이라, 그 사이 같은 브랜치에 다른 커밋이
// 올라가면(다른 탭·다른 플랫폼·다른 기기) 그 커밋이 브랜치 이력에서 사라졌다. 이제 ref 는 fast-forward 로만
// 옮기고, GitHub 가 거절하면(422 Update is not a fast forward, 2026-09-24 TIL2 에서 실측) 최신 ref 위에
// 다시 커밋한다. Github.js 는 classic script 라 util.js 와 함께 fetch 스텁을 넣은 vm 에 원문을 로드한다.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const HOOK = 'tester/algorithm';
const API = `https://api.github.com/repos/${HOOK}`;

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

/* AbortSignal.timeout 을 테스트가 직접 발화시키는 가짜. 실제 30초를 기다리지 않는다. */
function makeSignals() {
  const issued = [];
  return {
    issued,
    AbortSignal: {
      timeout(ms) {
        const signal = { aborted: false, timeoutMs: ms };
        issued.push(signal);
        return signal;
      },
    },
  };
}

/**
 * util.js + Github.js 를 로드한다.
 * @param {(req: {url: string, method: string, body: any, init: object}) => any} route - 응답(jsonResponse) 또는 throw
 */
function loadGithub(route) {
  const requests = [];
  const delays = [];
  const signals = makeSignals();
  const sandbox = {
    console,
    TextEncoder,
    btoa,
    AbortSignal: signals.AbortSignal,
    // 재시도 대기는 기록만 하고 즉시 흘려보낸다
    setTimeout: (fn, ms) => { delays.push(ms); fn(); return 0; },
    // util.js 의 log() 는 각 플랫폼 스크립트의 debug 를 읽는다
    debug: false,
    fetch: async (url, init = {}) => {
      const req = { url, method: (init.method || 'GET').toUpperCase(), body: init.body ? JSON.parse(init.body) : null, init };
      requests.push(req);
      return route(req, requests);
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'scripts', 'util.js'), 'utf8'), sandbox, { filename: 'util.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'scripts', 'Github.js'), 'utf8'), sandbox, { filename: 'Github.js' });
  // 클래스·const 는 전역 렉시컬 스코프에 있어 샌드박스 속성이 아니므로 꺼내 둔다
  const exported = vm.runInContext('({ GitHub, GitHubApiError, GitHubTimeoutError, TokenExpiredError, GITHUB_COMMIT_MAX_ATTEMPTS, GITHUB_FETCH_TIMEOUT_MS, GITHUB_TREE_TIMEOUT_MS })', sandbox);
  return { sandbox, requests, delays, signals: signals.issued, ...exported };
}

/**
 * 브랜치를 흉내 내는 GitHub 서버. PATCH 는 force 가 아니면 fast-forward(부모가 현재 ref)일 때만 받는다.
 * beforePatch(n) 가 true 를 돌려주면 n 번째 PATCH 직전에 "다른 탭" 커밋이 끼어든다.
 */
function makeServer({ beforePatch = () => false, patchError = null } = {}) {
  const state = { head: 'c0', commits: { c0: { parents: [] } }, trees: 0, patches: 0, log: [] };
  let seq = 0;
  const route = (req) => {
    const { url, method, body } = req;
    if (method === 'GET' && url === `${API}/git/ref/heads/main`) {
      return jsonResponse(200, { ref: 'refs/heads/main', object: { sha: state.head } });
    }
    if (method === 'POST' && url === `${API}/git/trees`) {
      state.trees += 1;
      return jsonResponse(201, { sha: `t${state.trees}`, tree: [] });
    }
    if (method === 'POST' && url === `${API}/git/commits`) {
      seq += 1;
      const sha = `n${seq}`;
      state.commits[sha] = { parents: body.parents, tree: body.tree, message: body.message };
      return jsonResponse(201, { sha });
    }
    if (method === 'PATCH' && url === `${API}/git/refs/heads/main`) {
      state.patches += 1;
      if (patchError) return patchError(state.patches);
      if (beforePatch(state.patches)) {
        const other = `other${state.patches}`;
        state.commits[other] = { parents: [state.head] };
        state.head = other;
        state.log.push(other);
      }
      if (!body.force && !state.commits[body.sha].parents.includes(state.head)) {
        return jsonResponse(422, { message: 'Update is not a fast forward' });
      }
      state.head = body.sha;
      state.log.push(body.sha);
      return jsonResponse(200, { ref: 'refs/heads/main', object: { sha: body.sha } });
    }
    throw new Error(`unexpected request ${method} ${url}`);
  };
  /** head 에서 부모를 따라 내려가며 도달 가능한 커밋 */
  state.history = () => {
    const out = [];
    for (let sha = state.head; sha; sha = (state.commits[sha].parents || [])[0]) out.push(sha);
    return out;
  };
  return { state, route };
}

const ITEMS = [{ path: '프로그래머스/1/1. 문제/문제.py', mode: '100644', type: 'blob', sha: 'blob1' }];

describe('commitTreeItems — ref 는 fast-forward 로만 옮긴다', () => {
  test('경합이 없으면 ref 조회 → tree → commit → ref 갱신(force: false) 4회로 끝난다', async () => {
    const server = makeServer();
    const gh = loadGithub(server.route);
    const git = new gh.GitHub(HOOK, 'token');
    const result = await git.commitTreeItems('main', ITEMS, 'msg');

    assert.deepEqual(gh.requests.map((r) => r.method), ['GET', 'POST', 'POST', 'PATCH']);
    assert.equal(gh.requests[1].body.base_tree, 'c0');
    assert.deepEqual(gh.requests[2].body.parents, ['c0']);
    assert.equal(gh.requests[3].body.force, false);
    assert.equal(result.commitSHA, 'n1');
    assert.equal(result.parentSHA, 'c0');
    assert.deepEqual(server.state.history(), ['n1', 'c0']);
  });

  test('그 사이 다른 커밋이 올라가면 최신 ref 위에 tree·commit 을 새로 만들어 두 커밋을 모두 남긴다', async () => {
    const server = makeServer({ beforePatch: (n) => n === 1 });
    const gh = loadGithub(server.route);
    const git = new gh.GitHub(HOOK, 'token');
    const result = await git.commitTreeItems('main', ITEMS, 'msg');

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
    const git = new gh.GitHub(HOOK, 'token');
    await assert.rejects(git.commitTreeItems('main', ITEMS, 'msg'), (error) => {
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

  for (const [label, response, ErrorName] of [
    ['보호 브랜치 422', () => jsonResponse(422, { message: 'Changes must be made through a pull request.' }), 'GitHubApiError'],
    ['브랜치 없음 404', () => jsonResponse(404, { message: 'Not Found' }), 'GitHubApiError'],
    ['토큰 만료 401', () => jsonResponse(401, { message: 'Bad credentials' }), 'TokenExpiredError'],
  ]) {
    test(`fast-forward 거절이 아닌 오류(${label})는 다시 시도하지 않는다`, async () => {
      const server = makeServer({ patchError: response });
      const gh = loadGithub(server.route);
      const git = new gh.GitHub(HOOK, 'token');
      await assert.rejects(git.commitTreeItems('main', ITEMS, 'msg'), (error) => error.name === ErrorName);
      assert.equal(server.state.patches, 1);
      assert.deepEqual(gh.delays, []);
    });
  }

  test('isNotFastForwardError 는 422 + fast forward 문구일 때만 참이다', () => {
    const gh = loadGithub(() => { throw new Error('no request'); });
    const { GitHub, GitHubApiError } = gh;
    assert.equal(GitHub.isNotFastForwardError(new GitHubApiError('Update is not a fast forward', 422)), true);
    assert.equal(GitHub.isNotFastForwardError(new GitHubApiError('Update is not a fast-forward', 422)), true);
    assert.equal(GitHub.isNotFastForwardError(new GitHubApiError('Reference update failed', 422)), false);
    assert.equal(GitHub.isNotFastForwardError(new GitHubApiError('Update is not a fast forward', 409)), false);
    assert.equal(GitHub.isNotFastForwardError(new Error('Update is not a fast forward')), false);
    assert.equal(GitHub.isNotFastForwardError(null), false);
  });

  test('updateHead 의 force 기본값은 false 다 (클래스·최상위 함수 모두)', async () => {
    const gh = loadGithub(() => jsonResponse(200, { object: { sha: 'x' } }));
    await new gh.GitHub(HOOK, 'token').updateHead('refs/heads/main', 'x');
    await gh.sandbox.updateHead(HOOK, 'token', 'refs/heads/main', 'x');
    assert.deepEqual(gh.requests.map((r) => r.body.force), [false, false]);
  });
});

describe('githubRequest — 캐시·타임아웃·404', () => {
  test('GET 은 브라우저 HTTP 캐시를 쓰지 않고 재검증한다 (다른 탭이 옮긴 ref 를 60초 동안 못 보는 문제)', async () => {
    const gh = loadGithub((req) => {
      if (req.url.endsWith('/git/ref/heads/main')) return jsonResponse(200, { ref: 'refs/heads/main', object: { sha: 'c0' } });
      if (req.url === API) return jsonResponse(200, { default_branch: 'main' });
      return jsonResponse(201, { sha: 's' });
    });
    await gh.sandbox.getReference(HOOK, 'token', 'main');
    await gh.sandbox.getDefaultBranchOnRepo(HOOK, 'token');
    await gh.sandbox.createCommit(HOOK, 'token', 'm', 't', 'c0');
    assert.equal(gh.requests[0].init.cache, 'no-cache');
    assert.equal(gh.requests[1].init.cache, 'no-cache');
    assert.equal(gh.requests[2].init.cache, undefined, 'POST 에는 캐시 옵션을 붙이지 않는다');
  });

  test('모든 요청에 타임아웃 signal 이 붙고, 트리 생성만 길게 준다', async () => {
    const gh = loadGithub((req) => jsonResponse(200, req.url.endsWith('/git/trees') ? { sha: 't' } : { sha: 's', object: { sha: 's' }, default_branch: 'main' }));
    await gh.sandbox.createTree(HOOK, 'token', 'c0', []);
    await gh.sandbox.createBlob(HOOK, 'token', 'x', 'a.py');
    assert.equal(gh.requests.length, 2);
    assert.ok(gh.requests.every((r) => r.init.signal && r.init.signal === gh.signals[gh.requests.indexOf(r)]));
    assert.deepEqual(gh.signals.map((s) => s.timeoutMs), [gh.GITHUB_TREE_TIMEOUT_MS, gh.GITHUB_FETCH_TIMEOUT_MS]);
  });

  test('시간 안에 응답이 없으면 GitHubTimeoutError 로 끊는다 (업로드 줄이 영원히 막히지 않게)', async () => {
    let gh;
    gh = loadGithub(() => {
      const signal = gh.signals[gh.signals.length - 1];
      signal.aborted = true;
      const error = new Error('The operation was aborted due to timeout');
      error.name = 'TimeoutError';
      throw error;
    });
    await assert.rejects(gh.sandbox.getReference(HOOK, 'token', 'main'), (error) => {
      assert.ok(error instanceof gh.GitHubTimeoutError);
      assert.ok(error instanceof gh.GitHubApiError, 'GitHubApiError 로 잡는 기존 catch 가 그대로 동작해야 한다');
      assert.equal(error.name, 'GitHubTimeoutError');
      assert.equal(error.status, 0);
      assert.match(error.message, /30초/);
      return true;
    });
  });

  test('본문을 읽다가 시간이 다 돼도 GitHubTimeoutError 다', async () => {
    let gh;
    gh = loadGithub(() => ({
      status: 200,
      ok: true,
      json: async () => {
        gh.signals[0].aborted = true;
        const error = new Error('aborted');
        error.name = 'AbortError';
        throw error;
      },
    }));
    await assert.rejects(gh.sandbox.getTree(HOOK, 'token'), (error) => error.name === 'GitHubTimeoutError');
  });

  test('타임아웃이 아닌 네트워크 오류는 그대로 던진다', async () => {
    const gh = loadGithub(() => { throw new TypeError('Failed to fetch'); });
    await assert.rejects(gh.sandbox.getReference(HOOK, 'token', 'main'), (error) => error.name === 'TypeError' && error.message === 'Failed to fetch');
  });

  test('ref 갱신이 타임아웃되면 다시 커밋하지 않는다 (이미 반영됐을 수 있어 중복 커밋이 생긴다)', async () => {
    let gh;
    const server = makeServer({
      patchError: () => {
        gh.signals[gh.signals.length - 1].aborted = true;
        const error = new Error('timeout');
        error.name = 'TimeoutError';
        throw error;
      },
    });
    gh = loadGithub(server.route);
    await assert.rejects(new gh.GitHub(HOOK, 'token').commitTreeItems('main', ITEMS, 'msg'), (error) => error.name === 'GitHubTimeoutError');
    assert.equal(server.state.patches, 1);
  });

  test('getFile 은 404 를 null 로, 다른 API 는 404 를 오류로 돌려준다', async () => {
    const gh = loadGithub(() => jsonResponse(404, { message: 'Not Found' }));
    assert.equal(await gh.sandbox.getFile(HOOK, 'token', 'a/b.py'), null);
    await assert.rejects(gh.sandbox.getReference(HOOK, 'token', 'main'), (error) => error instanceof gh.GitHubApiError && error.status === 404);
  });

  test('AbortSignal.timeout 이 없는 브라우저(Chrome 103 미만)에서는 AbortController 와 타이머로 끊는다', async () => {
    const timers = [];
    const cleared = [];
    const sandbox = {
      console,
      TextEncoder,
      btoa,
      debug: false,
      AbortSignal: {},
      AbortController: class {
        constructor() { this.signal = { aborted: false }; }
        abort() { this.signal.aborted = true; }
      },
      setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
      clearTimeout: (id) => cleared.push(id),
      fetch: async (url, init) => {
        if (url.endsWith('/hang')) {
          timers[timers.length - 1].fn(); // 제한 시간이 지남
          assert.equal(init.signal.aborted, true);
          const error = new Error('aborted');
          error.name = 'AbortError';
          throw error;
        }
        return jsonResponse(200, { ok: true });
      },
    };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'scripts', 'util.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'scripts', 'Github.js'), 'utf8'), sandbox);
    const ok = await sandbox.githubRequest('https://api.github.com/ok');
    assert.equal(ok.ok, true);
    assert.equal(timers[0].ms, 30000);
    assert.deepEqual(cleared, [1], '응답을 다 읽으면 타이머를 정리한다');
    await assert.rejects(sandbox.githubRequest('https://api.github.com/hang'), (error) => error.name === 'GitHubTimeoutError');
    assert.deepEqual(cleared, [1, 2]);
  });

  test('재귀 트리 조회(getTree·getTreeWithTruncation)에는 트리 생성과 같은 긴 제한 시간을 준다', async () => {
    const gh = loadGithub(() => jsonResponse(200, { tree: [], truncated: false }));
    await gh.sandbox.getTree(HOOK, 'token');
    await gh.sandbox.getTreeWithTruncation(HOOK, 'token', 'HEAD');
    assert.deepEqual(gh.signals.map((s) => s.timeoutMs), [gh.GITHUB_TREE_TIMEOUT_MS, gh.GITHUB_TREE_TIMEOUT_MS]);
  });

  test('401/403 은 TokenExpiredError 다', async () => {
    const gh = loadGithub(() => jsonResponse(403, { message: 'Resource not accessible' }));
    await assert.rejects(gh.sandbox.getReference(HOOK, 'token', 'main'), (error) => error instanceof gh.TokenExpiredError && error.status === 403);
  });
});

describe('getReference — 없는 브랜치는 404 로 알린다', () => {
  test('단수 엔드포인트(git/ref)로 조회한다', async () => {
    const gh = loadGithub(() => jsonResponse(200, { ref: 'refs/heads/main', object: { sha: 'c0' } }));
    const result = await gh.sandbox.getReference(HOOK, 'token', 'main');
    assert.equal(gh.requests[0].url, `${API}/git/ref/heads/main`);
    assert.deepEqual({ ...result }, { refSHA: 'c0', ref: 'refs/heads/main' });
  });

  // 복수 엔드포인트(git/refs/heads/<이름>)는 정확히 일치하는 브랜치가 없으면 이름으로 시작하는 ref 배열을 200 으로 준다
  for (const [label, body] of [
    ['배열 응답', [{ ref: 'refs/heads/main-v2', object: { sha: 'c9' } }]],
    ['object 가 없는 응답', { ref: 'refs/heads/main' }],
  ]) {
    test(`${label}은 TypeError 가 아니라 GitHubApiError(404)다`, async () => {
      const gh = loadGithub(() => jsonResponse(200, body));
      await assert.rejects(gh.sandbox.getReference(HOOK, 'token', 'main'), (error) => error instanceof gh.GitHubApiError && error.status === 404);
    });
  }
});

describe('외톨이 서러게이트 — 올리는 바이트와 캐시 SHA 가 같아야 한다', () => {
  // GitHub 는 JSON 문자열 content 의 외톨이 서러게이트를 '?' 로 저장하고(2026-09-24 TIL2 실측, blob ad01dda8),
  // calculateBlobSHA 는 U+FFFD 기준으로 계산한다. 올리는 쪽이 U+FFFD 로 맞추지 않으면 같은 코드도 매번 새 코드로 보인다.
  const LONE = 'a\uD800b\uDC00c\n';
  const FIXED = 'a�b�c\n';

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

  test('createBlob 의 base64 는 U+FFFD 로 바꾼 UTF-8 바이트다', async () => {
    const gh = loadGithub(() => jsonResponse(201, { sha: 's' }));
    await gh.sandbox.createBlob(HOOK, 'token', LONE, 'a.py');
    const { content, encoding } = gh.requests[0].body;
    assert.equal(encoding, 'base64');
    assert.equal(Buffer.from(content, 'base64').toString('utf8'), FIXED);
  });

  test('b64EncodeUnicode 는 큰 입력도 스택 넘침 없이 원문 바이트로 되돌아온다', () => {
    const gh = loadGithub(() => { throw new Error('no request'); });
    const big = '가나다 abc \u{1F600}\r\n'.repeat(40000);
    assert.equal(Buffer.from(gh.sandbox.b64EncodeUnicode(big), 'base64').toString('utf8'), big);
    assert.equal(gh.sandbox.b64EncodeUnicode(''), '');
  });

  test('toWellFormedText 는 짝이 맞는 서러게이트와 일반 문자를 건드리지 않는다', () => {
    const gh = loadGithub(() => { throw new Error('no request'); });
    const { toWellFormedText } = gh.sandbox;
    assert.equal(toWellFormedText('\u{1F600}'), '\u{1F600}');
    assert.equal(toWellFormedText('\uDC00\uD800'), '��', '순서가 뒤집힌 쌍은 둘 다 외톨이다');
    assert.equal(toWellFormedText('끝\uD83D'), '끝�');
    assert.equal(toWellFormedText(''), '');
  });
});
