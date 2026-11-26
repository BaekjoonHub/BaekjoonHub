'use strict';

// #353 — 다시 푼 문제의 서로 다른 풀이를 번호 붙은 파일(이름.py, 이름_002.py, 이름_003.py)로 남기는 옵션.
// 실제 util.js·Github.js·storage.js·utils/solutionVersions.js 와 각 플랫폼의 uploadfunctions.js·메인 스크립트(beginUpload)를
// 한 vm 에 로드하고, 파일 내용을 들고 있는 가짜 GitHub(tests/helpers/versionHarness.js) 위에서 업로드 경로를 그대로 태운다.
// 풀이 파일의 저장 위치는 서버가 가진 파일로 검증하고, 서버의 blob SHA 는 확장 코드와 따로 계산한다.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const {
  FakeGithub, loadPlatform, submit, settle, solved, blobSha, PLATFORMS, HOOK, VERSION,
} = require('./helpers/versionHarness.js');

const A = 'print(1)\n';
const B = 'print(2)\n';
const C = 'print(3)\n';
const D = 'print(4)\n';
// 풀이 하나를 올리는 구현은 둘이다: scripts/upload.js 의 upload(백준·프로그래머스)와 SWEA 의 uploadSWEA
const UPLOADERS = ['baekjoon', 'swexpertacademy'];

