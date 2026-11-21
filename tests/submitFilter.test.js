'use strict';

// #371: 백준 제출 페이지에서 서버가 거부(403)하는 것으로 알려진 문자열(CRS 규칙 941180 의 단어)을 편집기에 표시한다.
// 실제 submitfilter.js 를 vm 에 로드하고, 가짜 편집기·문서·시계로 표시와 툴팁을 본다.

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
    ops: 0,
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
    operation: (fn) => (e.ops++, fn()),
    on: (name, fn) => e.handlers.push([name, fn]),
    off: (name, fn) => (e.handlers = e.handlers.filter((h) => h[0] !== name || h[1] !== fn)),
    /** 지워지지 않은 표시를 [[from line, ch], [to line, ch]] 로 */
    live: () => e.all.filter((m) => !m.cleared).map((m) => [[m.from.line, m.from.ch], [m.to.line, m.to.ch]]),
    type(newText) {
      e.text = newText;
      e.handlers.filter((h) => h[0] === 'change').forEach((h) => h[1]());
    },
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

test('while (n --> 0) 의 --> 에 표시한다', () => {
  assert.deepEqual(marksOf('while (n --> 0) {'), [[[0, 9], [0, 12]]]);
});

test('대소문자를 가리지 않는다 (Document.Write)', () => {
  assert.deepEqual(marksOf('Document.Write('), [[[0, 0], [0, 14]]]);
});

test('한 소스의 여러 곳에 줄과 열 위치대로 표시한다', () => {
  assert.deepEqual(marksOf('<!-- a -->\nx = window.location;'), [
    [[0, 0], [0, 4]],
    [[0, 7], [0, 10]],
    [[1, 4], [1, 19]],
  ]);
});

test('바꾼 뒤 250ms 가 지나야 다시 찾고, 이전 표시는 지운다', () => {
  const editor = fakeEditor('a --> b');
  const page = load(editor);
  assert.equal(editor.ops, 1);
  editor.type('document.write(1); x = y;');
  page.advance(200);
  assert.equal(editor.ops, 1, '타이핑 중에는 돌지 않는다');
  page.advance(60);
  assert.equal(editor.ops, 2);
  assert.deepEqual(editor.live(), [[[0, 0], [0, 14]]]);
  editor.type('ordinary');
  page.advance(250);
  assert.deepEqual(editor.live(), []);
});

const ORDINARY = {
  'C++ cin/cout': '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n  int a, b;\n  cin >> a >> b;\n  cout << a + b << "\\n";\n  return 0;\n}\n',
  'Java Scanner': 'import java.util.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int a = sc.nextInt(), b = sc.nextInt();\n    System.out.println(a + b);\n  }\n}\n',
  Python: 'a, b = map(int, input().split())\nprint(a + b)\n',
  'C scanf/printf': '#include <stdio.h>\nint main() {\n  int a, b;\n  scanf("%d %d", &a, &b);\n  printf("%d\\n", a + b);\n  return 0;\n}\n',
};
for (const [name, source] of Object.entries(ORDINARY)) {
  test(`평범한 A+B 풀이는 표시하지 않는다: ${name}`, () => {
    assert.deepEqual(marksOf(source), []);
  });
}

test('표시에 마우스를 올리면 문자열과 안내를 글로만 보여 주고, 떠나면 없앤다', () => {
  const editor = fakeEditor('while (n --> 0) {');
  const page = load(editor);
  let prevented = 0;
  page.fire('mouseover', { target: markElement(editor, 0), preventDefault: () => prevented++ });

  assert.equal(page.body.children.length, 1);
  const tip = page.body.children[0];
  assert.equal(tip.attrs.role, 'tooltip');
  assert.equal(tip.style.position, 'fixed');
  assert.equal(tip.htmlSet, false, 'HTML 이 아니라 글로 넣는다');
  assert.equal(
    tip.textContent,
    '백준허브: 이 부분(-->)이 들어 있으면 백준 서버가 제출을 거부(403)하는 것으로 알려져 있습니다. 제출하려면 이 부분을 바꿔 주세요. 예: n --> 0 은 n-- > 0 처럼 띄어 쓰면 됩니다.'
  );
  assert.equal(prevented, 0);

  page.fire('mouseout', {});
  assert.equal(tip.removed, true);
});

test('data-bjh-pattern 속성이 없거나 패턴을 가리키지 않는 표시에는 툴팁이 없다', () => {
  const editor = fakeEditor('document.cookie');
  const page = load(editor);
  for (const value of [null, '', '99']) {
    const el = markElement(editor, 0);
    el.getAttribute = () => value;
    page.fire('mouseover', { target: el });
    assert.equal(page.body.children.length, 0, `속성 ${JSON.stringify(value)}`);
  }
});

test('-->가 아닌 단어의 안내에는 띄어 쓰라는 말이 없다', () => {
  const editor = fakeEditor('document.cookie');
  const page = load(editor);
  page.fire('mouseover', { target: markElement(editor, 0) });
  const text = page.body.children[0].textContent;
  assert.match(text, /^백준허브: 이 부분\(document\.cookie\)이 들어 있으면/);
  assert.doesNotMatch(text, /띄어/);
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

test('70KB 소스는 표시도 오류도 없고, 히트가 200곳을 넘어도 표시하지 않는다', () => {
  assert.deepEqual(marksOf('x'.repeat(70 * 1024) + ' -->'), []);
  assert.equal(marksOf('-->\n'.repeat(200)).length, 200);
  assert.equal(marksOf('-->\n'.repeat(201)).length, 0);
});

test('편집기가 5초 안에 나타나지 않으면 아무것도 하지 않는다', () => {
  const listeners = [];
  const timers = [];
  const context = vm.createContext({
    document: { querySelector: () => null, addEventListener: (t) => listeners.push(t) },
    setTimeout: (fn, ms) => timers.push([fn, ms]),
  });
  vm.runInContext(SRC, context);
  for (let i = 0; i < 40 && timers.length; i++) timers.shift()[0]();
  assert.equal(timers.length, 0);
  assert.deepEqual(listeners, []);
});
