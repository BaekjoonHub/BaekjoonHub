'use strict';

// #371: 백준 제출 페이지에서 서버가 거부(403)하는 것으로 알려진 문자열(CRS 규칙 941180 의 단어)을 편집기에 표시한다.
// 실제 submitfilter.js 를 vm 에 로드하고, 가짜 편집기·문서·시계로 표시와 툴팁을 본다.
// 일부러 다루지 않는 것: 툴팁 문구(사람이 읽는 글), 편집기가 5초 안에 나타나지 않는 페이지,
// 바꾼 뒤 250ms 뒤에 다시 찾기.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '../scripts/baekjoon/submitfilter.js'), 'utf8');

function fakeEditor(text) {
  const e = {
    text,
    all: [],
    handlers: [],
    markCalls: 0,
    throwAt: -1,
    getValue: () => e.text,
    posFromIndex(i) {
      const lines = e.text.slice(0, i).split('\n');
      return { line: lines.length - 1, ch: lines[lines.length - 1].length };
    },
    markText(from, to, options) {
      if (e.markCalls++ === e.throwAt) throw new Error('markText 실패');
      const m = { from, to, options, cleared: false, clear: () => (m.cleared = true) };
      e.all.push(m);
      return m;
    },
    operation: (fn) => fn(),
    on: (name, fn) => e.handlers.push([name, fn]),
    off: (name, fn) => (e.handlers = e.handlers.filter((h) => h[0] !== name || h[1] !== fn)),
    /** 지워지지 않은 표시를 [[from line, ch], [to line, ch]] 로 */
    live: () => e.all.filter((m) => !m.cleared).map((m) => [[m.from.line, m.from.ch], [m.to.line, m.to.ch]]),
  };
  return e;
}

/** 폼과 버튼 자리에 놓는, 무엇이든 건드리면 기록하는 Proxy. 스크립트가 .CodeMirror 만 찾는지 본다. */
function touchRecorder(name, touched) {
  const proxy = new Proxy(function () {}, {
    get: (_t, key) => (touched.push(`${name}.get ${String(key)}`), proxy),
    set: (_t, key) => (touched.push(`${name}.set ${String(key)}`), true),
    apply: () => (touched.push(`${name}()`), proxy),
  });
  return proxy;
}

function fakeElement() {
  const el = {
    attrs: {},
    style: {},
    removed: false,
    htmlSet: false,
    setAttribute: (k, v) => (el.attrs[k] = v),
    remove: () => (el.removed = true),
  };
  Object.defineProperty(el, 'innerHTML', { set: () => (el.htmlSet = true) });
  return el;
}

/** 편집기가 처음부터 있는 페이지에 submitfilter.js 를 로드한다. */
function load(editor, { touched = [] } = {}) {
  const listeners = [];
  const timers = [];
  let now = 0;
  const body = { children: [], appendChild: (c) => body.children.push(c) };
  const document = {
    body,
    documentElement: { clientWidth: 1200 },
    addEventListener: (type, fn) => listeners.push({ type, fn }),
    createElement: () => fakeElement(),
    querySelector: (sel) => (sel === '.CodeMirror' ? { CodeMirror: editor } : touchRecorder(sel, touched)),
  };
  const context = vm.createContext({
    document,
    console: { log: () => assert.fail('DEBUG 가 꺼져 있으면 아무것도 출력하지 않는다') },
    setTimeout: (fn, ms) => timers.push({ fn, at: now + ms, id: timers.length + 1 }),
    clearTimeout: (id) => {
      const t = timers.find((x) => x.id === id);
      if (t) t.cancelled = true;
    },
  });
  vm.runInContext(SRC, context, { filename: 'submitfilter.js' });
  const advance = (ms) => {
    now += ms;
    for (const t of timers.filter((x) => !x.cancelled && !x.done && x.at <= now)) {
      t.done = true;
      t.fn();
    }
  };
  const fire = (type, event) => listeners.filter((l) => l.type === type).forEach((l) => l.fn(event));
  return { body, advance, fire, listeners };
}

/** 편집기 안의 표시 요소 흉내: i 번째 표시의 속성을 그대로 달고 있다. */
function markElement(editor, i) {
  const el = {
    closest: (sel) => (sel === '.bjh-filter-hit' ? el : null),
    getAttribute: (k) => editor.all[i].options.attributes[k],
    getBoundingClientRect: () => ({ left: 120, bottom: 80 }),
  };
  return el;
}

const marksOf = (text) => {
  const editor = fakeEditor(text);
  load(editor);
  return editor.live();
};

const ORDINARY = {
  'C++ cin/cout': '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n  int a, b;\n  cin >> a >> b;\n  cout << a + b << "\\n";\n  return 0;\n}\n',
  'Java Scanner': 'import java.util.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int a = sc.nextInt(), b = sc.nextInt();\n    System.out.println(a + b);\n  }\n}\n',
  Python: 'a, b = map(int, input().split())\nprint(a + b)\n',
  'C scanf/printf': '#include <stdio.h>\nint main() {\n  int a, b;\n  scanf("%d %d", &a, &b);\n  printf("%d\\n", a + b);\n  return 0;\n}\n',
};

