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
    return await upload(token, hook, bojData.code, bojData.readme, bojData.directory, bojData.fileName, bojData.message, cb, bojData.samples);
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
 * 프로필 페이지에서 맞은 문제 전체를 GitHub에 일괄 업로드합니다.
 * 이미 업로드된 문제는 파싱 전에 스킵하고, 단일 커밋으로 업로드합니다.
 */
async function uploadAllSolvedProblem() {
  const tree_items = [];
  try {
    // 1. GitHub tree 동기화
    const stats = await updateLocalStorageStats();
    const hook = await getHook();
    const token = await getToken();
    const git = new GitHub(hook, token);
    const default_branch = stats.branches[hook];
    const { refSHA, ref } = await git.getReference(default_branch);

    // 2. 맞은 문제 목록 파싱 & 이미 업로드된 문제 스킵
    const username = findUsername();
    if (isEmpty(username)) return;
    const list = await findUniqueResultTableListByUsername(username);
    const uploadedIds = extractUploadedProblemIds(stats, hook);
    const newList = list.filter((item) => !uploadedIds.has(String(item.problemId)));

    if (newList.length === 0) {
      MultiloaderUpToDate();
      return null;
    }

    // 3. 문제 데이터 파싱 (TTL 캐시 활용, asyncPool(2) 병렬 제어)
    const { submission } = stats;
    setMultiLoaderDenom(newList.length);
    const datas = await findDatas(newList);
    const bojDatas = datas.filter((d) => !isNull(d));

    // 4. Tree 아이템 생성 (Blob 생성 API 호출을 줄이기 위해 content 직접 전달)
    const saveExamples = await getSaveExamplesOption();
    for (const bojData of bojDatas) {
      if (!isEmpty(bojData.code) && !isEmpty(bojData.readme)) {
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
        if (saveExamples && bojData.samples && bojData.samples.length > 0) {
          const fileEntries = samplesToFileEntries(bojData.samples);
          for (const entry of fileEntries) {
            tree_items.push({
              path: `${bojData.directory}/${entry.filename}`,
              mode: '100644',
              type: 'blob',
              content: entry.content,
            });
          }
        }
      }
      incMultiLoader(1);
    }

    // 5. 단일 커밋으로 일괄 업로드
    if (tree_items.length !== 0) {
      const treeData = await git.createTree(refSHA, tree_items);
      const commitSHA = await git.createCommit('전체 코드 업로드 -BaekjoonHub', treeData.sha, refSHA);
      await git.updateHead(ref, commitSHA);
      MultiloaderSuccess();
      treeData.tree.forEach((item) => {
        updateObjectDatafromPath(submission, `${hook}/${item.path}`, item.sha);
      });
      await saveStats(stats);
    } else {
      MultiloaderUpToDate();
    }
  } catch (error) {
    console.error('전체 코드 업로드 실패', error);
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
async function upload(token, hook, sourceText, readmeText, directory, filename, commitMessage, cb, samples) {
  /* 업로드 후 커밋 */
  const git = new GitHub(hook, token);
  const stats = await getStats();
  const default_branch = await git.getDefaultBranchOnRepo();
  stats.branches[hook] = default_branch;
  const refData = await git.getReference(default_branch);
  const { refSHA, ref } = refData;
  const source = await git.createBlob(sourceText, `${directory}/${filename}`); // 소스코드 파일
  const readme = await git.createBlob(readmeText, `${directory}/README.md`); // readme 파일
  const tree_items = [source, readme];

  // 예제 입출력 파일 추가
  const saveExamples = await getSaveExamplesOption();
  if (saveExamples && samples && samples.length > 0) {
    const fileEntries = samplesToFileEntries(samples);
    for (const entry of fileEntries) {
      const blob = await git.createBlob(entry.content, `${directory}/${entry.filename}`);
      tree_items.push(blob);
    }
  }

  const treeData = await git.createTree(refSHA, tree_items);
  const commitSHA = await git.createCommit(commitMessage, treeData.sha, refSHA);
  await git.updateHead(ref, commitSHA);

  /* stats의 값을 갱신합니다. */
  treeData.tree.forEach((item) => {
    updateObjectDatafromPath(stats.submission, `${hook}/${item.path}`, item.sha);
  });
  await saveStats(stats);
  // 콜백 함수 실행
  if (typeof cb === 'function') {
    cb(stats.branches, directory);
  }
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
  const level = bj_level[solvedJson.level];
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
  const stats = await getStats();
  const default_branch = await git.getDefaultBranchOnRepo();
  stats.branches[hook] = default_branch;
  const { refSHA, ref } = await git.getReference(default_branch);

  const fileEntries = samplesToFileEntries(samples);
  const tree_items = [];
  for (const entry of fileEntries) {
    const blob = await git.createBlob(entry.content, `${directory}/${entry.filename}`);
    tree_items.push(blob);
  }

  const treeData = await git.createTree(refSHA, tree_items);
  const commitSHA = await git.createCommit(commitMessage, treeData.sha, refSHA);
  await git.updateHead(ref, commitSHA);

  treeData.tree.forEach((item) => {
    updateObjectDatafromPath(stats.submission, `${hook}/${item.path}`, item.sha);
  });
  await saveStats(stats);
}
