'use strict';

// 풀이 버전 보관(#353) 테스트용 하네스.
// - FakeGithub: blob·tree·commit·ref 와 contents API 를 가진 가짜 GitHub 서버. 파일 내용을 실제로 들고 있어
//   "어떤 경로에 어떤 코드가 저장됐는지" 를 직접 확인할 수 있다. blob SHA 는 확장 코드와 별개로 node crypto 로 계산한다.
// - loadPlatform: 실제 util.js·Github.js·storage.js·solutionVersions.js 와 플랫폼의 uploadfunctions.js·메인 스크립트를
//   한 vm 에 로드한다. DOM 에 닿는 함수(완료 표시 등)와 파싱만 스텁이다.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const { normalizePath } = require('../../scripts/utils/pathNormalize.js');

const ROOT = path.join(__dirname, '..', '..');
const HOOK = 'tester/algorithm';
const API = `https://api.github.com/repos/${HOOK}`;
const VERSION = '1.4.22';

/** git blob SHA — 확장 코드(calculateBlobSHA)와 따로 계산한 정답 */
function blobSha(text) {
  const body = Buffer.from(text, 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${body.length}\0`), body])).digest('hex');
}

function jsonResponse(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

class FakeGithub {
  /**
   * @param {{files?: Object<string, string>, beforePatch?: function(number, FakeGithub): void}} options
   *   files: 첫 커밋(c0)의 파일 (경로 → 내용). beforePatch(n, server): n 번째 ref 갱신 직전에 불린다(그 사이 다른 기기가 커밋하는 상황).
   */
  constructor({ files = {}, beforePatch = null } = {}) {
    this.blobs = new Map(); // sha → 내용
    this.commits = {}; // sha → { parents, files: Map(path → blob sha), message }
    this.trees = {};
    this.requests = [];
    this.patches = 0;
    this.beforePatch = beforePatch;
    this.seq = 0;
    const root = new Map(Object.entries(files).map(([p, content]) => [p, this.storeBlob(content)]));
    this.commits.c0 = { parents: [], files: root, message: 'init' };
    this.head = 'c0';
    this.route = this.route.bind(this);
  }

  storeBlob(content) {
    const sha = blobSha(content);
    this.blobs.set(sha, content);
    return sha;
  }

  /** 지금 브랜치 끝의 파일 (경로 → 내용) */
  filesAtHead() {
    return Object.fromEntries([...this.commits[this.head].files].map(([p, sha]) => [p, this.blobs.get(sha)]));
  }

  /** 그 사이 다른 탭·기기가 올린 커밋: 브랜치 끝 위에 파일을 더해 브랜치를 옮긴다 */
  advanceHead(files) {
    const next = new Map(this.commits[this.head].files);
    for (const [p, content] of Object.entries(files)) next.set(p, this.storeBlob(content));
    this.others = (this.others || 0) + 1;
    const sha = `other${this.others}`;
    this.commits[sha] = { parents: [this.head], files: next, message: 'other device' };
    this.head = sha;
    return sha;
  }

  /** 브랜치 끝에서 부모를 따라 내려가며 도달 가능한 커밋 (끝 → 처음) */
  history() {
    const out = [];
    for (let sha = this.head; sha; sha = this.commits[sha].parents[0]) out.push(sha);
    return out;
  }

  /** 요청 목록에서 contents API 호출의 ref 만 (어느 시점의 목록을 읽었는지) */
  listingRefs() {
    return this.requests.filter((r) => r.includes('/contents/') && r.includes('?ref=')).map((r) => r.split('?ref=')[1]);
  }

  resolve(ref) {
    return this.commits[ref] ? ref : (ref === 'main' || !ref ? this.head : null);
  }

  async route({ url, method, body }) {
    const parsed = new URL(url);
    const apiPath = decodeURIComponent(parsed.pathname.replace(`/repos/${HOOK}`, ''));
    this.requests.push(`${method} ${parsed.pathname.replace(`/repos/${HOOK}`, '')}${parsed.search}`);
    if (method === 'GET' && apiPath === '') return jsonResponse(200, { default_branch: 'main' });
    if (method === 'GET' && apiPath === '/git/ref/heads/main') return jsonResponse(200, { ref: 'refs/heads/main', object: { sha: this.head } });
    if (method === 'POST' && apiPath === '/git/blobs') {
      return jsonResponse(201, { sha: this.storeBlob(Buffer.from(body.content, 'base64').toString('utf8')) });
    }
    if (method === 'POST' && apiPath === '/git/trees') {
      const files = new Map(this.commits[body.base_tree].files);
      for (const item of body.tree) {
        if (item.content !== undefined) files.set(item.path, this.storeBlob(item.content));
        else if (this.blobs.has(item.sha)) files.set(item.path, item.sha);
        else return jsonResponse(422, { message: `unknown blob ${item.sha}` });
      }
      this.seq += 1;
      this.trees[`t${this.seq}`] = files;
      return jsonResponse(201, { sha: `t${this.seq}` });
    }
    if (method === 'POST' && apiPath === '/git/commits') {
      this.seq += 1;
      this.commits[`n${this.seq}`] = { parents: body.parents, files: this.trees[body.tree], message: body.message };
      return jsonResponse(201, { sha: `n${this.seq}` });
    }
    if (method === 'PATCH' && apiPath === '/git/refs/heads/main') {
      this.patches += 1;
      if (this.beforePatch) this.beforePatch(this.patches, this);
      if (!body.force && !this.commits[body.sha].parents.includes(this.head)) return jsonResponse(422, { message: 'Update is not a fast forward' });
      this.head = body.sha;
      return jsonResponse(200, { ref: 'refs/heads/main', object: { sha: body.sha } });
    }
    if (method === 'GET' && apiPath === '/git/trees/HEAD') {
      return jsonResponse(200, { truncated: false, tree: [...this.commits[this.head].files].map(([p, sha]) => ({ path: p, type: 'blob', sha })) });
    }
    if (method === 'GET' && apiPath.startsWith('/contents/')) {
      const target = apiPath.slice('/contents/'.length).replace(/\/$/, '');
      const sha = this.resolve(parsed.searchParams.get('ref'));
      if (!sha) return jsonResponse(404, { message: 'No commit found for the ref' });
      const files = this.commits[sha].files;
      if (files.has(target)) return jsonResponse(200, { type: 'file', name: target.split('/').pop(), path: target, sha: files.get(target) });
      const prefix = target === '' ? '' : `${target}/`;
      const entries = new Map();
      for (const [p, fileSha] of files) {
        if (!p.startsWith(prefix)) continue;
        const rest = p.slice(prefix.length);
        const name = rest.split('/')[0];
        entries.set(name, rest.includes('/') ? { type: 'dir', name, path: prefix + name } : { type: 'file', name, path: p, sha: fileSha });
      }
      return entries.size ? jsonResponse(200, [...entries.values()]) : jsonResponse(404, { message: 'Not Found' });
    }
    throw new Error(`unexpected request ${method} ${url}`);
  }
}

/**
 * 플랫폼별 실제 업로드 경로: 메인 스크립트의 beginUpload 와 uploadfunctions.js 의 upload.
 * mock: 메인 스크립트·uploadfunctions 가 부르지만 이 테스트에서는 의미 없는 플랫폼 util/parsing 함수
 */
const PLATFORMS = {
  baekjoon: { dir: 'baekjoon', main: 'baekjoon.js', directory: '백준/Bronze/1000. A+B', fileName: 'A+B.py' },
  programmers: { dir: 'programmers', main: 'programmers.js', directory: '프로그래머스/2/12345. 두 수의 합 #1', fileName: '두 수의 합.py' },
  swexpertacademy: { dir: 'swexpertacademy', main: 'swexpertacademy.js', directory: 'SWEA/D3/1234. 문제', fileName: '문제.py' },
  goormlevel: { dir: 'goormlevel', main: 'goormlevel.js', directory: 'goormlevel/보통/54321. 문제', fileName: '문제.py' },
};

/**
 * @param {FakeGithub} server
 * @param {string} platform - PLATFORMS 의 키
 * @param {{keep?: boolean, stats?: object|null}} options - keep: 풀이별 파일 보관 옵션, stats: 로컬 캐시(기본: 최신 버전의 빈 캐시)
 */
function loadPlatform(server, platform, { keep = false, stats = undefined } = {}) {
  const info = PLATFORMS[platform];
  const store = new Map([
    ['isSync', true],
    ['BaekjoonHub_token', 'token'],
    ['BaekjoonHub_hook', HOOK],
  ]);
  if (keep) store.set('bjhKeepSolutionVersions', true);
  store.set('stats', stats === undefined ? { version: VERSION, branches: { [HOOK]: 'main' }, submission: { tester: { algorithm: {} } } } : stats);
  const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
  const calls = { uploaded: [], failed: 0 };
  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    TextEncoder,
    btoa,
    AbortSignal: { timeout: (ms) => ({ aborted: false, timeoutMs: ms }) },
    setTimeout: (fn) => { fn(); return 0; }, // 커밋 재시도 대기를 기다리지 않는다
    location: { href: 'about:blank', pathname: '/' }, // 플랫폼 메인 스크립트의 최상위 코드가 읽는다 (주소가 맞지 않아 감시는 시작하지 않는다)
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
    fetch: async (url, init = {}) => server.route({ url, method: (init.method || 'GET').toUpperCase(), body: init.body ? JSON.parse(init.body) : null }),
    // 플랫폼 util.js / parsing.js 의 DOM 쪽 함수
    markUploadedCSS: (branches, directory) => { calls.uploaded.push(directory); },
    markUploadFailedCSS: () => { calls.failed += 1; },
    startUpload: () => ({}),
    findUsername: () => null,
    checkEnable: async () => true,
  };
  sandbox.window = sandbox; // js-sha1 이 window 에 sha1 을 건다
  vm.createContext(sandbox);
  const files = ['library/sha1.min.js', 'scripts/util.js', 'scripts/Github.js', 'scripts/storage.js', 'scripts/utils/solutionVersions.js',
    `scripts/${info.dir}/uploadfunctions.js`, `scripts/${info.dir}/${info.main}`];
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  return { sandbox, store, calls, info };
}

/** 플랫폼의 beginUpload 가 받는 파싱 결과 모양 */
function solved(platform, code, overrides = {}) {
  const { directory, fileName } = PLATFORMS[platform];
  return {
    problemId: '1000', examId: '1', quizNumber: '1', message: 'commit message', readme: '# readme\n', directory, fileName, code, ...overrides,
  };
}

async function settle() {
  for (let i = 0; i < 30; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

/** 플랫폼의 beginUpload 를 실제로 태운다 */
async function submit(loaded, platform, code, overrides) {
  await loaded.sandbox.beginUpload(solved(platform, code, overrides), platform === 'programmers' || platform === 'goormlevel' ? {} : undefined);
  await settle();
}

module.exports = { FakeGithub, loadPlatform, solved, submit, settle, blobSha, PLATFORMS, HOOK, API, VERSION };
