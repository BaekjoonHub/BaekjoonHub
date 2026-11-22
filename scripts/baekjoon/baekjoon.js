// Set to true to enable console log
const debug = false;

/* 
  문제 제출 맞음 여부를 확인하는 함수
  2초마다 문제를 파싱하여 확인
*/
let loader;

const currentUrl = window.location.href;
log(currentUrl);

/* 제출 페이지(/submit/번호)의 편집기 객체는 페이지의 JS 세계에만 있어서, 오래된 Chrome 에서도 되도록 manifest 의 "world" 키 대신
   <script> 요소로 submitfilter.js 를 페이지에 넣는다. 로그인이나 다른 준비를 기다리지 않는다. */
if (/^https:\/\/(www\.)?acmicpc\.net\/submit\/\d+/.test(currentUrl)) injectPageScript('baekjoonhub-submitfilter', 'scripts/baekjoon/submitfilter.js');

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
        // includes: 부분 점수('pac')도 맞은 것으로 본다
        if (!resultCategory.includes(RESULT_CATEGORY.RESULT_ACCEPTED)) {
          // 채점 중/기다리는 중 등 비완료 상태를 감지
          seenPending = true;
          askToWatchSolution(data);
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

/* BOJ 는 채점 결과를 Pusher 이벤트로 화면에 반영한다(status.js 의 display_solution). 이벤트가 오지 않으면 결과 칸이
   "채점 준비 중" 등에서 멈추고, 로더는 화면의 표만 읽으므로 새 제출이 올라가지 않는다.
   맨 위 제출이 채점 중이면 페이지 컨텍스트에서 도는 statusrefresh.js 에 그 제출을 지켜봐 달라고 부탁한다. 거기서는 BOJ 의
   display_solution·pusher 에 닿으므로, 실시간 이벤트가 오는 동안은 요청 없이 기다리고 오지 않을 때만 /status/ajax 로 결과를 채운다.
   그 스크립트는 manifest 의 "world" 키(Chrome 111 이상) 대신 <script> 요소로 페이지에 넣는다(injectPageScript, util.js). 처음 부탁할 때 한 번만 넣고,
   확장을 다시 불러와 이 스크립트가 한 번 더 떠도 두 벌이 되지 않도록 중복 여부는 페이지의 DOM(요소 id)으로 가린다.
   부탁은 스크립트가 뜨기 전에 보낸 것이 사라지므로 채점 중인 동안 로더 주기마다 되풀이한다(이미 지켜보는 제출은 무시된다). */
const STATUS_REFRESH_SCRIPT_ID = 'baekjoonhub-statusrefresh';
const STATUS_REFRESH_SCRIPT_FILE = 'scripts/baekjoon/statusrefresh.js';

function askToWatchSolution(row) {
  const pending = [RESULT_CATEGORY.RESULT_PENDING, RESULT_CATEGORY.RESULT_PENDING_REJUDGE, RESULT_CATEGORY.RESULT_PREPARE_FOR_JUDGE, RESULT_CATEGORY.RESULT_JUDGING];
  if (!pending.includes(row.resultCategory)) return;
  const id = /^solution-(\d+)$/.exec(row.elementId)?.[1];
  if (!id) return;
  injectPageScript(STATUS_REFRESH_SCRIPT_ID, STATUS_REFRESH_SCRIPT_FILE);
  window.postMessage({ type: 'BaekjoonHub:watch-solution', id }, window.location.origin);
}

/* 파싱 직후 실행되는 함수 */
async function beginUpload(bojData) {
  bojData = preProcessEmptyObj(bojData);
  log('bojData', bojData);
  if (!isNull(bojData) && isNotEmpty(bojData.code) && isNotEmpty(bojData.readme) && isNotEmpty(bojData.directory)) {
    await uploadUnlessSame(bojData, markUploadedCSS);
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
