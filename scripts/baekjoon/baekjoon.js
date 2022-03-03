// Set to true to enable console log
const debug = false;
/* 
  문제 제출 맞음 여부를 확인하는 함수
  2초마다 문제를 파싱하여 확인
*/
let loader;

const currentUrl = window.location.href;
console.log(currentUrl);

// 문제 제출 사이트의 경우에는 로더를 실행하고, 유저 페이지의 경우에는 버튼을 생성한다.
// 백준 사이트 로그인 상태이면 username이 있으며, 아니면 없다.
const username = findUsername();
if (!isNull(username)) {
  if (currentUrl.includes('status?') && currentUrl.includes(`user_id=${username}`)) startLoader();
  else if (currentUrl.includes('/source/') && currentUrl.includes('extension=BaekjoonHub')) parseLoader();
  else if (currentUrl.includes('.net/user')) {
    getStats().then((stats) => {
      if (!isEmpty(stats.version) && stats.version === getVersion()) {
        if (findUsernameOnUserInfoPage() === username) {
          // insertUploadAllButton();
          // insertDownloadAllButton();
        }
      } else {
        versionUpdate();
      }
    });
  }
}

function startLoader() {
  loader = setInterval(async () => {
    if (isExistResultTable()) {
      const table = findFromResultTable();
      if (isEmpty(table)) return;
      const data = table[0];
      if (data.hasOwnProperty('username') && data.hasOwnProperty('resultCategory')) {
        const { username, resultCategory } = data;
        if (username === findUsername() && resultCategory.includes(RESULT_CATEGORY.RESULT_ACCEPTED)) {
          stopLoader();
          console.log('풀이가 맞았습니다. 업로드를 시작합니다.');
          const bojData = await findData();
          /* await beginUpload(bojData); */
        }
      }
    }
  }, 2000);
}

function stopLoader() {
  clearInterval(loader);
  loader = null;
}

/**
 * document 파싱 함수 - 파싱 후 업로드를 진행한다
 * @param: 파싱할 문서 - default는 현재 제출 페이지
 */
function parseLoader(doc = document) {
  Swal.fire({
    title: '🛠️ 업로드 진행중',
    html: '<b>BaekjoonHub</b> 익스텐션이 실행하였습니다<br/>이 창은 자동으로 닫힙니다',
    didOpen: () => {
      Swal.showLoading();
    },
    allowOutsideClick: false,
    allowEscapeKey: false,
    allowEnterKey: false,
  });
  loader = setInterval(async () => {
    try {
      console.log('파싱 중...');
      const bojData = await parseData(doc);
      console.log('bojData', bojData);
      if (isNotEmpty(bojData)) {
        stopLoader();
        Swal.close();
        console.log('백준 업로드 시작합니다.');
        await beginUpload(bojData);
      }
    } catch (e) {
      stopLoader();
      Swal.fire({
        icon: 'error',
        title: '에러 발생',
        html: `<b>BaekjoonHub</b> 익스텐션이 실행하였습니다<br/>에러가 발생했습니다. 개발자에게 문의해주세요.<br/><br/>${e}`,
        footer: '<a href="https://github.com/BaekjoonHub/BaekjoonHub/issues">개발자에게 문의하기</a>',
      });
    }
  }, 2000);
}

/* 파싱 직후 실행되는 함수 */
async function beginUpload(bojData) {
  if (debug) console.log('bojData', bojData);
  if (isNotEmpty(bojData)) {
    startUpload();

    const stats = await getStats();
    const hook = await getHook();

    const currentVersion = stats.version;
    /* 버전 차이가 발생하거나, 해당 hook에 대한 데이터가 없는 경우 localstorage의 Stats 값을 업데이트하고, version을 최신으로 변경한다 */
    if (isNull(currentVersion) || currentVersion !== getVersion() || isNull(await getStatsSHAfromPath(hook))) {
      await versionUpdate();
    }

    /* 현재 제출하려는 소스코드가 기존 업로드한 내용과 같다면 중지 */
    if (debug) console.log('local:', await getStatsSHAfromPath(`${hook}/${bojData.directory}/${bojData.fileName}`), 'calcSHA:', calculateBlobSHA(bojData.code));
    if ((await getStatsSHAfromPath(`${hook}/${bojData.directory}/${bojData.fileName}`)) === calculateBlobSHA(bojData.code)) {
      markUploadedCSS();
      console.log(`현재 제출번호를 업로드한 기록이 있습니다.` /* submissionID ${bojData.submissionId}` */);
      return;
    }
    /* 신규 제출 번호라면 새롭게 커밋  */
    await uploadOneSolveProblemOnGit(bojData, markUploadedCSS);
  }
}

async function versionUpdate() {
  if (debug) console.log('start versionUpdate');
  const stats = await updateLocalStorageStats();
  // update version.
  stats.version = getVersion();
  await saveStats(stats);
  if (debug) console.log('stats updated.', stats);
}
