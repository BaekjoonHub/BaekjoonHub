'use strict';

// #349 goormLEVEL 난이도 파싱 회귀 테스트.
//
// 기존 구현은 parsing.js 에서 'span[role=text] > span' 이 null 이면 .innerHTML 에서 TypeError 를
// 던져 parseData() 전체를 죽였고, goormlevel.js 의 catch 가 log() 로 이를 받았는데 debug=false 라
// no-op 이어서 업로드도 로그도 UI 표시도 없는 완전한 무음 실패가 되었다.
//
// 여기서는 새 구현이 (1) goorm DOM 이 바뀌어도 throw 하지 않고, (2) 본문에 우연히 등장한 같은
// 단어에 낚이지 않으며, (3) 기존 selector 가 살아 있을 때는 동작이 한 글자도 변하지 않음을 고정한다.
//
// 저장소에 DOM 테스트 하네스가 없고 devDependency 를 늘릴 수 없으므로(package.json 은
// {"test": "node --test"} 뿐) 최소 fake DOM 을 직접 만든다. selector 매칭 자체는 일부러 흉내내지
// 않는다 — CSS 엔진은 Chrome 의 몫이고, querySelectorAll 을 주입 맵으로 두면 "이 selector 가
// 맞았다/빗나갔다" 가 명시적인 테스트 입력이 된다.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { parseDifficultyLabel, parseDifficulty, buildGoormCommitMessage, normalizeLabelText, DIFFICULTY_UNKNOWN, DIFFICULTY_SELECTORS } = require('../scripts/goormlevel/parsing.js');
const { difficultyLabels } = require('../scripts/goormlevel/variables.js');

/* ─────────── 최소 fake DOM (구현이 실제로 읽는 속성만 구현) ─────────── */

function el({ tag = 'div', text = '', id = '', className = '', children = [] } = {}) {
  const node = { tag, id, className, children, parentElement: null };
  Object.defineProperty(node, 'textContent', {
    get() {
      return children.length === 0 ? text : children.map((c) => c.textContent).join(' ');
    },
  });
  for (const child of children) child.parentElement = node;
  return node;
}

/** 문서 순서로 평탄화 */
function flatten(node, out = []) {
  for (const child of node.children) {
    out.push(child);
    flatten(child, out);
  }
  return out;
}

/**
 * 알려진 selector 후보는 주입 맵으로만 응답하고, 그 외(텍스트 스캔 selector)는 트리 전체를 돌려준다.
 * @param {object} rootNode - 문서 루트
 * @param {object} selectorHits - selector 문자열 → 요소(또는 요소 배열)
 */
function fakeDocument(rootNode, selectorHits = {}) {
  return {
    querySelectorAll(selector) {
      if (DIFFICULTY_SELECTORS.includes(selector)) {
        const hit = selectorHits[selector];
        if (!hit) return [];
        return Array.isArray(hit) ? hit : [hit];
      }
      return flatten(rootNode);
    },
  };
}

/** console.error/warn 를 가로채 "소리를 냈는지" 까지 검증한다. #349 의 본질이 침묵이었기 때문이다. */
function captureConsole(fn) {
  const messages = [];
  const origError = console.error;
  const origWarn = console.warn;
  console.error = (...args) => messages.push('error: ' + args.map(String).join(' '));
  console.warn = (...args) => messages.push('warn: ' + args.map(String).join(' '));
  try {
    return { value: fn(), messages };
  } finally {
    console.error = origError;
    console.warn = origWarn;
  }
}

/** 실제 페이지의 헤더 행: 난이도 뱃지 + '유형 프로그래밍 | 배점 100점 | 참여자 2533 | 정답률 88.5%' */
const headerRow = (badgeText) =>
  el({
    className: 'header-row',
    children: [el({ tag: 'span', text: badgeText, className: 'badge' }), el({ tag: 'span', text: '유형 프로그래밍 | 배점 100점 | 참여자 2533 | 정답률 88.5%' })],
  });

/* ─────────────────────────── 테스트 ─────────────────────────── */

