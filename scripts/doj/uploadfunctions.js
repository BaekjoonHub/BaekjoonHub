/**
 * 맞은 풀이 하나를 GitHub 에 올립니다. (upload: scripts/upload.js)
 * 실패는 던진다. 부른 쪽(doj.js uploadSubmission)이 토스트로 알리고, 저장소가 연결되어 있는지도 부른 쪽(checkSubmissions)이 먼저 본다.
 * @param {object} bojData - 파싱 결과 { code, readme, directory, fileName, message }
 * @param {function} cb - 업로드 뒤 완료 표시 콜백 (branches, directory, committed)
 */
async function uploadOneSolveProblemOnGit(bojData, cb) {
  /* 세 번째 인자로 새로 커밋했음을 알린다. 같은 코드라 건너뛸 때는 uploadUnlessSame 이 두 인자로 부른다. */
  return upload(await getToken(), await getHook(), bojData.code, bojData.readme, bojData.directory, bojData.fileName, bojData.message, (branches, directory) => cb(branches, directory, true));
}
