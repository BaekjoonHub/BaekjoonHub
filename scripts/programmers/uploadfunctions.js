/** 푼 문제들에 대한 단일 업로드는 uploadGit 함수로 합니다.
 * 파라미터는 아래와 같습니다.
 * @param {string} filePath - 업로드할 파일의 경로
 * @param {string} sourceCode - 업로드하는 소스코드 내용
 * @param {string} readme - 업로드하는 README 내용
 * @param {string} filename - 업로드할 파일명
 * @param {string} commitMessage - 커밋 메시지
 * @param {function} cb - 콜백 함수 (ex. 업로드 후 로딩 아이콘 처리 등)
 * @returns {Promise<void>}
 */
async function uploadOneSolveProblemOnGit(bojData, cb) {
  const token = await getToken();
  const hook = await getHook();
  if (isNull(token) || isNull(hook)) {
    console.error('token or hook is null', token, hook);
    return;
  }
  try {
    return await upload(token, hook, bojData.code, bojData.readme, bojData.directory, bojData.fileName, bojData.message, cb);
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      console.error('GitHub 토큰이 만료되었거나 유효하지 않습니다.', e);
      return;
    }
    throw e;
  }
}

/** Github api를 사용하여 업로드를 합니다.
 * @see https://docs.github.com/en/rest/reference/repos#create-or-update-file-contents
 * @param {string} token - github api 토큰
 * @param {string} hook - github api hook
 * @param {string} sourceText - 업로드할 소스코드
 * @param {string} readmeText - 업로드할 readme
 * @param {string} directory - 업로드할 파일의 경로
 * @param {string} filename - 업로드할 파일명
 * @param {string} commitMessage - 커밋 메시지
 * @param {function} cb - 콜백 함수 (ex. 업로드 후 로딩 아이콘 처리 등)
 */
async function upload(token, hook, sourceText, readmeText, directory, filename, commitMessage, cb) {
  /* 업로드 후 커밋 */
  const git = new GitHub(hook, token);
  const default_branch = await git.getDefaultBranchOnRepo();
  const source = await git.createBlob(sourceText, `${directory}/${filename}`); // 소스코드 파일
  const readme = await git.createBlob(readmeText, `${directory}/README.md`); // readme 파일
  // 브랜치는 fast-forward 로만 옮긴다 — 다른 탭이 그 사이 커밋했으면 그 위에 다시 커밋한다 (commitTreeItems 참고)
  await git.commitTreeItems(default_branch, [source, readme], commitMessage);

  /* stats의 값을 갱신합니다. (저장 직전에 다시 읽어 다른 탭의 기록을 덮지 않는다) */
  const stats = await recordUploadInStats(hook, default_branch, [source, readme]);
  // 콜백 함수 실행
  if (typeof cb === 'function') {
    cb(stats.branches, directory);
  }
}

/**
 * 프로그래머스에서 맞은 문제 전체를 GitHub에 일괄 업로드합니다.
 */
async function uploadAllSolvedProblemProgrammers() {
  const tree_items = [];
  const zip = new JSZip();
  try {
    // 1. GitHub tree 동기화
    const stats = await updateLocalStorageStats();
    const hook = await getHook();
    const token = await getToken();
    const git = new GitHub(hook, token);
    const default_branch = stats.branches[hook];
    // 브랜치가 없으면 오래 걸리는 파싱 전에 멈춘다. 커밋의 부모는 커밋 직전에 다시 읽는다(commitTreeItems).
    await git.getReference(default_branch);

    // 2. 풀이 완료 문제 목록 파싱 & 이미 업로드된 문제 스킵
    const solvedProblems = await findAllSolvedProblems();
    const uploadedIds = extractUploadedProblemIdsForProgrammers(stats, hook);
    const newList = solvedProblems.filter((item) => !uploadedIds.has(String(item.problemId)));

    if (newList.length === 0) {
      MultiloaderUpToDate();
      return null;
    }

    // 3. 문제 데이터 파싱 (asyncPool(2) 병렬 제어)
    setMultiLoaderDenom(newList.length);
    const datas = await asyncPool(2, newList, fetchProblemCodeAndData);
    const bojDatas = datas.filter((d) => !isNull(d));

    // 4. Tree 아이템 생성 (Blob 생성 API 호출을 줄이기 위해 content 직접 전달)
    for (const bojData of bojDatas) {
      if (!isEmpty(bojData.code) && !isEmpty(bojData.readme)) {
        zip
          .folder(bojData.directory)
          .file(bojData.fileName, bojData.code)
          .file('README.md', bojData.readme);
        tree_items.push({
          path: `${bojData.directory}/${bojData.fileName}`,
          mode: '100644',
          type: 'blob',
          content: bojData.code,
        });
        tree_items.push({
          path: `${bojData.directory}/README.md`,
          mode: '100644',
          type: 'blob',
          content: bojData.readme,
        });
      }
      incMultiLoader(1);
    }

    // 5. 단일 커밋으로 일괄 업로드
    if (tree_items.length !== 0) {
      /* 파싱에 수 분이 걸리므로 그 사이 다른 탭의 커밋이 올라갔을 수 있다. 부모는 커밋 직전에 읽고,
         브랜치는 fast-forward 로만 옮긴다(예전에는 파싱 전에 읽은 ref 로 force 갱신해 그 사이 커밋을 지웠다). */
      await git.commitTreeItems(default_branch, tree_items, '전체 코드 업로드 -BaekjoonHub');
      MultiloaderSuccess();
      await recordUploadInStats(hook, default_branch, tree_items);
    } else {
      MultiloaderUpToDate();
    }
  } catch (error) {
    console.error('전체 코드 업로드 실패', error);
    const msg = error?.message || String(error);

    // 토큰 만료(재인증으로 해결) 또는 트리 적재 이전 단계 실패(빈 ZIP)인 경우 폴백 스킵
    const isTokenExpired = error?.name === 'TokenExpiredError';
    const hasZipContent = Object.keys(zip.files).length > 0;
    if (!isTokenExpired && hasZipContent) {
      try {
        const zipped = await zip.generateAsync({ type: 'blob' });
        const filename = `programmers_backup_${Date.now()}.zip`;
        saveAs(zipped, filename);
        Toast.raiseToast(`전체 업로드 실패: ${msg}. 데이터를 zip 파일로 다운로드했습니다.`);
        return;
      } catch (zipError) {
        console.error('ZIP 폴백 생성 실패', zipError);
      }
    }
    Toast.raiseToast(`전체 업로드 실패: ${msg}`);
  }
}
