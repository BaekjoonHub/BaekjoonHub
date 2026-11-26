'use strict';

// 정올 풀이는 제출 상세 페이지의 HTML 에 실린 데이터(devalue 가 만든 JS 리터럴)에서 읽는다.
// 실제 parsing.js 를 vm 에 로드해, 그 리터럴을 읽는 것과 업로드 데이터(README·경로·커밋 메시지)를 통째로 비교한다.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({ console: { warn() {} }, buildDirectory: async (platform, variables) => variables._defaultDir });
for (const file of ['scripts/util.js', 'scripts/jungol/variables.js', 'scripts/jungol/parsing.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
}
context.getDateString = (date) => `DATE ${date.getTime()}`; // util.js 가 선언한 뒤에 바꾼다

/** 정올 페이지가 데이터를 싣는 자리와 같은 모양의 HTML */
const page = (data) => `<script>kit.start(app, element, {\n node_ids: [0, 3, 19],\n data: ${data},\n form: null, error: null });</script>`;
/** vm 안에서 만든 값을 이 영역의 값으로 바꾼다 (deepEqual 은 프로토타입도 비교한다) */
const plain = (value) => JSON.parse(JSON.stringify(value));

const U = String.fromCodePoint(0x2005); // 기본 폴더 이름에서 문제 번호 뒤에 오는 공백 (FOUR-PER-EM SPACE)
const DETAIL = {
  m_reason: 'AC',
  m_time: 23,
  m_memory: 9184,
  language: 'PYTHON3',
  source: [{ source: 'print(1)\n' }],
  problemId: 6268,
  additional: { time: 1795338356997, contestId: null },
  problemInfo: { title: '어떤 함수 f(x)', id: 6268, tier: { tier: 5, score: 4.6 }, fTier: null },
};

test('페이지에 실린 데이터를 읽는다: 이스케이프된 문자열, 따옴표 친 키, 숫자, void 0, 호출식', () => {
  const nodes = context.readSvelteKitData(
    page('[{type:"data",data:{"$/submission/7":{data:{source:[{source:"a \\u003C b;\\n\\"x\\" \\\\n"}],m_time:.5,n:-0,big:1e+21,gone:void 0,at:new Date(1),later:__sveltekit_x.defer(1),ok:true,no:false},url:"/submission/7"}},uses:{}},null]'),
  );
  assert.equal(nodes.length, 2);
  assert.equal(nodes[1], null);
  const loaded = context.findLoaded(nodes, '$/submission/7');
  assert.equal(loaded.url, '/submission/7');
  assert.equal(loaded.data.source[0].source, 'a < b;\n"x" \\n');
  assert.deepEqual(plain([loaded.data.m_time, loaded.data.big, loaded.data.ok, loaded.data.no]), [0.5, 1e21, true, false]);
  assert.ok(Object.is(loaded.data.n, -0));
  assert.deepEqual([loaded.data.gone, loaded.data.at, loaded.data.later], [undefined, undefined, undefined]);
  assert.equal(context.findLoaded(nodes, '$/submission/8'), undefined);
  // 질의가 붙는 이름('$/submission?…')은 앞부분으로 찾는다
  assert.equal(context.findLoaded(nodes, '$/submission/'), undefined);
  assert.equal(context.findLoaded(nodes, '$/submission/', true).url, '/submission/7');
});

test('한 노드에서 반복되는 값을 묶은 함수 꼴을 읽는다 (인자는 본문 뒤에 있다)', () => {
  const nodes = context.readSvelteKitData(page('[(function(a,b){return {type:"data",data:{first:a,list:[b,a],text:"a"}}}("같은 글",{k:1})),{type:"data",data:{a:2}}]'));
  assert.deepEqual(plain(nodes[0].data), { first: '같은 글', list: [{ k: 1 }, '같은 글'], text: 'a' });
  assert.deepEqual(plain(nodes[1].data), { a: 2 });
});

test('읽지 못하는 글은 null 이다: 데이터 자리가 없는 페이지, 끊긴 글, 새 devalue 의 let 문 꼴', () => {
  assert.equal(context.readSvelteKitData('<html><body>점검 중</body></html>'), null);
  assert.equal(context.readSvelteKitData(page('[{type:"data",data:{a:"끝나지 않는 문자열')), null);
  assert.equal(context.readSvelteKitData(page('[(function(){let a="x";return {type:"data",data:{v:a}}}())]')), null);
});

test('제출 상세로 업로드 데이터를 만든다: 문제 본문 없는 README, 티어 폴더, 커밋 메시지', async () => {
  const data = await context.makeData(DETAIL);
  assert.deepEqual(plain(data), {
    problemId: '6268',
    directory: `정올/Bronze/6268.${U}어떤${U}함수${U}f（x）`,
    message: '[Bronze I] Title: 어떤 함수 f(x), Time: 23 ms, Memory: 9184 KB -BaekjoonHub',
    fileName: `어떤${U}함수${U}f（x）.py`,
    readme:
      '# [Bronze I] 어떤 함수 f(x) - 6268 \n\n[문제 링크](https://jungol.co.kr/problem/6268) \n\n'
      + '### 성능 요약\n\n메모리: 9184 KB, 시간: 23 ms\n\n### 제출 일자\n\nDATE 1795338356997\n\n> 출처: 정올(JUNGOL), https://jungol.co.kr/',
    code: 'print(1)\n',
  });
});

test('고정 티어가 있으면 그 티어를 쓰고, 모르는 언어는 코드 이름과 .txt 로 올린다', async () => {
  const data = await context.makeData({ ...DETAIL, language: 'AHEUI', problemInfo: { ...DETAIL.problemInfo, fTier: 11 } });
  assert.equal(data.directory, `정올/Gold/6268.${U}어떤${U}함수${U}f（x）`);
  assert.match(data.message, /^\[Gold V\] /);
  assert.equal(data.fileName, `어떤${U}함수${U}f（x）.txt`);
  assert.deepEqual([0, 1, 30, 31, undefined].map((tier) => context.solvedTierName(tier)), ['Unrated', 'Bronze V', 'Ruby I', 'Master', 'Unrated']);
});

test('코드를 볼 수 없는 제출(source 가 안내 문구)은 업로드 데이터를 만들지 않는다', async () => {
  assert.equal(await context.makeData({ ...DETAIL, source: '로그인해야 코드를 볼 수 있어요.' }), null);
});
