'use strict';

// #346 언어 폴더 마이그레이션 순수 플래너 검증.
// 글루(runLanguageFolderMigrationIfNeeded)는 chrome.*/GitHub 의존이라 Node 로 실행 불가하며,
// 여기서는 커밋 내용을 결정하는 planLanguageFolderMigration 과
// 완료 플래그 조건(isMigrationComplete)의 계획 정확성을 고정한다.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { planLanguageFolderMigration, isMigrationComplete } = require('../scripts/utils/languageMigration.js');

const U = String.fromCodePoint(0x2005); // 제목 단어 구분자(FOUR-PER-EM SPACE)

const blob = (path, sha = 'sha-' + path, mode = '100644') => ({ path, sha, mode, type: 'blob' });
const treeDir = (path) => ({ path, sha: 'tree-' + path, mode: '040000', type: 'tree' });

describe('planLanguageFolderMigration — 이동 계획', () => {
  test('Python3/·PyPy3/ 최상위 폴더의 blob 을 Python/ 으로 이동(+구 경로 삭제)', () => {
    const items = [
      blob(`Python3/프로그래머스/1/131112.${U}제목/제목.py`),
      blob(`PyPy3/백준/1000.${U}제목/제목.py`),
    ];
    const { treeEntries, moved, merged, blocked } = planLanguageFolderMigration(items);
    assert.equal(moved.length, 2);
    assert.equal(merged.length, 0);
    assert.equal(blocked.length, 0);
    assert.deepEqual(treeEntries, [
      { path: `Python/프로그래머스/1/131112.${U}제목/제목.py`, mode: '100644', type: 'blob', sha: items[0].sha },
      { path: `Python3/프로그래머스/1/131112.${U}제목/제목.py`, mode: '100644', type: 'blob', sha: null },
      { path: `Python/백준/1000.${U}제목/제목.py`, mode: '100644', type: 'blob', sha: items[1].sha },
      { path: `PyPy3/백준/1000.${U}제목/제목.py`, mode: '100644', type: 'blob', sha: null },
    ]);
  });

  test('폴더명 표기 변형이 모두 이동 대상 — 공백/U+2005/대소문자/버전 (normalizeLanguageName 판정 재사용)', () => {
    const tops = ['Python 3', `Python${U}3`, 'python3', 'PYTHON3', 'PYTHON', 'python', 'Python2', 'pypy', 'PyPy2'];
    for (const top of tops) {
      const { moved, treeEntries } = planLanguageFolderMigration([blob(`${top}/백준/1000.제목/제목.py`)]);
      assert.equal(moved.length, 1, `'${top}/' 폴더는 이동 대상이어야 함`);
      assert.equal(treeEntries[0].path, 'Python/백준/1000.제목/제목.py');
    }
  });

  test('표준형 top 세그먼트 "Python" 정확일치만 제외된다 (/i 정규식과의 상호작용 회귀 가드)', () => {
    const canonical = planLanguageFolderMigration([blob('Python/백준/1000.제목/제목.py')]);
    assert.equal(canonical.treeEntries.length, 0);
    const lower = planLanguageFolderMigration([blob('python/백준/1000.제목/제목.py')]);
    assert.equal(lower.moved.length, 1); // 소문자 'python' 은 표준형이 아니므로 이동
  });

  test('blob 의 mode 를 보존한다', () => {
    const { treeEntries } = planLanguageFolderMigration([blob('Python3/백준/run.sh', 'abc', '100755')]);
    assert.equal(treeEntries[0].mode, '100755');
    assert.equal(treeEntries[1].mode, '100755');
  });
});

