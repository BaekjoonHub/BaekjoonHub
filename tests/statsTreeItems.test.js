'use strict';

// 업로드 후 submission 캐시 갱신과 재구축 견고성 검증.
// - e686e20 회귀: createTree 응답의 tree 는 루트 한 단계 목록이라, 그것으로 캐시를 갱신하면 최상위 폴더 노드가
//   tree SHA 문자열로 덮여 레포 캐시 전체가 무너졌다(2026-09-23 E2E 에서 확인).
// - #346: 파일 sha(문자열) 노드를 정규화로 수렴한 디렉토리 키가 관통해도 재구축이 멈추지 않아야 한다.
// storage.js 는 실제 번들과 같이 library/sha1.min.js + scripts/util.js 와 함께 로드하고, 기대 blob SHA 는 따로 계산한다.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { FakeGithub, loadPlatform, settle, HOOK } = require('./helpers/versionHarness.js');

/** 실제 업로드 번들(SWEA)을 메모리 chrome.storage 위에 로드한다 (tests/helpers/versionHarness.js) */
async function load() {
  const loaded = loadPlatform(new FakeGithub(), 'swexpertacademy');
  await settle();
  return loaded;
}

/** git hash-object 와 같은 방식으로 계산한 blob SHA (독립 구현) */
function gitBlobSHA(content) {
  const body = Buffer.from(content, 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${body.length}\0`), body])).digest('hex');
}

const BOJ = '백준/Bronze/1000. A＋B/A＋B.py';
const PROG = '프로그래머스/1/12906. 같은 숫자는 싫어/같은 숫자는 싫어.cpp';

/** 무너지기 전의 정상 캐시: 다른 플랫폼 폴더가 이미 기록되어 있다 */
function existingSubmission(sandbox) {
  const submission = {};
  sandbox.updateObjectDatafromPath(submission, `${HOOK}/${BOJ}`, 'sha-boj');
  sandbox.updateObjectDatafromPath(submission, `${HOOK}/${PROG}`, 'sha-prog');
  return submission;
}

describe('recordTreeItemsInStats — 업로드한 항목만 캐시에 기록', () => {
  test('blob 항목은 중첩 경로에 기록되고, 다른 플랫폼 폴더와 tree 항목이 캐시를 덮지 않는다 (e686e20 회귀)', async () => {
    const { sandbox } = await load();
    const submission = existingSubmission(sandbox);
    const dir = 'SWEA/D3/1234. 정수의 길이';
    sandbox.recordTreeItemsInStats(submission, HOOK, [
      { path: `${dir}/정수의 길이.cc`, sha: 'sha-code', mode: '100644', type: 'blob' },
      { path: `${dir}/README.md`, sha: 'sha-readme', mode: '100644', type: 'blob' },
      { path: '백준', mode: '040000', type: 'tree', sha: 'tree-sha' },
    ]);
    const read = (p) => sandbox.getObjectDatafromPath(submission, `${HOOK}/${p}`);
    assert.equal(read(`${dir}/정수의 길이.cc`), 'sha-code');
    assert.equal(read(`${dir}/README.md`), 'sha-readme');
    assert.equal(read(BOJ), 'sha-boj', 'tree 항목이 폴더 노드를 문자열로 덮으면 안 된다');
    assert.equal(read(PROG), 'sha-prog');
  });

  test('content 로 넣은 항목(전체 업로드)은 git blob SHA 를 계산해 기록한다', async () => {
    const { sandbox } = await load();
    const codes = [
      '# 한글 주석\nprint("정답")\n',
      'int main() {\r\n  return 0;\r\n}\r\n',
      '\uFEFFpublic class Main {}\n',
      '// emoji \u{1F600} 4byte\n',
      '',
      // 외톨이 서러게이트: 업로드 경로(createTree/createBlob)가 U+FFFD 로 정규화해 보내므로 그 바이트의 SHA 여야 한다
      'a\uD800b\n',
    ];
    for (const code of codes) {
      const submission = {};
      sandbox.recordTreeItemsInStats(submission, HOOK, [{ path: BOJ, mode: '100644', type: 'blob', content: code }]);
      assert.equal(sandbox.getObjectDatafromPath(submission, `${HOOK}/${BOJ}`), gitBlobSHA(code), `업로드 후 같은 코드를 다시 내면 캐시 비교로 스킵되어야 한다: ${JSON.stringify(code)}`);
    }
  });
});

describe('updateObjectDatafromPath·getObjectDatafromPath — 파일/디렉토리 키 충돌 (#346)', () => {
  test('문자열(파일 sha) 노드를 디렉토리 키가 관통해도 크래시 없이 디렉토리로 바꿔 기록한다', async () => {
    const { updateObjectDatafromPath } = (await load()).sandbox;
    for (const [label, filePath, deepPath] of [
      // git 재귀 트리 순서: 루트 blob 'Python' 이 먼저 기록되고, 'Python3/...' 가 'Python/...' 키로 수렴한다
      ['루트 파일 + 정규화 수렴 키', 'owner/repo/Python', 'owner/repo/Python3/백준/1000.제목/제목.py'],
      ['더 깊은 위치의 파일', 'owner/repo/Python/백준', 'owner/repo/Python/백준/1000.제목/제목.py'],
    ]) {
      const submission = {};
      updateObjectDatafromPath(submission, filePath, 'sha-file');
      updateObjectDatafromPath(submission, deepPath, 'sha-code');
      assert.equal(submission.owner.repo.Python['백준']['1000.제목']['제목.py'], 'sha-code', label);
    }
  });

  test('이미 무너진 캐시에서 경로 조회가 sha 문자열의 글자를 집어오지 않는다', async () => {
    const { sandbox } = await load();
    const submission = { tester: { algorithm: { 프로그래머스: '16a08716399b003653d3cc4365681bf0fb704b4b' } } };
    assert.equal(sandbox.getObjectDatafromPath(submission, `${HOOK}/프로그래머스/0/0`), null);
  });
});

describe('recordUploadInStats — 저장 직전에 다시 읽어 다른 탭의 기록을 덮지 않는다', () => {
  test('업로드가 도는 사이 다른 탭이 남긴 캐시가 살아남는다', async () => {
    const { sandbox, store } = await load();
    store.set('stats', { version: '1.4.20', branches: { [HOOK]: 'main' }, submission: existingSubmission(sandbox) });

    // 예전 전체 업로드는 시작할 때 읽은 stats 를 수 분 뒤 통째로 저장해, 그 사이 다른 탭이 올린 문제의 캐시를 지웠다
    const staleAtStart = await sandbox.getStats();
    const otherTab = await sandbox.getStats();
    sandbox.updateObjectDatafromPath(otherTab.submission, `${HOOK}/SWEA/D3/1. 다른 탭/다른 탭.py`, 'sha-other-tab');
    await sandbox.saveStats(otherTab);

    const saved = await sandbox.recordUploadInStats(HOOK, 'main', [
      { path: '프로그래머스/2/2. 이번 업로드/이번 업로드.py', mode: '100644', type: 'blob', sha: 'sha-mine' },
    ]);
    const persisted = store.get('stats');
    const read = (p) => sandbox.getObjectDatafromPath(persisted.submission, `${HOOK}/${p}`);
    assert.equal(read('SWEA/D3/1. 다른 탭/다른 탭.py'), 'sha-other-tab');
    assert.equal(read('프로그래머스/2/2. 이번 업로드/이번 업로드.py'), 'sha-mine');
    assert.equal(read(BOJ), 'sha-boj');
    assert.equal(persisted.version, '1.4.20');
    assert.equal(sandbox.getObjectDatafromPath(saved.submission, `${HOOK}/SWEA/D3/1. 다른 탭/다른 탭.py`), 'sha-other-tab', '반환값도 저장한 최신 stats 다');
    assert.equal(sandbox.getObjectDatafromPath(staleAtStart.submission, `${HOOK}/SWEA/D3/1. 다른 탭/다른 탭.py`), null);
  });

  test('stats 가 비어 있어도 submission/branches 를 만들어 기록하고, branch 를 모르면 브랜치 기록을 지우지 않는다', async () => {
    const { sandbox, store } = await load();
    store.delete('stats');
    await sandbox.recordUploadInStats(HOOK, 'master', [{ path: 'a/b.py', mode: '100644', type: 'blob', content: 'x\n' }]);
    assert.deepEqual(store.get('stats').branches, { [HOOK]: 'master' });
    assert.equal(sandbox.getObjectDatafromPath(store.get('stats').submission, `${HOOK}/a/b.py`), gitBlobSHA('x\n'));
    await sandbox.recordUploadInStats(HOOK, undefined, []);
    assert.deepEqual(store.get('stats').branches, { [HOOK]: 'master' });
  });
});
