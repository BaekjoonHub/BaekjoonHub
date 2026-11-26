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
    return await upload(token, hook, bojData, cb);
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      console.error('GitHub 토큰이 만료되었거나 유효하지 않습니다.', e);
      return;
    }
    throw e;
  }
}

/**
 * 프로그래머스에서 맞은 문제 전체를 GitHub에 일괄 업로드합니다. (uploadAllSolved: scripts/upload.js)
 */
function uploadAllSolvedProblemProgrammers() {
  return uploadAllSolved({
    folder: '프로그래머스',
    zipName: 'programmers',
    poolLimit: 2,
    listSolved: findAllSolvedProblems,
    fetchOne: fetchProblemCodeAndData,
  });
}
