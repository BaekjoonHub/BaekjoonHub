/* 세 플랫폼이 함께 쓰는 업로드 흐름. manifest 의 각 번들에서 storage.js 뒤, 플랫폼 스크립트 앞에 로드한다.
   uploadOneSolveProblemOnGit 은 각 플랫폼의 uploadfunctions.js 가 정의한다(토큰 만료 때 할 일이 플랫폼마다 다르다). */

/* 버전은 재구축과 같은 저장에 기록한다(레포 파일 목록을 읽지 못했으면 기록하지 않아 다음에 다시 재구축한다).
   재구축 결과를 받아 버전을 붙여 다시 저장하면, 그 사이 다른 탭이 남긴 업로드 기록을 덮는다. */
async function versionUpdate() {
  log('start versionUpdate');
  const stats = await updateLocalStorageStats({ version: getVersion() });
  log('stats updated.', stats);
}

/**
 * 파싱한 풀이를 올립니다. 같은 코드가 이미 올라가 있으면 커밋 없이 완료 표시만 합니다.
 * @param {{code: string, directory: string, fileName: string}} bojData - 플랫폼의 파싱 결과
 * @param {function(object, string): void} markUploaded - 완료 표시 (branches, directory)
 */
async function uploadUnlessSame(bojData, markUploaded) {
  const stats = await getStats();
  const hook = await getHook();
  const token = await getToken();

  /* 버전이 바뀌었거나 이 hook 의 캐시가 없으면 레포 파일 목록으로 캐시를 다시 만든다 */
  if (isNull(stats.version) || stats.version !== getVersion() || isNull(await getStatsSHAfromPath(hook))) {
    await versionUpdate();
  }

  /* 풀이별 파일 보관 옵션이 켜져 있으면 같은 코드인지도 캐시가 아니라 GitHub 의 파일 목록으로 정한다(utils/solutionVersions.js).
     같은 코드면 upload 가 커밋 없이 끝나고 완료 표시는 콜백이 한다. */
  if (!(await getKeepSolutionVersionsOption())) {
    const path = `${bojData.directory}/${bojData.fileName}`;
    const cachedSHA = await getStatsSHAfromPath(`${hook}/${path}`);
    const calcSHA = calculateBlobSHA(bojData.code);
    log('cachedSHA', cachedSHA, 'calcSHA', calcSHA);
    // 캐시에 없으면(레포에서 지운 파일일 수도 있다) 원격 파일과 비교한다
    const uploadedSHA = isNull(cachedSHA) ? (await getFile(hook, token, path))?.sha : cachedSHA;
    if (uploadedSHA === calcSHA) {
      markUploaded(stats.branches, bojData.directory);
      console.log('같은 코드가 이미 올라가 있어 업로드를 건너뜁니다.');
      return;
    }
  }
  await uploadOneSolveProblemOnGit(bojData, markUploaded);
}

/**
 * 풀이 하나(소스·README·예제 입출력)를 한 커밋으로 올리고 캐시에 기록합니다.
 * (SWEA 는 캐시한 브랜치를 쓰는 자체 구현 uploadSWEA 를 쓴다)
 * @param {string} token - GitHub 토큰
 * @param {string} hook - 'owner/repo'
 * @param {{code: string, readme: string, directory: string, fileName: string, message: string, samples?: Array<{input: string, output: string}>}} bojData - 플랫폼의 파싱 결과 (samples 는 백준의 예제 입출력)
 * @param {function(object, string, boolean): void} cb - 업로드 뒤 완료 표시 (branches, directory, true). 같은 코드라 건너뛸 때는 uploadUnlessSame 이 앞의 두 인자로만 부른다.
 */
async function upload(token, hook, { code, readme, directory, fileName, message, samples }, cb) {
  const git = new GitHub(hook, token);
  const default_branch = await git.getDefaultBranchOnRepo();
  const tree_items = [
    await createSolutionItem(git, code, `${directory}/${fileName}`),
    await createSolutionItem(git, readme, `${directory}/README.md`),
  ];
  if (samples?.length > 0 && (await getSaveExamplesOption())) {
    for (const entry of samplesToFileEntries(samples)) {
      tree_items.push(await createSolutionItem(git, entry.content, `${directory}/${entry.filename}`));
    }
  }

  /* 풀이별 파일 보관 옵션이 켜져 있으면 풀이 파일의 경로(이름_002.py …)를 커밋의 부모에서 정한다(utils/solutionVersions.js) */
  const commit = await prepareSolutionItems(git, directory, fileName, code, tree_items);
  // 브랜치는 fast-forward 로만 옮긴다 — 다른 탭이 그 사이 커밋했으면 그 위에 다시 커밋한다 (commitTreeItems 참고)
  await git.commitTreeItems(default_branch, commit.items, message);

  /* 올린 항목만 기록하고(createTree 응답의 tree 는 루트 목록이라 쓰면 캐시가 무너진다),
     저장 직전에 다시 읽어 다른 탭의 기록을 덮지 않는다. */
  const stats = await recordUploadInStats(hook, default_branch, commit.committed);
  if (typeof cb === 'function') cb(stats.branches, directory, true);
}

