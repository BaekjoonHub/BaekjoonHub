'use strict';

// 언어 표기 → 파일 확장자 해석 회귀 테스트.
//
// 기존 구현은 `languages[language.toLowerCase()]` 를 그대로 템플릿 문자열에 박았다. 구름LEVEL 이
// 드롭다운에 버전 표기('Java 14')를 쓰기 시작하면서 이 조회가 전부 undefined 가 되었고,
// `제목.undefined` 파일이 업로드됐다. tests/fixtures/realPaths.txt 에 실제 사례가 44건 남아 있다
// (goormlevel 43건 + 프로그래머스 1건 — 프로그래머스는 원인이 다르다, 아래 참고).
//
// 여기서 고정하는 것:
//   (1) 구름LEVEL 드롭다운 29개 언어가 "하나도 빠짐없이" 올바른 확장자로 해석된다
//   (2) 어떤 입력에도 'undefined' 문자열이 확장자로 나가지 않는다
//   (3) 모르는 언어에 대해 "틀린 확장자를 지어내지 않는다" — 실패는 항상 fallback('txt')이다
//
// 29개 목록은 2026-09-11 실제 구름LEVEL 문제 페이지의
// `#FrameBody .Tour__selectLang div[role="menu"] button[role="menuitem"]` 를 그대로 읽어온 값이다
// (parseData 가 쓰는 바로 그 selector). 전부 버전 표기라는 점이 이 버그의 핵심이다.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { resolveLanguageExtension, extensionFromFileLabel, DEFAULT_LANGUAGE_EXTENSION } = require('../scripts/utils/languageExtension.js');
const { languages: goormLanguages } = require('../scripts/goormlevel/variables.js');
const { languages: sweaLanguages } = require('../scripts/swexpertacademy/variables.js');

/** 구름LEVEL 드롭다운 실측값(29종) → 기대 확장자. 사본이 아니라 출고되는 맵으로 검증한다. */
const GOORM_DROPDOWN = [
  ['C 17', 'c'],
  ['C++ 17', 'cc'],
  ['Java 14', 'java'],
  ['Python 2.7', 'py'],
  ['Python 3.9', 'py'],
  ['Go 1.16', 'go'],
  ['Swift 5', 'swift'],
  ['Javascript 16', 'js'],
  ['Typescript 5.3', 'ts'],
  ['Ruby 2.5', 'rb'],
  ['Kotlin 1.4', 'kt'],
  ['Scala 2.12', 'scala'],
  ['VB.NET 4', 'vb'],
  ['Pascal 3.0', 'pas'],
  ['Lua 5.3', 'lua'],
  ['Objective-C 3.8', 'm'],
  ['R 3.6.3', 'r'],
  ['Rust 1.48', 'rs'],
  ['Cobol 1.1', 'cob'],
  ['Clojure 1.8', 'clj'],
  ['Smalltalk 3.2', 'st'],
  ['Dart 2.12', 'dart'],
  ['Haskell 7.10', 'hs'],
  ['Perl 5.26', 'pl'],
  ['Common Lisp 2.49', 'lisp'],
  ['D 2.074', 'd'],
  ['Erlang 20', 'erl'],
  ['PHP 7.1', 'php'],
  ['C# 9', 'cs'],
];

