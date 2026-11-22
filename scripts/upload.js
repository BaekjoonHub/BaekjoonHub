/* 네 플랫폼이 함께 쓰는 업로드 흐름. manifest 의 각 번들에서 storage.js 뒤, 플랫폼 스크립트 앞에 로드한다.
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
 * @param {string} sourceText - 소스코드
 * @param {string} readmeText - README 내용
 * @param {string} directory - 풀이 디렉토리
 * @param {string} filename - 풀이 파일 이름
 * @param {string} commitMessage - 커밋 메시지
 * @param {function(object, string): void} cb - 업로드 뒤 완료 표시 (branches, directory)
 * @param {Array<{input: string, output: string}>} [samples] - 예제 입출력 (백준)
 */
async function upload(token, hook, sourceText, readmeText, directory, filename, commitMessage, cb, samples) {
  const git = new GitHub(hook, token);
  const default_branch = await git.getDefaultBranchOnRepo();
  const tree_items = [
    await createSolutionItem(git, sourceText, `${directory}/${filename}`),
    await createSolutionItem(git, readmeText, `${directory}/README.md`),
  ];
  if (samples?.length > 0 && (await getSaveExamplesOption())) {
    for (const entry of samplesToFileEntries(samples)) {
      tree_items.push(await createSolutionItem(git, entry.content, `${directory}/${entry.filename}`));
    }
  }

  /* 풀이별 파일 보관 옵션이 켜져 있으면 풀이 파일의 경로(이름_002.py …)를 커밋의 부모에서 정한다(utils/solutionVersions.js) */
  const commit = await prepareSolutionItems(git, directory, filename, sourceText, tree_items);
  // 브랜치는 fast-forward 로만 옮긴다 — 다른 탭이 그 사이 커밋했으면 그 위에 다시 커밋한다 (commitTreeItems 참고)
  await git.commitTreeItems(default_branch, commit.items, commitMessage);

  /* 올린 항목만 기록하고(createTree 응답의 tree 는 루트 목록이라 쓰면 캐시가 무너진다),
     저장 직전에 다시 읽어 다른 탭의 기록을 덮지 않는다. */
  const stats = await recordUploadInStats(hook, default_branch, commit.committed);
  if (typeof cb === 'function') cb(stats.branches, directory);
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
  for (const [name, content] of files) {
    zip.folder(directory).file(name, content);
    treeItems.push({ path: `${directory}/${name}`, mode: '100644', type: 'blob', content });
  }
}

/**
 * stats 캐시에서 이미 올린 문제 번호를 모읍니다. (폴더 이름 맨 앞의 숫자)
 * 플랫폼 폴더는 레포 바로 아래(플랫폼별 정리)나 언어 폴더 아래(언어별 정리)에 있다.
 * @param {object} stats
 * @param {string} hook - 'owner/repo'
 * @param {string} platform - 플랫폼 폴더 이름 ('백준', '프로그래머스', 'SWEA')
 * @returns {Set<string>}
 */
function extractUploadedProblemIds(stats, hook, platform) {
  const uploadedIds = new Set();
  const [owner, repo] = (hook || '').split('/');
  const repoObj = stats?.submission?.[owner]?.[repo];
  if (isNull(repoObj)) return uploadedIds;
  const languageNodes = Object.keys(repoObj).filter((key) => key !== platform).map((key) => repoObj[key]);
  for (const node of [repoObj, ...languageNodes]) {
    if (isNull(node) || typeof node !== 'object' || isNull(node[platform])) continue;
    for (const key of Object.keys(node[platform])) {
      const match = key.match(/^(\d+)/);
      if (match) uploadedIds.add(match[1]);
    }
  }
  return uploadedIds;
}