describe('planLanguageFolderMigration — 비대상 보존', () => {
  test('비파이썬 언어·플랫폼 폴더, 최상위 파일, tree 항목, 파이썬 유사 이름은 건드리지 않음', () => {
    const plan = planLanguageFolderMigration([
      blob('Java/백준/1000.제목/제목.java'),
      blob('MySQL/프로그래머스/131112.제목/제목.sql'),
      blob('백준/Gold/1000.제목/제목.py'),
      blob('README.md'),
      blob('Python3'), // 루트에 있는 'Python3' 이름의 파일 — 폴더가 아니므로 비대상
      blob('Python3풀이/백준/1000.제목/제목.py'), // 세그먼트 전체가 파이썬 표기가 아님
      blob('Python&nbsp;3/백준/1000.제목/제목.py'), // NBSP 엔티티 표기 — 현행 한계(비대상) 명시
      treeDir('Python3'), // tree 항목은 blob 이동으로 자연 정리되므로 계획에서 제외
    ]);
    assert.deepEqual(plan, { treeEntries: [], moved: [], merged: [], blocked: [] });
    assert.equal(isMigrationComplete(plan), true);
  });

  test('빈 트리/비배열 입력에도 빈 계획을 반환하며 완료로 판정된다', () => {
    for (const input of [[], null, undefined]) {
      const plan = planLanguageFolderMigration(input);
      assert.deepEqual(plan, { treeEntries: [], moved: [], merged: [], blocked: [] });
      assert.equal(isMigrationComplete(plan), true);
    }
  });
});

describe('planLanguageFolderMigration — 충돌 병합', () => {
  test('표준 경로에 같은 파일이 이미 있으면 구 사본을 삭제해 병합한다 (표준 파일 유지)', () => {
    const { treeEntries, moved, merged } = planLanguageFolderMigration([
      blob('Python3/프로그래머스/1/131112.제목/제목.py', 'old-sha'),
      blob('Python/프로그래머스/1/131112.제목/제목.py', 'new-sha'),
    ]);
    assert.equal(moved.length, 0);
    assert.deepEqual(merged, ['Python3/프로그래머스/1/131112.제목/제목.py']);
    // 삭제 1건만 — 표준 경로(new-sha)는 건드리지 않는다
    assert.deepEqual(treeEntries, [
      { path: 'Python3/프로그래머스/1/131112.제목/제목.py', mode: '100644', type: 'blob', sha: null },
    ]);
  });

  test('여러 구 폴더가 같은 표준 경로를 노리면 CPython 계열이 우선 이동하고 나머지는 병합 삭제', () => {
    // git 트리는 경로 오름차순이라 PyPy3 가 Python3 보다 먼저 오지만, 우선순위 정렬로 Python3 이 이긴다
    const { treeEntries, moved, merged } = planLanguageFolderMigration([
      blob('PyPy3/백준/1000.제목/제목.py', 'sha-pypy'),
      blob('Python3/백준/1000.제목/제목.py', 'sha-cpython'),
    ]);
    assert.deepEqual(moved, ['Python3/백준/1000.제목/제목.py']);
    assert.deepEqual(merged, ['PyPy3/백준/1000.제목/제목.py']);
    const added = treeEntries.find((e) => e.path === 'Python/백준/1000.제목/제목.py');
    assert.equal(added.sha, 'sha-cpython');
    // 구 경로 2곳 모두 삭제 — 병합 후 구 폴더는 완전히 빈다
    assert.equal(treeEntries.filter((e) => e.sha === null).length, 2);
  });

  test('부분집합 목적지: 충돌 파일은 병합 삭제, 나머지는 이동 — 반쪽 폴더가 남지 않는다', () => {
    // 구 폴더에 코드+README+예제, 표준 폴더에 코드+README 만 있는 경우(#346 이후 재제출로 생김)
    const { moved, merged, treeEntries } = planLanguageFolderMigration([
      blob('Python3/백준/1000.A/A.py'),
      blob('Python3/백준/1000.A/README.md'),
      blob('Python3/백준/1000.A/input1.txt'),
      blob('Python/백준/1000.A/A.py'),
      blob('Python/백준/1000.A/README.md'),
    ]);
    assert.deepEqual(moved, ['Python3/백준/1000.A/input1.txt']);
    assert.deepEqual(merged.sort(), ['Python3/백준/1000.A/A.py', 'Python3/백준/1000.A/README.md']);
    // 구 폴더의 blob 3개 전부 삭제 항목이 존재 → Python3/ 는 완전히 사라진다
    const deletions = treeEntries.filter((e) => e.sha === null).map((e) => e.path).sort();
    assert.deepEqual(deletions, [
      'Python3/백준/1000.A/A.py',
      'Python3/백준/1000.A/README.md',
      'Python3/백준/1000.A/input1.txt',
    ]);
  });
});

