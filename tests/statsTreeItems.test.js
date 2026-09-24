'use strict';

// 업로드 후 submission 캐시 갱신 검증 (e686e20 회귀).
// createTree 응답의 tree 는 루트 한 단계 목록이라, 그것으로 캐시를 갱신하면 최상위 폴더 노드가
// tree SHA 문자열로 덮여 레포 캐시 전체가 무너졌다(2026-09-23 E2E 에서 구름 업로드 직후 확인).
// storage.js 는 chrome.* 스텁을 넣은 vm 에 원문을 로드하고, blob SHA 는 실제 번들과 같게
// library/sha1.min.js + scripts/util.js 의 calculateBlobSHA 를 그대로 쓴다.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { normalizePath } = require('../scripts/utils/pathNormalize.js');

const ROOT = path.join(__dirname, '..');
const HOOK = 'tester/algorithm';
const isNullish = (value) => value === null || value === undefined;

/**
 * @param {Map<string, any>} [store] - 주면 chrome.storage.local 을 이 Map 으로 흉내 낸다(값은 JSON 으로 복제해
 *   실제 storage 처럼 읽을 때마다 새 객체가 나온다). 없으면 get/set 이 아무 일도 하지 않는다.
 */
function loadStorageJs(store = null) {
  const noop = () => {};
  const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
  const local = isNullish(store)
    ? { get: noop, set: noop }
    : {
        get: (key, cb) => setImmediate(() => cb({ [key]: clone(store.get(key)) })),
        set: (obj, cb) => setImmediate(() => { for (const [k, v] of Object.entries(obj)) store.set(k, clone(v)); if (cb) cb(); }),
      };
  // storage.js 는 로드될 때 sync→local 동기화와 stats 기본값 저장을 한다. 동기화는 끝난 것으로 둔다.
  if (!isNullish(store) && !store.has('isSync')) store.set('isSync', true);
  const sandbox = {
    console,
    TextEncoder,
    btoa,
    chrome: {
      runtime: { getManifest: () => ({ version: '1.4.20' }) },
      storage: {
        local,
        sync: { get: noop, set: noop },
      },
    },
    normalizePath,
    log: noop,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'library', 'sha1.min.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'scripts', 'util.js'), 'utf8'), sandbox, { filename: 'util.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'scripts', 'storage.js'), 'utf8'), sandbox, { filename: 'storage.js' });
  return sandbox;
}