/**
 * 전체 업로드: 풀이 하나의 파일들을 zip(커밋 실패 때 내려받는 백업)과 tree 항목에 싣습니다.
 * blob 생성 API 호출을 줄이려고 content 를 tree 에 직접 싣는다.
 * @param {JSZip} zip
 * @param {Array<object>} treeItems - createTree 에 넘길 항목 (여기에 더한다)
 * @param {string} directory - 풀이 디렉토리
 * @param {Array<[string, string]>} files - [파일 이름, 내용]
 */
function addBulkFiles(zip, treeItems, directory, files) {
  // 한 문제의 파일은 zip 에서도 한 폴더에 둔다: 하나라도 너무 길면 그 문제의 경로를 모두 같은 한도로 줄인다
  const tooLong = files.some(([name]) => utf8Size(`${directory}/${name}`) > ZIP_PATH_MAX_BYTES);
  for (const [name, content] of files) {
    const path = `${directory}/${name}`;
    zip.file(tooLong ? shortenZipPath(path) : path, content);
    treeItems.push({ path, mode: '100644', type: 'blob', content });
  }
}

/* Windows 의 압축 폴더는 zip 안 경로가 UTF-8 로 260바이트 이상인 항목이 하나라도 있으면 zip 전체를 올바르지 않다며 열지 않는다(#388).
   한글·전각 문자·U+2005 는 글자당 3바이트라 문제 제목이 40자쯤이면 넘는다. */
const ZIP_PATH_MAX_BYTES = 259;

function utf8Size(text) {
  return new TextEncoder().encode(text).length;
}

/**
 * zip 안 경로를 Windows 가 열 수 있는 길이로 줄입니다. zip 안에서만 줄인다(레포에 올리는 경로는 그대로다).
 * 조각(폴더·파일 이름)마다 같은 한도로 뒤를 자르고, 파일 이름의 확장자는 남긴다.
 * shortcut: 줄인 폴더 이름이 겹치면 한 폴더로 합쳐진다(기본 경로는 문제 번호로 시작해 겹치지 않는다), 사용자 지정 경로에서 보고되면 번호를 붙인다.
 * @param {string} path
 * @returns {string}
 */
function shortenZipPath(path) {
  const segments = path.split('/');
  const limit = Math.floor((ZIP_PATH_MAX_BYTES - (segments.length - 1)) / segments.length);
  return segments.map((segment, index) => {
    const dot = index === segments.length - 1 ? segment.lastIndexOf('.') : -1;
    const extension = dot > 0 ? segment.slice(dot) : '';
    const stem = [...segment.slice(0, segment.length - extension.length)]; // 글자(코드 포인트) 단위로 자른다
    while (stem.length > 0 && utf8Size(stem.join('') + extension) > limit) stem.pop();
    return stem.join('') + extension;
  }).join('/');
}

/* v1.7.2 까지는 백준이 요청을 막았을 때의 403 응답 본문(134바이트 HTML)을 풀이 코드로 올렸다. 그 파일의 git blob sha 다.
   이 파일이 든 문제는 올린 문제로 치지 않아, 전체 업로드가 같은 경로에 다시 올린다.
   shortcut: 풀이 파일 이름이 그때와 달라지면(가장 좋은 제출의 언어가 바뀜) 옛 파일이 남아 계속 다시 올린다, 그런 보고가 오면 옛 파일을 지우는 항목을 커밋에 더한다. */
const BOJ_BLOCKED_BLOB_SHA = '178a959522ce55eb27b5a8734133a7d4beed8b6e';

/**
 * stats 캐시에서 이미 올린 문제 번호를 모읍니다. (폴더 이름 맨 앞의 숫자)
 * 플랫폼 폴더는 레포 바로 아래(플랫폼별 정리)나 언어 폴더 아래(언어별 정리)에 있다.
 * @param {object} stats
 * @param {string} hook - 'owner/repo'
 * @param {string} platform - 플랫폼 폴더 이름 ('백준', '프로그래머스', 'SWEA')
 * @param {boolean} [blocked] - true 면 403 응답이 풀이로 올라간 문제만, false 면 그것을 뺀 문제만 모은다
 * @returns {Set<string>}
 */