// 백준 게시판 글(166494)의 제보와 규칙 941160 의 태그 갈래, 그리고 두 항목 이상이 겹치는 경우.
test('알려진 문자열에만 줄과 열 위치대로 표시하고, 평범한 코드에는 표시하지 않는다', () => {
  const rows = [
    ['while (n --> 0) {', [[[0, 9], [0, 12]]]],
    ['Document.Write(', [[[0, 0], [0, 14]]]], // 대소문자를 가리지 않는다
    ['<!-- a -->\nx = window.location;', [[[0, 0], [0, 4]], [[0, 7], [0, 10]], [[1, 4], [1, 19]]]],
    ['vector<set<int>> v;', [[[0, 6], [0, 11]]]],
    ['#include <format>', [[[0, 9], [0, 14]]]],
    ['</script>', [[[0, 0], [0, 8]]]],
    ['< / s c r i p t', [[[0, 0], [0, 15]]]],
    ['std::numeric_limits<int>::max()', [[[0, 5], [0, 19]]]],
    ['Std::Numeric_Limits<int>', [[[0, 5], [0, 19]]]],
    ['<!--script <svg>', [[[0, 0], [0, 4]], [[0, 0], [0, 10]], [[0, 11], [0, 15]]]], // 겹치거나 맞닿아도 각자 남는다
    ...Object.values(ORDINARY).map((source) => [source, []]),
    ...['#include <set>', 'map<int, set<int>> m;', 'if (a < b && c > d) {', 'for (int i = 0; i<n; i++) a<--b;'].map((source) => [source, []]),
  ];
  for (const [source, expected] of rows) assert.deepEqual(marksOf(source), expected, source);
});

test('표시에 마우스를 올리면 그 문자열의 안내를 글로만 보여 주고, 떠나면 없애며, 패턴을 가리키지 않는 표시에는 툴팁이 없다', () => {
  const editor = fakeEditor('while (n --> 0) {');
  const page = load(editor);
  page.fire('mouseover', { target: markElement(editor, 0) });
  assert.equal(page.body.children.length, 1);
  const tip = page.body.children[0];
  assert.equal(tip.attrs.role, 'tooltip');
  assert.equal(tip.style.position, 'fixed');
  assert.equal(tip.htmlSet, false, 'HTML 이 아니라 글로 넣는다');
  assert.match(tip.textContent, /이 부분\(-->\)/);
  page.fire('mouseout', {});
  assert.equal(tip.removed, true);

  for (const value of [null, '', '99']) {
    const el = markElement(editor, 0);
    el.getAttribute = () => value;
    page.fire('mouseover', { target: el });
    assert.equal(page.body.children.length, 1, `속성 ${JSON.stringify(value)}`);
  }
});

test('폼과 버튼은 건드리지 않고 submit 을 가로채지 않는다', () => {
  const touched = [];
  const editor = fakeEditor('while (n --> 0) {');
  const page = load(editor, { touched });
  page.advance(5000);
  assert.deepEqual(touched, []);
  assert.deepEqual(page.listeners.map((l) => l.type).sort(), ['mouseout', 'mouseover']);
  assert.deepEqual(editor.handlers.map((h) => h[0]), ['change']);
});

test('markText 가 던지면 아무것도 밖으로 새지 않고 표시를 모두 지운다', () => {
  const editor = fakeEditor('a --> b <!-- c');
  editor.throwAt = 1; // 첫 표시는 만들어지고 두 번째에서 던진다
  const page = load(editor);
  assert.equal(editor.all.length, 1);
  assert.deepEqual(editor.live(), []);
  assert.deepEqual(editor.handlers, [], '멈춘 뒤에는 change 도 듣지 않는다');
  page.advance(1000); // 남은 타이머도 조용하다
});

test('64KB 를 넘는 소스와 모든 항목을 합쳐 200곳을 넘는 히트는 표시하지 않고, 나쁜 입력도 500ms 안에 끝난다', () => {
  const rows = [
    ['70KB', 'x'.repeat(70 * 1024) + ' -->', 0],
    ['200곳', '-->\n'.repeat(200), 200],
    ['201곳', '-->\n'.repeat(201), 0],
    ['두 항목 합쳐 200곳', '-->\n<svg\n'.repeat(100), 200],
    ['두 항목 합쳐 201곳', '-->\n<svg\n'.repeat(100) + '<svg\n', 0],
    ['세 항목 합쳐 201곳', 'numeric_limits\n'.repeat(100) + '<svg\n'.repeat(101), 0],
    ['< 만', '<'.repeat(64 * 1024 - 1), 0],
    ['< 와 공백', '< '.repeat(32 * 1024 - 1), 0],
    ['< 와 -', ('<' + '-'.repeat(200)).repeat(320), 0],
    ['< 와 !', '<' + '!'.repeat(64 * 1024 - 2), 0],
  ];
  for (const [name, source, count] of rows) {
    const t0 = Date.now();
    assert.equal(marksOf(source).length, count, name);
    assert.ok(Date.now() - t0 < 500, `${name}: ${Date.now() - t0}ms`);
  }
});
