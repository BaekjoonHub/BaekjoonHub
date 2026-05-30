'use strict';

// 기존(기본) 디렉터리 템플릿이 각 플랫폼의 실제 _defaultDir 과 동일한 경로를 만드는지 검증한다.
// (welcome.js TEMPLATE_DEFAULTS / welcome.html placeholder ↔ scripts/<platform>/parsing.js 의 _defaultDir)
// storage.js 는 최상단 chrome.* 부작용으로 require 불가하므로 applyDirectoryTemplate 을 미러링한다.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const U = String.fromCodePoint(0x2005); // 제목 단어 구분자(FOUR-PER-EM SPACE)

// scripts/storage.js applyDirectoryTemplate 의 미러
const applyTemplate = (tmpl, vars) => tmpl.replace(/\$\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : ''));

// welcome.js TEMPLATE_DEFAULTS 와 동일해야 한다. goorm 은 examId 기반(_defaultDir 과 일치하도록 교정됨).
const DEFAULT_TMPL = {
  baekjoon: '${platform}/${level}/${id}. ${title}',
  programmers: '${platform}/${level}/${id}. ${title}',
  swea: '${platform}/${level}/${id}. ${title}',
  goormlevel: '${platform}/${examId}/${id}. ${title}',
};

// 각 parsing.js makeData 가 buildDirectory 에 넘기는 변수/_defaultDir 구조를 그대로 반영(대표값).
const PLATFORMS = {
  baekjoon: {
    vars: { platform: '백준', level: 'Gold', levelFull: 'Gold V', id: '1000', title: 'A＋B' },
    defaultDir: '백준/Gold/1000. A＋B',
  },
  programmers: {
    vars: { platform: '프로그래머스', level: '2', id: '12345', title: `타겟${U}넘버` },
    defaultDir: `프로그래머스/2/12345. 타겟${U}넘버`,
  },
  swea: {
    vars: { platform: 'SWEA', level: 'D4', id: '1234', title: '문제제목' },
    defaultDir: 'SWEA/D4/1234. 문제제목',
  },
  goormlevel: {
    // goorm: level=difficulty(1~5), examId=시험 uid, id=quizNumber. _defaultDir 은 examId 기반.
    vars: { platform: 'goormlevel', level: '3', examId: '159695', id: '54321', title: `문제${U}제목` },
    defaultDir: `goormlevel/159695/54321. 문제${U}제목`,
  },
};

describe('each platform default template reproduces its _defaultDir', () => {
  for (const [name, { vars, defaultDir }] of Object.entries(PLATFORMS)) {
    test(`${name}: applied default template === _defaultDir`, () => {
      assert.equal(applyTemplate(DEFAULT_TMPL[name], vars), defaultDir);
    });
  }
});

describe('goorm default template uses examId, not difficulty (regression guard for #337 follow-up fix)', () => {
  test('goorm default template references ${examId} so dedup keys stay stable', () => {
    assert.match(DEFAULT_TMPL.goormlevel, /\$\{examId\}/);
    assert.doesNotMatch(DEFAULT_TMPL.goormlevel, /\$\{level\}/);
  });
  test('the old difficulty-based template would have diverged from _defaultDir', () => {
    const { vars, defaultDir } = PLATFORMS.goormlevel;
    const oldBuggy = applyTemplate('${platform}/${level}/${id}. ${title}', vars);
    assert.notEqual(oldBuggy, defaultDir); // documents the bug that was fixed
  });
});
