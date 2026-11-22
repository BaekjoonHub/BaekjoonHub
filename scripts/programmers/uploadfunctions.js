/**
 * 맞은 풀이 하나를 GitHub 에 올립니다. (upload: scripts/upload.js)
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
    return await upload(token, hook, bojData.code, bojData.readme, bojData.directory, bojData.fileName, bojData.message, cb);
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      console.error('GitHub 토큰이 만료되었거나 유효하지 않습니다.', e);
      return;
    }
    throw e;
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
    const uploadedIds = extractUploadedProblemIds(stats, hook, '프로그래머스');
    const newList = solvedProblems.filter((item) => !uploadedIds.has(String(item.problemId)));

    if (newList.length === 0) {
      MultiloaderUpToDate();
      return null;
    }

    // 3. 문제 데이터 파싱 (asyncPool(2) 병렬 제어)
    setMultiLoaderDenom(newList.length);
    const datas = await asyncPool(2, newList, fetchProblemCodeAndData);
    const bojDatas = datas.filter((d) => !isNull(d));

    // 4. Tree 아이템 생성
    for (const bojData of bojDatas) {
      if (!isEmpty(bojData.code) && !isEmpty(bojData.readme)) {
        addBulkFiles(zip, tree_items, bojData.directory, [[bojData.fileName, bojData.code], ['README.md', bojData.readme]]);
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