/** 플랫폼의 풀이 디렉토리와 버전 파일 경로들 */
function paths(platform) {
  const { directory, fileName } = PLATFORMS[platform];
  const dot = fileName.lastIndexOf('.');
  const at = (suffix) => `${directory}/${fileName.slice(0, dot)}${suffix}${fileName.slice(dot)}`;
  return { directory, fileName, plain: at(''), v2: at('_002'), v3: at('_003'), v4: at('_004'), readme: `${directory}/README.md` };
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

test('planSolutionVersion — 같은 코드는 skip, 번호는 같은 이름·확장자의 가장 큰 번호 + 1', async () => {
  const { sandbox } = await load(new FakeGithub(), 'baekjoon');
  const other = [['문제.java', A], ['문제_002.java', B], ['문제2.py', C], ['문제_a.py', C], ['문제_002.py.bak', C], ['x문제.py', C], ['README.md', C]];
  for (const [label, files, fileName, code, expected] of [
    ['버전이 없으면 이름 그대로', [['README.md', 'r'], ['다른.py', A]], '문제.py', A, '문제.py'],
    ['번호 없는 파일과 같은 코드', [['문제.py', A]], '문제.py', A, 'skip'],
    ['번호 붙은 파일과 같은 코드', [['문제.py', A], ['문제_002.py', B]], '문제.py', B, 'skip'],
    ['번호 없는 파일은 1번', [['문제.py', A]], '문제.py', B, '문제_002.py'],
    ['가장 큰 번호 + 1', [['문제.py', A], ['문제_002.py', B]], '문제.py', C, '문제_003.py'],
    ['번호 없는 파일이 지워져도 번호를 다시 쓰지 않는다', [['문제_005.py', A]], '문제.py', B, '문제_006.py'],
    ['빈 번호가 있어도 가장 큰 번호 다음', [['문제.py', A], ['문제_002.py', B], ['문제_007.py', C]], '문제.py', D, '문제_008.py'],
    ['3자리로 0 을 채운다', [['문제_099.py', A]], '문제.py', B, '문제_100.py'],
    ['999 다음은 4자리', [['문제_999.py', A]], '문제.py', B, '문제_1000.py'],
    ['다른 확장자·비슷한 이름만 있으면 번호 없는 이름', other, '문제.py', D, '문제.py'],
    ['다른 확장자·비슷한 이름은 세지 않는다', [...other, ['문제.py', A]], '문제.py', D, '문제_002.py'],
    ['번호 붙은 다른 확장자 파일은 세지 않는다', [['문제.py', A], ['문제_002.py', B]], '문제.java', C, '문제.java'],
    ['확장자 없는 파일 이름', [['Main', A]], 'Main', B, 'Main_002'],
    ['점이 여러 개인 이름', [['1000. A+B.py', A]], '1000. A+B.py', B, '1000. A+B_002.py'],
  ]) {
    const result = sandbox.planSolutionVersion(files.map(([name, content]) => ({ name, sha: blobSha(content) })), fileName, code);
    assert.equal(result.skip ? 'skip' : result.fileName, expected, label);
  }
});

test('플랫폼별 실제 업로드 경로: 옵션 꺼짐은 같은 파일을 덮어쓰고, 켜짐은 다른 풀이를 _002 로 남긴다', async () => {
  for (const platform of Object.keys(PLATFORMS)) {
    for (const keep of [false, true]) {
      const label = `${platform} keep=${keep}`;
      const server = new FakeGithub();
      const loaded = await load(server, platform, { keep });
      const p = paths(platform);
      await submit(loaded, platform, A);
      assert.equal(server.filesAtHead()[p.plain], A, label);
      await submit(loaded, platform, B);
      const expectedNames = keep ? [p.fileName, p.v2.slice(p.directory.length + 1)] : [p.fileName];
      assert.deepEqual(namesIn(server, p.directory), ['README.md', ...expectedNames].sort(), `${label}: README 는 하나`);
      assert.equal(server.filesAtHead()[p.plain], keep ? A : B, label);
      assert.equal(server.history().length, 3, `${label}: c0 + 업로드 두 번`);
      // 같은 코드 재제출은 스킵
      const before = writes(server);
      await submit(loaded, platform, B);
      assert.equal(writes(server), before, label);
      if (!keep) assert.equal(server.listingRefs().length, 0, `${label}: 옵션이 꺼져 있으면 디렉토리 목록을 읽지 않는다`);
      assert.equal(loaded.calls.failed, 0, label);
    }
  }
});

describe('옵션 켜짐 — 백준 beginUpload', () => {
  test('같은 코드는 커밋하지 않고, 다른 코드는 _002 → _003, 옛 버전과 같은 코드는 커밋하지 않는다', async () => {
    const server = new FakeGithub();
    const loaded = await load(server, 'baekjoon', { keep: true });
    const p = paths('baekjoon');

    await submit(loaded, 'baekjoon', A);
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
    assert.deepEqual([files[p.plain], files[p.v2], files[p.v3]], [A, B, C]);
    assert.equal(server.history().length, 4);

    // 옛 버전(번호 없는 파일, _002)과 같은 코드: 커밋 없음
    const w2 = writes(server);
    for (const code of [A, B, C]) await submit(loaded, 'baekjoon', code);
    assert.equal(writes(server), w2);
    assert.equal(server.history().length, 4);

    // 새 코드는 계속 이어서 번호가 붙고, 앞 파일은 그대로다
    await submit(loaded, 'baekjoon', D);
    files = server.filesAtHead();
    assert.deepEqual([files[p.plain], files[p.v2], files[p.v3], files[p.v4]], [A, B, C, D]);
    assert.deepEqual(namesIn(server, p.directory).filter((n) => n.startsWith('README')), ['README.md']);
    assert.equal(loaded.calls.failed, 0);
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
    // 전체 업로드가 "이미 올린 문제" 를 거르는 목록에도 보인다
    assert.ok(loaded.sandbox.extractUploadedProblemIds({ submission, branches }, HOOK, '백준').has('1000'));
  });

  test('수동 업로드 버튼도 같은 규칙: 첫 풀이는 이름 그대로, 다른 풀이는 _002, 같은 코드는 커밋 없이 완료', async () => {
    const server = new FakeGithub();
    const loaded = await load(server, 'baekjoon', { keep: true });
    const p = paths('baekjoon');
    const press = (code) => {
      const classes = new Set(['bjh-upload-icon']);
      const button = { title: '', classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) } };
      loaded.sandbox.findData = async () => solved('baekjoon', code);
      loaded.sandbox.__item = { data: { elementId: 'solution-1' }, button };
      return vm.runInContext('manualUploadQueue.push(__item); processManualUploadQueue();', loaded.sandbox).then(() => classes);
    };
    assert.ok((await press(A)).has('bjh-upload-success'));
    assert.equal(server.filesAtHead()[p.plain], A);
    assert.ok((await press(B)).has('bjh-upload-success'));
    assert.equal(server.filesAtHead()[p.plain], A);
    assert.equal(server.filesAtHead()[p.v2], B);
    const before = writes(server);
    assert.ok((await press(B)).has('bjh-upload-success'));
    assert.equal(writes(server), before);
    assert.equal(server.history().length, 3);
  });
});