describe('parseDifficultyLabel — 난이도 라벨 추출', () => {
  test('기존 selector(span[role=text] > span)가 살아 있으면 그대로 채택한다 (무회귀)', () => {
    const badge = el({ tag: 'span', text: '보통' });
    const doc = fakeDocument(el({ children: [badge] }), { 'span[role=text] > span': badge });
    const { value, messages } = captureConsole(() => parseDifficultyLabel(doc, difficultyLabels));
    assert.equal(value, '보통');
    assert.deepEqual(messages, [], '정상 경로에서는 경고/에러를 내지 않아야 한다');
    assert.equal(parseDifficulty(doc, difficultyLabels), 3);
  });

  test('#349 재현 — 기존 selector 가 죽어도 헤더의 난이도 뱃지를 텍스트 스캔으로 찾는다', () => {
    const doc = fakeDocument(el({ children: [headerRow('매우 쉬움'), el({ tag: 'h3', text: '문제' })] }));
    assert.equal(parseDifficultyLabel(doc, difficultyLabels), '매우 쉬움');
    assert.equal(parseDifficulty(doc, difficultyLabels), 1);
  });

  test('selector 가 매칭돼도 텍스트가 난이도 라벨이 아니면 채택하지 않고 다음 단계로 넘어간다', () => {
    const decoy = el({ tag: 'span', text: '프로그래밍' });
    const doc = fakeDocument(el({ children: [decoy, headerRow('쉬움')] }), { 'span[role=text] > span': decoy });
    assert.equal(parseDifficultyLabel(doc, difficultyLabels), '쉬움');
  });

  test("본문에 '보통' 이 단독 leaf 로 먼저 등장해도 헤더 문맥의 '어려움' 을 우선한다 (오검출 방지)", () => {
    // 실제 페이지처럼 본문이 길어야 조상 텍스트 길이 상한(200자)이 문맥 판정을 헤더로 좁힌다.
    const longBody = '문제 설명 '.repeat(60);
    const body = el({ className: 'desc', children: [el({ tag: 'p', text: '보통' }), el({ tag: 'p', text: longBody })] });
    const doc = fakeDocument(el({ children: [body, headerRow('어려움')] })); // 문서 순서상 본문이 먼저
    assert.equal(parseDifficultyLabel(doc, difficultyLabels), '어려움');
  });

  test('코드 에디터(#fileEditor)와 채점 결과(.tab-content) 안의 라벨 텍스트는 무시한다', () => {
    const editor = el({ id: 'fileEditor', children: [el({ className: 'cm-content cm-lineWrapping', children: [el({ className: 'cm-line', text: '보통' })] })] });
    const results = el({ className: 'tab-content', children: [el({ tag: 'td', text: '어려움' })] });
    const doc = fakeDocument(el({ children: [editor, results] }));
    assert.equal(parseDifficultyLabel(doc, difficultyLabels), '');
  });

  test('프로토타입 키(constructor/toString/valueOf)를 난이도로 오인하지 않는다', () => {
    const doc = fakeDocument(el({ children: [el({ tag: 'span', text: 'constructor' }), el({ tag: 'span', text: 'toString' }), el({ tag: 'span', text: 'valueOf' })] }));
    assert.equal(parseDifficultyLabel(doc, difficultyLabels), '');
  });

  test('뱃지 텍스트의 개행/탭/연속 공백을 정규화해 매칭한다', () => {
    const badge = el({ tag: 'span', text: '\n  매우\t쉬움  ' });
    const doc = fakeDocument(el({ children: [badge] }), { 'span[role=text] > span': badge });
    assert.equal(parseDifficultyLabel(doc, difficultyLabels), '매우 쉬움');
  });

  test('문맥 없이 텍스트 스캔으로만 찾은 경우 console.warn 으로 오검출 가능성을 알린다', () => {
    const doc = fakeDocument(el({ children: [el({ tag: 'span', text: '보통' })] }));
    const { value, messages } = captureConsole(() => parseDifficultyLabel(doc, difficultyLabels));
    assert.equal(value, '보통');
    assert.equal(messages.length, 1);
    assert.match(messages[0], /^warn: .*텍스트 스캔/);
  });
});

describe('parseDifficulty — 실패해도 throw 하지 않고 업로드를 계속한다 (#349 근본 원인)', () => {
  test('goorm DOM 이 완전히 바뀌어 아무것도 못 찾아도 예외 대신 Unrated 를 반환한다', () => {
    const doc = fakeDocument(el({ children: [] }));
    let captured;
    assert.doesNotThrow(() => {
      captured = captureConsole(() => parseDifficulty(doc, difficultyLabels));
    });
    assert.equal(captured.value, DIFFICULTY_UNKNOWN);
    assert.equal(captured.messages.length, 1, '침묵하지 않고 반드시 console.error 를 남겨야 한다');
    assert.match(captured.messages[0], /^error: .*난이도를 찾지 못했습니다/);
  });

  test('난이도 맵이 비어 있어도(상수 파손) throw 하지 않는다', () => {
    const doc = fakeDocument(el({ children: [headerRow('보통')] }));
    let value;
    assert.doesNotThrow(() => {
      value = captureConsole(() => parseDifficulty(doc, { __empty: 0 })).value;
    });
    assert.equal(value, DIFFICULTY_UNKNOWN);
  });
});

describe('parseDifficulty — 라벨 5종 매핑 (variables.js difficultyLabels)', () => {
  for (const [label, expected] of Object.entries(difficultyLabels)) {
    test(`'${label}' → ${expected}`, () => {
      const doc = fakeDocument(el({ children: [headerRow(label)] }));
      assert.equal(parseDifficulty(doc, difficultyLabels), expected);
    });
  }
});

describe('buildGoormCommitMessage — 난이도를 못 찾았을 때의 커밋 메시지', () => {
  const base = { title: '정수의 길이', runtime: '1.00 ms', memory: '2.00 MB' };

  test('난이도가 있으면 기존 포맷을 한 글자도 바꾸지 않는다 (무회귀)', () => {
    assert.equal(buildGoormCommitMessage({ ...base, difficulty: 1 }), '[난이도 1] Title: 정수의 길이, Time: 1.00 ms, Memory: 2.00 MB -BaekjoonHub');
  });

  test('난이도가 Unrated 면 [난이도 ...] 접두사를 통째로 생략한다', () => {
    const message = buildGoormCommitMessage({ ...base, difficulty: DIFFICULTY_UNKNOWN });
    assert.equal(message, 'Title: 정수의 길이, Time: 1.00 ms, Memory: 2.00 MB -BaekjoonHub');
    assert.doesNotMatch(message, /난이도/);
  });

  test('난이도가 undefined/null 이어도 [난이도 undefined] 같은 값을 내보내지 않는다', () => {
    for (const bad of [undefined, null, '']) {
      assert.doesNotMatch(buildGoormCommitMessage({ ...base, difficulty: bad }), /난이도/);
    }
  });
});

describe('normalizeLabelText — null 안전성', () => {
  for (const [input, expected] of [
    [null, ''],
    [undefined, ''],
    ['  보통 ', '보통'],
    [{ textContent: ' 매우  어려움 ' }, '매우 어려움'],
  ]) {
    test(`${JSON.stringify(input)} → ${JSON.stringify(expected)}`, () => {
      assert.equal(normalizeLabelText(input), expected);
    });
  }
});
