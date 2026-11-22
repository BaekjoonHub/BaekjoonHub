'use strict';

// DOJ 풀이의 코드는 제출 상세 페이지의 HTML 에 실린 데이터(React Flight)에서 읽는다.
// 실제 parsing.js 를 vm 에 로드해, 그 데이터를 읽는 것과 업로드 데이터(README·경로·커밋 메시지), 올릴 제출을 고르는 기준을 확인한다.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({ console: { warn() {} }, TextEncoder, TextDecoder, atob, buildDirectory: async (platform, variables) => variables._defaultDir });
for (const file of ['scripts/util.js', 'scripts/doj/variables.js', 'scripts/doj/parsing.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
}
context.getDateString = (date) => `DATE ${date.getTime()}`; // util.js 가 선언한 뒤에 바꾼다

/** Next.js 가 데이터 조각을 HTML 에 싣는 모양. 글 조각은 [1, 글], UTF-8 글로 풀 수 없는 조각은 [3, base64] 다 */
const escapeForHtml = (json) => json.replace(/[<>&]/g, (char) => `\\u00${char.charCodeAt(0).toString(16)}`);
const page = (...chunks) =>
  `<html><body><div>본문</div><script>(self.__next_f=self.__next_f||[]).push([0])</script>${chunks
    .map((chunk) => `<script nonce="n">self.__next_f.push(${escapeForHtml(JSON.stringify(typeof chunk === 'string' ? [1, chunk] : [3, Buffer.from(chunk).toString('base64')]))})</script>`)
    .join('')}</body></html>`;
const row = (id, model) => `${id}:${JSON.stringify(model)}\n`;
/** 실제 제출 상세 페이지에서 본 코드 보기 컴포넌트의 자리와 속성 (2026-11-22) */
const viewer = (value) => [
  '$',
  'section',
  null,
  { className: 'panel stack', 'aria-label': '제출 코드', children: [null, null, ['$', '$L5d', null, { value, language: 'cpp17', label: '제출 코드', copyLabel: '복사', copiedLabel: '복사됨', expandLabel: '전체 코드 보기', collapseLabel: '고정 높이로 보기' }]] },
];
/** vm 안에서 만든 값을 이 영역의 값으로 바꾼다 (deepEqual 은 프로토타입도 비교한다) */
const plain = (value) => JSON.parse(JSON.stringify(value));

const U = String.fromCodePoint(0x2005); // 기본 폴더 이름에서 문제 번호 뒤에 오는 공백 (FOUR-PER-EM SPACE)
const NOW = Date.parse('2026-11-22T12:00:00.000Z');
const SUBMISSION = {
  id: 'cmsubmission0000000000001',
  verdict: 'ACCEPTED',
  score: 100,
  maxScore: 100,
  createdAt: '2026-11-22T11:46:16.048Z',
  problemDisplayId: 1,
  problemTitle: 'Lemon Game',
  contestTitle: null,
  contestSlug: null,
  dlcVariantId: null,
  dlcSlug: null,
  maxExecutionTimeMs: 4,
  maxMemoryBytes: 4448256,
  language: 'cpp17',
  codeLength: 42,
  canViewDetail: true,
};
const PROBLEM = { displayId: 1, slug: 'lemongame', titles: { en: 'Lemon Game', ko: '레몬 게임 (Easy)' }, difficulty: 6 };

test('짧은 코드는 코드 보기 컴포넌트의 속성에서 읽는다: 조각이 행 중간에서 나뉘고, 모듈·힌트 행과 비슷한 속성이 섞여 있다', () => {
  const code = '#include <bits/stdc++.h>\nint main() { puts("한글 & </script>"); }\n';
  const stream =
    '5d:I[696353,["/_next/static/chunks/a.js"],"CodeViewer"]\n' +
    ':HL["/_next/static/css/a.css","style"]\n' +
    row('0', { b: 'build', f: [['$', 'select', null, { name: 'language', value: 'cpp17', language: 'ko' }]] }) +
    row('1a', ['$', 'main', null, { children: [viewer(code), ['$', 'div', null, { className: 'stack' }]] }]);
  const cut = stream.indexOf('bits');
  assert.equal(context.findDojCode(page(stream.slice(0, cut), stream.slice(cut))), code);
});

test('1024자 이상인 코드는 T 행에서 읽는다: 길이는 바이트 수이고, 조각이 한글 글자 중간에서 나뉘어 base64 로 실린다', () => {
  const code = `// 한글 주석 ${'가나다라 '.repeat(250)}\nint main() {}\n`;
  assert.ok(code.length >= 1024 && Buffer.byteLength(code) > code.length);
  // T 행은 줄바꿈 없이 끝나고 바로 다음 행이 온다
  const stream = Buffer.from(`2:"$Sreact.fragment"\n1f:T${Buffer.byteLength(code).toString(16)},${code}${row('1a', viewer('$1f'))}`);
  const cut = stream.indexOf(Buffer.from('가')) + 1; // '가'(3바이트)의 첫 바이트 뒤
  assert.equal(context.findDojCode(page(stream.subarray(0, cut), stream.subarray(cut))), code);
});

test("'$' 로 시작하는 코드는 '$$' 로 실린 것을 되돌린다", () => {
  assert.equal(context.findDojCode(page(row('1', viewer('$$x = 1;\n')))), '$x = 1;\n');
});

test('코드를 찾지 못하면 null 이다: 데이터가 없는 페이지, 코드 보기가 없는 페이지, 가리키는 T 행이 없는 페이지', () => {
  assert.equal(context.findDojCode('<html><body>로그인</body></html>'), null);
  assert.equal(context.findDojCode(page(row('1', ['$', 'main', null, { children: [{ value: 'x', language: 'ko' }] }]))), null);
  assert.equal(context.findDojCode(page(row('1', viewer('$1f')))), null);
  assert.equal(context.findDojCode(page('1:T')), null);
});

test('제출 하나를 업로드 데이터로 만든다: 제목은 한국어 먼저, 티어·폴더·커밋 메시지·README', async () => {
  const data = await context.makeData(SUBMISSION, PROBLEM, 'int main() {}\n');
  assert.deepEqual(plain(data), {
    problemId: '1',
    directory: `DOJ/Silver/1.${U}레몬${U}게임${U}（Easy）`,
    message: '[Silver V] Title: 레몬 게임 (Easy), Time: 4 ms, Memory: 4344 KB -BaekjoonHub',
    fileName: `레몬${U}게임${U}（Easy）.cpp`,
    readme:
      '# [Silver V] 레몬 게임 (Easy) - 1 \n\n' +
      '[문제 링크](https://doj.kr/ko/problems/1) \n\n' +
      '### 성능 요약\n\n메모리: 4344 KB, 시간: 4 ms\n\n' +
      `### 제출 일자\n\nDATE ${Date.parse(SUBMISSION.createdAt)}\n\n` +
      '> 출처: DOJ, https://doj.kr/',
    code: 'int main() {}\n',
  });
});

test('난이도가 없는 문제는 Unrated, 표에 없는 언어는 .txt, 한국어 제목이 없으면 영어 → 그 밖 → 목록의 제목 순이다', async () => {
  const make = (submission, problem) => context.makeData({ ...SUBMISSION, ...submission }, { ...PROBLEM, ...problem }, 'x');
  for (const difficulty of [0, -1, 31, undefined]) {
    assert.equal((await make({}, { difficulty })).directory, `DOJ/Unrated/1.${U}레몬${U}게임${U}（Easy）`);
  }
  assert.equal((await make({}, { difficulty: 30 })).message.slice(0, 8), '[Ruby I]');
  const unknown = await make({ language: 'zig' }, { titles: { ja: 'レモン', en: 'Lemon' } });
  assert.equal(unknown.fileName, 'Lemon.txt');
  assert.equal((await make({ language: 'pypy3' }, { titles: { ja: 'レモン' } })).fileName, 'レモン.py');
  assert.equal((await make({}, { titles: {} })).fileName, `Lemon${U}Game.cpp`);
});

test('올릴 제출은 최근에 낸 만점 정답이고, 대회·DLC 제출과 상세를 볼 수 없는 제출은 아니다', () => {
  const uploadable = (changes) => context.isUploadable({ ...SUBMISSION, ...changes }, NOW);
  assert.equal(uploadable({}), true);
  for (const verdict of ['PARTIAL', 'WRONG_ANSWER', 'QUEUED', 'RUNNING', 'PENDING', 'COMPILE_ERROR']) {
    assert.equal(uploadable({ verdict }), false, verdict);
  }
  assert.equal(uploadable({ contestSlug: 'bcd18' }), false);
  assert.equal(uploadable({ contestTitle: 'DOJ Beginner Contest 18' }), false);
  assert.equal(uploadable({ dlcVariantId: 'cmdlc' }), false);
  assert.equal(uploadable({ dlcSlug: 'power' }), false);
  assert.equal(uploadable({ canViewDetail: false }), false);
  assert.equal(uploadable({ createdAt: '2026-11-22T11:00:00.001Z' }), true);
  assert.equal(uploadable({ createdAt: '2026-11-22T11:00:00.000Z' }), false);
});

test('같은 문제의 맞은 제출이 여럿이면 가장 최근 것만 올린다 (목록의 순서와 상관없이)', () => {
  const list = [
    { ...SUBMISSION, id: 'old', createdAt: '2026-11-22T11:30:00.000Z' },
    { ...SUBMISSION, id: 'judging', createdAt: '2026-11-22T11:59:00.000Z', verdict: 'RUNNING' },
    { ...SUBMISSION, id: 'new', createdAt: '2026-11-22T11:50:00.000Z' },
    { ...SUBMISSION, id: 'other', createdAt: '2026-11-22T11:40:00.000Z', problemDisplayId: 2 },
    { ...SUBMISSION, id: 'contest', createdAt: '2026-11-22T11:55:00.000Z', problemDisplayId: 3, contestSlug: 'bcd18' },
  ];
  const picked = (submissions) => plain(context.pickUploads(submissions, NOW).map((submission) => submission.id)).sort();
  assert.deepEqual(picked(list), ['new', 'other']);
  assert.deepEqual(picked([...list].reverse()), ['new', 'other']);
});
