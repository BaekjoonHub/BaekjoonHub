'use strict';

// #346 언어 폴더 마이그레이션 순수 플래너 검증.
// 글루(runLanguageFolderMigrationIfNeeded)는 chrome.*/GitHub 의존이라 Node 로 실행 불가하며,
// 여기서는 커밋 내용을 결정하는 planLanguageFolderMigration 과
// 완료 플래그 조건(isMigrationComplete)의 계획 정확성을 고정한다.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { planLanguageFolderMigration, isMigrationComplete } = require('../scripts/utils/languageMigration.js');

const U = String.fromCodePoint(0x2005); // 제목 단어 구분자(FOUR-PER-EM SPACE)

const blob = (path, sha = 'sha-' + path, mode = '100644') => ({ path, sha, mode, type: 'blob' });
const treeDir = (path) => ({ path, sha: 'tree-' + path, mode: '040000', type: 'tree' });

test('Python3/·PyPy3/ 최상위 폴더의 blob 을 mode 를 지켜 Python/ 으로 이동(+구 경로 삭제)', () => {
  const items = [
    blob(`Python3/프로그래머스/1/131112.${U}제목/제목.py`),
    blob(`PyPy3/백준/1000.${U}제목/run.sh`, 'sha-run', '100755'),
  ];
  const plan = planLanguageFolderMigration(items);
  assert.equal(plan.moved.length, 2);
  assert.equal(plan.merged.length, 0);
  assert.equal(plan.blocked.length, 0);
  assert.deepEqual(plan.treeEntries, [
    { path: `Python/프로그래머스/1/131112.${U}제목/제목.py`, mode: '100644', type: 'blob', sha: items[0].sha },
    { path: `Python3/프로그래머스/1/131112.${U}제목/제목.py`, mode: '100644', type: 'blob', sha: null },
    { path: `Python/백준/1000.${U}제목/run.sh`, mode: '100755', type: 'blob', sha: 'sha-run' },
    { path: `PyPy3/백준/1000.${U}제목/run.sh`, mode: '100755', type: 'blob', sha: null },
  ]);
  assert.equal(isMigrationComplete(plan), false, '이동이 남아 있으면 미완료');
});

test('폴더명 표기 변형이 모두 이동 대상 — 공백/U+2005/대소문자/버전 (normalizeLanguageName 판정 재사용)', () => {
  const tops = ['Python 3', `Python${U}3`, 'python3', 'PYTHON3', 'PYTHON', 'python', 'Python2', 'pypy', 'PyPy2'];
  for (const top of tops) {
    const { moved, treeEntries } = planLanguageFolderMigration([blob(`${top}/백준/1000.제목/제목.py`)]);
    assert.equal(moved.length, 1, `'${top}/' 폴더는 이동 대상이어야 함`);
    assert.equal(treeEntries[0].path, 'Python/백준/1000.제목/제목.py');
  }
});

test('표준 폴더 Python, 비파이썬 언어·플랫폼 폴더, 최상위 파일, tree 항목, 파이썬 유사 이름은 건드리지 않음', () => {
  const plan = planLanguageFolderMigration([
    blob('Python/백준/1000.제목/제목.py'), // 표준형 top 세그먼트 "Python" 정확일치 (/i 정규식과의 상호작용 회귀 가드)
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

test('부분집합 목적지: 충돌 파일은 병합 삭제(표준 파일 유지), 나머지는 이동 — 반쪽 폴더가 남지 않는다', () => {
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
  // 표준 경로의 기존 파일은 건드리지 않고, 새로 생기는 것은 옮긴 파일뿐이다
  assert.deepEqual(treeEntries.filter((e) => e.sha !== null).map((e) => e.path), ['Python/백준/1000.A/input1.txt']);
  // 구 폴더의 blob 3개 전부 삭제 항목이 존재 → Python3/ 는 완전히 사라진다
  const deletions = treeEntries.filter((e) => e.sha === null).map((e) => e.path).sort();
  assert.deepEqual(deletions, [
    'Python3/백준/1000.A/A.py',
    'Python3/백준/1000.A/README.md',
    'Python3/백준/1000.A/input1.txt',
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

test('파일/디렉토리 자리가 충돌하는 항목은 보류하고 지우지 않으며, 계획은 유효한 git 트리다', () => {
  for (const [label, items, moved, blocked] of [
    ["루트에 'Python' 이름의 파일", [blob('Python'), blob('Python3/백준/1000.제목/제목.py')], [], ['Python3/백준/1000.제목/제목.py']],
    ['깊은 조상이 파일인 항목만 보류', [blob('Python/백준'), blob('Python3/백준/1000.제목/제목.py'), blob('Python3/프로그래머스/1.제목/제목.py')],
      ['Python3/프로그래머스/1.제목/제목.py'], ['Python3/백준/1000.제목/제목.py']],
    // 'Python3/백준' 이 파일인데 목적지 'Python/백준' 은 표준 폴더에서 디렉토리
    ['역방향: 파일 목적지가 표준 폴더의 디렉토리 자리', [blob('Python3/백준'), blob('Python/백준/1000.A/A.py')], [], ['Python3/백준']],
    // CPython 우선순위로 파일이 먼저 자리를 차지하고 깊은 항목은 보류된다
    ['이번 커밋 내 상호 충돌', [blob('Python3/백준'), blob('PyPy3/백준/1000.A/A.py')], ['Python3/백준'], ['PyPy3/백준/1000.A/A.py']],
    // 트리 정렬상 'Python2/...'(깊은 항목)가 'Python3/백준'(파일)보다 먼저 처리되는 경우
    ['이번 커밋 내 상호 충돌(역순)', [blob('Python2/백준/1000.A/A.py'), blob('Python3/백준')], ['Python2/백준/1000.A/A.py'], ['Python3/백준']],
  ]) {
    const plan = planLanguageFolderMigration(items);
    assert.deepEqual(plan.moved, moved, label);
    assert.deepEqual(plan.blocked, blocked, label);
    assert.equal(isMigrationComplete(plan), false, `${label}: 보류 상태에서는 완료 플래그를 기록하지 않는다`);
    if (moved.length === 0) assert.equal(plan.treeEntries.length, 0, `${label}: 아무것도 삭제하지 않는다`);
    for (const path of blocked) assert.ok(!plan.treeEntries.some((e) => e.path === path), `${label}: 보류한 ${path} 는 삭제하지 않는다`);
    // 신규 경로가 서로의 조상이 아니어야 한다
    const added = plan.treeEntries.filter((e) => e.sha !== null).map((e) => e.path);
    for (const a of added) for (const b of added) assert.ok(!b.startsWith(`${a}/`), `${label}: ${a} 는 ${b} 의 조상이면 안 됨`);
  }
});
