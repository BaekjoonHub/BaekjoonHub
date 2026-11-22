/**
 * 맞은 풀이 하나를 GitHub 에 올립니다.
 * @param {object} bojData - 파싱 결과 { code, readme, directory, fileName, message }
 * @param {function} cb - 업로드 뒤 완료 표시 콜백 (branches, directory)
 */
async function uploadOneSolveProblemOnGit(bojData, cb) {
  const token = await getToken();
  const hook = await getHook();
  if (isNull(token) || isNull(hook)) {
    console.error('token or hook is null', token, hook);
    return;
  }
  try {
    return await uploadSWEA(token, hook, bojData.code, bojData.readme, bojData.directory, bojData.fileName, bojData.message, cb);
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

/**
 * 풀이 하나를 한 커밋으로 올리고 캐시에 기록합니다. 인자는 scripts/upload.js 의 upload 와 같다.
 * 결과창을 닫기 전에 끝나야 해서 API 호출을 줄인다: blob 을 따로 만들지 않고, 브랜치는 캐시한 값을 먼저 쓴다.
 */
async function uploadSWEA(token, hook, sourceText, readmeText, directory, filename, commitMessage, cb) {
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
  /* 풀이별 파일 보관 옵션이 켜져 있으면 풀이 파일의 경로(이름_002.py …)를 커밋의 부모에서 정한다(utils/solutionVersions.js) */
  const commit = await prepareSolutionItems(git, directory, filename, sourceText, tree_items);
  try {
    await git.commitTreeItems(default_branch, commit.items, commitMessage);
  } catch (e) {
    if (isNull(cachedBranch) || e.name === 'TokenExpiredError' || !(e instanceof GitHubApiError && e.status === 404)) throw e;
    const liveBranch = await git.getDefaultBranchOnRepo();
    if (liveBranch === default_branch) throw e;
    default_branch = liveBranch;
    await git.commitTreeItems(default_branch, commit.items, commitMessage);
  }

  /* stats의 값을 갱신합니다. 업로드한 두 파일의 blob sha를 로컬에서 계산해 기록하므로(recordTreeItemsInStats)
     같은 문제 재제출 시 원격 조회 없이 즉시 스킵된다. 저장 직전에 다시 읽어 다른 탭의 기록을 덮지 않는다. */
  const stats = await recordUploadInStats(hook, default_branch, commit.committed);
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
    const uploadedIds = extractUploadedProblemIds(stats, hook, 'SWEA');
    const newList = solvedProblems.filter((item) => !uploadedIds.has(String(item.problemId)));

    if (newList.length === 0) {
      MultiloaderUpToDate();
      return null;
    }

    // 3. 문제 데이터 파싱 (asyncPool(4) 병렬 제어 — 문제당 2회 fetch이므로 브라우저 host 제한(6) 안에서 처리량 확보)
    setMultiLoaderDenom(newList.length);
    const results = await asyncPool(4, newList, async (problem) => {
      const result = await fetchSWEASubmissionCode(problem);
      incMultiLoader(1);
      return result;
    });
    const bojDatas = results.filter((result) => result.status === 'success').map((result) => result.data);
    const skippedIds = results.filter((result) => result.status === 'skipped').map((result) => result.problemId);
    const failedIds = results.filter((result) => result.status === 'failed').map((result) => result.problemId);

    // 4. Tree 아이템 생성
    for (const bojData of bojDatas) {
      if (!isEmpty(bojData.code) && !isEmpty(bojData.readme)) {
        addBulkFiles(zip, tree_items, bojData.directory, [[bojData.fileName, bojData.code], ['README.md', bojData.readme]]);
      }
    }

    // 5. 단일 커밋으로 일괄 업로드
    if (tree_items.length !== 0) {
      /* 파싱에 수 분이 걸리므로 그 사이 다른 탭의 커밋이 올라갔을 수 있다. 부모는 커밋 직전에 읽고,
         브랜치는 fast-forward 로만 옮긴다(예전에는 파싱 전에 읽은 ref 로 force 갱신해 그 사이 커밋을 지웠다). */
      await git.commitTreeItems(default_branch, tree_items, '전체 코드 업로드 -BaekjoonHub');
      /* 업로드한 각 파일의 blob sha를 로컬에서 계산해 기록한다(createTree 응답의 tree 는 루트 목록이라 쓸 수 없다). */
      await recordUploadInStats(hook, default_branch, tree_items);
    }
    if (skippedIds.length || failedIds.length) {
      const summary = [`전체 업로드: ${tree_items.length / 2}개 업로드`];
      if (skippedIds.length) summary.push(`Pass 조회 없음으로 건너뜀 ${skippedIds.length}개: ${skippedIds.join(', ')}`);
      if (failedIds.length) summary.push(`코드 조회 실패 ${failedIds.length}개: ${failedIds.join(', ')}`);
      MultiloaderIncomplete(summary.join('. '));
    } else if (tree_items.length !== 0) {
      MultiloaderSuccess();
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
