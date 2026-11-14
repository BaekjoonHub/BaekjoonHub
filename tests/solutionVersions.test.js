'use strict';

// #353 — 다시 푼 문제의 서로 다른 풀이를 번호 붙은 파일(이름.py, 이름_002.py, 이름_003.py)로 남기는 옵션.
// 실제 util.js·Github.js·storage.js·utils/solutionVersions.js 와 각 플랫폼의 uploadfunctions.js·메인 스크립트(beginUpload)를
// 한 vm 에 로드하고, 파일 내용을 들고 있는 가짜 GitHub(tests/helpers/versionHarness.js) 위에서 업로드 경로를 그대로 태운다.
// 풀이 파일의 저장 위치는 서버가 가진 파일로 검증하고, 서버의 blob SHA 는 확장 코드와 따로 계산한다.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  FakeGithub, loadPlatform, submit, settle, solved, blobSha, PLATFORMS, HOOK, VERSION,
} = require('./helpers/versionHarness.js');

const A = 'print(1)\n';
const B = 'print(2)\n';
const C = 'print(3)\n';
const D = 'print(4)\n';
const EMPTY_CACHE = { version: VERSION, branches: {}, submission: {} };

/** 'A+B.py' → ['A+B', '.py'] */
function split(fileName) {
  const dot = fileName.lastIndexOf('.');
  return [fileName.slice(0, dot), fileName.slice(dot)];
}

/** 플랫폼의 풀이 디렉토리와 버전 파일 경로들 */
function paths(platform, ext = null) {
  const { directory, fileName } = PLATFORMS[platform];
  const [stem, ext0] = split(fileName);
  const e = ext || ext0;
  const at = (suffix) => `${directory}/${stem}${suffix}${e}`;
  return { directory, fileName: `${stem}${e}`, plain: at(''), v2: at('_002'), v3: at('_003'), v4: at('_004'), readme: `${directory}/README.md` };
}

/** 서버의 풀이 디렉토리 파일 이름들 (README 포함) */
function namesIn(server, directory) {
  return Object.keys(server.filesAtHead()).filter((p) => p.startsWith(`${directory}/`)).map((p) => p.slice(directory.length + 1)).sort();
}

async function load(server, platform, options) {
  const loaded = loadPlatform(server, platform, options);
  await settle(); // storage.js 가 로드 시점에 시작하는 stats 초기화가 끝나도록
  return loaded;
}

/** 서버에 올라간 (blob·tree·commit·ref 갱신) 쓰기 요청 수 */
const writes = (server) => server.requests.filter((r) => r.startsWith('POST') || r.startsWith('PATCH')).length;

describe('planSolutionVersion — 이름 정하기', () => {
  const plan = async (files, fileName, code) => {
    const { sandbox } = await load(new FakeGithub(), 'baekjoon');
    return sandbox.planSolutionVersion(files.map(([name, content]) => ({ name, sha: blobSha(content) })), fileName, code);
  };

  test('버전이 없으면 이름 그대로', async () => {
    const result = await plan([['README.md', 'r'], ['다른.py', A]], '문제.py', A);
    assert.equal(result.skip, undefined);
    assert.equal(result.fileName, '문제.py');
  });

  test('같은 코드가 번호 없는 파일에도, 번호 붙은 파일에도 있으면 skip', async () => {
    assert.equal((await plan([['문제.py', A]], '문제.py', A)).skip, true);
    assert.equal((await plan([['문제.py', A], ['문제_002.py', B]], '문제.py', B)).skip, true);
  });

  test('번호는 가장 큰 번호 + 1, 번호 없는 파일은 1, 3자리 이상으로 0 을 채운다', async () => {
    assert.equal((await plan([['문제.py', A]], '문제.py', B)).fileName, '문제_002.py');
    assert.equal((await plan([['문제.py', A], ['문제_002.py', B]], '문제.py', C)).fileName, '문제_003.py');
    // 번호 없는 파일이 지워졌어도 번호를 다시 쓰지 않는다
    assert.equal((await plan([['문제_005.py', A]], '문제.py', B)).fileName, '문제_006.py');
    // 빈 번호가 있어도 가장 큰 번호 다음
    assert.equal((await plan([['문제.py', A], ['문제_002.py', B], ['문제_007.py', C]], '문제.py', D)).fileName, '문제_008.py');
    assert.equal((await plan([['문제_099.py', A]], '문제.py', B)).fileName, '문제_100.py');
    assert.equal((await plan([['문제_999.py', A]], '문제.py', B)).fileName, '문제_1000.py');
  });

  test('버전은 이름과 확장자가 모두 같은 파일만 센다', async () => {
    const files = [['문제.java', A], ['문제_002.java', B], ['문제2.py', C], ['문제_a.py', C], ['문제_002.py.bak', C], ['x문제.py', C], ['README.md', C]];
    assert.equal((await plan(files, '문제.py', D)).fileName, '문제.py', '다른 확장자만 있으면 번호 없는 이름');
    assert.equal((await plan([...files, ['문제.py', A]], '문제.py', D)).fileName, '문제_002.py');
  });

  test('확장자 없는 파일 이름과 점이 여러 개인 이름', async () => {
    assert.equal((await plan([['Main', A]], 'Main', B)).fileName, 'Main_002');
    assert.equal((await plan([['1000. A+B.py', A]], '1000. A+B.py', B)).fileName, '1000. A+B_002.py');
  });
});