describe('옵션 켜짐 — 로컬 캐시가 아니라 GitHub 의 파일로 정한다', () => {
  test('캐시가 비어 있고 GitHub 에 이름·_002 가 있으면 _003 으로 올리고 아무것도 덮지 않는다', async () => {
    for (const platform of UPLOADERS) {
      const p = paths(platform);
      const server = new FakeGithub({ files: { [p.plain]: A, [p.v2]: B, [p.readme]: 'old readme' } });
      const loaded = await load(server, platform, { keep: true, stats: { version: VERSION, branches: {}, submission: {} } });
      await loaded.sandbox.uploadOneSolveProblemOnGit(solved(platform, C), () => {});
      await settle();
      const files = server.filesAtHead();
      assert.deepEqual([files[p.plain], files[p.v2], files[p.v3]], [A, B, C], platform);
      assert.equal(server.history().length, 2, platform);
    }
  });

  test('캐시에는 없지만 GitHub 에 있는 코드와 같으면 커밋하지 않는다', async () => {
    const p = paths('baekjoon');
    const server = new FakeGithub({ files: { [p.plain]: A, [p.v2]: B } });
    const loaded = await load(server, 'baekjoon', { keep: true, stats: { version: VERSION, branches: {}, submission: {} } });
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
  const racing = (p) => new FakeGithub({
    files: { [p.plain]: A },
    beforePatch: (n, s) => { if (n === 1) s.advanceHead({ [p.v2]: B }); },
  });

  test('새 브랜치 끝에 이미 _002 가 있으면 다시 시도한 커밋은 _003 으로 저장된다', async () => {
    for (const platform of UPLOADERS) {
      const p = paths(platform);
      const server = racing(p);
      const loaded = await load(server, platform, { keep: true });
      await loaded.sandbox.uploadOneSolveProblemOnGit(solved(platform, C), () => {});
      await settle();
      const files = server.filesAtHead();
      assert.equal(files[p.plain], A, platform);
      assert.equal(files[p.v2], B, `${platform}: 다른 기기가 올린 파일을 덮지 않는다`);
      assert.equal(files[p.v3], C, platform);
      assert.equal(server.patches, 2, platform);
      // 두 번째 시도는 첫 시도의 부모(c0)가 아니라 옮겨진 브랜치 끝의 파일 목록으로 정했다
      assert.deepEqual(server.listingRefs(), ['c0', 'other1'], platform);
      assert.equal(server.history().length, 3, `${platform}: c0 → 다른 기기 → 이번 업로드`);
    }
  });

  test('새 브랜치 끝에 같은 코드가 이미 있으면 두 번째 사본을 만들지 않는다', async () => {
    for (const platform of UPLOADERS) {
      const p = paths(platform);
      const server = racing(p);
      const loaded = await load(server, platform, { keep: true });
      let marked = 0;
      await loaded.sandbox.uploadOneSolveProblemOnGit(solved(platform, B), () => { marked += 1; });
      await settle();
      assert.equal(server.filesAtHead()[p.v2], B, platform);
      assert.equal(server.filesAtHead()[p.v3], undefined, `${platform}: B 는 한 번만 저장된다`);
      assert.equal(server.head, 'other1', `${platform}: 이번 업로드의 커밋은 브랜치에 오르지 않는다`);
      assert.equal(marked, 1, `${platform}: 완료 표시는 뜬다`);
    }
  });
});
