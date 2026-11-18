'use strict';

// #359 solved.ac API v4 전환.
// background.js 의 SolvedApiCall 은 v4 응답을 content script 와 저장된 캐시(stats.solvedac)가 쓰는
// v3 모양(titleKo, level, tags[].displayNames)으로 바꿔 돌려준다. v4 문제 응답의 태그에는 이름이 없어
// 태그 목록(/tags)을 따로 받는다.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

const PROBLEM = 'https://solvedac.ssafy.today/api/v4/problems/4354';
const TAGS = 'https://solvedac.ssafy.today/api/v4/tags';
// 실제 v4 응답에서 쓰는 필드만 남긴 것
const RESPONSES = {
  [PROBLEM]: {
    problemId: 4354,
    level: 16,
    titles: [
      { language: 'en', title: 'Power Strings', isOriginal: true },
      { language: 'ko', title: '문자열 제곱', isOriginal: false },
    ],
    tags: [{ id: 40, key: 'kmp', isMeta: false }, { id: 158, key: 'string', isMeta: false }],
  },
  [TAGS]: {
    tags: [
      { key: 'kmp', names: { ko: 'KMP', en: 'kmp' } },
      { key: 'string', names: { ko: '문자열', en: 'string' } },
    ],
  },
};

/** background.js 를 가짜 fetch 와 함께 로드한다. responses: 주소 → 응답 본문 (없는 주소는 404) */
function loadBackground(responses) {
  const requests = [];
  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: (fn) => { fn(); return 0; }, // 재시도 대기를 기다리지 않는다
    chrome: { runtime: { onMessage: { addListener: () => {} } } },
    fetch: async (url) => {
      requests.push(url);
      const body = responses[url];
      return { status: body ? 200 : 404, ok: Boolean(body), headers: { get: () => null }, json: async () => body };
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'scripts/background.js'), 'utf8'), sandbox, { filename: 'scripts/background.js' });
  return { sandbox, requests };
}

test('v4 응답을 content script 가 읽는 모양(titleKo, level, 한국어 태그 이름)으로 돌려준다', async () => {
  const { sandbox, requests } = loadBackground(RESPONSES);
  const solved = await sandbox.SolvedApiCall(4354);
  assert.equal(solved.titleKo, '문자열 제곱');
  assert.equal(solved.level, 16);
  // parsing.js 의 findProblemInfoAndSubmissionCode 가 태그를 읽는 식 그대로
  const tags = solved.tags.flatMap((tag) => tag.displayNames).filter((tag) => tag.language === 'ko').map((tag) => tag.name);
  assert.deepEqual([...tags], ['KMP', '문자열']);

  await sandbox.SolvedApiCall(4354);
  assert.deepEqual(requests, [PROBLEM, TAGS, PROBLEM], '태그 목록은 한 번만 받는다');

  // 서비스 워커의 fetch 는 host_permissions 에 있는 주소만 CORS 없이 읽을 수 있다
  const allowed = manifest.host_permissions.map((pattern) => pattern.replace(/\*$/, ''));
  for (const url of requests) assert.ok(allowed.some((prefix) => url.startsWith(prefix)), `${url} 이 host_permissions 에 없다`);
});

test('한국어 제목이 없으면 원제를, 이름을 모르는 태그는 key 를 쓴다', async () => {
  const { sandbox } = loadBackground({
    [PROBLEM]: { problemId: 4354, level: 0, titles: [{ language: 'en', title: 'Power Strings', isOriginal: true }], tags: [{ key: 'kmp' }] },
  }); // 태그 목록 요청은 실패한다
  const solved = await sandbox.SolvedApiCall(4354);
  assert.equal(solved.titleKo, 'Power Strings');
  assert.equal(solved.level, 0);
  assert.equal(solved.tags[0].displayNames[0].name, 'kmp');
});

test('문제 요청이 실패하면 null 을 돌려준다 (업로드는 기본값으로 계속된다)', async () => {
  const { sandbox } = loadBackground({});
  assert.equal(await sandbox.SolvedApiCall(4354), null);
});
