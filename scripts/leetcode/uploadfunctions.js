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

async function upload(token, hook, sourceText, readmeText, directory, filename, commitMessage, cb) {
  const git = new GitHub(hook, token);
  const stats = await getStats();
  const default_branch = await git.getDefaultBranchOnRepo();
  stats.branches[hook] = default_branch;
  const { refSHA, ref } = await git.getReference(default_branch);
  const source = await git.createBlob(sourceText, `${directory}/${filename}`);
  const readme = await git.createBlob(readmeText, `${directory}/README.md`);
  const tree_items = [source, readme];

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
