// Set to true to enable console log
const debug = false;

/* 
  문제 제출 맞음 여부를 확인하는 함수
  2초마다 문제를 파싱하여 확인
*/
let loader;

if(currentUrl.includes('problem_id'))
  startLoader();
else if(currentUrl.includes('.net/user')){
  getStats()
  .then(stats =>{
    if(stats.version === getVersion()){
      insertUploadAllButton();
    }
  });
}

function startLoader() {
  loader = setInterval(async () => {
    if (isExistResultTable()) {
      const table = findFromResultTable();
      if (isEmpty(table)) return;
      const data = table[0];
      if (data.hasOwnProperty('username') && data.hasOwnProperty('result')) {
        const { username, result } = data;
        stopLoader();

        if (username === findUsername() && result === '맞았습니다!!') {
          if (debug) console.log('풀이가 맞았습니다. 업로드를 시작합니다.');
          const bojData = await findData();
          await beginUpload(bojData);
        }
        else return;
      }
    }
  }, 2000);
}

function stopLoader() {
  clearInterval(loader);
}

/* 파싱 직후 실행되는 함수 */
async function beginUpload(bojData) {
  if (debug) console.log('bojData', bojData);
  if (isNotEmpty(bojData)) {
    startUpload();

    const stats = await getStats();
    if (debug) console.log('stats in beginUpload()', stats);

    /* 버전 차이 업로드 */
    if (isNull(stats.version) || stats.version !== getVersion()) {
      markUploadFailedCSS();
      alert('버전 차이가 확인되었습니다. \n확장 프로그램을 열어 패치노트 확인 후 업데이트를 실행해주세요.');
      insertUpdateButton();
      return;
    }

    const filePath = bojData.meta.problemId + bojData.meta.problemId + bojData.meta.language;
    let recentSubmissionId = null;
    if (!isNull(stats) && !isNull(stats.submission[filePath])) {
      /* code 또는 readme의 sha가 storage에 저장되어 있지 않은 경우, 잘못된 기록이므로 해당 문제에 대한 기록을 초기화 */
      if (isNull(stats.submission[filePath][CommitType.code]) || isNull(stats.submission[filePath][CommitType.readme])) {
        delete stats.submission[filePath];
        saveStats(stats);
      } else {
        recentSubmissionId = stats.submission[filePath].submissionId;
      }
    }

    /* 현재 제출 번호가 기존 제출 번호와 같다면 실행 중지 */
    if (recentSubmissionId === bojData.submission.submissionId) {
      markUploadedCSS();
      console.log(`현재 제출번호를 업로드한 기록이 있습니다. ID ${recentSubmissionId}`);
      return;
    }
    /* 신규 제출 번호라면 */
    // 문제 설명 커밋
    uploadGit(b64EncodeUnicode(bojData.meta.readme), bojData.meta.directory, 'README.md', CommitType.readme, undefined, bojData);
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
    );
  }
}
