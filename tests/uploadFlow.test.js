'use strict';

// 실제 업로드 스크립트를 SWEA 번들로 한 vm 에 로드해(tests/helpers/versionHarness.js 의 loadPlatform), 가짜 GitHub 서버와
// 메모리 chrome.storage 위에서 업로드 흐름을 검증한다.
// - SWEA 단일 업로드: 캐시된 브랜치가 사라졌거나 없을 때 기본 브랜치를 다시 조회해 한 번만 커밋하고 캐시를 고친다.
//   예전 getReference 는 복수 엔드포인트(git/refs/heads/<이름>)라, 이름이 그것으로 시작하는 다른 브랜치가 있으면
//   404 대신 배열 200 을 받아 TypeError 로 끝났다.
// - updateLocalStorageStats: 트리를 읽지 못하면(타임아웃 등) 캐시를 비우지 않고, 조회 사이 다른 탭의 기록을 살린다.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { FakeGithub, loadPlatform, solved, settle, HOOK, VERSION } = require('./helpers/versionHarness.js');

const API = `https://api.github.com/repos/${HOOK}`;

function jsonResponse(status, body, headers = {}) {
  return { status, ok: status >= 200 && status < 300, json: async () => body, headers: { get: (name) => headers[name.toLowerCase()] ?? null } };
}

/**
 * 브랜치 여러 개를 가진 가짜 GitHub. 단수 ref 조회는 정확히 일치할 때만 200, 아니면 404 (실제 API 와 같다).
 * 복수 ref(git/refs/heads/<이름>) GET 은 다루지 않아, 코드가 그 경로를 쓰면 요청이 실패해 드러난다.
 */