describe('옵션 꺼짐 — 지금과 같은 동작', () => {
  for (const platform of Object.keys(PLATFORMS)) {
    test(`${platform}: 다른 코드를 다시 올리면 같은 파일을 덮어쓰고 번호 파일은 만들지 않는다`, async () => {
      const server = new FakeGithub();
      const loaded = await load(server, platform, { keep: false });
      const p = paths(platform);
      await submit(loaded, platform, A);
      await submit(loaded, platform, B);
      assert.deepEqual(namesIn(server, p.directory), ['README.md', p.fileName].sort());
      assert.equal(server.filesAtHead()[p.plain], B);
      assert.equal(server.history().length, 3, 'c0 + 업로드 두 번');
      // 같은 코드 재제출은 지금처럼 스킵
      const before = writes(server);
      await submit(loaded, platform, B);
      assert.equal(writes(server), before);
      assert.equal(server.listingRefs().length, 0, '옵션이 꺼져 있으면 디렉토리 목록을 읽지 않는다');
    });
  }
});

describe('옵션 켜짐 — 플랫폼별 실제 업로드 경로', () => {
  for (const platform of Object.keys(PLATFORMS)) {
    test(`${platform}: 첫 풀이는 이름 그대로, 다른 풀이는 _002 로 남는다`, async () => {
      const server = new FakeGithub();
      const loaded = await load(server, platform, { keep: true });
      const p = paths(platform);
      await submit(loaded, platform, A);
      assert.equal(server.filesAtHead()[p.plain], A);
      await submit(loaded, platform, B);
      const files = server.filesAtHead();
      assert.equal(files[p.plain], A, '앞 풀이는 그대로');
      assert.equal(files[p.v2], B);
      assert.deepEqual(namesIn(server, p.directory), ['README.md', p.fileName, p.v2.slice(p.directory.length + 1)].sort(), 'README 는 하나');
      assert.equal(server.history().length, 3);
      assert.equal(loaded.calls.failed, 0);
    });
  }
});

