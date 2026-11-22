/** NOTE: github upload와 관련된 로직 모음입니다. */

/**
 * 맞은 풀이 하나를 GitHub 에 올립니다. (upload: scripts/upload.js)
 * @param {object} bojData - 파싱 결과 { code, readme, directory, fileName, message }
 * @param {function} cb - 업로드 뒤 완료 표시 콜백 (branches, directory)
 */
async function uploadOneSolveProblemOnGit(bojData, cb) {
  const { code, readme, directory, fileName, message } = bojData;
  const token = await getToken();
  const hook = await getHook();
  if (isNull(token) || isNull(hook)) {
    console.error('token or hook is null', token, hook);
    return;
  }
  try {
    return await upload(token, hook, code, readme, directory, fileName, message, cb);
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      console.error('GitHub 토큰이 만료되었거나 유효하지 않습니다.', e);
      return;
    }
    throw e;
  }
}