describe('planLanguageFolderMigration — 조상 blob 충돌 보류', () => {
  test("루트에 'Python' 이름의 파일이 있으면 이동을 보류하고 아무것도 삭제하지 않는다", () => {
    const plan = planLanguageFolderMigration([
      blob('Python'), // 루트 파일 — 'Python/' 트리를 만들 수 없다
      blob('Python3/백준/1000.제목/제목.py'),
    ]);
    assert.deepEqual(plan.blocked, ['Python3/백준/1000.제목/제목.py']);
    assert.equal(plan.treeEntries.length, 0);
    assert.equal(isMigrationComplete(plan), false); // 보류 상태에서는 완료 플래그를 기록하지 않는다
  });

  test('깊은 조상이 파일인 항목만 보류되고 나머지는 정상 이동한다', () => {
    const plan = planLanguageFolderMigration([
      blob('Python/백준'), // 'Python/백준' 이 파일 — 그 아래로는 배치 불가
      blob('Python3/백준/1000.제목/제목.py'),
      blob('Python3/프로그래머스/1.제목/제목.py'),
    ]);
    assert.deepEqual(plan.blocked, ['Python3/백준/1000.제목/제목.py']);
    assert.deepEqual(plan.moved, ['Python3/프로그래머스/1.제목/제목.py']);
  });

  test('역방향: 구 폴더 바로 아래의 "파일" 목적지가 표준 폴더의 디렉토리 자리면 보류한다', () => {
    // 'Python3/백준' 이 파일인데 목적지 'Python/백준' 은 표준 폴더에서 디렉토리 — blob/tree 충돌
    const plan = planLanguageFolderMigration([
      blob('Python3/백준'), // depth-1 파일 (수기 생성 등)
      blob('Python/백준/1000.A/A.py'),
    ]);
    assert.deepEqual(plan.blocked, ['Python3/백준']);
    assert.equal(plan.treeEntries.length, 0); // 삭제도 하지 않는다
    assert.equal(isMigrationComplete(plan), false);
  });

  test('이번 커밋 내 상호 충돌: 같은 자리를 파일과 디렉토리로 동시에 쓰는 계획을 만들지 않는다', () => {
    // 'Python3/백준'(파일) 의 목적지 'Python/백준' 과 'PyPy3/백준/1000.A/A.py' 의 목적지가 충돌.
    // CPython 우선순위로 파일이 먼저 자리를 차지하고 깊은 항목은 보류된다.
    const plan = planLanguageFolderMigration([
      blob('Python3/백준'),
      blob('PyPy3/백준/1000.A/A.py'),
    ]);
    assert.deepEqual(plan.moved, ['Python3/백준']);
    assert.deepEqual(plan.blocked, ['PyPy3/백준/1000.A/A.py']);
    // 계획된 트리 항목들이 유효한 git 트리인지 — 신규 경로가 서로의 조상이 아니어야 한다
    const added = plan.treeEntries.filter((e) => e.sha !== null).map((e) => e.path);
    for (const a of added) for (const b of added) {
      if (a !== b) assert.ok(!b.startsWith(`${a}/`), `${a} 는 ${b} 의 조상이면 안 됨`);
    }
  });

  test('이번 커밋 내 상호 충돌(역순): 깊은 항목이 먼저 자리를 차지하면 파일 항목이 보류된다', () => {
    // 트리 정렬상 'Python2/...'(깊은 항목)가 'Python3/백준'(파일)보다 먼저 처리되는 경우
    const plan = planLanguageFolderMigration([
      blob('Python2/백준/1000.A/A.py'),
      blob('Python3/백준'),
    ]);
    assert.deepEqual(plan.moved, ['Python2/백준/1000.A/A.py']);
    assert.deepEqual(plan.blocked, ['Python3/백준']);
  });
});

describe('isMigrationComplete — 완료 플래그 조건', () => {
  test('이동/병합이 남아 있으면 미완료, 빈 계획은 완료', () => {
    assert.equal(isMigrationComplete({ treeEntries: [{}], moved: ['x'], merged: [], blocked: [] }), false);
    assert.equal(isMigrationComplete({ treeEntries: [], moved: [], merged: [], blocked: [] }), true);
  });
});