describe('옵션 켜짐 — 번호 규칙 (백준 beginUpload)', () => {
  test('같은 코드는 커밋하지 않고, 다른 코드는 _002 → _003, 옛 버전과 같은 코드는 커밋하지 않는다', async () => {
    const server = new FakeGithub();
    const loaded = await load(server, 'baekjoon', { keep: true });
    const p = paths('baekjoon');

    await submit(loaded, 'baekjoon', A);
    assert.deepEqual(namesIn(server, p.directory), [p.fileName, 'README.md'].sort());
    const markedAfterFirst = loaded.calls.uploaded.length;

    // 같은 코드 다시: 커밋도, blob/tree 업로드도 없고 완료 표시는 그대로 뜬다
    const w1 = writes(server);
    await submit(loaded, 'baekjoon', A);
    assert.equal(writes(server), w1);
    assert.equal(server.history().length, 2);
    assert.equal(loaded.calls.uploaded.length, markedAfterFirst + 1, '완료 표시는 지금처럼 뜬다');

    await submit(loaded, 'baekjoon', B);
    await submit(loaded, 'baekjoon', C);
    let files = server.filesAtHead();
    assert.equal(files[p.plain], A);
    assert.equal(files[p.v2], B);
    assert.equal(files[p.v3], C);
    assert.equal(server.history().length, 4);

    // 옛 버전(번호 없는 파일, _002)과 같은 코드: 커밋 없음
    const w2 = writes(server);
    await submit(loaded, 'baekjoon', A);
    await submit(loaded, 'baekjoon', B);
    await submit(loaded, 'baekjoon', C);
    assert.equal(writes(server), w2);
    assert.equal(server.history().length, 4);

    // 새 코드는 계속 이어서 번호가 붙고, 앞 파일은 그대로다
    await submit(loaded, 'baekjoon', D);
    files = server.filesAtHead();
    assert.equal(files[p.v4], D);
    assert.deepEqual([files[p.plain], files[p.v2], files[p.v3]], [A, B, C]);
    assert.deepEqual(namesIn(server, p.directory).filter((n) => n.startsWith('README')), ['README.md']);
    assert.equal(loaded.calls.failed, 0);
  });

  test('같은 디렉토리의 다른 확장자는 번호 없는 이름부터 시작한다', async () => {
    const server = new FakeGithub();
    const loaded = await load(server, 'baekjoon', { keep: true });
    const py = paths('baekjoon');
    const java = paths('baekjoon', '.java');
    await submit(loaded, 'baekjoon', A);
    await submit(loaded, 'baekjoon', B);
    await submit(loaded, 'baekjoon', 'class Main {}\n', { fileName: java.fileName });
    let files = server.filesAtHead();
    assert.equal(files[java.plain], 'class Main {}\n');
    assert.equal(files[java.v2], undefined, '다른 확장자의 첫 풀이는 번호가 붙지 않는다');
    assert.equal(files[py.v2], B);
    await submit(loaded, 'baekjoon', 'class Main { int x; }\n', { fileName: java.fileName });
    files = server.filesAtHead();
    assert.equal(files[java.v2], 'class Main { int x; }\n');
    assert.equal(files[py.v3], undefined, 'py 의 번호는 java 와 따로 센다');
  });

  test('업로드 뒤 stats 캐시에 번호 붙은 실제 경로와 blob SHA 가 남는다', async () => {
    const server = new FakeGithub();
    const loaded = await load(server, 'baekjoon', { keep: true });
    const p = paths('baekjoon');
    await submit(loaded, 'baekjoon', A);
    await submit(loaded, 'baekjoon', B);
    const { submission, branches } = loaded.store.get('stats');
    const cached = (file) => loaded.sandbox.getObjectDatafromPath(submission, `${HOOK}/${file}`);
    assert.equal(cached(p.plain), blobSha(A));
    assert.equal(cached(p.v2), blobSha(B), '번호 붙은 경로에 서버가 가진 blob SHA');
    assert.equal(cached(p.v2), server.commits[server.head].files.get(p.v2));
    assert.equal(cached(p.readme), blobSha('# readme\n'));
    assert.equal(branches[HOOK], 'main');
    // 전체 업로드가 "이미 올린 문제" 를 거르는 목록(statusicons.js 의 extractUploadedProblemIds)에도 보인다
    const icons = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'baekjoon', 'statusicons.js'), 'utf8');
    vm.runInContext(icons.slice(0, icons.indexOf('async function injectUploadStatusIcons')), loaded.sandbox);
    assert.ok(loaded.sandbox.extractUploadedProblemIds({ submission, branches }, HOOK).has('1000'));
  });
});

