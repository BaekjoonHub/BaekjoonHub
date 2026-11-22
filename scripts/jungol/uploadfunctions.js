/**
 * 맞은 풀이 하나를 GitHub 에 올립니다. (upload: scripts/upload.js)
 * 실패는 던진다. 부른 쪽(jungol.js handleResult)이 채점 결과 대화상자와 토스트로 알린다.
 * @param {object} bojData - 파싱 결과 { code, readme, directory, fileName, message }
 * @param {function} cb - 업로드 뒤 완료 표시 콜백 (branches, directory, committed)
 */
async function uploadOneSolveProblemOnGit(bojData, cb) {
  const token = await getToken();
  const hook = await getHook();
  if (isNull(token) || isNull(hook)) throw new Error('GitHub 저장소가 연결되어 있지 않습니다. BaekjoonHub 설정을 확인해 주세요.');
  /* 세 번째 인자로 새로 커밋했음을 알린다. 같은 코드라 건너뛸 때는 uploadUnlessSame 이 두 인자로 부른다. */
  return upload(token, hook, bojData.code, bojData.readme, bojData.directory, bojData.fileName, bojData.message, (branches, directory) => cb(branches, directory, true));
}
