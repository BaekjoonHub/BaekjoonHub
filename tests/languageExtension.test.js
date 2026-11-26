'use strict';

// 언어 표기 → 파일 확장자 해석. 예전에는 버전이 붙은 표기('Java 14')나 점이 없는 탭 라벨에서 `제목.undefined` 파일이 올라갔다
// (공개 레포 경로에서 실제로 43건). 버전이 붙어도 맵의 확장자로 해석하고, 모르는 언어에는 틀린 확장자를 지어내지 않고 'txt' 를 쓴다.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { resolveLanguageExtension, extensionFromFileLabel } = require('../scripts/utils/languageExtension.js');
const { languages: sweaLanguages } = require('../scripts/swexpertacademy/variables.js');

test('resolveLanguageExtension: 버전·공백·대소문자를 걷어 내고 맵에 정확히 있는 언어만 해석하며, 그 밖에는 txt 다', () => {
  const map = { c: 'c', 'c++': 'cc', java: 'java', python: 'py', r: 'r' };
  for (const [input, expected] of [
    ['  Java 14  ', 'java'], ['C++17', 'cc'], ['jAvA 14', 'java'], ['R 3.6.3', 'r'],
    ['Cython 3', 'txt'], // 접두사 추정으로 .c 를 만들지 않는다
    ['Zig 0.11', 'txt'], ['', 'txt'], ['   ', 'txt'], [null, 'txt'], [undefined, 'txt'], [14, 'txt'],
    ['constructor', 'txt'], ['__proto__', 'txt'], // 프로토타입 키
  ]) assert.equal(resolveLanguageExtension(map, input), expected, JSON.stringify(input));
});

test('SWEA 가 실제로 쓰는 맵으로 해석한다', () => {
  for (const [input, expected] of [['Java', 'java'], ['Python', 'py'], ['C++', 'cpp'], ['C', 'c'], ['Python 3', 'py'], ['C++ 17', 'cpp'], ['Kotlin', 'txt'], ['', 'txt']]) {
    assert.equal(resolveLanguageExtension(sweaLanguages, input), expected, input);
  }
});

test('extensionFromFileLabel: 프로그래머스 에디터 탭 라벨의 마지막 점 뒤가 확장자이고, 없으면 txt 다', () => {
  for (const [input, expected] of [
    ['solution.java', 'java'], ['solution.sql', 'sql'], ['  solution.py  ', 'py'], ['my.solution.cpp', 'cpp'],
    ['solution', 'txt'], // 실제 .undefined 원인
    ['', 'txt'], [null, 'txt'], [undefined, 'txt'], ['.gitignore', 'txt'], ['solution.', 'txt'],
  ]) assert.equal(extensionFromFileLabel(input), expected, JSON.stringify(input));
});
