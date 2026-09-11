// Set to true to enable console log
const debug = false;

/* 
  문제 제출 맞음 여부를 확인하는 함수
  2초마다 문제를 파싱하여 확인하고, 결과 모달이 닫히면 감지를 재무장해 재제출도 처리한다
*/
let loader;
let passHandled = false; // 같은 결과 모달로 중복 트리거되는 것을 막는 플래그
let handleCount = 0; // 한 페이지 로드에서의 처리 횟수 (비정상 재트리거 폭주 방지)

const MAX_HANDLE_COUNT = 30;

const currentUrl = window.location.href;

// 프로그래머스 연습 문제 주소임을 확인하고, 맞다면 로더를 실행
if (currentUrl.includes('/learn/courses/30') && currentUrl.includes('lessons')) startLoader();

if (currentUrl.includes('/learn/challenges')) {
  (async () => {
    const enable = await checkEnable();
    if (!enable) return;
    const stats = await getStats();
    if (isNull(stats)) return;
    if (stats.version !== getVersion()) {
      await versionUpdate();
    }
    // SPA이므로 div.total이 렌더링될 때까지 대기
    const waitForElement = (selector, timeout = 10000) => new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) { observer.disconnect(); resolve(el); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
    await waitForElement('div.total div.bookmark');
    insertUploadAllButton();
  })();
}

/* 결과 모달에 '정답'이 표시된 경우, 모달 1회당 한 번만 실행되는 핸들러 */
async function handleSolvedResult() {
  if (passHandled) return;
  // 업로드가 진행 중이면 중복 실행하지 않는다 (passHandled에 이은 2차 방어선)
  if (uploadState.uploading) return;
  // 결과 모달이 실제로 화면에 떠 있고, 그 안에 '정답'이 표시된 경우에만 처리한다
  if (!isResultModalOpen() || !getSolvedResult().includes('정답')) return;
  // 여기까지 모두 동기 코드이므로, 아래 플래그가 세워지기 전에 다음 tick이 끼어들 수 없다
  passHandled = true;
  handleCount += 1;
  // DOM 이상 등으로 재트리거가 폭주하는 경우를 대비한 상한
  if (handleCount > MAX_HANDLE_COUNT) {
    stopLoader();
    return;
  }
  log('정답이 나왔습니다. 업로드를 시작합니다.');
  try {
    const bojData = await parseData();
    await beginUpload(bojData);
  } catch (error) {
    console.error('[BaekjoonHub] 프로그래머스 파싱/업로드 중 오류가 발생했습니다.', error);
    // 확정된 실패이므로 워치독을 기다리지 않고 즉시 실패 아이콘을 표시한다.
    // (로딩 아이콘이 아직 삽입되지 않은 경우에는 안전하게 no-op)
    markUploadFailedCSS();
  } finally {
    /* 성공/스킵/실패 어느 결과였든 모달이 닫히면 감지를 재무장해, 같은 화면에서의 재제출도 처리한다.
       (동일 코드 재제출은 beginUpload의 SHA 비교에서 스킵되므로 중복 커밋은 생기지 않는다) */
    rearmAfterModalClose();
  }
}

/**
 * 결과 모달이 닫힌 뒤 감지를 재무장합니다.
 * 모달이 떠 있는 동안 재무장하면 같은 '정답' 텍스트로 즉시 재트리거되어 루프가 되므로,
 * 모달이 화면에서 사라진 것을 확인한 뒤 플래그를 되돌린다.
 */
function rearmAfterModalClose() {
  const rearm = setInterval(() => {
    if (!chrome.runtime?.id) {
      clearInterval(rearm);
      return;
    }
    if (isResultModalOpen()) return;
    clearInterval(rearm);
    // 이전 시도의 아이콘이 다음 모달에 그대로 남아 보이지 않도록 정리한다
    const anchor = document.getElementById('BaekjoonHub_progress_anchor_element');
    if (!isNull(anchor)) anchor.remove();
    passHandled = false;
  }, 500);
}

