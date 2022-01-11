// Set to true to enable console log
const debug = true;


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
  })
}

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

/* 파싱 직후 실행되는 함수 */
async function beginUpload(bojData) {
  if(debug) console.log('bojData', bojData);
  if (isNotEmpty(bojData)) {
    startUpload();
    
    const stats = await getStats();
    if (debug) console.log('stats in beginUpload()', stats);

    // if (debug) console.log('stats version', stats.version, 'current version', getVersion());
    // /* 버전 차이 업로드 */
    if (stats.version === undefined || stats.version !== getVersion()) {
      markUploadFailedCSS();
      alert('버전 차이가 확인되었습니다. \n확장 프로그램을 열어 패치노트 확인 후 업데이트를 실행해주세요.');
      insertUpdateButton();
      return;
    }

    const filePath = bojData.meta.problemId + bojData.meta.problemId + bojData.meta.language;
    let recentSubmissionId = null;
    if (stats !== undefined && stats.submission !== undefined && stats.submission[filePath] !== undefined) {
      /**  
       * 1.0.2 버전 한정 로직으로 1.0.3에는 지워야함
       * 여기까지 왔다면 이미 버전체크가 된 상태이므로 변경되지 않은 파일에 대하여 하드 포맷
       */ 
      if(stats.submission[filePath].codeSha === undefined || stats.submission[filePath].readmeSha === undefined){
        delete stats.submission[filePath];
        saveStats(stats);
      }
      else recentSubmissionId = stats.submission[filePath].submissionId;
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
  } else console.log('in begin upload: not ready');
}
