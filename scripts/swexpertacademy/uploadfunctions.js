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
      // 확정된 실패이므로 20초 워치독을 기다리지 않고 즉시 실패 아이콘을 표시한다.
      markUploadFailedCSS();
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
  const cachedStats = await getStats();

  /* blob 생성 API 2회 대신 tree에 content를 직접 전달한다 (전체 업로드 경로와 동일 방식).
     브랜치는 fast-forward 로만 옮긴다 — 다른 탭이 그 사이 커밋했으면 그 위에 다시 커밋한다 (commitTreeItems 참고). */
  const tree_items = [
    { path: `${directory}/${filename}`, mode: '100644', type: 'blob', content: sourceText },
    { path: `${directory}/README.md`, mode: '100644', type: 'blob', content: readmeText },
  ];

  /* default branch는 이전 업로드에서 캐시된 값을 우선 사용해 API 1회를 줄인다.
     캐시된 브랜치가 변경/삭제되어 ref 조회가 404 로 실패하면 기본 브랜치를 다시 조회해 1회 재시도한다. */
  const cachedBranch = cachedStats?.branches?.[hook];
  let default_branch = isNull(cachedBranch) ? await git.getDefaultBranchOnRepo() : cachedBranch;
  try {
    await git.commitTreeItems(default_branch, tree_items, commitMessage);
  } catch (e) {
    if (isNull(cachedBranch) || e.name === 'TokenExpiredError' || !(e instanceof GitHubApiError && e.status === 404)) throw e;
    const liveBranch = await git.getDefaultBranchOnRepo();
    if (liveBranch === default_branch) throw e;
    default_branch = liveBranch;
    await git.commitTreeItems(default_branch, tree_items, commitMessage);
  }

  /* stats의 값을 갱신합니다. 업로드한 두 파일의 blob sha를 로컬에서 계산해 기록하므로(recordTreeItemsInStats)
     같은 문제 재제출 시 원격 조회 없이 즉시 스킵된다. 저장 직전에 다시 읽어 다른 탭의 기록을 덮지 않는다. */
  const stats = await recordUploadInStats(hook, default_branch, tree_items);
  // 콜백 함수 실행
  if (typeof cb === 'function') {
    cb(stats.branches, directory);
  }

  /* default branch가 '기존의 다른 브랜치'로 전환된 경우에는 캐시된 브랜치의 getReference가
     계속 성공하므로 위의 재시도 경로로는 감지되지 않는다. 업로드 완료 후(지연 경로 밖)
     백그라운드로 재검증해, 전환이 있었더라도 잘못된 브랜치 커밋을 최대 1회로 한정한다. */
  git.getDefaultBranchOnRepo().then(async (live) => {
    if (live !== default_branch) {
      const s = await getStats();
      if (isNull(s.branches)) s.branches = {};
      s.branches[hook] = live;
      await saveStats(s);
    }
  }).catch(() => {});
}

/**
 * SWEA에서 맞은 문제 전체를 GitHub에 일괄 업로드합니다.
 */
async function uploadAllSolvedProblemSWEA() {
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
    const solvedProblems = await findAllSolvedProblemsSWEA();
    const uploadedIds = extractUploadedProblemIdsForSWEA(stats, hook);
    const newList = solvedProblems.filter((item) => !uploadedIds.has(String(item.problemId)));

    if (newList.length === 0) {
      MultiloaderUpToDate();
      return null;
    }

    // 3. 문제 데이터 파싱 (asyncPool(4) 병렬 제어 — 문제당 2회 fetch이므로 브라우저 host 제한(6) 안에서 처리량 확보)
    setMultiLoaderDenom(newList.length);
    const datas = await asyncPool(4, newList, fetchSWEASubmissionCode);
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
      /* 업로드한 각 파일의 blob sha를 로컬에서 계산해 기록한다(createTree 응답의 tree 는 루트 목록이라 쓸 수 없다). */
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
        const filename = `swexpertacademy_backup_${Date.now()}.zip`;
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