/** storage.js 가 로드될 때 시작한 비동기 초기화(stats 기본값 저장)가 끝나기를 기다린다 */
async function settle() {
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

/** git hash-object 와 같은 방식으로 계산한 blob SHA (독립 구현) */
function gitBlobSHA(content) {
  const body = Buffer.from(content, 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${body.length}\0`), body])).digest('hex');
}

/** 무너지기 전의 정상 캐시: 다른 플랫폼 폴더가 이미 기록되어 있다 */
function existingSubmission(sandbox) {
  const submission = {};
  sandbox.updateObjectDatafromPath(submission, `${HOOK}/백준/Bronze/1000. A＋B/A＋B.py`, 'sha-boj');
  sandbox.updateObjectDatafromPath(submission, `${HOOK}/프로그래머스/1/12906. 같은 숫자는 싫어/같은 숫자는 싫어.cpp`, 'sha-prog');
  return submission;
}

describe('recordTreeItemsInStats — 업로드한 항목만 캐시에 기록', () => {
  test('createBlob 항목은 GitHub 가 준 sha 로 중첩 경로에 기록된다', () => {
    const sandbox = loadStorageJs();
    const submission = existingSubmission(sandbox);
    const dir = 'goormlevel/173089/1. 정수의 길이';
    sandbox.recordTreeItemsInStats(submission, HOOK, [
      { path: `${dir}/정수의 길이.cc`, sha: 'sha-code', mode: '100644', type: 'blob' },
      { path: `${dir}/README.md`, sha: 'sha-readme', mode: '100644', type: 'blob' },
    ]);
    assert.equal(sandbox.getObjectDatafromPath(submission, `${HOOK}/${dir}/정수의 길이.cc`), 'sha-code');
    assert.equal(sandbox.getObjectDatafromPath(submission, `${HOOK}/${dir}/README.md`), 'sha-readme');
  });

  test('다른 플랫폼 폴더의 캐시는 그대로 남는다 (e686e20 회귀)', () => {
    const sandbox = loadStorageJs();
    const submission = existingSubmission(sandbox);
    sandbox.recordTreeItemsInStats(submission, HOOK, [
      { path: 'goormlevel/1/1. 제목/제목.cc', sha: 'sha-code', mode: '100644', type: 'blob' },
    ]);
    assert.equal(sandbox.getObjectDatafromPath(submission, `${HOOK}/백준/Bronze/1000. A＋B/A＋B.py`), 'sha-boj');
    assert.equal(sandbox.getObjectDatafromPath(submission, `${HOOK}/프로그래머스/1/12906. 같은 숫자는 싫어/같은 숫자는 싫어.cpp`), 'sha-prog');
  });

  test('content 로 넣은 항목(전체 업로드)은 git blob SHA 를 계산해 기록한다', () => {
    const sandbox = loadStorageJs();
    const codes = [
      '# 한글 주석\nprint("정답")\n',
      'int main() {\r\n  return 0;\r\n}\r\n',
      '﻿public class Main {}\n',
      '// emoji \u{1F600} 4byte\n',
      '',
      // 외톨이 서러게이트: 업로드 경로(createTree/createBlob)가 U+FFFD 로 정규화해 보내므로 그 바이트의 SHA 여야 한다
      'a\uD800b\n',
    ];
    for (const code of codes) {
      const submission = {};
      sandbox.recordTreeItemsInStats(submission, HOOK, [
        { path: '백준/Bronze/1000. A＋B/A＋B.py', mode: '100644', type: 'blob', content: code },
      ]);
      const recorded = sandbox.getObjectDatafromPath(submission, `${HOOK}/백준/Bronze/1000. A＋B/A＋B.py`);
      assert.equal(recorded, gitBlobSHA(code), `업로드 후 같은 코드를 다시 내면 캐시 비교로 스킵되어야 한다: ${JSON.stringify(code)}`);
    }
  });

  test('sha 도 content 도 없는 항목은 건너뛴다', () => {
    const sandbox = loadStorageJs();
    const submission = {};
    sandbox.recordTreeItemsInStats(submission, HOOK, [{ path: 'a/b.py', mode: '100644', type: 'blob', sha: null }]);
    assert.equal(sandbox.getObjectDatafromPath(submission, `${HOOK}/a/b.py`), null);
  });

  test('파일이 아닌 tree 항목은 기록하지 않는다 (폴더 노드를 문자열로 덮지 않음)', () => {
    const sandbox = loadStorageJs();
    const submission = existingSubmission(sandbox);
    sandbox.recordTreeItemsInStats(submission, HOOK, [{ path: '백준', mode: '040000', type: 'tree', sha: 'tree-sha' }]);
    assert.equal(sandbox.getObjectDatafromPath(submission, `${HOOK}/백준/Bronze/1000. A＋B/A＋B.py`), 'sha-boj');
  });

  test('이미 무너진 캐시에서 경로 조회가 sha 문자열의 글자를 집어오지 않는다', () => {
    const sandbox = loadStorageJs();
    const submission = { tester: { algorithm: { 프로그래머스: '16a08716399b003653d3cc4365681bf0fb704b4b' } } };
    assert.equal(sandbox.getObjectDatafromPath(submission, `${HOOK}/프로그래머스/0/0`), null);
  });
});

describe('업로드 함수 소스 가드', () => {
  test('createTree 응답의 tree 를 코드에서 읽지 않는다', () => {
    const files = ['baekjoon', 'goormlevel', 'programmers', 'swexpertacademy'].map((dir) => path.join(ROOT, 'scripts', dir, 'uploadfunctions.js'));
    for (const file of files) {
      // 주석(원인 설명)은 제외하고 코드만 본다. forEach 가 아닌 for...of 나 map 으로 읽어도 걸린다.
      const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      assert.doesNotMatch(code, /\btreeData\.tree\b/, `${path.relative(ROOT, file)}: recordTreeItemsInStats 에 올린 항목을 넘겨야 한다`);
    }
  });
});

describe('recordUploadInStats — 저장 직전에 다시 읽어 다른 탭의 기록을 덮지 않는다', () => {
  test('업로드가 도는 사이 다른 탭이 남긴 캐시가 살아남는다', async () => {
    const store = new Map();
    const sandbox = loadStorageJs(store);
    await settle();
    const initial = { version: '1.4.20', branches: { [HOOK]: 'main' }, submission: existingSubmission(sandbox) };
    store.set('stats', initial);

    // 예전 전체 업로드는 시작할 때 읽은 stats 를 수 분 뒤 통째로 저장해, 그 사이 다른 탭이 올린 문제의 캐시를 지웠다
    const staleAtStart = await sandbox.getStats();
    const otherTab = await sandbox.getStats();
    sandbox.updateObjectDatafromPath(otherTab.submission, `${HOOK}/goormlevel/1/1. 다른 탭/다른 탭.py`, 'sha-other-tab');
    await sandbox.saveStats(otherTab);

    const saved = await sandbox.recordUploadInStats(HOOK, 'main', [
      { path: '프로그래머스/2/2. 이번 업로드/이번 업로드.py', mode: '100644', type: 'blob', sha: 'sha-mine' },
    ]);
    const persisted = store.get('stats');
    const read = (p) => sandbox.getObjectDatafromPath(persisted.submission, `${HOOK}/${p}`);
    assert.equal(read('goormlevel/1/1. 다른 탭/다른 탭.py'), 'sha-other-tab');
    assert.equal(read('프로그래머스/2/2. 이번 업로드/이번 업로드.py'), 'sha-mine');
    assert.equal(read('백준/Bronze/1000. A＋B/A＋B.py'), 'sha-boj');
    assert.equal(persisted.version, '1.4.20');
    assert.equal(sandbox.getObjectDatafromPath(saved.submission, `${HOOK}/goormlevel/1/1. 다른 탭/다른 탭.py`), 'sha-other-tab', '반환값도 저장한 최신 stats 다');
    assert.equal(sandbox.getObjectDatafromPath(staleAtStart.submission, `${HOOK}/goormlevel/1/1. 다른 탭/다른 탭.py`), null);
  });

  test('stats 가 비어 있어도 submission/branches 를 만들어 기록한다', async () => {
    const store = new Map();
    const sandbox = loadStorageJs(store);
    await settle();
    store.delete('stats');
    await sandbox.recordUploadInStats(HOOK, 'master', [{ path: 'a/b.py', mode: '100644', type: 'blob', content: 'x\n' }]);
    const persisted = store.get('stats');
    assert.deepEqual(persisted.branches, { [HOOK]: 'master' });
    assert.equal(sandbox.getObjectDatafromPath(persisted.submission, `${HOOK}/a/b.py`), gitBlobSHA('x\n'));
  });

  test('branch 를 모르면 기존 브랜치 기록을 지우지 않는다', async () => {
    const store = new Map([['stats', { version: '1.4.20', branches: { [HOOK]: 'main' }, submission: {} }]]);
    const sandbox = loadStorageJs(store);
    await settle();
    await sandbox.recordUploadInStats(HOOK, undefined, []);
    assert.deepEqual(store.get('stats').branches, { [HOOK]: 'main' });
  });
});
