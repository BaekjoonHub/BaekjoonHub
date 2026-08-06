'use strict';

// stats.submission 재구축 견고성 검증 (#346 후속).
// storage.js 는 최상단 chrome.* 부작용 때문에 require 불가하므로, chrome 스텁을 넣은 vm 컨텍스트에
// 원문 전체를 로드해 "실제" updateObjectDatafromPath / getObjectDatafromPath 를 실행한다.
// (스텁의 chrome.storage.local.get 은 콜백을 호출하지 않아 최상단 비동기 체인이 조용히 멈춘다.)

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { normalizePath } = require('../scripts/utils/pathNormalize.js');

function loadStorageJs() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'storage.js'), 'utf8');
  const noop = () => {};
  const sandbox = {
    console,
    chrome: {
      storage: {
        local: { get: noop, set: noop },
        sync: { get: noop, set: noop },
      },
    },
    isNull: (v) => v === null || v === undefined,
    normalizePath,
    log: noop,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'storage.js' });
  return sandbox;
}

describe('updateObjectDatafromPath — 파일/디렉토리 키 충돌 견고성', () => {
  test('루트 파일 sha(문자열) 노드를 정규화 수렴 키가 관통해도 크래시 없이 재구축된다 (#346)', () => {
    const { updateObjectDatafromPath } = loadStorageJs();
    const submission = {};
    // git 재귀 트리 순서: 루트 blob 'Python' 이 먼저 문자열 노드로 기록되고,
    // 이어서 'Python3/...' 가 unifyPythonFolder 로 'Python/...' 키에 수렴한다.
    updateObjectDatafromPath(submission, 'owner/repo/Python', 'sha-root-file');
    assert.doesNotThrow(() => {
      updateObjectDatafromPath(submission, 'owner/repo/Python3/백준/1000.제목/제목.py', 'sha-code');
    });
    // 문자열 중간 노드는 디렉토리로 대체되고 깊은 항목이 정상 기록된다
    assert.equal(submission.owner.repo.Python['백준']['1000.제목']['제목.py'], 'sha-code');
  });

  test('더 깊은 위치의 파일/디렉토리 충돌도 동일하게 견딘다', () => {
    const { updateObjectDatafromPath } = loadStorageJs();
    const submission = {};
    updateObjectDatafromPath(submission, 'owner/repo/Python/백준', 'sha-file');
    assert.doesNotThrow(() => {
      updateObjectDatafromPath(submission, 'owner/repo/Python/백준/1000.제목/제목.py', 'sha-code');
    });
    assert.equal(submission.owner.repo.Python['백준']['1000.제목']['제목.py'], 'sha-code');
  });

  test('getObjectDatafromPath 는 문자열 중간 노드를 만나면 크래시 없이 null/undefined 를 반환한다', () => {
    const { updateObjectDatafromPath, getObjectDatafromPath } = loadStorageJs();
    const submission = {};
    updateObjectDatafromPath(submission, 'owner/repo/Python', 'sha-root-file');
    let result;
    assert.doesNotThrow(() => {
      result = getObjectDatafromPath(submission, 'owner/repo/Python3/백준/1000.제목/제목.py');
    });
    assert.ok(result === null || result === undefined);
  });

  test('일반 경로의 기록/조회 동작은 변하지 않는다 (무회귀)', () => {
    const { updateObjectDatafromPath, getObjectDatafromPath } = loadStorageJs();
    const submission = {};
    updateObjectDatafromPath(submission, 'owner/repo/Python/백준/1000.제목/제목.py', 'sha-1');
    updateObjectDatafromPath(submission, 'owner/repo/백준/2000.제목/제목.cpp', 'sha-2');
    assert.equal(getObjectDatafromPath(submission, 'owner/repo/Python3/백준/1000.제목/제목.py'), 'sha-1'); // 수렴 조회
    assert.equal(getObjectDatafromPath(submission, 'owner/repo/백준/2000.제목/제목.cpp'), 'sha-2');
    assert.equal(getObjectDatafromPath(submission, 'owner/repo/백준/9999.없음/x.py'), null);
  });
});
