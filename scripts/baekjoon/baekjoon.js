// Set to true to enable console log
const debug = false;

/* 
  문제 제출 맞음 여부를 확인하는 함수
  2초마다 문제를 파싱하여 확인
*/
let loader;

const currentUrl = window.location.href;
log(currentUrl);

// 문제 제출 사이트의 경우에는 로더를 실행하고, 유저 페이지의 경우에는 버튼을 생성한다.
// 백준 사이트 로그인 상태이면 username이 있으며, 아니면 없다.
const username = findUsername();
if (!isNull(username)) {
  if (['status', `user_id=${username}`, 'problem_id', 'from_mine=1'].every((key) => currentUrl.includes(key))) startLoader();
  else if (currentUrl.match(/\.net\/problem\/\d+/) !== null) {
    parseProblemDescription();
    injectSaveExamplesButton();
  }
  else if (currentUrl.includes('.net/user') && findUsernameOnUserInfoPage() === username) {
    /* 자기 프로필에서만 캐시를 재구축하고 전체 업로드 버튼을 붙인다(프로그래머스·SWEA 와 같은 순서).
       재구축은 레포 파일 목록을 읽지 못하면(토큰 만료 등) 버전을 기록하지 않아 다음 방문에 다시 시도하므로,
       남의 프로필을 볼 때마다 GitHub 요청이 나가지 않게 한다. */
    getStats().then(async (stats) => {
      if (isEmpty(stats?.version) || stats.version !== getVersion()) await versionUpdate();
      insertUploadAllButton();
    });
  }
  if (currentUrl.includes('/status')) injectManualUploadButtons(username);
}

/* 제출 직후에는 결과가 "기다리는 중/채점 중" → "맞았습니다"로 전이됨.
   이력 페이지에서는 즉시 "맞았습니다"가 보이므로, 전이를 감지하여 구분함. */
let seenPending = false;

function startLoader() {
  loader = setInterval(async () => {
    // 기능 Off시 작동하지 않도록 함
    const enable = await checkEnable();
    if (!enable) stopLoader();
    else if (isExistResultTable()) {
      const table = findFromResultTable();
      if (isEmpty(table)) return;
      const data = table[0];
      if (data.hasOwnProperty('username') && data.hasOwnProperty('resultCategory')) {
        const { username, resultCategory } = data;
        if (username !== findUsername()) return;
        const isAccepted = resultCategory.includes(RESULT_CATEGORY.RESULT_ACCEPTED) ||
          resultCategory.includes(RESULT_CATEGORY.RESULT_ENG_ACCEPTED);
        if (!isAccepted) {
          // 채점 중/기다리는 중 등 비완료 상태를 감지
          seenPending = true;
          return;
        }
        stopLoader();
        if (seenPending) {
          console.log('풀이가 맞았습니다. 업로드를 시작합니다.');
          startUpload();
        }
        // !seenPending: 이력 페이지 or 재시도. beginUpload()의 SHA 체크가 중복 처리.
        const bojData = await findData();
        await beginUpload(bojData);
      }
    }
  }, 2000);
}

function stopLoader() {
  clearInterval(loader);
  loader = null;
}

function toastThenStopLoader(toastMessage, errorMessage) {
  Toast.raiseToast(toastMessage)
  stopLoader()
  throw new Error(errorMessage)
}

/* 파싱 직후 실행되는 함수 */
async function beginUpload(bojData) {
  bojData = preProcessEmptyObj(bojData);
  log('bojData', bojData);
  if (!isNull(bojData) && isNotEmpty(bojData.code) && isNotEmpty(bojData.readme) && isNotEmpty(bojData.directory)) {
    const stats = await getStats();
    const hook = await getHook();
    const token = await getToken();

    const currentVersion = stats.version;
    /* 버전 차이가 발생하거나, 해당 hook에 대한 데이터가 없는 경우 localstorage의 Stats 값을 업데이트하고, version을 최신으로 변경한다 */
    if (isNull(currentVersion) || currentVersion !== getVersion() || isNull(await getStatsSHAfromPath(hook))) {
      await versionUpdate();
    }

    /* 현재 제출하려는 소스코드가 기존 업로드한 내용과 같다면 중지 */
    /* 선언 없이 대입하면 전역 변수가 되어, 겹쳐 실행되는 다른 업로드가 비교 도중 값을 바꿀 수 있다 */
    const cachedSHA = await getStatsSHAfromPath(`${hook}/${bojData.directory}/${bojData.fileName}`);
    const calcSHA = calculateBlobSHA(bojData.code);
    log('cachedSHA', cachedSHA, 'calcSHA', calcSHA)

    if (isNull(cachedSHA)) {
      /* 로컬 캐시가 없는 경우 원격 저장소에서 파일 존재 여부 실시간 확인 */
      const remoteFile = await getFile(hook, token, `${bojData.directory}/${bojData.fileName}`);
      if (remoteFile && remoteFile.sha === calcSHA) {
        markUploadedCSS(stats.branches, bojData.directory);
        console.log('원격 저장소에 동일한 파일이 존재하여 업로드를 건너뜁니다.');
        return;
      }
      /* GitHub에서 파일이 삭제된 경우, 새 업로드로 처리 */
      console.log('캐시된 SHA가 없습니다. 새로 업로드합니다.');
    } else if (cachedSHA == calcSHA) {
      markUploadedCSS(stats.branches, bojData.directory);
      console.log(`현재 제출번호를 업로드한 기록이 있습니다.` /* submissionID ${bojData.submissionId}` */);
      return;
    }
    /* 신규 제출 번호라면 새롭게 커밋  */
    await uploadOneSolveProblemOnGit(bojData, markUploadedCSS);
  }
}

