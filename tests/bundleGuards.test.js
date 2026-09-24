'use strict';

// 콘텐츠 스크립트 번들 가드.
// manifest 의 content_scripts 한 항목(번들)의 파일들은 classic script 로 하나의 전역 스코프를 공유한다.
// - 두 파일이 같은 최상위 이름을 let/const/class 로 선언하면 뒤 파일이 SyntaxError 로 통째로 죽는다.
// - 번들에 없는 파일의 전역(예: toast.js 의 Toast)을 쓰면 그 코드 경로에서 ReferenceError 가 난다.
//   프로그래머스 번들은 toast.js 를 싣지 않아 전체 업로드 실패 안내가 ReferenceError 로 바뀌었다.
// - 업로드는 브랜치를 fast-forward 로만 옮긴다(commitTreeItems). force 로 옮기면 다른 탭의 커밋이 사라진다.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const bundles = manifest.content_scripts.map((entry) => ({ name: entry.matches.join(','), files: entry.js }));

/** 주석을 뺀 코드 (정규식 가드가 원인 설명 주석에 걸리지 않게). 문자열 안의 // 는 드물어 무시한다. */
function codeOf(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** 무엇을 읽든 호출하든 자기 자신을 돌려주는 스텁. 최상위 코드가 DOM/chrome 에 닿아도 선언 검사까지 가게 한다. */
function universalStub() {
  const target = function stub() {};
  const proxy = new Proxy(target, {
    get: (t, key) => (key === 'then' ? undefined : key === Symbol.toPrimitive ? () => '' : proxy),
    apply: () => proxy,
    construct: () => proxy,
  });
  return proxy;
}

/**
 * 파일들을 한 컨텍스트에 순서대로 로드한다. 최상위 런타임 오류(스텁이라 생기는 것)는 무시하고,
 * 전역 선언 충돌·문법 오류(SyntaxError)만 모아 돌려준다. 선언 충돌은 스크립트 실행 전에 검사되므로
 * 앞 스크립트가 런타임 오류로 멈춰도 그 선언은 남아 뒤 스크립트와 충돌을 일으킨다 — 브라우저와 같다.
 */
function loadTogether(sources) {
  const stub = universalStub();
  const sandbox = {
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    chrome: stub,
    document: stub,
    location: stub,
    navigator: stub,
    MutationObserver: stub,
    setInterval: () => 0,
    setTimeout: () => 0,
    clearInterval() {},
    clearTimeout() {},
    fetch: () => new Promise(() => {}),
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  const syntaxErrors = [];
  for (const { filename, code } of sources) {
    try {
      vm.runInContext(code, sandbox, { filename });
    } catch (error) {
      if (error && error.name === 'SyntaxError') syntaxErrors.push(`${filename}: ${error.message}`);
    }
  }
  return syntaxErrors;
}

describe('manifest 콘텐츠 스크립트 번들', () => {
  test('가드 자체 점검: 번들 안의 최상위 이름 충돌을 잡아낸다', () => {
    const errors = loadTogether([
      { filename: 'a.js', code: 'const uploadState = {}; document.body.appendChild(null);' },
      { filename: 'b.js', code: 'let uploadState = 1;' },
    ]);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /b\.js: .*uploadState/);
  });

  for (const bundle of bundles) {
    test(`${bundle.name}: 모든 파일이 존재하고 최상위 선언이 충돌하지 않는다`, () => {
      const sources = bundle.files.map((file) => {
        assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} 이 없다`);
        return { filename: file, code: fs.readFileSync(path.join(ROOT, file), 'utf8') };
      });
      assert.deepEqual(loadTogether(sources), []);
    });

    test(`${bundle.name}: Toast 를 쓰는 파일보다 toast.js 가 먼저 로드된다`, () => {
      const users = bundle.files.filter((file) => file !== 'scripts/toast.js' && /\bToast\s*\.\s*raiseToast\b|\bnew\s+Toast\b/.test(codeOf(file)));
      if (users.length === 0) return;
      const toastIndex = bundle.files.indexOf('scripts/toast.js');
      assert.notEqual(toastIndex, -1, `${users.join(', ')} 가 Toast 를 쓰는데 번들에 scripts/toast.js 가 없다`);
      for (const file of users) assert.ok(bundle.files.indexOf(file) > toastIndex, `${file} 보다 toast.js 가 먼저 와야 한다`);
    });
  }
});

describe('업로드 커밋 소스 가드', () => {
  const uploadFiles = ['baekjoon', 'goormlevel', 'programmers', 'swexpertacademy'].map((dir) => `scripts/${dir}/uploadfunctions.js`);

  test('플랫폼 업로드 코드는 ref 를 직접 옮기지 않고 commitTreeItems 로 커밋한다', () => {
    for (const file of uploadFiles) {
      const code = codeOf(file);
      assert.doesNotMatch(code, /\.updateHead\s*\(/, `${file}: updateHead 를 직접 부르면 fast-forward 재시도가 빠진다`);
      assert.doesNotMatch(code, /\.createCommit\s*\(/, `${file}: createCommit 은 commitTreeItems 안에서만 부른다`);
      assert.match(code, /\.commitTreeItems\s*\(/, `${file}: commitTreeItems 로 커밋해야 한다`);
    }
  });

  test('어디에서도 ref 를 force 로 옮기지 않는다', () => {
    const files = ['scripts/Github.js', ...uploadFiles, 'scripts/baekjoon/baekjoon.js', 'scripts/programmers/programmers.js'];
    for (const file of files) {
      const code = codeOf(file);
      assert.doesNotMatch(code, /force\s*:\s*true/, `${file}: force: true`);
      assert.doesNotMatch(code, /updateHead\s*\([^)]*,\s*true\s*\)/, `${file}: updateHead(..., true)`);
    }
  });

  test('업로드 후 캐시는 recordUploadInStats 로 저장 직전에 다시 읽어 기록한다', () => {
    for (const file of uploadFiles) {
      const code = codeOf(file);
      assert.match(code, /recordUploadInStats\s*\(/, `${file}`);
      // 업로드 시작 전에 읽은 stats 를 업로드가 끝난 뒤 통째로 저장하면 그 사이 다른 탭의 기록을 덮는다.
      // 직접 저장은 바로 앞(몇 줄 안)에서 새로 읽은 경우만 허용한다 (SWEA 의 브랜치 재확인).
      for (const match of code.matchAll(/saveStats\s*\(/g)) {
        const before = code.slice(Math.max(0, match.index - 200), match.index);
        assert.match(before, /await getStats\(\)/, `${file}: 저장 직전에 다시 읽지 않은 saveStats`);
      }
    }
  });
});

describe('버전 갱신 가드', () => {
  // 재구축 결과를 받아 버전을 붙여 다시 저장하면 그 사이 다른 탭의 기록을 덮고, 재구축에 실패해도 버전이 기록된다
  const files = ['scripts/baekjoon/baekjoon.js', 'scripts/programmers/programmers.js', 'scripts/swexpertacademy/swexpertacademy.js', 'scripts/goormlevel/goormlevel.js'];
  test('versionUpdate 는 재구축과 같은 저장에 버전을 기록한다', () => {
    for (const file of files) {
      const code = codeOf(file);
      const body = code.slice(code.indexOf('async function versionUpdate()'));
      const fn = body.slice(0, body.indexOf('\n}') + 2);
      assert.match(fn, /updateLocalStorageStats\(\{\s*version:\s*getVersion\(\)\s*\}\)/, `${file}`);
      assert.doesNotMatch(fn, /saveStats\s*\(/, `${file}: versionUpdate 가 stats 를 다시 저장한다`);
    }
  });
});

describe('암묵적 전역 변수 가드', () => {
  // 선언 없이 대입하면 전역 변수가 되어 같은 탭의 다른 업로드와 값을 공유한다(비동기 업로드가 겹치면 섞인다).
  const files = ['scripts/baekjoon/baekjoon.js', 'scripts/programmers/programmers.js', 'scripts/swexpertacademy/swexpertacademy.js', 'scripts/goormlevel/goormlevel.js'];
  for (const name of ['cachedSHA', 'calcSHA']) {
    test(`${name} 는 선언한 지역 변수다`, () => {
      for (const file of files) {
        const code = codeOf(file);
        if (!new RegExp(`\\b${name}\\b`).test(code)) continue;
        assert.match(code, new RegExp(`\\b(?:const|let)\\s+${name}\\b`), `${file}: ${name} 선언이 없다`);
        const bare = code.split('\n').filter((line) => new RegExp(`^\\s*${name}\\s*=[^=]`).test(line));
        assert.deepEqual(bare, [], `${file}: 선언 없이 ${name} 에 대입한다`);
      }
    });
  }
});
