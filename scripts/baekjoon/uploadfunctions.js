/**
 * 맞은 풀이 하나를 GitHub 에 올립니다. (upload: scripts/upload.js)
 * @param {object} bojData - 파싱 결과 { code, readme, directory, fileName, message, samples }
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
    return await upload(token, hook, bojData, cb);
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

/**
 * 프로필 페이지에서 맞은 문제 전체를 GitHub에 일괄 업로드합니다. (uploadAllSolved: scripts/upload.js)
 * 받은 문제 설명·제출 코드는 캐시(scripts/baekjoon/storage.js)에 남아, 멈추거나 실패한 뒤 다시 해도 새로 요청하지 않는다.
 */
function uploadAllSolvedProblem() {
  return uploadAllSolved({
    folder: '백준',
    zipName: 'baekjoon',
    poolLimit: 2,
    note: '받은 문제는 일주일 동안 저장되어, 멈추거나 이 탭을 닫아도 다시 요청하지 않습니다.',
    listSolved: async () => {
      const username = findUsername();
      if (isEmpty(username)) throw new Error('로그인 정보를 확인할 수 없습니다. 로그인 상태를 확인한 뒤 다시 시도해 주세요.');
      const list = await findUniqueResultTableListByUsername(username);
      if (list.length === 0) throw new Error('맞은 제출 내역을 찾지 못했습니다. 백준 페이지 상태를 확인해 주세요.');
      // 대회 문제(번호가 1000 미만이거나 없음)는 올리지 않는다. 남겨 두면 실행할 때마다 가져오지 못한 문제로 나온다.
      return list.filter((item) => Number(item.problemId) >= 1000);
    },
    fetchOne: findDataOfSubmission,
  });
}

async function uploadExamplesFromProblemPage(samples) {
  const token = await getToken();
  const hook = await getHook();
  if (isNull(token) || isNull(hook)) {
    console.error('token or hook is null', token, hook);
    return;
  }
  const { problemId } = parseProblemDescription();
  if (!problemId) throw new Error('문제 번호를 파싱할 수 없습니다.');
  const solvedJson = await getSolvedACById(problemId);
  const title = solvedJson.titleKo;
  const level = solvedTierName(solvedJson.level);
  const directory = await buildDirectory('baekjoon', {
    platform: '백준',
    level: level.replace(/ .*/, ''),
    levelFull: level,
    id: problemId,
    title: convertSingleCharToDoubleChar(title),
    language: '',
    _defaultDir: `백준/${level.replace(/ .*/, '')}/${problemId}. ${convertSingleCharToDoubleChar(title)}`,
  });
  const commitMessage = `[${level}] Title: ${title} - 예제 입출력 -BaekjoonHub`;

  const git = new GitHub(hook, token);
  const default_branch = await git.getDefaultBranchOnRepo();

  const fileEntries = samplesToFileEntries(samples);
  const tree_items = [];
  for (const entry of fileEntries) {
    const blob = await git.createBlob(entry.content, `${directory}/${entry.filename}`);
    tree_items.push(blob);
  }

  await git.commitTreeItems(default_branch, tree_items, commitMessage);

  await recordUploadInStats(hook, default_branch, tree_items);
}