function extractUploadedProblemIds(stats, hook, platform, blocked = false) {
  const uploadedIds = new Set();
  const [owner, repo] = (hook || '').split('/');
  const repoObj = stats?.submission?.[owner]?.[repo];
  if (isNull(repoObj)) return uploadedIds;
  const languageNodes = Object.keys(repoObj).filter((key) => key !== platform).map((key) => repoObj[key]);
  for (const node of [repoObj, ...languageNodes]) {
    if (isNull(node) || typeof node !== 'object' || isNull(node[platform])) continue;
    for (const [key, folder] of Object.entries(node[platform])) {
      const match = key.match(/^(\d+)/);
      if (match && Object.values(folder || {}).includes(BOJ_BLOCKED_BLOB_SHA) === blocked) uploadedIds.add(match[1]);
    }
  }
  return uploadedIds;
}

/* 전체 업로드의 진행 모달(progressModal, toast.js)과 진행 수. modal 은 전체 업로드가 도는 동안에만 있다.
   reload: 이 페이지에서 올린 문제가 있으면, 결과를 닫을 때 새로 고쳐 올라간 표시를 보여 준다. */
const multiloader = { modal: null, done: 0, total: 0, startedAt: 0, note: '', reload: false };

/** 전체 업로드 진행 모달을 띄웁니다. 가져올 문제 수를 알기 전의 막대는 비어 있다. */
function insertMultiLoader(note) {
  Object.assign(multiloader, { modal: progressModal('전체제출 업로드'), done: 0, total: 0, note });
  updateMultiLoader({ status: '제출 목록을 읽는 중…', note });
}

/**
 * 진행 모달의 문구를 바꿉니다. 모달이 없으면(자동·수동 업로드) 아무 일도 하지 않습니다.
 * @param {{status?: string, note?: string, value?: number, max?: number, eta?: string, pausable?: boolean}} fields
 */
function updateMultiLoader(fields) {
  multiloader.modal?.update(fields);
}

/** 가져올 문제 수를 정하고, 이때부터 일시정지할 수 있게 합니다. */
function setMultiLoaderDenom(num) {
  multiloader.total = num;
  multiloader.startedAt = Date.now();
  updateMultiLoader({ pausable: true });
  incMultiLoader(0);
}

/** 가져온 문제 수를 늘립니다. 기다린다는 안내(백준의 fetchBoj)가 떠 있었다면 기본 안내로 되돌립니다. */
function incMultiLoader(num) {
  multiloader.done += num;
  const { done, total, startedAt, note } = multiloader;
  // 남은 시간은 지금까지의 속도로 어림한다. 처음 몇 문제는 값이 크게 흔들려 보여 주지 않는다.
  const left = done >= 5 && done < total ? ((Date.now() - startedAt) / done) * (total - done) : null;
  const eta = left === null ? '' : left < 60000 ? '1분 안에 끝남' : `약 ${Math.round(left / 60000)}분 남음`;
  updateMultiLoader({ status: '문제와 제출 코드를 가져오는 중…', note, value: done, max: total, eta });
}

/** 결과를 보여 주고 전체 업로드를 끝냅니다. options 는 progressModal 의 finish 와 같다(onClose 는 여기서 정한다). */
function finishMultiLoader(message, options = {}) {
  const { modal } = multiloader;
  multiloader.modal = null;
  modal?.finish(message, { ...options, onClose: multiloader.reload ? () => location.reload() : null });
}

/**
 * 맞은 문제 전체를 커밋 하나로 올립니다. 백준·프로그래머스·SWEA 의 전체 업로드가 이 흐름을 함께 쓴다.
 * 레포 파일 목록 동기화 → 맞은 문제 목록 → 이미 올린 문제 제외 → 문제별로 가져오기 → 커밋 → 기록.
 * 가져오지 못한 문제는 건너뛰고 결과에 번호와 이유를 보여 주며, 그 문제만 다시 시도할 수 있다.
 * @param {object} platform
 * @param {string} platform.folder - 레포의 플랫폼 폴더 이름 ('백준', '프로그래머스', 'SWEA')
 * @param {string} platform.zipName - 커밋에 실패했을 때 내려받는 zip 파일 이름의 앞부분
 * @param {number} platform.poolLimit - 동시에 가져올 문제 수
 * @param {function(): Promise<Array<{problemId: string}>>} platform.listSolved - 맞은 문제 목록
 * @param {function(object): Promise<{directory: string, fileName: string, code: string, readme: string, samples?: Array}>} platform.fetchOne
 *   - 목록의 한 문제를 올릴 내용으로 바꾼다. 가져오지 못하면 이유를 담아 throw 한다.
 * @param {string} [platform.note] - 진행 중에 보여 줄 안내
 * @param {Array<object>} [only] - 다시 시도할 문제들. 주면 맞은 문제 목록을 다시 읽지 않는다.
 */
