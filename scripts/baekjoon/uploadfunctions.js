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
  return upload(token, hook, bojData.submission.code, bojData.meta.readme, bojData.meta.directory, bojData.meta.fileName, bojData.meta.message, cb);
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
  const { refSHA, ref } = await git.getReference();
  const source = await git.createBlob(sourceText, `${directory}/${filename}`); // 소스코드 파일
  const readme = await git.createBlob(readmeText, `${directory}/README.md`); // readme 파일
  const treeSHA = await git.createTree(refSHA, [source, readme]);
  const commitSHA = await git.createCommit(commitMessage, treeSHA, refSHA);
  /* await */ git.updateHead(ref, commitSHA);

  /* stats의 값을 갱신합니다. */
  await updateStatsSHAfromPath(`${hook}/${source.path}`, source.sha);
  /* await */ updateStatsSHAfromPath(`${hook}/${readme.path}`, readme.sha);
  // 콜백 함수 실행
  if (typeof cb === 'function') cb();
}

/* 모든 코드를 github에 업로드하는 함수 */
async function uploadAllSolvedProblem() {
  const tree_items = [];
  const hook = await getHook();
  const token = await getToken();
  const git = new GitHub(hook, token);
  const stats = await getStats();
  const { refSHA, ref } = await git.getReference();
  await updateLocalStorageStats();
  await findUniqueResultTableListByUsername(findUsername())
    .then(async (list) => {
      const { submission } = stats;
      return list.filter((problem) => {
        const sha = getObjectDatafromPath(submission, `${hook}/${bojData.meta.directory}/${bojData.meta.fileName}`);
        return isNull(sha) || sha !== calculateBlobSHA(problem.submission.code);
      });
    })
    .then((list) => {
      if (list.length === 0) {
        MultiloaderUpToDate();
        return null;
      }
      setMultiLoaderDenom(list.length);
      return Promise.all(
        list.map(async (problem) => {
          const bojData = await findData(problem);
          if (isNull(bojData)) return;
          const source = await git.createBlob(bojData.submission.code, `${bojData.meta.directory}/${bojData.meta.fileName}`); // 소스코드 파일
          const readme = await git.createBlob(bojData.meta.readme, `${bojData.meta.directory}/README.md`); // readme 파일
          tree_items.push(...[source, readme]);
          incMultiLoader(1);
        }),
      );
    })
    .then(async () => {
      const { submission } = stats;
      tree_items.forEach((item) => {
        updateObjectDatafromPath(submission, `${hook}/${item.path}`, item.sha);
      });
      await saveStats(stats);
    })
    .then((_) => git.createTree(refSHA, tree_items))
    .then((treeSHA) => git.createCommit('전체 코드 업로드', treeSHA, refSHA))
    .then((commitSHA) => git.updateHead(ref, commitSHA))
    .then((_) => {
      if (debug) console.log('전체 코드 업로드 완료');
      incMultiLoader(1);
    })
    .catch((e) => {
      if (debug) console.log('전체 코드 업로드 실패', e);
    });
}

/* 모든 코드를 zip 파일로 저장하는 함수 */
async function downloadAllSolvedProblem() {
  const zip = new JSZip();
  await findUniqueResultTableListByUsername(findUsername())
    .then((list) => {
      setMultiLoaderDenom(list.length);
      return Promise.all(
        list.map(async (problem) => {
          const bojData = await findData(problem);
          if (isNull(bojData)) return;
          const folder = zip.folder(bojData.meta.directory);
          folder.file(`${bojData.meta.fileName}`, bojData.submission.code);
          folder.file('README.md', bojData.meta.readme);
          incMultiLoader(1);
        }),
      );
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

/* github repo에 있는 모든 파일 목록을 가져와서 stats 갱신 */
async function updateLocalStorageStats() {
  const hook = await getHook();
  const token = await getToken();
  const git = new GitHub(hook, token);
  const stats = await getStats();
  if (isEmpty(stats)) stats = {};
  const tree_items = [];
  await git.getTree().then((tree) => {
    tree.forEach((item) => {
      if (item.type === 'blob') {
        tree_items.push(item);
      }
    });
  });
  if (isEmpty(stats.submission)) stats.submission = {};
  const { submission } = stats;
  tree_items.forEach((item) => {
    updateObjectDatafromPath(submission, `${hook}/${item.path}`, item.sha);
  });
  await saveStats(stats);
  if (debug) console.log('update stats', stats);
}