describe('옵션 켜짐 — 로컬 캐시가 아니라 GitHub 의 파일로 정한다', () => {
  for (const platform of Object.keys(PLATFORMS)) {
    test(`${platform}: 캐시가 비어 있고 GitHub 에 이름·_002 가 있으면 _003 으로 올리고 아무것도 덮지 않는다`, async () => {
      const p = paths(platform);
      const server = new FakeGithub({ files: { [p.plain]: A, [p.v2]: B, [p.readme]: 'old readme' } });
      const loaded = await load(server, platform, { keep: true, stats: EMPTY_CACHE });
      await loaded.sandbox.uploadOneSolveProblemOnGit(solved(platform, C), () => {});
      await settle();
      const files = server.filesAtHead();
      assert.equal(files[p.plain], A);
      assert.equal(files[p.v2], B);
      assert.equal(files[p.v3], C);
      assert.equal(server.history().length, 2);
    });
  }

  test('캐시에는 없지만 GitHub 에 있는 코드와 같으면 커밋하지 않는다', async () => {
    const p = paths('baekjoon');
    const server = new FakeGithub({ files: { [p.plain]: A, [p.v2]: B } });
    const loaded = await load(server, 'baekjoon', { keep: true, stats: EMPTY_CACHE });
    await submit(loaded, 'baekjoon', B);
    assert.equal(writes(server), 0);
    assert.ok(loaded.calls.uploaded.length >= 1);
  });

  test('캐시가 낡아 이름의 SHA 가 이번 코드로 되어 있어도 GitHub 에 없으면 올린다', async () => {
    const p = paths('baekjoon');
    const server = new FakeGithub({ files: { [p.plain]: A } });
    const loaded = await load(server, 'baekjoon', { keep: true });
    // 캐시는 이름 그대로의 파일이 B 라고 믿는다 (GitHub 에는 A)
    const stats = loaded.store.get('stats');
    loaded.sandbox.updateObjectDatafromPath(stats.submission, `${HOOK}/${p.plain}`, blobSha(B));
    loaded.store.set('stats', JSON.parse(JSON.stringify(stats)));
    await submit(loaded, 'baekjoon', B);
    assert.equal(server.filesAtHead()[p.v2], B);
    assert.equal(server.filesAtHead()[p.plain], A);
  });

  test('디렉토리 목록은 이번 커밋의 부모 커밋에서 읽고, 공백·한글·#·+ 가 든 경로도 읽는다', async () => {
    const server = new FakeGithub({ files: { [paths('programmers').plain]: A } });
    const loaded = await load(server, 'programmers', { keep: true });
    await submit(loaded, 'programmers', B);
    assert.deepEqual(server.listingRefs(), ['c0']);
    assert.equal(server.filesAtHead()[paths('programmers').v2], B);
  });

  test('디렉토리에 파일이 1,000개 이상이면 번호를 잘못 매기지 않고 커밋 없이 실패한다', async () => {
    const { directory } = paths('baekjoon');
    const files = {};
    for (let i = 0; i < 1000; i += 1) files[`${directory}/x${i}.txt`] = String(i);
    const server = new FakeGithub({ files });
    const loaded = await load(server, 'baekjoon', { keep: true });
    await assert.rejects(loaded.sandbox.uploadOneSolveProblemOnGit(solved('baekjoon', A), () => {}), /1,000/);
    assert.equal(writes(server), 0);
  });
});

describe('옵션 켜짐 — 커밋이 밀려 다시 시도될 때 (다른 탭·기기와 경합)', () => {
  for (const platform of Object.keys(PLATFORMS)) {
    test(`${platform}: 새 브랜치 끝에 이미 _002 가 있으면 다시 시도한 커밋은 _003 으로 저장된다`, async () => {
      const p = paths(platform);
      const server = new FakeGithub({
        files: { [p.plain]: A },
        beforePatch: (n, s) => { if (n === 1) s.advanceHead({ [p.v2]: B }); },
      });
      const loaded = await load(server, platform, { keep: true });
      await loaded.sandbox.uploadOneSolveProblemOnGit(solved(platform, C), () => {});
      await settle();
      const files = server.filesAtHead();
      assert.equal(files[p.plain], A);
      assert.equal(files[p.v2], B, '다른 기기가 올린 파일을 덮지 않는다');
      assert.equal(files[p.v3], C);
      assert.equal(server.patches, 2);
      // 두 번째 시도는 첫 시도의 부모(c0)가 아니라 옮겨진 브랜치 끝의 파일 목록으로 정했다
      assert.deepEqual(server.listingRefs(), ['c0', 'other1']);
      assert.equal(server.history().length, 3, 'c0 → 다른 기기 → 이번 업로드');
    });

    test(`${platform}: 새 브랜치 끝에 같은 코드가 이미 있으면 두 번째 사본을 만들지 않는다`, async () => {
      const p = paths(platform);
      const server = new FakeGithub({
        files: { [p.plain]: A },
        beforePatch: (n, s) => { if (n === 1) s.advanceHead({ [p.v2]: B }); },
      });
      const loaded = await load(server, platform, { keep: true });
      let marked = 0;
      await loaded.sandbox.uploadOneSolveProblemOnGit(solved(platform, B), () => { marked += 1; });
      await settle();
      const files = server.filesAtHead();
      assert.equal(files[p.v2], B);
      assert.equal(files[p.v3], undefined, 'B 는 한 번만 저장된다');
      assert.equal(server.head, 'other1', '이번 업로드의 커밋은 브랜치에 오르지 않는다');
      assert.equal(marked, 1, '완료 표시는 뜬다');
    });
  }

  test('같은 문제를 동시에 올리는 두 업로드(다른 코드)는 서로 다른 번호로 둘 다 남는다', async () => {
    const p = paths('baekjoon');
    const server = new FakeGithub({ files: { [p.plain]: A } });
    const one = await load(server, 'baekjoon', { keep: true });
    const two = await load(server, 'baekjoon', { keep: true });
    await Promise.all([
      one.sandbox.uploadOneSolveProblemOnGit(solved('baekjoon', B), () => {}),
      two.sandbox.uploadOneSolveProblemOnGit(solved('baekjoon', C), () => {}),
    ]);
    await settle();
    const files = server.filesAtHead();
    assert.equal(files[p.plain], A);
    assert.deepEqual([files[p.v2], files[p.v3]].sort(), [B, C]);
  });

  test('같은 문제를 동시에 올리는 두 업로드(같은 코드)는 한 번만 저장된다', async () => {
    const p = paths('baekjoon');
    const server = new FakeGithub({ files: { [p.plain]: A } });
    const one = await load(server, 'baekjoon', { keep: true });
    const two = await load(server, 'baekjoon', { keep: true });
    await Promise.all([
      one.sandbox.uploadOneSolveProblemOnGit(solved('baekjoon', B), () => {}),
      two.sandbox.uploadOneSolveProblemOnGit(solved('baekjoon', B), () => {}),
    ]);
    await settle();
    const copies = Object.entries(server.filesAtHead()).filter(([file, content]) => file.startsWith(`${p.directory}/`) && content === B);
    assert.equal(copies.length, 1);
    assert.equal(server.filesAtHead()[p.v3], undefined);
  });
});