async function uploadAllSolved(platform, only) {
  const treeItems = [];
  const zip = new JSZip();
  insertMultiLoader(platform.note || '이 탭을 닫거나 다른 페이지로 가면 업로드가 멈춥니다.');
  try {
    // 1. 레포 파일 목록으로 업로드 기록을 맞춘다
    const stats = await updateLocalStorageStats();
    const hook = await getHook();
    const git = new GitHub(hook, await getToken());
    const branch = stats.branches[hook];
    // 브랜치가 없으면 오래 걸리는 파싱 전에 멈춘다. 커밋의 부모는 커밋 직전에 다시 읽는다(commitTreeItems).
    await git.getReference(branch);

    // 2. 맞은 문제 가운데 아직 올리지 않은 것
    const uploadedIds = extractUploadedProblemIds(stats, hook, platform.folder);
    const list = (only || (await platform.listSolved())).filter((item) => !uploadedIds.has(String(item.problemId)));
    if (list.length === 0) return finishMultiLoader('새로 올릴 문제가 없습니다. 이미 모두 올라가 있습니다.');

    // 3. 문제별로 가져온다. 멈춰 있는 동안(일시정지)에는 다음 문제를 시작하지 않는다.
    setMultiLoaderDenom(list.length);
    const failed = [];
    const fetched = (await asyncPool(platform.poolLimit, list, async (item) => {
      try {
        await multiloader.modal?.running();
        const data = await platform.fetchOne(item);
        if (isNull(data) || isEmpty(data.code) || isEmpty(data.readme)) throw new Error('제출한 코드나 문제 설명을 찾지 못했습니다.');
        return data;
      } catch (error) {
        console.warn('[BaekjoonHub] 문제를 가져오지 못했습니다.', item.problemId, error);
        failed.push({ item, reason: error?.message || String(error) });
        return null;
      } finally {
        incMultiLoader(1);
      }
    })).filter(Boolean);

    // 4. 커밋 하나로 올린다
    if (fetched.length > 0) {
      const saveExamples = await getSaveExamplesOption();
      for (const data of fetched) {
        const files = [[data.fileName, data.code], ['README.md', data.readme]];
        if (saveExamples && data.samples?.length > 0) {
          for (const entry of samplesToFileEntries(data.samples)) files.push([entry.filename, entry.content]);
        }
        addBulkFiles(zip, treeItems, data.directory, files);
      }
      /* 파싱에 수 분이 걸리므로 그 사이 다른 탭의 커밋이 올라갔을 수 있다. 부모는 커밋 직전에 읽고,
         브랜치는 fast-forward 로만 옮긴다(예전에는 파싱 전에 읽은 ref 로 force 갱신해 그 사이 커밋을 지웠다). */
      updateMultiLoader({ status: 'GitHub에 올리는 중…', pausable: false });
      await git.commitTreeItems(branch, treeItems, '전체 코드 업로드 -BaekjoonHub');
      // 확인을 누르면 페이지를 새로 고치므로 기록을 먼저 끝낸다
      await recordUploadInStats(hook, branch, treeItems);
      multiloader.reload = true;
    }

    // 5. 결과. 가져오지 못한 문제는 번호와 이유를 보여 주고, 그 문제만 다시 시도할 수 있게 한다.
    failed.sort((a, b) => a.item.problemId - b.item.problemId);
    const result = {
      details: failed.map(({ item, reason }) => `${item.problemId}: ${reason}`),
      onRetry: failed.length > 0 ? () => uploadAllSolved(platform, failed.map(({ item }) => item)) : null,
    };
    if (fetched.length === 0) return finishMultiLoader('문제를 하나도 가져오지 못했습니다.', { ...result, failed: true });
    finishMultiLoader(`${fetched.length}개 문제를 GitHub에 올렸습니다.${failed.length > 0 ? ` ${failed.length}개는 가져오지 못했습니다.` : ''}`, result);
  } catch (error) {
    console.error('전체 코드 업로드 실패', error);
    let message = error?.message || String(error);
    // 토큰 만료(재인증으로 해결)나 올릴 파일을 모으기 전의 실패에는 zip 을 만들지 않는다
    if (error?.name !== 'TokenExpiredError' && Object.keys(zip.files).length > 0) {
      try {
        saveAs(await zip.generateAsync({ type: 'blob' }), `${platform.zipName}_backup_${Date.now()}.zip`);
        message += ' 올리려던 파일은 zip 파일로 내려받았습니다.';
      } catch (zipError) {
        console.error('ZIP 폴백 생성 실패', zipError);
      }
    }
    finishMultiLoader(message, { failed: true, onRetry: () => uploadAllSolved(platform, only) });
  }
}
