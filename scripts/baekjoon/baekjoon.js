// Set to true to enable console log
const debug = false;

/* 
  문제 제출 맞음 여부를 확인하는 함수
  2초마다 문제를 파싱하여 확인
*/
let loader;

// Stats 초기값이 없는 경우, 기본값을 생성하고 업데이트한다.
getStats().then((stats) => {
  if (isNull(stats)) stats = { version: '0.0.0', submission: {} };
  // 1.0.2 버전의 제출 내역을 초기화하기 위한 임시코드
  if (stats.version === '1.0.2') {
    stats.submission = {};
  }
  saveStats(stats);
});

const currentUrl = window.location.href;

// 문제 제출 사이트의 경우에는 로더를 실행하고, 유저 페이지의 경우에는 버튼을 생성한다.
if (currentUrl.includes('problem_id')) startLoader();
else if (currentUrl.includes('.net/user')) {
  getStats().then((stats) => {
    if (stats.version === getVersion()) {
      insertUploadAllButton();
      insertDownloadAllButton();
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
        if (username === findUsername() && result === '맞았습니다!!') {
          stopLoader();
          if (debug) console.log('풀이가 맞았습니다. 업로드를 시작합니다.');
          const bojData = await findData();
          await beginUpload(bojData);
        }
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
    const hook = await getHook();

    if (debug) console.log('stats in beginUpload()', stats);

    const currentVersion = stats.version;
    /* 버전 차이가 발생하거나, 해당 hook에 대한 데이터가 없는 경우 localstorage의 Stats 값을 업데이트하고, version을 최신으로 변경한다 */
    if (isNull(currentVersion) || isNewVersion(currentVersion, getVersion()) || isNull(await getStatsSHAfromPath(hook))) {
      const stats = await updateLocalStorageStats();
      // update version.
      stats.version = getVersion();
      await saveStats(stats);
      if (debug) console.log('stats updated.', stats);
    }

    /* 현재 제출하려는 소스코드가 기존 업로드한 내용과 같다면 중지 */
    if ((await getStatsSHAfromPath(`${hook}/${bojData.meta.directory}/${bojData.meta.fileName}`)) === calculateBlobSHA(bojData.submission.code)) {
      markUploadedCSS();
      console.log(`현재 제출번호를 업로드한 기록이 있습니다. submissionID ${bojData.submission.submissionId}`);
      return;
    }
    /* 신규 제출 번호라면 새롭게 커밋  */
    await uploadOneSolveProblemOnGit(bojData, markUploadedCSS);
  }
}