describe('옵션 켜짐 — 백준 수동 업로드 버튼', () => {
  function pressManualUpload(loaded, code) {
    const classes = new Set(['bjh-upload-icon']);
    const button = { title: '', classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) } };
    loaded.sandbox.findData = async () => solved('baekjoon', code);
    loaded.sandbox.__item = { data: { elementId: 'solution-1' }, button };
    return vm.runInContext('manualUploadQueue.push(__item); processManualUploadQueue();', loaded.sandbox).then(() => classes);
  }

  test('수동 업로드도 같은 규칙: 첫 풀이는 이름 그대로, 다른 풀이는 _002, 같은 코드는 커밋 없이 완료', async () => {
    const server = new FakeGithub();
    const loaded = await load(server, 'baekjoon', { keep: true });
    const p = paths('baekjoon');
    assert.ok((await pressManualUpload(loaded, A)).has('bjh-upload-success'));
    assert.equal(server.filesAtHead()[p.plain], A);
    assert.ok((await pressManualUpload(loaded, B)).has('bjh-upload-success'));
    assert.equal(server.filesAtHead()[p.plain], A);
    assert.equal(server.filesAtHead()[p.v2], B);
    const before = writes(server);
    const classes = await pressManualUpload(loaded, B);
    assert.equal(writes(server), before);
    assert.ok(classes.has('bjh-upload-success'));
    assert.equal(server.history().length, 3);
  });

  test('옵션이 꺼져 있으면 수동 업로드는 지금처럼 같은 파일을 덮어쓴다', async () => {
    const server = new FakeGithub();
    const loaded = await load(server, 'baekjoon', { keep: false });
    const p = paths('baekjoon');
    await pressManualUpload(loaded, A);
    await pressManualUpload(loaded, B);
    assert.equal(server.filesAtHead()[p.plain], B);
    assert.equal(server.filesAtHead()[p.v2], undefined);
  });
});

describe('옵션 저장소', () => {
  test('getKeepSolutionVersionsOption 은 true 로 저장된 값만 켜진 것으로 본다 (기본 꺼짐)', async () => {
    const off = await load(new FakeGithub(), 'baekjoon', { keep: false });
    assert.equal(await off.sandbox.getKeepSolutionVersionsOption(), false);
    off.store.set('bjhKeepSolutionVersions', 'true');
    assert.equal(await off.sandbox.getKeepSolutionVersionsOption(), false);
    const on = await load(new FakeGithub(), 'baekjoon', { keep: true });
    assert.equal(await on.sandbox.getKeepSolutionVersionsOption(), true);
  });
});
