/* GitHub 업로드 — 백준 모듈의 단일 업로드 흐름과 동일 */

async function uploadOneSolveProblemOnGit(lcData, cb) {
  const token = await getToken();
  const hook = await getHook();
  if (isNull(token) || isNull(hook)) {
    console.error('token or hook is null', token, hook);
    return;
  }
  try {
    return await upload(
      token,
      hook,
      lcData.code,
      lcData.readme,
      lcData.directory,
      lcData.fileName,
      lcData.message,
      cb,
      lcData.samples,
    );
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      console.error('GitHub 토큰이 만료되었거나 유효하지 않습니다.', e);
      if (typeof Toast !== 'undefined') {
        Toast.raiseToast('GitHub 토큰이 만료되었습니다. BaekjoonHub 설정에서 토큰을 새로고침해주세요.');
      }
      return;
    }
    throw e;
  }
}

async function upload(token, hook, sourceText, readmeText, directory, filename, commitMessage, cb, samples) {
  const git = new GitHub(hook, token);
  const stats = await getStats();
  const default_branch = await git.getDefaultBranchOnRepo();
  stats.branches[hook] = default_branch;
  const { refSHA, ref } = await git.getReference(default_branch);
  const source = await git.createBlob(sourceText, `${directory}/${filename}`);
  const readme = await git.createBlob(readmeText, `${directory}/README.md`);
  const tree_items = [source, readme];

  // 예제 저장 옵션이 켜져 있으면 input{N}.txt를 함께 추가 (LeetCode는 출력은 미제공)
  const saveExamples = await getSaveExamplesOption();
  if (saveExamples && Array.isArray(samples) && samples.length > 0) {
    const entries = samplesToFileEntries(samples);
    for (const entry of entries) {
      const blob = await git.createBlob(entry.content, `${directory}/${entry.filename}`);
      tree_items.push(blob);
    }
  }

  const treeData = await git.createTree(refSHA, tree_items);
  const commitSHA = await git.createCommit(commitMessage, treeData.sha, refSHA);
  await git.updateHead(ref, commitSHA);

  treeData.tree.forEach((item) => {
    updateObjectDatafromPath(stats.submission, `${hook}/${item.path}`, item.sha);
  });
  await saveStats(stats);
  if (typeof cb === 'function') cb(stats.branches, directory);
}

/**
 * 단일 문제 업로드 진입점.
 * 동일 코드가 이미 원격에 존재하면 업로드를 스킵한다 (백준 모듈의 SHA 비교 패턴 동일).
 */
async function beginUpload(lcData) {
  if (!lcData || isEmpty(lcData.code) || isEmpty(lcData.readme) || isEmpty(lcData.directory)) {
    console.warn('LeetCode 데이터가 비어 있어 업로드를 중단합니다.', lcData);
    return;
  }
  const stats = await getStats();
  const hook = await getHook();
  const token = await getToken();
  if (isNull(hook) || isNull(token)) {
    console.warn('GitHub 연결 정보가 없어 업로드를 중단합니다.');
    return;
  }

  if (
    isNull(stats.version) ||
    stats.version !== getVersion() ||
    isNull(await getStatsSHAfromPath(hook))
  ) {
    await versionUpdate();
  }

  const path = `${hook}/${lcData.directory}/${lcData.fileName}`;
  const cachedSHA = await getStatsSHAfromPath(path);
  const calcSHA = calculateBlobSHA(lcData.code);

  if (isNull(cachedSHA)) {
    const remoteFile = await getFile(hook, token, `${lcData.directory}/${lcData.fileName}`);
    if (remoteFile && remoteFile.sha === calcSHA) {
      const fresh = await getStats();
      markUploadedCSS(fresh.branches, lcData.directory);
      console.log('원격 저장소에 동일한 파일이 존재하여 업로드를 건너뜁니다.');
      return;
    }
  } else if (cachedSHA === calcSHA) {
    markUploadedCSS(stats.branches, lcData.directory);
    console.log('현재 제출과 동일한 코드를 이미 업로드한 기록이 있습니다.');
    return;
  }

  await uploadOneSolveProblemOnGit(lcData, markUploadedCSS);
}

async function versionUpdate() {
  const stats = await updateLocalStorageStats();
  stats.version = getVersion();
  await saveStats(stats);
}

/**
 * LeetCode 프로필에서 최근 Accepted 제출들을 단일 GitHub 커밋으로 일괄 업로드한다.
 * - LeetCode `recentAcSubmissionList`는 limit이 작으므로(약 50건) "최근 Accepted 동기화" 의미.
 * - stats.submission 트리에 이미 존재하는 problemId는 스킵.
 * - 진행률은 multiloader DOM으로 노출.
 */
async function uploadAllSolvedProblem(username) {
  const tree_items = [];
  const stats = await updateLocalStorageStats();
  const hook = await getHook();
  const token = await getToken();
  if (isNull(hook) || isNull(token)) {
    MultiloaderFail('GitHub 연결 정보가 없습니다.');
    return;
  }

  const git = new GitHub(hook, token);
  const default_branch = stats.branches[hook] || (await git.getDefaultBranchOnRepo());
  stats.branches[hook] = default_branch;
  const { refSHA, ref } = await git.getReference(default_branch);

  const list = await fetchRecentAcSubmissions(username, 50);
  if (list.length === 0) {
    MultiloaderUpToDate();
    return;
  }

  setMultiLoaderDenom(list.length);

  const lcDatas = await asyncPool(2, list, async (item) => {
    try {
      const lcData = await buildLeetCodeData(item.id);
      incMultiLoader(1);
      return lcData;
    } catch (e) {
      console.warn('LeetCode 빌드 실패', item?.titleSlug, e);
      incMultiLoader(1);
      return null;
    }
  });

  const uploadedIds = extractUploadedProblemIdsForLeetCode(stats, hook);
  const saveExamples = await getSaveExamplesOption();
  for (const lcData of lcDatas) {
    if (isNull(lcData) || isEmpty(lcData.code) || isEmpty(lcData.readme)) continue;
    if (uploadedIds.has(String(lcData.problemId))) {
      log('이미 업로드된 LeetCode 문제 스킵:', lcData.problemId);
      continue;
    }
    tree_items.push({
      path: `${lcData.directory}/${lcData.fileName}`,
      mode: '100644', type: 'blob', content: lcData.code,
    });
    tree_items.push({
      path: `${lcData.directory}/README.md`,
      mode: '100644', type: 'blob', content: lcData.readme,
    });
    if (saveExamples && Array.isArray(lcData.samples) && lcData.samples.length > 0) {
      const entries = samplesToFileEntries(lcData.samples);
      for (const entry of entries) {
        tree_items.push({
          path: `${lcData.directory}/${entry.filename}`,
          mode: '100644', type: 'blob', content: entry.content,
        });
      }
    }
  }

  if (tree_items.length === 0) {
    MultiloaderUpToDate();
    return;
  }

  const treeData = await git.createTree(refSHA, tree_items);
  const commitSHA = await git.createCommit('LeetCode 전체 코드 업로드 -BaekjoonHub', treeData.sha, refSHA);
  await git.updateHead(ref, commitSHA);
  treeData.tree.forEach((item) => {
    updateObjectDatafromPath(stats.submission, `${hook}/${item.path}`, item.sha);
  });
  await saveStats(stats);
  MultiloaderSuccess();
}