/* 수동 업로드 큐 (동기적 처리) */
const manualUploadQueue = [];
let isManualUploading = false;

async function processManualUploadQueue() {
  if (isManualUploading || manualUploadQueue.length === 0) return;
  isManualUploading = true;
  while (manualUploadQueue.length > 0) {
    const { data, button } = manualUploadQueue.shift();
    button.classList.remove('bjh-upload-icon');
    button.classList.add('BaekjoonHub_progress');
    button.title = '업로드 중...';
    try {
      const bojData = await findData(data);
      if (isNotEmpty(bojData)) {
        await uploadOneSolveProblemOnGit(bojData, markUploadedCSS);
        button.classList.remove('BaekjoonHub_progress');
        button.classList.add('bjh-upload-success');
        button.title = '업로드 완료';
      } else {
        button.classList.remove('BaekjoonHub_progress');
        button.classList.add('bjh-upload-fail');
        button.title = '데이터 파싱 실패';
      }
    } catch (e) {
      console.error('Manual upload failed:', e);
      button.classList.remove('BaekjoonHub_progress');
      button.classList.add('bjh-upload-fail');
      button.title = '업로드 실패: ' + e.message;
    }
  }
  isManualUploading = false;
}

function injectManualUploadButtons(currentUsername) {
  if (!isExistResultTable()) return;
  const table = findFromResultTable();
  if (isEmpty(table)) return;
  for (const row of table) {
    const isAccepted = row.resultCategory === RESULT_CATEGORY.RESULT_ACCEPTED ||
      row.resultCategory === RESULT_CATEGORY.RESULT_PARTIALLY_ACCEPTED;
    if (!isAccepted) continue;
    if (row.username !== currentUsername) continue;
    const rowEl = document.getElementById(row.elementId);
    if (!rowEl) continue;
    const resultCell = rowEl.querySelector('[data-color]')?.closest('td');
    if (!resultCell) continue;
    if (resultCell.querySelector('.bjh-manual-upload-btn')) continue;
    const btn = document.createElement('button');
    btn.className = 'bjh-manual-upload-btn bjh-upload-icon';
    btn.title = 'GitHub에 업로드';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.classList.contains('BaekjoonHub_progress') || btn.classList.contains('bjh-upload-success')) return;
      manualUploadQueue.push({ data: row, button: btn });
      processManualUploadQueue();
    });
    resultCell.appendChild(btn);
  }
}

async function injectSaveExamplesButton() {
  const enabled = await getSaveExamplesOption();
  if (!enabled) return;
  const samples = parseSampleData(document);
  if (samples.length === 0) return;
  const anchor = document.getElementById('sampleinput1') || document.querySelector('#sample-input-1')?.parentElement;
  if (!anchor) return;
  const btn = document.createElement('button');
  btn.className = 'bjh-save-examples-btn';
  btn.textContent = '예제 업로드';
  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.classList.remove('success', 'fail');
    btn.textContent = '업로드 중...';
    try {
      await uploadExamplesFromProblemPage(samples);
      btn.classList.add('success');
      btn.textContent = '업로드 완료';
    } catch (e) {
      console.error('예제 업로드 실패:', e);
      btn.classList.add('fail');
      btn.textContent = '업로드 실패';
      btn.disabled = false;
    }
  });
  anchor.parentElement.insertBefore(btn, anchor);
}

async function versionUpdate() {
  log('start versionUpdate');
  /* 버전은 재구축과 같은 저장에 기록한다(레포 파일 목록을 읽지 못했으면 기록하지 않아 다음에 다시 재구축한다).
     재구축 결과를 받아 버전을 붙여 다시 저장하면, 그 사이 다른 탭이 남긴 업로드 기록을 덮는다. */
  const stats = await updateLocalStorageStats({ version: getVersion() });
  log('stats updated.', stats);
}
