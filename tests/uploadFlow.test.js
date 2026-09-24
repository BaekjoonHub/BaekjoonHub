'use strict';

// 실제 util.js + Github.js + storage.js + swexpertacademy/uploadfunctions.js 를 한 vm 에 로드해, 가짜 GitHub 서버와
// 메모리 chrome.storage 위에서 업로드 흐름을 검증한다.
// - SWEA 단일 업로드: 캐시된 브랜치가 사라졌을 때(404) 기본 브랜치를 다시 조회해 한 번만 커밋하고 캐시를 고친다.
//   예전 getReference 는 복수 엔드포인트(git/refs/heads/<이름>)라, 이름이 그것으로 시작하는 다른 브랜치가 있으면
//   404 대신 배열 200 을 받아 TypeError 로 끝났다.
// - updateLocalStorageStats: 트리를 읽지 못하면(타임아웃 등) 캐시를 비우지 않고, 조회 사이 다른 탭의 기록을 살린다.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { normalizePath } = require('../scripts/utils/pathNormalize.js');

const ROOT = path.join(__dirname, '..');
const HOOK = 'tester/algorithm';
const API = `https://api.github.com/repos/${HOOK}`;
const VERSION = '1.4.20';

function jsonResponse(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

function timeoutError() {
  const error = new Error('The operation was aborted due to timeout');
  error.name = 'TimeoutError';
  return error;
}

/**
 * 브랜치 여러 개를 가진 가짜 GitHub. 단수 ref 조회는 정확히 일치할 때만 200, 아니면 404 (실제 API 와 같다).
 * 복수 ref GET 은 이름으로 시작하는 ref 배열을 돌려주는 실제 동작을 흉내 내, 코드가 그 경로를 쓰면 드러나게 한다.
 */
function makeServer({ branches = { main: 'c0' }, defaultBranch = 'main', tree = [], onGetTree = null } = {}) {
  const state = { branches: { ...branches }, defaultBranch, commits: {}, requests: [], trees: [] };
  let seq = 0;
  const route = async (req) => {
    const { url, method, body } = req;
    state.requests.push(`${method} ${url.replace(API, '')}`);
    if (method === 'GET' && url === API) return jsonResponse(200, { default_branch: state.defaultBranch });
    let m = url.match(/\/git\/ref\/heads\/(.+)$/);
    if (method === 'GET' && m) {
      const sha = state.branches[m[1]];
      return sha ? jsonResponse(200, { ref: `refs/heads/${m[1]}`, object: { sha } }) : jsonResponse(404, { message: 'Not Found' });
    }
    m = url.match(/\/git\/refs\/heads\/(.+)$/);
    if (method === 'GET' && m) {
      const prefixed = Object.keys(state.branches).filter((b) => b.startsWith(m[1]));
      if (state.branches[m[1]]) return jsonResponse(200, { ref: `refs/heads/${m[1]}`, object: { sha: state.branches[m[1]] } });
      return prefixed.length ? jsonResponse(200, prefixed.map((b) => ({ ref: `refs/heads/${b}`, object: { sha: state.branches[b] } }))) : jsonResponse(404, { message: 'Not Found' });
    }
    if (method === 'POST' && url === `${API}/git/trees`) {
      state.trees.push(body);
      return jsonResponse(201, { sha: `t${state.trees.length}` });
    }
    if (method === 'POST' && url === `${API}/git/commits`) {
      seq += 1;
      state.commits[`n${seq}`] = body;
      return jsonResponse(201, { sha: `n${seq}` });
    }
    if (method === 'PATCH' && m) {
      const current = state.branches[m[1]];
      if (!current) return jsonResponse(422, { message: 'Reference does not exist' });
      if (!body.force && !state.commits[body.sha].parents.includes(current)) return jsonResponse(422, { message: 'Update is not a fast forward' });
      state.branches[m[1]] = body.sha;
      return jsonResponse(200, { ref: `refs/heads/${m[1]}`, object: { sha: body.sha } });
    }
    if (method === 'GET' && url === `${API}/git/trees/HEAD?recursive=1`) {
      if (onGetTree) return onGetTree(req);
      return jsonResponse(200, { tree, truncated: false });
    }
    throw new Error(`unexpected request ${method} ${url}`);
  };
  return { state, route };
}

function load(server, { stats = null, markUploadFailedCSS = () => {} } = {}) {
  const store = new Map([
    ['isSync', true],
    ['BaekjoonHub_token', 'token'],
    ['BaekjoonHub_hook', HOOK],
  ]);
  if (stats) store.set('stats', stats);
  const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
  const errors = [];
  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: (...args) => errors.push(args) },
    TextEncoder,
    btoa,
    // 요청마다 abort 여부를 테스트가 정할 수 있는 가짜 (실제 30초 타이머를 만들지 않는다)
    AbortSignal: { timeout: (ms) => ({ aborted: false, timeoutMs: ms }) },
    setTimeout: (fn) => { fn(); return 0; },
    debug: false,
    chrome: {
      runtime: { getManifest: () => ({ version: VERSION }) },
      storage: {
        local: {
          get: (key, cb) => setImmediate(() => cb({ [key]: clone(store.get(key)) })),
          set: (obj, cb) => setImmediate(() => { for (const [k, v] of Object.entries(obj)) store.set(k, clone(v)); if (cb) cb(); }),
        },
        sync: { get: () => {}, set: () => {} },
      },
    },
    normalizePath,
    runLanguageFolderMigrationIfNeeded: async () => {},
    markUploadFailedCSS,
    fetch: async (url, init = {}) => server.route({ url, method: (init.method || 'GET').toUpperCase(), body: init.body ? JSON.parse(init.body) : null, init }),
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ['library/sha1.min.js', 'scripts/util.js', 'scripts/Github.js', 'scripts/storage.js', 'scripts/swexpertacademy/uploadfunctions.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  }
  return { sandbox, store, errors };
}

async function settle() {
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

const BOJ_DATA = { code: 'print(1)\n', readme: '# readme\n', directory: 'SWEA/D2/1000. 문제', fileName: '문제.py', message: 'msg' };

describe('SWEA 단일 업로드 — 캐시된 브랜치가 사라졌을 때', () => {
  for (const [label, branches] of [
    ['캐시된 브랜치가 삭제됨', { main: 'c0' }],
    // 복수 엔드포인트였다면 'master-old' 배열을 받아 TypeError 로 끝났던 경우
    ['같은 이름으로 시작하는 브랜치만 남음', { main: 'c0', 'master-old': 'c9' }],
  ]) {
    test(`${label}: 기본 브랜치를 다시 조회해 한 번만 커밋하고 캐시를 고친다`, async () => {
      const server = makeServer({ branches, defaultBranch: 'main' });
      const { sandbox, store } = load(server, { stats: { version: VERSION, branches: { [HOOK]: 'master' }, submission: {} } });
      await settle();
      let callbackBranches = null;
      await sandbox.uploadOneSolveProblemOnGit(BOJ_DATA, (b) => { callbackBranches = b; });
      await settle();

      assert.equal(server.state.requests.filter((r) => r.startsWith('GET /git/refs/')).length, 0, 'ref 조회는 단수 엔드포인트로 한다');
      assert.deepEqual(Object.keys(server.state.commits), ['n1'], '커밋은 한 번만 만든다');
      assert.equal(server.state.branches.main, 'n1');
      assert.equal(server.state.branches['master-old'], branches['master-old']);
      assert.equal(store.get('stats').branches[HOOK], 'main');
      assert.equal(callbackBranches[HOOK], 'main');
      const recorded = sandbox.getObjectDatafromPath(store.get('stats').submission, `${HOOK}/${BOJ_DATA.directory}/${BOJ_DATA.fileName}`);
      assert.equal(recorded, sandbox.calculateBlobSHA(BOJ_DATA.code));
    });
  }

  test('기본 브랜치도 같으면(브랜치 자체가 없음) 404 를 그대로 던지고 아무것도 기록하지 않는다', async () => {
    const server = makeServer({ branches: {}, defaultBranch: 'main' });
    const { sandbox, store } = load(server, { stats: { version: VERSION, branches: { [HOOK]: 'main' }, submission: {} } });
    await settle();
    await assert.rejects(sandbox.uploadOneSolveProblemOnGit(BOJ_DATA, () => {}), (error) => error.status === 404);
    assert.equal(server.state.trees.length, 0);
    assert.deepEqual(store.get('stats').submission, {});
  });

  test('토큰 오류(401)는 브랜치를 다시 찾지 않고 바로 실패로 표시한다', async () => {
    const server = makeServer();
    server.route = async (req) => {
      server.state.requests.push(`${req.method} ${req.url.replace(API, '')}`);
      return jsonResponse(401, { message: 'Bad credentials' });
    };
    let failed = 0;
    const { sandbox } = load(server, { stats: { version: VERSION, branches: { [HOOK]: 'main' }, submission: {} }, markUploadFailedCSS: () => { failed += 1; } });
    await settle();
    await sandbox.uploadOneSolveProblemOnGit(BOJ_DATA, () => {});
    assert.equal(failed, 1);
    assert.deepEqual(server.state.requests, ['GET /git/ref/heads/main']);
  });

  test('캐시된 브랜치가 없으면 기본 브랜치를 조회해 커밋한다', async () => {
    const server = makeServer({ branches: { trunk: 'c0' }, defaultBranch: 'trunk' });
    const { sandbox, store } = load(server, { stats: { version: VERSION, branches: {}, submission: {} } });
    await settle();
    await sandbox.uploadOneSolveProblemOnGit(BOJ_DATA, () => {});
    await settle();
    assert.equal(server.state.requests[0], 'GET ');
    assert.equal(server.state.branches.trunk, 'n1');
    assert.equal(store.get('stats').branches[HOOK], 'trunk');
  });
});

describe('updateLocalStorageStats — 레포 파일 목록으로 캐시 재구축', () => {
  const OLD = { [HOOK.split('/')[0]]: { [HOOK.split('/')[1]]: { 백준: { 'a.py': 'sha-a-old', 'deleted.py': 'sha-deleted' } } } };

  test('트리를 읽으면 트리 기준으로 다시 만들고(지운 파일 정리) 버전을 같은 저장에 기록한다', async () => {
    const server = makeServer({ tree: [{ path: '백준/a.py', type: 'blob', sha: 'sha-a' }, { path: '백준', type: 'tree', sha: 'tree' }] });
    const { sandbox, store } = load(server, { stats: { version: '1.0.0', branches: {}, submission: OLD, other: { x: 1 } } });
    await settle();
    await sandbox.updateLocalStorageStats({ version: VERSION });
    const stats = store.get('stats');
    assert.equal(sandbox.getObjectDatafromPath(stats.submission, `${HOOK}/백준/a.py`), 'sha-a');
    assert.equal(sandbox.getObjectDatafromPath(stats.submission, `${HOOK}/백준/deleted.py`) ?? null, null);
    assert.equal(stats.version, VERSION);
    assert.equal(stats.branches[HOOK], 'main');
    assert.deepEqual(stats.other, { x: 1 }, '재구축과 무관한 필드는 그대로 둔다');
  });

  test('트리 조회가 타임아웃되면 캐시를 비우지 않고 버전도 기록하지 않는다 (다음에 다시 재구축)', async () => {
    const server = makeServer({
      onGetTree: (req) => {
        req.init.signal.aborted = true;
        throw timeoutError();
      },
    });
    const { sandbox, store, errors } = load(server, { stats: { version: '1.0.0', branches: {}, submission: OLD } });
    await settle();
    await sandbox.updateLocalStorageStats({ version: VERSION });
    const stats = store.get('stats');
    assert.deepEqual(stats.submission, OLD, '전체 업로드가 이미 올린 문제를 다시 올리지 않도록 캐시를 지킨다');
    assert.equal(stats.version, '1.0.0');
    assert.equal(stats.branches[HOOK], 'main', '브랜치는 따로 갱신한다');
    assert.ok(errors.some((args) => String(args[0]).includes('캐시를 그대로 둡니다')));
    const treeRequest = server.state.requests.find((r) => r.includes('/git/trees/HEAD'));
    assert.ok(treeRequest);
  });

  test('재귀 트리 조회에는 긴 제한 시간을 준다', async () => {
    let timeoutMs = null;
    const server = makeServer({
      onGetTree: (req) => {
        timeoutMs = req.init.signal.timeoutMs;
        return jsonResponse(200, { tree: [] });
      },
    });
    const { sandbox } = load(server, { stats: { version: VERSION, branches: {}, submission: {} } });
    await settle();
    await sandbox.updateLocalStorageStats();
    assert.equal(timeoutMs, 120000);
  });

  for (const status of [409, 404]) {
    test(`빈 레포(${status})는 빈 트리로 보고 캐시를 비운다`, async () => {
      const server = makeServer({ onGetTree: () => jsonResponse(status, { message: 'Git Repository is empty.' }) });
      const { sandbox, store } = load(server, { stats: { version: '1.0.0', branches: {}, submission: OLD } });
      await settle();
      await sandbox.updateLocalStorageStats({ version: VERSION });
      assert.deepEqual(store.get('stats').submission, {});
      assert.equal(store.get('stats').version, VERSION);
    });
  }

  for (const missing of ['BaekjoonHub_hook', 'BaekjoonHub_token']) {
    test(`${missing} 이 없으면 요청을 보내지 않고 저장·버전 기록도 하지 않는다`, async () => {
      const server = makeServer();
      const { sandbox, store } = load(server, { stats: { version: '1.0.0', branches: {}, submission: OLD } });
      store.delete(missing);
      await settle();
      const returned = await sandbox.updateLocalStorageStats({ version: VERSION });
      await settle();
      assert.deepEqual(server.state.requests, []);
      assert.equal(store.get('stats').version, '1.0.0', '연결한 뒤 재구축하도록 버전을 남겨 둔다');
      assert.deepEqual(store.get('stats').submission, OLD);
      assert.deepEqual({ ...returned.branches }, {}, '호출하는 쪽이 branches 를 바로 읽을 수 있다');
    });
  }

  test('트리를 조회하는 사이 다른 탭이 기록한 업로드는 재구축 뒤에도 남는다', async () => {
    let sandboxRef = null;
    const server = makeServer({
      // 트리는 조회 시점의 상태(a.py 는 옛 sha). 응답 직전에 다른 탭이 a.py 새 버전과 b.py 를 올리고 기록한다.
      onGetTree: async () => {
        await sandboxRef.recordUploadInStats(HOOK, 'main', [
          { path: '백준/a.py', type: 'blob', mode: '100644', sha: 'sha-a-new' },
          { path: '백준/b.py', type: 'blob', mode: '100644', sha: 'sha-b' },
        ]);
        return jsonResponse(200, { tree: [{ path: '백준/a.py', type: 'blob', sha: 'sha-a-old' }] });
      },
    });
    const { sandbox, store } = load(server, { stats: { version: '1.0.0', branches: {}, submission: OLD } });
    sandboxRef = sandbox;
    await settle();
    await sandbox.updateLocalStorageStats({ version: VERSION });
    const { submission } = store.get('stats');
    assert.equal(sandbox.getObjectDatafromPath(submission, `${HOOK}/백준/a.py`), 'sha-a-new', '다른 탭이 올린 새 버전을 옛 값으로 되돌리지 않는다');
    assert.equal(sandbox.getObjectDatafromPath(submission, `${HOOK}/백준/b.py`), 'sha-b');
    assert.equal(sandbox.getObjectDatafromPath(submission, `${HOOK}/백준/deleted.py`) ?? null, null, '그 사이 바뀌지 않은 옛 항목은 트리 기준으로 정리된다');
  });
});
