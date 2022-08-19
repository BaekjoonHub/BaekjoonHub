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
  return upload(token, hook, bojData.code, bojData.readme, bojData.directory, bojData.fileName, bojData.message, cb);
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
  const stats = await getStats();
  let default_branch = stats.branches[hook];
  if (isNull(default_branch)) {
    default_branch = await git.getDefaultBranchOnRepo();
    stats.branches[hook] = default_branch;
  }
  const { refSHA, ref } = await git.getReference(default_branch);
  const source = await git.createBlob(sourceText, `${directory}/${filename}`); // 소스코드 파일
  const readme = await git.createBlob(readmeText, `${directory}/README.md`); // readme 파일
  const treeSHA = await git.createTree(refSHA, [source, readme]);
  const commitSHA = await git.createCommit(commitMessage, treeSHA, refSHA);
  await git.updateHead(ref, commitSHA);

  /* stats의 값을 갱신합니다. */
  updateObjectDatafromPath(stats.submission, `${hook}/${source.path}`, source.sha);
  updateObjectDatafromPath(stats.submission, `${hook}/${readme.path}`, readme.sha);
  await saveStats(stats);
  // 콜백 함수 실행
  if (typeof cb === 'function') cb();
}

/* 모든 코드를 github에 업로드하는 함수 */
async function uploadAllSolvedProblem() {
  const tree_items = [];

  // 업로드된 모든 파일에 대한 SHA 업데이트
  const stats = await updateLocalStorageStats();

  const hook = await getHook();
  const token = await getToken();
  const git = new GitHub(hook, token);

  const default_branch = stats.branches[hook];
  const { refSHA, ref } = await git.getReference(default_branch);

  const username = findUsername();
  if (isEmpty(username)) {
    if (debug) console.log('로그인되어 있지 않아. 파싱을 진행할 수 없습니다.');
    return;
  }
  const list = await findUniqueResultTableListByUsername(username);
  const { submission } = stats;
  const bojDatas = [];
  const datas = await findDatas(list);
  await Promise.all(
    datas.map(async (bojData) => {
      const sha = getObjectDatafromPath(submission, `${hook}/${bojData.directory}/${bojData.fileName}`);
      if (debug) console.log('sha', sha, 'calcSHA:', calculateBlobSHA(bojData.code));
      if (isNull(sha) || sha !== calculateBlobSHA(bojData.code)) {
        bojDatas.push(bojData);
      }
    }),
  );

  if (bojDatas.length === 0) {
    MultiloaderUpToDate();
    if (debug) console.log('업로드 할 새로운 코드가 하나도 없습니다.');
    return null;
  }
  setMultiLoaderDenom(bojDatas.length);
  await asyncPool(2, bojDatas, async (bojData) => {
    if (!isEmpty(bojData.code) && !isEmpty(bojData.readme)) {
      const source = await git.createBlob(bojData.code, `${bojData.directory}/${bojData.fileName}`); // 소스코드 파일
      const readme = await git.createBlob(bojData.readme, `${bojData.directory}/README.md`); // readme 파일
      tree_items.push(...[source, readme]);
    }
    incMultiLoader(1);
  });

  try {
    if (tree_items.length !== 0) {
      const treeSHA = await git.createTree(refSHA, tree_items);
      const commitSHA = await git.createCommit('전체 코드 업로드 -BaekjoonHub', treeSHA, refSHA);
      await git.updateHead(ref, commitSHA);
      if (debug) console.log('전체 코드 업로드 완료');
      incMultiLoader(1);

      tree_items.forEach((item) => {
        updateObjectDatafromPath(submission, `${hook}/${item.path}`, item.sha);
      });
      await saveStats(stats);
    }
  } catch (error) {
    if (debug) console.log('전체 코드 업로드 실패', error);
  }
}

/* 모든 코드를 zip 파일로 저장하는 함수 */
async function downloadAllSolvedProblem() {
  const zip = new JSZip();
  await findUniqueResultTableListByUsername(findUsername())
    .then((list) => {
      setMultiLoaderDenom(list.length);
      return findDatas(list).then((datas) => {
        return Promise.all(
          datas.map(async (bojData) => {
            if (isNull(bojData)) return;
            const folder = zip.folder(bojData.directory);
            folder.file(`${bojData.fileName}`, bojData.code);
            folder.file('README.md', bojData.readme);
            incMultiLoader(1);
          }),
        );
      });
    })
    .then((_) =>
      zip.generateAsync({ type: 'blob' }).then((content) => {
        saveAs(content, 'all_solved_problem.zip');
      }),
    )
    .then((_) => {
      if (debug) console.log('전체 코드 다운로드 완료');
      incMultiLoader(1);
    })
    .catch((e) => {
      if (debug) console.log('전체 코드 다운로드 실패', e);
    });
}