function makeServer({ branches = { main: 'c0' }, defaultBranch = 'main', tree = [], onGetTree = null } = {}) {
  const state = { branches: { ...branches }, commits: {}, requests: [] };
  let seq = 0;
  const route = async (req) => {
    const { url, method, body } = req;
    state.requests.push(`${method} ${url.replace(API, '')}`);
    if (method === 'GET' && url === API) return jsonResponse(200, { default_branch: defaultBranch });
    let m = url.match(/\/git\/ref\/heads\/(.+)$/);
    if (method === 'GET' && m) {
      const sha = state.branches[m[1]];
      return sha ? jsonResponse(200, { ref: `refs/heads/${m[1]}`, object: { sha } }) : jsonResponse(404, { message: 'Not Found' });
    }
    m = url.match(/\/git\/refs\/heads\/(.+)$/);
    if (method === 'POST' && url === `${API}/git/trees`) return jsonResponse(201, { sha: 't' });
    if (method === 'POST' && url === `${API}/git/commits`) {
      seq += 1;
      state.commits[`n${seq}`] = body;
      return jsonResponse(201, { sha: `n${seq}` });
    }
    if (method === 'PATCH' && m) {
      if (!state.commits[body.sha].parents.includes(state.branches[m[1]])) return jsonResponse(422, { message: 'Update is not a fast forward' });
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

async function load(server, stats) {
  const loaded = loadPlatform(server, 'swexpertacademy', { stats });
  await settle();
  return loaded;
}

const SWEA_DATA = { code: 'print(1)\n', readme: '# readme\n', directory: 'SWEA/D2/1000. 문제', fileName: '문제.py', message: 'msg' };

test('SWEA 단일 업로드: 캐시된 브랜치가 사라졌거나 없으면 기본 브랜치를 조회해 한 번만 커밋하고 캐시를 고친다', async () => {
  for (const [label, branches, cachedBranches] of [
    // 복수 엔드포인트였다면 'master-old' 배열을 받아 TypeError 로 끝났던 경우
    ['캐시된 master 가 지워지고 같은 이름으로 시작하는 브랜치만 남음', { trunk: 'c0', 'master-old': 'c9' }, { [HOOK]: 'master' }],
    ['캐시된 브랜치가 없음', { trunk: 'c0' }, {}],
  ]) {
    const server = makeServer({ branches, defaultBranch: 'trunk' });
    const { sandbox, store } = await load(server, { version: VERSION, branches: cachedBranches, submission: {} });
    let callbackBranches = null;
    await sandbox.uploadOneSolveProblemOnGit(SWEA_DATA, (b) => { callbackBranches = b; });
    await settle();

    assert.ok(server.state.requests.includes('GET '), `${label}: 기본 브랜치를 조회한다`);
    assert.equal(server.state.requests.filter((r) => r.startsWith('GET /git/refs/')).length, 0, `${label}: ref 조회는 단수 엔드포인트로 한다`);
    assert.deepEqual(Object.keys(server.state.commits), ['n1'], `${label}: 커밋은 한 번만 만든다`);
    assert.equal(server.state.branches.trunk, 'n1', label);
    assert.equal(server.state.branches['master-old'], branches['master-old'], label);
    assert.equal(store.get('stats').branches[HOOK], 'trunk', label);
    assert.equal(callbackBranches[HOOK], 'trunk', label);
    const recorded = sandbox.getObjectDatafromPath(store.get('stats').submission, `${HOOK}/${SWEA_DATA.directory}/${SWEA_DATA.fileName}`);
    assert.equal(recorded, sandbox.calculateBlobSHA(SWEA_DATA.code), label);
  }
});

test('토큰 오류(401)는 브랜치를 다시 찾지 않고 바로 실패로 표시하며 아무것도 기록하지 않는다', async () => {
  const requests = [];
  const server = { route: async ({ url, method }) => { requests.push(`${method} ${url.replace(API, '')}`); return jsonResponse(401, { message: 'Bad credentials' }); } };
  const { sandbox, store, calls } = await load(server, { version: VERSION, branches: { [HOOK]: 'main' }, submission: {} });
  await sandbox.uploadOneSolveProblemOnGit(SWEA_DATA, () => {}); // TokenExpiredError 만 실패 표시 후 조용히 끝난다
  assert.equal(calls.failed, 1, '실패 표시를 한 번 한다');
  assert.deepEqual(requests, ['GET /git/ref/heads/main'], '기본 브랜치를 다시 찾지 않는다');
  assert.deepEqual(store.get('stats').submission, {}, '캐시에 아무것도 기록하지 않는다');
});

test('완료 콜백의 세 번째 인자는 새로 커밋했을 때만 true 다 (정올·DOJ 가 "올렸습니다" 안내를 이 값으로 정한다)', async () => {
  const { sandbox } = loadPlatform(new FakeGithub(), 'baekjoon'); // 정올·DOJ 와 같은 upload.js 의 upload 를 쓴다
  await settle();
  const seen = [];
  for (let i = 0; i < 2; i += 1) await sandbox.uploadUnlessSame(solved('baekjoon', 'print(1)\n'), (branches, directory, committed) => seen.push(committed));
  assert.deepEqual(seen, [true, undefined], '같은 코드를 다시 올리면 커밋 없이 완료 표시만 한다');
});

test('GitHub 403: 요청 한도 초과와 토큰 문제를 서로 다른 안내로 알린다 (백준 업로드)', async () => {
  const shown = {};
  for (const [kind, headers] of [['limit', { 'x-ratelimit-remaining': '0' }], ['token', { 'x-ratelimit-remaining': '4990' }]]) {
    const { sandbox } = loadPlatform({ route: async () => jsonResponse(403, { message: 'from GitHub' }, headers) }, 'baekjoon');
    await settle();
    const toasts = [];
    sandbox.Toast = { raiseToast: (message) => toasts.push(message) };
    const upload = sandbox.uploadOneSolveProblemOnGit(solved('baekjoon', 'print(1)\n'), () => {});
    // 한도 초과는 실패로 던져 부른 쪽이 실패로 표시하고, 토큰 문제는 예전처럼 안내만 하고 끝난다
    if (kind === 'limit') await assert.rejects(upload, (error) => error.name === 'GitHubRateLimitError');
    else await upload;
    assert.equal(toasts.length, 1, kind);
    shown[kind] = toasts[0];
  }
  assert.match(shown.limit, /요청 한도/);
  assert.doesNotMatch(shown.limit, /토큰/);
  assert.match(shown.token, /토큰/);
});

test('백준 수동 업로드: 토큰이나 저장소가 없으면 업로드 완료로 바꾸지 않고, 실패를 알리고 버튼을 원래대로 둔다', async () => {
  for (const missing of ['BaekjoonHub_token', 'BaekjoonHub_hook', null]) {
    const server = new FakeGithub();
    const { sandbox, store } = loadPlatform(server, 'baekjoon');
    await settle();
    if (missing) store.delete(missing);
    const toasts = [];
    sandbox.Toast = { raiseToast: (message) => toasts.push(message) };
    sandbox.findData = async () => solved('baekjoon', 'print(1)\n');
    const classes = new Set(['bjh-manual-upload-btn', 'bjh-upload-icon']);
    const button = { title: 'GitHub에 업로드', classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) } };
    sandbox.__item = { data: { elementId: 'solution-1' }, button };
    await vm.runInContext('manualUploadQueue.push(__item); processManualUploadQueue();', sandbox);
    await settle();
    if (missing === null) { // 대조군: 연결돼 있으면 올리고 완료로 바꾼다
      assert.ok(classes.has('bjh-upload-success'), '연결돼 있으면 업로드 완료');
      assert.deepEqual(toasts, []);
      continue;
    }
    assert.deepEqual([...classes].sort(), ['bjh-manual-upload-btn', 'bjh-upload-icon'], `${missing}: 버튼은 누르기 전 상태 그대로다`);
    assert.equal(button.title, 'GitHub에 업로드', missing);
    assert.equal(toasts.length, 1, `${missing}: 실패를 알린다`);
    assert.match(toasts[0], /연결/, missing);
    assert.deepEqual(server.requests, [], `${missing}: GitHub 에 요청하지 않는다`);
  }
});

describe('updateLocalStorageStats — 레포 파일 목록으로 캐시 재구축', () => {
  const OLD = { tester: { algorithm: { 백준: { 'a.py': 'sha-a-old', 'deleted.py': 'sha-deleted' } } } };
  const OLD_STATS = { version: '1.0.0', branches: {}, submission: OLD };

  test('트리를 읽으면 트리 기준으로 다시 만들고(지운 파일 정리) 버전을 같은 저장에 기록한다', async () => {
    const server = makeServer({ tree: [{ path: '백준/a.py', type: 'blob', sha: 'sha-a' }, { path: '백준', type: 'tree', sha: 'tree' }] });
    const { sandbox, store } = await load(server, { ...OLD_STATS, other: { x: 1 } });
    await sandbox.updateLocalStorageStats({ version: VERSION });
    const stats = store.get('stats');
    assert.equal(sandbox.getObjectDatafromPath(stats.submission, `${HOOK}/백준/a.py`), 'sha-a');
    assert.equal(sandbox.getObjectDatafromPath(stats.submission, `${HOOK}/백준/deleted.py`) ?? null, null);
    assert.equal(stats.version, VERSION);
    assert.equal(stats.branches[HOOK], 'main');
    assert.deepEqual(stats.other, { x: 1 }, '재구축과 무관한 필드는 그대로 둔다');
  });

  test('트리 조회가 타임아웃되면 캐시를 비우지 않고 버전도 기록하지 않는다 (다음에 다시 재구축)', async () => {
    let treeRequested = false;
    const server = makeServer({
      onGetTree: (req) => {
        treeRequested = true;
        req.init.signal.aborted = true;
        const error = new Error('The operation was aborted due to timeout');
        error.name = 'TimeoutError';
        throw error;
      },
    });
    const { sandbox, store } = await load(server, OLD_STATS);
    await sandbox.updateLocalStorageStats({ version: VERSION });
    const stats = store.get('stats');
    assert.ok(treeRequested);
    assert.deepEqual(stats.submission, OLD, '전체 업로드가 이미 올린 문제를 다시 올리지 않도록 캐시를 지킨다');
    assert.equal(stats.version, '1.0.0');
    assert.equal(stats.branches[HOOK], 'main', '브랜치는 따로 갱신한다');
  });

  test('빈 레포(409·404)는 빈 트리로 보고 캐시를 비운다', async () => {
    for (const status of [409, 404]) {
      const server = makeServer({ onGetTree: () => jsonResponse(status, { message: 'Git Repository is empty.' }) });
      const { sandbox, store } = await load(server, OLD_STATS);
      await sandbox.updateLocalStorageStats({ version: VERSION });
      assert.deepEqual(store.get('stats').submission, {}, `${status}`);
      assert.equal(store.get('stats').version, VERSION, `${status}`);
    }
  });

  test('hook·토큰이 없으면 요청을 보내지 않고 저장·버전 기록도 하지 않는다', async () => {
    for (const missing of ['BaekjoonHub_hook', 'BaekjoonHub_token']) {
      const server = makeServer();
      const { sandbox, store } = await load(server, OLD_STATS);
      store.delete(missing);
      const returned = await sandbox.updateLocalStorageStats({ version: VERSION });
      await settle();
      assert.deepEqual(server.state.requests, [], missing);
      assert.equal(store.get('stats').version, '1.0.0', `${missing}: 연결한 뒤 재구축하도록 버전을 남겨 둔다`);
      assert.deepEqual(store.get('stats').submission, OLD, missing);
      assert.deepEqual({ ...returned.branches }, {}, `${missing}: 호출하는 쪽이 branches 를 바로 읽을 수 있다`);
    }
  });

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
    const { sandbox, store } = await load(server, OLD_STATS);
    sandboxRef = sandbox;
    await sandbox.updateLocalStorageStats({ version: VERSION });
    const { submission } = store.get('stats');
    assert.equal(sandbox.getObjectDatafromPath(submission, `${HOOK}/백준/a.py`), 'sha-a-new', '다른 탭이 올린 새 버전을 옛 값으로 되돌리지 않는다');
    assert.equal(sandbox.getObjectDatafromPath(submission, `${HOOK}/백준/b.py`), 'sha-b');
    assert.equal(sandbox.getObjectDatafromPath(submission, `${HOOK}/백준/deleted.py`) ?? null, null, '그 사이 바뀌지 않은 옛 항목은 트리 기준으로 정리된다');
  });
});
