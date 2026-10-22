const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../scripts/swexpertacademy/parsing.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context);

function element(text, attrs = {}) {
  return { textContent: text, getAttribute: (name) => attrs[name] || null };
}
function card(id, title, level, contestId) {
  const fields = {
    '.week_text a[onclick*="fn_move_prob"]': element(title, { onclick: `fn_move_prob('${contestId}','N','CODE')` }),
    '.week_num': element(`${id}.`),
    '.badge': element(level),
  };
  return { querySelector: (selector) => fields[selector] || null };
}

test('SWEA 카드형 제출 목록에서 문제 정보와 영숫자 contestProbId를 읽는다', () => {
  const cards = [card(1989, '초심자의 회문 검사', 'D2', 'AV5PyTLqAf4DFAUq'), card(1859, '백만 장자 프로젝트', 'D2', 'AV5LrsUaDxcDFAXc')];
  const root = { querySelectorAll: (selector) => selector === '#submitProb .widget-box-sub' ? cards : [] };
  const result = context.parseSolvedProblemCardsSWEA(root);
  assert.equal(result.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(result[0])), {
    problemId: '1989', contestProbId: 'AV5PyTLqAf4DFAUq', title: '초심자의 회문 검사', level: 'D2',
  });
});

test('SWEA 제출 이력에서 다른 사람의 Pass를 건너뛰고 내 Pass만 고른다', () => {
  function submission(name, result) {
    const fields = { '.club_name .name': element(name), '.info .txt-success': result === 'Pass' ? element(result) : null };
    return { querySelector: (selector) => fields[selector] || null };
  }
  const cards = [submission('other', 'Pass'), submission('my-user', 'Fail'), submission('my-user', 'Pass')];
  const root = { querySelectorAll: () => cards };
  assert.equal(context.findMyPassedSubmissionSWEA(root, 'my-user'), cards[2]);
});

test('전체 업로드 버튼은 SWEA 검색 폼을 제출하지 않는다', () => {
  const util = fs.readFileSync(path.join(__dirname, '../scripts/swexpertacademy/util.js'), 'utf8');
  assert.match(util, /btn\.type = 'button'/);
  assert.match(util, /event\.preventDefault\(\)/);
});

test('자동 업로드는 SWEA 코드 저장이 끝난 뒤 파싱을 시작한다', async () => {
  let finishSave;
  let saved = false;
  const storage = vm.createContext({
    chrome: { runtime: { id: 'active' } },
    getObjectFromLocalStorage: async () => ({}),
    saveObjectInLocalStorage: () => new Promise((resolve) => { finishSave = () => { saved = true; resolve(); }; }),
    isNull: (value) => value == null,
    log: () => {},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../scripts/swexpertacademy/storage.js'), 'utf8'), storage);
  const promise = storage.updateProblemData('1859', { code: 'class Solution {}', contestProbId: 'abc' });
  let completed = false;
  promise.then(() => { completed = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(completed, false);
  finishSave();
  await promise;
  assert.equal(saved, true);
  assert.equal(completed, true);
});
