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
    return await uploadSWEA(token, hook, bojData, cb);
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
async function uploadSWEA(token, hook, { code, readme, directory, fileName, message }, cb) {
  const git = new GitHub(hook, token);
  const cachedStats = await getStats();

  /* blob 생성 API 2회 대신 tree에 content를 직접 전달한다 (전체 업로드 경로와 동일 방식).
     브랜치는 fast-forward 로만 옮긴다 — 다른 탭이 그 사이 커밋했으면 그 위에 다시 커밋한다 (commitTreeItems 참고). */
  const tree_items = [
    { path: `${directory}/${fileName}`, mode: '100644', type: 'blob', content: code },
    { path: `${directory}/README.md`, mode: '100644', type: 'blob', content: readme },
  ];

  /* default branch는 이전 업로드에서 캐시된 값을 우선 사용해 API 1회를 줄인다.
     캐시된 브랜치가 변경/삭제되어 ref 조회가 404 로 실패하면 기본 브랜치를 다시 조회해 1회 재시도한다. */
  const cachedBranch = cachedStats?.branches?.[hook];
  let default_branch = isNull(cachedBranch) ? await git.getDefaultBranchOnRepo() : cachedBranch;
  /* 풀이별 파일 보관 옵션이 켜져 있으면 풀이 파일의 경로(이름_002.py …)를 커밋의 부모에서 정한다(utils/solutionVersions.js) */
  const commit = await prepareSolutionItems(git, directory, fileName, code, tree_items);
  try {
    await git.commitTreeItems(default_branch, commit.items, message);
  } catch (e) {
    if (isNull(cachedBranch) || !(e instanceof GitHubApiError && e.status === 404)) throw e;
    const liveBranch = await git.getDefaultBranchOnRepo();
    if (liveBranch === default_branch) throw e;
    default_branch = liveBranch;
    await git.commitTreeItems(default_branch, commit.items, message);
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
 * SWEA에서 맞은 문제 전체를 GitHub에 일괄 업로드합니다. (uploadAllSolved: scripts/upload.js)
 */
function uploadAllSolvedProblemSWEA() {
  return uploadAllSolved({
    folder: 'SWEA',
    zipName: 'swexpertacademy',
    // 문제당 요청이 2번이라, 브라우저의 호스트당 연결 제한(6) 안에서 4문제씩 가져온다
    poolLimit: 4,
    listSolved: findAllSolvedProblemsSWEA,
    fetchOne: async (problem) => {
      const result = await fetchSWEASubmissionCode(problem);
      if (result.status !== 'success') throw new Error(result.status === 'skipped' ? 'Pass 한 제출을 찾지 못했습니다.' : '제출 코드를 가져오지 못했습니다.');
      return result.data;
    },
  });
}
