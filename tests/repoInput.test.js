'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parseRepoInput } = require('../scripts/utils/repoInput.js');

test('GitHub 주소, owner/repo, 이름만 입력한 경우를 owner/repo 로 바꾼다', () => {
  const cases = [
    ['https://github.com/my-org/algo', 'me', 'my-org/algo'],
    ['https://github.com/my-org/algo.git', 'me', 'my-org/algo'],
    ['https://github.com/my-org/algo/tree/main/백준?tab=x#readme', 'me', 'my-org/algo'],
    ['github.com/my-org/algo', 'me', 'my-org/algo'],
    ['my-org/algo.v2', 'me', 'my-org/algo.v2'],
    ['algo', 'me', 'me/algo'],
    ['  my-org/algo  ', 'me', 'my-org/algo'],
  ];
  for (const [input, username, expected] of cases) {
    assert.equal(parseRepoInput(input, username), expected, input);
  }
});

test('저장소로 볼 수 없는 입력은 null', () => {
  for (const input of ['', '   ', '<img src=x onerror=alert(1)>', 'a/b/c', 'my org/algo', 'me/al go', 'me/..', '/algo']) {
    assert.equal(parseRepoInput(input, 'me'), null, input);
  }
  assert.equal(parseRepoInput('algo', null), null, '이름만 입력했는데 사용자 이름이 없으면 null');
  assert.equal(parseRepoInput('algo', undefined), null);
});
