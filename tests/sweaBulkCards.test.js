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
  let inserted;
  let onClick;
  let uploads = 0;
  let prevented = false;
  const button = { style: {}, addEventListener: (type, listener) => { assert.equal(type, 'click'); onClick = listener; } };
  const ctx = vm.createContext({
    document: {
      querySelector: () => ({ appendChild: (node) => { inserted = node; } }),
      createElement: (tag) => { assert.equal(tag, 'button'); return button; },
    },
    isNull: (value) => value == null,
    confirm: () => true,
    insertMultiLoader() {},
    uploadAllSolvedProblemSWEA: () => { uploads += 1; },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../scripts/swexpertacademy/util.js'), 'utf8'), ctx);
  ctx.insertMultiLoader = () => {};
  ctx.insertUploadAllButton();
  assert.equal(inserted, button);
  assert.equal(button.type, 'button');
  onClick({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(uploads, 1);
});

function listPage(cards, total, pageSize) {
  return {
    querySelectorAll: (selector) => selector === '#submitProb .widget-box-sub' ? cards : [],
    querySelector: (selector) => ({
      'h4.club_box_tit span': element(String(total)),
      'select[name="rowNum"]': { value: String(pageSize) },
    })[selector] || null,
  };
}

function paginationContext(pages, total) {
  const requested = [];
  const ctx = vm.createContext({
    document: listPage(pages[1], total, 2),
    location: new URL('https://swexpertacademy.com/main/userpage/code/userCode.do?userId=test&pageIndex=2'),
    URL, URLSearchParams,
    fetch: async (url) => {
      const params = new URL(url).searchParams;
      requested.push(Number(params.get('pageIndex')));
      assert.equal(params.get('userId'), 'test');
      assert.equal(params.get('rowNum'), '2');
      return { ok: true, text: async () => params.get('pageIndex') };
    },
    DOMParser: class { parseFromString(page) { return listPage(pages[Number(page) - 1], total, 2); } },
  });
  vm.runInContext(source, ctx);
  return { ctx, requested };
}

test('전체 페이지의 카드 수를 먼저 확인하고 Problem Box의 중복 문제를 제거한다', async () => {
  const a = card(1959, '두 개의 숫자열', 'D2', 'abc');
  const b = card(1989, '초심자의 회문 검사', 'D2', 'def');
  const { ctx, requested } = paginationContext([[a, b], [a, a], [b]], 5);
  const result = await ctx.findAllSolvedProblemsSWEA();
  assert.deepEqual(Array.from(result, (item) => item.problemId).sort(), ['1959', '1989']);
  assert.deepEqual(requested, [1, 3]);
});

test('중복 문제를 허용해도 실제로 카드를 덜 읽은 경우에는 실패한다', async () => {
  const a = card(1959, '두 개의 숫자열', 'D2', 'abc');
  const { ctx } = paginationContext([[a, a], [a]], 4);
  await assert.rejects(ctx.findAllSolvedProblemsSWEA(), /4개 중 3개만/);
});

function submissionContext({ passed = true, code = 'a[b[i]]>0', historyStatus = 200, detailStatus = 200 } = {}) {
  const requests = [];
  const errors = [];
  const fields = {
    '.club_name .name': element('my-user'),
    '.info .txt-success': passed ? element('Pass') : null,
    'a[href*="codeview("]': element('', { href: "javascript:codeview('history-123')" }),
  };
  const submission = {
    querySelector: (selector) => fields[selector] || null,
    querySelectorAll: () => ['PYTHON', '62,720  kb', '100 ms', '30'].map((text) => ({ querySelector: () => element(text) })),
  };
  // DOMParser decodes &gt; in <textarea class="brush:cpp">a[b[i]]&gt;0</textarea> into .value.
  const textarea = { value: code, textContent: code };
  const codeWrap = { textContent: code, querySelector: (selector) => selector === 'textarea' ? textarea : null };
  const ctx = vm.createContext({
    URLSearchParams,
    location: { origin: 'https://swexpertacademy.com' },
    console: { error: (...args) => errors.push(args) },
    getNickname: () => 'my-user',
    languages: {}, resolveLanguageExtension: () => 'py',
    fetch: async (url, options) => {
      requests.push({ url, options });
      const history = url.endsWith('problemSubmitHistory.do');
      const status = history ? historyStatus : detailStatus;
      return { ok: status === 200, status, text: async () => history ? 'history' : 'detail' };
    },
    DOMParser: class {
      parseFromString(html) {
        return html === 'history'
          ? { querySelectorAll: () => [submission] }
          : { querySelector: (selector) => selector === '.code_wrap' ? codeWrap : null };
      }
    },
  });
  vm.runInContext(source, ctx);
  ctx.makeDataForBulkUploadSWEA = async (data) => data;
  return { ctx, requests, errors };
}

const problem = { problemId: '1959', contestProbId: 'abc', title: '두 개의 숫자열', level: 'D2' };

test('상세 textarea의 중첩 인덱스, CDATA 모양의 문자열과 공백을 원문 그대로 보존한다', async () => {
  const code = '  if a[b[i]]>0:\n    print("<![CDATA[test]]>")\n';
  const { ctx, requests } = submissionContext({ code });
  const result = await ctx.fetchSWEASubmissionCode(problem);
  assert.equal(result.status, 'success');
  assert.equal(result.data.code, code);
  assert.equal(result.data.memory, '62,720  KB');
  assert.equal(requests[1].options.method, 'POST');
  assert.equal(requests[1].options.body.get('contestHistoryId'), 'history-123');
});

test('내 Pass가 없는 문제는 상세 요청 없이 건너뛴다', async () => {
  const { ctx, requests, errors } = submissionContext({ passed: false });
  const result = await ctx.fetchSWEASubmissionCode(problem);
  assert.equal(result.status, 'skipped');
  assert.equal(result.problemId, '1959');
  assert.equal(requests.length, 1);
  assert.equal(errors.length, 0);
});

for (const options of [{ historyStatus: 503 }, { detailStatus: 503 }, { code: '   ' }]) {
  test(`실제 조회 실패를 Pass 없음과 구분한다: ${JSON.stringify(options)}`, async () => {
    const { ctx, errors } = submissionContext(options);
    const result = await ctx.fetchSWEASubmissionCode(problem);
    assert.equal(result.status, 'failed');
    assert.equal(result.problemId, '1959');
    assert.equal(errors.length, 1);
  });
}

function bulkContext(results) {
  const commits = [];
  const recorded = [];
  const notices = [];
  let upToDate = false;
  let success = false;
  let progress = 0;
  const ctx = vm.createContext({
    console: { error() {} },
    JSZip: class { constructor() { this.files = {}; } folder() { return this; } file() { return this; } },
    GitHub: class {
      async getReference() {}
      async commitTreeItems(branch, items) { commits.push(items); }
    },
    updateLocalStorageStats: async () => ({ branches: { 'my/repo': 'main' } }),
    getHook: async () => 'my/repo', getToken: async () => 'test',
    findAllSolvedProblemsSWEA: async () => results.map((result, index) => ({ problemId: String(index) })),
    extractUploadedProblemIdsForSWEA: () => new Set(),
    fetchSWEASubmissionCode: async ({ problemId }) => results[Number(problemId)],
    recordUploadInStats: async (hook, branch, items) => recorded.push(items),
    setMultiLoaderDenom() {}, incMultiLoader: () => { progress += 1; },
    MultiloaderSuccess: () => { success = true; },
    MultiloaderUpToDate: () => { upToDate = true; },
    MultiloaderIncomplete: (message) => notices.push(message),
    Toast: { raiseToast: (message) => notices.push(message) },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../scripts/util.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../scripts/swexpertacademy/uploadfunctions.js'), 'utf8'), ctx);
  return { ctx, commits, recorded, notices, upToDate: () => upToDate, success: () => success, progress: () => progress };
}

const validResult = { status: 'success', data: { problemId: '1959', directory: 'SWEA/D2/1959', fileName: 'solution.py', code: 'a[b[i]]>0', readme: '# 1959' } };

test('Pass 없음과 요청 실패가 섞여 있어도 정상 코드는 커밋하고 제외된 문제 번호를 알린다', async () => {
  const s = bulkContext([validResult, { status: 'skipped', problemId: '1989' }, { status: 'failed', problemId: '2072' }]);
  await s.ctx.uploadAllSolvedProblemSWEA();
  assert.equal(s.commits.length, 1);
  assert.equal(s.commits[0].length, 2);
  assert.equal(s.commits[0][0].content, 'a[b[i]]>0');
  assert.equal(s.recorded.length, 1);
  assert.match(s.notices[0], /1개 업로드/);
  assert.match(s.notices[0], /Pass.*1989/);
  assert.match(s.notices[0], /실패.*2072/);
  assert.equal(s.success(), false);
  assert.equal(s.upToDate(), false);
  assert.equal(s.progress(), 3);
});

test('모든 문제가 제외되면 빈 커밋이나 Up To Date 대신 제외 사유를 알린다', async () => {
  const s = bulkContext([{ status: 'skipped', problemId: '1989' }, { status: 'failed', problemId: '2072' }]);
  await s.ctx.uploadAllSolvedProblemSWEA();
  assert.equal(s.commits.length, 0);
  assert.equal(s.recorded.length, 0);
  assert.equal(s.upToDate(), false);
  assert.match(s.notices[0], /0개 업로드/);
  assert.match(s.notices[0], /1989/);
  assert.match(s.notices[0], /2072/);
});

test('전체 조회가 성공하면 한 번 커밋하고 성공 표시를 유지한다', async () => {
  const s = bulkContext([validResult]);
  await s.ctx.uploadAllSolvedProblemSWEA();
  assert.equal(s.commits.length, 1);
  assert.equal(s.success(), true);
  assert.equal(s.notices.length, 0);
});

test('일부 제외 알림은 새로고침하지 않고 긴 문제 목록을 읽을 수 있게 표시한다', () => {
  const wrap = { textContent: '' };
  const toast = { element: { style: {} } };
  const ctx = vm.createContext({
    multiloader: { wrap }, isNull: (value) => value == null,
    setTimeout: () => assert.fail('부분 완료 뒤에는 새로고침을 예약하면 안 됩니다.'),
    Toast: { raiseToast: (message, duration) => {
      assert.equal(message, '전체 업로드: 1개 업로드. Pass 조회 없음: 1989');
      assert.equal(duration, 60000);
      return toast;
    } },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../scripts/swexpertacademy/util.js'), 'utf8'), ctx);
  ctx.MultiloaderIncomplete('전체 업로드: 1개 업로드. Pass 조회 없음: 1989');
  assert.match(wrap.textContent, /일부 제외/);
  assert.equal(toast.element.style.overflowY, 'auto');
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
