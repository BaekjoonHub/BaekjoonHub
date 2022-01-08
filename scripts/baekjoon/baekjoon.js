// Set to true to enable console log
const debug = true;

/* 
  문제 제출 맞음 여부를 확인하는 함수
  2초마다 문제를 파싱하여 확인
*/
let loader;

function startLoader() {
  loader = setInterval(async () => {
    if (isExistResultTable()) {
      const { username, result } = findFromResultTable();
      if (username !== findUsername() || result === '틀렸습니다') {
        stopLoader();
        return;
      }
      if (username === findUsername() && result === '맞았습니다!!') {
        if (debug) console.log('풀이가 맞았습니다. 업로드를 시작합니다.');
        stopLoader();
        const bojData = await findData();
        await beginUpload(bojData);
      }
    }
  }, 2000);
}

function stopLoader() {
  clearInterval(loader);
}

startLoader();

/* 파싱 직후 실행되는 함수 */
async function beginUpload(bojData) {
  console.log('bojData', bojData);
  if (isNotEmpty(bojData)) {
    startUpload();
    chrome.storage.local.get('stats', (s) => {
      const { stats } = s;
      if (debug) console.log('stats in beginUpload()', stats);

      if (debug) console.log('stats version', stats.version, 'current version', getVersion());
      /* 버전 차이 업로드 */
      if (stats.version !== getVersion()) {
        markUploadFailedCSS();
        alert('버전 차이가 확인되었습니다. 확장 프로그램을 열어 패치노트를 확인해주세요.');
        insertUpdateButton();
        return;
      }

      const filePath = bojData.meta.problemId + bojData.meta.problemId + bojData.meta.language;
      let sha = null;
      let recentSubmissionId = null;
      if (stats !== undefined && stats.submission !== undefined && stats.submission[filePath] !== undefined) {
        sha = stats.submission[filePath].sha;
        recentSubmissionId = stats.submission[filePath].submissionId;
      }
      /* 현재 제출 번호가 기존 제출 번호와 같다면 실행 중지 */
      if (recentSubmissionId === bojData.submission.submissionId) {
        markUploadedCSS();
        console.log(`Git up to date with submission ID ${recentSubmissionId}`);
      } else {
        /* 신규 제출 번호라면 */
        // 문제 설명 커밋
        uploadGit(b64EncodeUnicode(bojData.meta.readme), bojData.meta.directory, 'README.md', CommitType.readme, undefined, bojData);

        /* Upload code to Git */
        setTimeout(function () {
          uploadGit(
            b64EncodeUnicode(bojData.submission.code),
            bojData.meta.directory,
            bojData.meta.fileName,
            CommitType.code,
            // callback is called when the code upload to git is a success
            () => {
              markUploadedCSS();
            },
            bojData,
          ); // Encode `code` to base64
        }, 2000);
      }
    });
  } else console.log('in begin upload: not ready');
}

/* 모든 코드를 제출하는 함수 */
// async function uploadAllSolvedProblem() {
//   const tree_items = [];
//   const username = await getGithubUsername();
//   const hook = await getHook();
//   const token = await getToken();

//   const tree = await findUniqueResultTableListByUsername().then((list) => {
//     Promise.all(
//       list.map(async (problem) => {
//         const bojData = await findData(problem);
//         if (isNull(bojData)) return;
//         tree_items.push(await createBlob(username, hook, token, bojData.submission.code)); // )); // 소스코드 파일
//         tree_items.push(await createBlob(username, hook, token, bojData.submission.problemDescription)); // )); // readme 파일
//       }),
//     ).then(async (_) => await createTree(username, hook, token, baseSHA, tree_items));
//   });

//   const commitSHA = await createCommit(username, hook, token, '전체 코드 업데이트', tree.sha, baseSHA);
//   updateHead(username, hook, token, commitSHA);
//   console.log('commit', commitSHA);
// }
