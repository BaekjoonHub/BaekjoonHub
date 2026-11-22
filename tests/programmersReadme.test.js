'use strict';

// 프로그래머스 README 는 makeData 하나가 만든다. 채점 직후 업로드에는 성능 요약·채점결과 절이 있고,
// 전체 업로드(채점 결과를 볼 수 없다)에는 그 두 절만 없다. 실제 parsing.js 를 vm 에 로드해 README 를 통째로 비교한다.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({ buildDirectory: async (platform, variables) => variables._defaultDir });
for (const file of ['scripts/util.js', 'scripts/programmers/parsing.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
}
context.getDateString = () => 'DATE'; // util.js 가 선언한 뒤에 바꾼다

const U = String.fromCodePoint(0x2005); // 기본 폴더 이름에서 문제 번호 뒤에 오는 공백 (FOUR-PER-EM SPACE)
const LINK = 'https://school.programmers.co.kr/learn/courses/30/lessons/43165';
const origin = { link: LINK, problemId: '43165', level: '2', title: '타겟넘버', problem_description: '<p>설명</p>', division: '코딩테스트／연습/깊이／너비', language_extension: 'py', code: 'print(1)', language: 'Python3' };
const HEAD = `# [level 2] 타겟넘버 - 43165 \n\n[문제 링크](${LINK}) \n\n`;
const DIVISION = '### 구분\n\n코딩테스트／연습 > 깊이／너비\n\n';
const TAIL = '### 제출 일자\n\nDATE\n\n### 문제 설명\n\n<p>설명</p>\n\n> 출처: 프로그래머스 코딩 테스트 연습, https://school.programmers.co.kr/learn/challenges';

test('채점 직후 업로드의 README 에는 성능 요약과 채점결과가 있고, 전체 업로드의 README 에는 그 두 절만 없다', async () => {
  const single = await context.makeData({ ...origin, runtime: '0.01 ms', memory: '10.2 MB', result_message: '정확성: 100.0' });
  const bulk = await context.makeData(origin);
  assert.equal(single.readme, `${HEAD}### 성능 요약\n\n메모리: 10.2 MB, 시간: 0.01 ms\n\n${DIVISION}### 채점결과\n\n정확성: 100.0\n\n${TAIL}`);
  assert.equal(bulk.readme, `${HEAD}${DIVISION}${TAIL}`);
  assert.equal(single.message, '[level 2] Title: 타겟넘버, Time: 0.01 ms, Memory: 10.2 MB -BaekjoonHub');
  for (const data of [single, bulk]) {
    assert.deepEqual([data.problemId, data.directory, data.fileName, data.code], ['43165', `프로그래머스/2/43165.${U}타겟넘버`, '타겟넘버.py', 'print(1)']);
  }
});