describe('구름LEVEL 언어 확장자 해석 (.undefined 회귀)', () => {
  for (const [label, expected] of GOORM_DROPDOWN) {
    test(`'${label}' → .${expected}`, () => {
      assert.equal(resolveLanguageExtension(goormLanguages, label), expected);
    });
  }

  test('29종 중 fallback 으로 새는 언어가 하나도 없다', () => {
    const leaked = GOORM_DROPDOWN.map(([label]) => label).filter((label) => resolveLanguageExtension(goormLanguages, label) === DEFAULT_LANGUAGE_EXTENSION);
    assert.deepEqual(leaked, [], '구름LEVEL 정식 지원 언어는 전부 고유 확장자를 가져야 한다');
  });

  test("어떤 입력에도 'undefined' 문자열이 확장자가 되지 않는다", () => {
    for (const [label] of GOORM_DROPDOWN) {
      const extension = resolveLanguageExtension(goormLanguages, label);
      assert.equal(typeof extension, 'string');
      assert.notEqual(extension, 'undefined');
      assert.ok(extension.length > 0);
      assert.ok(!extension.includes('.'), `확장자에 점이 들어가면 안 된다: ${extension}`);
    }
  });

  test('버전이 없는 표기도 계속 동작한다 (구 동작 무회귀)', () => {
    // goorm 이 버전 표기를 쓰기 전에 올라간 파일들(.kt/.java)이 이 경로로 만들어졌다.
    assert.equal(resolveLanguageExtension(goormLanguages, 'Kotlin'), 'kt');
    assert.equal(resolveLanguageExtension(goormLanguages, 'Java'), 'java');
    assert.equal(resolveLanguageExtension(goormLanguages, 'python3'), 'py');
  });
});

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
    ['프로토타입 키 toString', 'toString', DEFAULT_LANGUAGE_EXTENSION],
    ['프로토타입 키 hasOwnProperty', 'hasOwnProperty', DEFAULT_LANGUAGE_EXTENSION],
    ['프로토타입 키 __proto__', '__proto__', DEFAULT_LANGUAGE_EXTENSION],
    ['앞뒤 공백은 무시된다', '  Java 14  ', 'java'],
    ['공백 없는 버전 표기도 처리한다', 'C++17', 'cc'],
    ['대소문자 무관', 'jAvA 14', 'java'],
    ['버전만 여러 자리', 'R 3.6.3', 'r'],
  ];
  for (const [name, input, expected] of table) {
    test(name, () => {
      assert.equal(resolveLanguageExtension(goormLanguages, input), expected);
    });
  }

  test('맵이 없어도 throw 하지 않고 fallback 을 반환한다', () => {
    assert.equal(resolveLanguageExtension(null, 'Java 14'), DEFAULT_LANGUAGE_EXTENSION);
    assert.equal(resolveLanguageExtension(undefined, 'Java 14'), DEFAULT_LANGUAGE_EXTENSION);
  });

  test('fallback 은 호출부가 바꿀 수 있다', () => {
    assert.equal(resolveLanguageExtension(goormLanguages, 'Zig 0.11', 'bin'), 'bin');
    assert.equal(resolveLanguageExtension(goormLanguages, 'Java 14', 'bin'), 'java');
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
  test('구름LEVEL languages 맵에 중복 key 가 없다', () => {
    // 객체 리터럴의 중복 key 는 런타임에 보이지 않는다(뒤가 이긴다). 실제로 'cobol' 이 두 번
    // 선언되어 "cbl" 이 죽은 코드였다. 소스 텍스트에서 직접 막는다.
    const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'goormlevel', 'variables.js'), 'utf8');
    const block = source.slice(source.indexOf('const languages'), source.indexOf('const difficultyLabels'));
    const keys = [...block.matchAll(/^\s*"([^"]+)"\s*:/gm)].map((m) => m[1]);
    const seen = new Set();
    const duplicates = keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
    assert.deepEqual(duplicates, [], `languages 맵에 중복 key: ${duplicates.join(', ')}`);
    assert.ok(keys.length > 20, '키를 제대로 파싱했는지 확인');
  });

  test('모든 확장자 값은 점 없는 비어있지 않은 문자열이다', () => {
    for (const map of [goormLanguages, sweaLanguages]) {
      for (const [key, value] of Object.entries(map)) {
        assert.equal(typeof value, 'string', `${key} 의 값이 문자열이 아니다`);
        assert.ok(value.length > 0, `${key} 의 값이 비어 있다`);
        assert.ok(!value.startsWith('.'), `${key} 의 값에 점이 붙어 있다: ${value}`);
      }
    }
  });
});