function startLoader() {
  loader = setInterval(async () => {
    /* 확장 컨텍스트가 무효화된 경우(확장 업데이트/재설치) 감지를 중단한다.
       가드가 없으면 checkEnable의 storage 접근이 2초마다 계속 reject된다. */
    if (!chrome.runtime?.id) {
      stopLoader();
      return;
    }
    // 기능 Off시 작동하지 않도록 함
    const enable = await checkEnable();
    if (!enable) {
      stopLoader();
      return;
    }
    // 제출 후 채점하기 결과가 성공적으로 나왔다면 코드를 파싱하고, 업로드를 시작한다
    handleSolvedResult();
  }, 2000);
}

function stopLoader() {
  clearInterval(loader);
  loader = null;
}

/* 채점 결과가 표시되는 요소 (프로그래머스 DOM 변경에 대비해 여러 selector를 시도한다) */
function getSolvedResultElement() {
  return document.querySelector('div.modal-header > h4')
    || document.querySelector('#modal-dialog h4')
    || document.querySelector('.modal-header h4')
    || document.querySelector('[class*="modal"] h4');
}

function getSolvedResult() {
  const result = getSolvedResultElement();
  if (result) return result.innerText;
  return '';
}

/* 채점 결과 모달이 실제로 화면에 떠 있는지 확인한다.
   닫힌(display:none) 요소의 innerText는 textContent로 폴백되어 '정답'이 그대로 읽히므로
   텍스트만으로는 모달이 닫혔는지 알 수 없고, 부트스트랩 버전에 따라 show/in 클래스도 달라진다.
   그래서 클래스가 아니라 실제 렌더링 여부로 판단한다. */
function isResultModalOpen() {
  const elem = getSolvedResultElement();
  if (isNull(elem)) return false;
  return !!(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length);
}

/* 파싱 직후 실행되는 함수 */
async function beginUpload(bojData) {
  log('bojData', bojData);
  if (isNotEmpty(bojData)) {
    startUpload();

    const stats = await getStats();
    const hook = await getHook();
    const token = await getToken();

    const currentVersion = stats.version;
    /* 버전 차이가 발생하거나, 해당 hook에 대한 데이터가 없는 경우 localstorage의 Stats 값을 업데이트하고, version을 최신으로 변경한다 */
    if (isNull(currentVersion) || currentVersion !== getVersion() || isNull(await getStatsSHAfromPath(hook))) {
      await versionUpdate();
    }

    /* 현재 제출하려는 소스코드가 기존 업로드한 내용과 같다면 중지 */
    cachedSHA = await getStatsSHAfromPath(`${hook}/${bojData.directory}/${bojData.fileName}`)
    calcSHA = calculateBlobSHA(bojData.code)
    log('cachedSHA', cachedSHA, 'calcSHA', calcSHA)

    if (isNull(cachedSHA)) {
      /* 로컬 캐시가 없는 경우 원격 저장소에서 파일 존재 여부 실시간 확인 */
      const remoteFile = await getFile(hook, token, `${bojData.directory}/${bojData.fileName}`);
      if (remoteFile && remoteFile.sha === calcSHA) {
        markUploadedCSS(stats.branches, bojData.directory);
        console.log('원격 저장소에 동일한 파일이 존재하여 업로드를 건너뜁니다.');
        return;
      }
      /* GitHub에서 파일이 삭제되거나 없는 경우, 새 업로드로 처리 */
      console.log('캐시된 SHA가 없습니다. 새로 업로드합니다.');
    } else if (cachedSHA == calcSHA) {
      markUploadedCSS(stats.branches, bojData.directory);
      console.log(`현재 제출번호를 업로드한 기록이 있습니다. problemIdID ${bojData.problemId}`);
      return;
    }
    /* 신규 제출 번호라면 새롭게 커밋  */
    await uploadOneSolveProblemOnGit(bojData, markUploadedCSS);
  }
}

async function versionUpdate() {
  log('start versionUpdate');
  const stats = await updateLocalStorageStats();
  // update version.
  stats.version = getVersion();
  await saveStats(stats);
  log('stats updated.', stats);
}

// /* TODO: 하나의 데이터만 가져오는 구조이므로 page를 계속적으로
//   아래 있는 네이베이션바의 "다음"버튼이 비활성화 될때까지 반복으로 진행한다.
//   진행하며 존재하는 알고리즘 카드인 div.col-item > div.card-algorithm > a 의 href 속성값을 가져와 리스트화하고,
//   이를 차후 fetch GET를 진행하여 작성한 알고리즘을 가져와 github에 업로드를 진행한다.
//   */
// function get_all_problems() {}
