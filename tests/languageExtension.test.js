'use strict';

// 언어 표기 → 파일 확장자 해석 회귀 테스트.
//
// 예전 구현은 `languages[language.toLowerCase()]` 를 그대로 파일 이름에 넣었다. 표기에 버전이 붙으면('Java 14')
// 조회가 undefined 가 되어 `제목.undefined` 파일이 올라갔다(지금은 종료된 구름LEVEL 에서 실제로 43건).
//
// 여기서 고정하는 것:
//   (1) 버전이 붙은 표기도 맵의 확장자로 해석된다
//   (2) 모르는 언어에 대해 "틀린 확장자를 지어내지 않는다" — 실패는 항상 fallback('txt')이다

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { resolveLanguageExtension, extensionFromFileLabel, DEFAULT_LANGUAGE_EXTENSION } = require('../scripts/utils/languageExtension.js');
const { languages: sweaLanguages } = require('../scripts/swexpertacademy/variables.js');

// 해석 규칙만 보는 표의 맵. 출고되는 맵(SWEA)은 아래에서 따로 검증한다.
const LANGUAGES = { c: 'c', 'c++': 'cc', java: 'java', python: 'py', r: 'r' };

describe('resolveLanguageExtension — 오답을 지어내지 않는다', () => {
  const table = [
    ['모르는 언어는 접두사 추정으로 엉뚱한 확장자를 만들지 않는다', 'Cython 3', DEFAULT_LANGUAGE_EXTENSION],
    ['맵에 없는 언어는 fallback', 'Zig 0.11', DEFAULT_LANGUAGE_EXTENSION],
    ['빈 문자열', '', DEFAULT_LANGUAGE_EXTENSION],
    ['공백만', '   ', DEFAULT_LANGUAGE_EXTENSION],
    ['null', null, DEFAULT_LANGUAGE_EXTENSION],
    ['undefined', undefined, DEFAULT_LANGUAGE_EXTENSION],
    ['숫자', 14, DEFAULT_LANGUAGE_EXTENSION],
    ['프로토타입 키 constructor', 'constructor', DEFAULT_LANGUAGE_EXTENSION],
    ['프로토타입 키 __proto__', '__proto__', DEFAULT_LANGUAGE_EXTENSION],
    ['앞뒤 공백은 무시된다', '  Java 14  ', 'java'],
    ['공백 없는 버전 표기도 처리한다', 'C++17', 'cc'],
    ['대소문자 무관', 'jAvA 14', 'java'],
    ['버전만 여러 자리', 'R 3.6.3', 'r'],
  ];
  for (const [name, input, expected] of table) {
    test(name, () => {
      assert.equal(resolveLanguageExtension(LANGUAGES, input), expected);
    });
  }

  test('맵이 없어도 throw 하지 않고 fallback 을 반환한다', () => {
    assert.equal(resolveLanguageExtension(null, 'Java 14'), DEFAULT_LANGUAGE_EXTENSION);
    assert.equal(resolveLanguageExtension(undefined, 'Java 14'), DEFAULT_LANGUAGE_EXTENSION);
  });

  test('fallback 은 호출부가 바꿀 수 있다', () => {
    assert.equal(resolveLanguageExtension(LANGUAGES, 'Zig 0.11', 'bin'), 'bin');
    assert.equal(resolveLanguageExtension(LANGUAGES, 'Java 14', 'bin'), 'java');
  });
});

describe('SWEA 언어 확장자 해석', () => {
  const table = [
    ['Java', 'java'],
    ['Python', 'py'],
    ['C++', 'cpp'],
    ['C', 'c'],
    ['Python 3', 'py'],
    ['C++ 17', 'cpp'],
    ['Kotlin', DEFAULT_LANGUAGE_EXTENSION],
    ['', DEFAULT_LANGUAGE_EXTENSION],
  ];
  for (const [input, expected] of table) {
    test(`'${input}' → .${expected}`, () => {
      assert.equal(resolveLanguageExtension(sweaLanguages, input), expected);
    });
  }
});

describe('extensionFromFileLabel — 프로그래머스 에디터 탭 라벨', () => {
  const table = [
    ['일반적인 라벨', 'solution.java', 'java'],
    ['SQL 문제', 'solution.sql', 'sql'],
    ['점이 없으면 fallback (실제 .undefined 원인)', 'solution', DEFAULT_LANGUAGE_EXTENSION],
    ['빈 문자열', '', DEFAULT_LANGUAGE_EXTENSION],
    ['null', null, DEFAULT_LANGUAGE_EXTENSION],
    ['undefined', undefined, DEFAULT_LANGUAGE_EXTENSION],
    ['앞뒤 공백', '  solution.py  ', 'py'],
    ['점이 여러 개면 마지막이 확장자', 'my.solution.cpp', 'cpp'],
    ['맨 앞 점은 확장자가 아니다', '.gitignore', DEFAULT_LANGUAGE_EXTENSION],
    ['점으로 끝나면 fallback', 'solution.', DEFAULT_LANGUAGE_EXTENSION],
  ];
  for (const [name, input, expected] of table) {
    test(name, () => {
      assert.equal(extensionFromFileLabel(input, undefined), expected);
    });
  }
});

describe('module hygiene', () => {
  test('모든 확장자 값은 점 없는 비어있지 않은 문자열이다', () => {
    for (const [key, value] of Object.entries(sweaLanguages)) {
      assert.equal(typeof value, 'string', `${key} 의 값이 문자열이 아니다`);
      assert.ok(value.length > 0, `${key} 의 값이 비어 있다`);
      assert.ok(!value.startsWith('.'), `${key} 의 값에 점이 붙어 있다: ${value}`);
    }
  });
});
