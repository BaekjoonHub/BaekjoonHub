// Set to true to enable console log
const debug = false;

/*
  문제 제출 맞음 여부를 확인하는 함수
  2초마다 문제를 파싱하여 확인하고, 결과 모달이 닫히면 감지를 재무장해 재제출도 처리한다
*/
let loader;
let passHandled = false; // 지금 떠 있는 결과 모달을 이미 처리했는지 (모달 1회당 한 번만 처리)
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
  /* 재무장은 업로드가 끝났는지가 아니라 "이 모달이 닫혔는지" 만 본다.
     업로드 완료 뒤에 재무장하면, 느린 업로드 도중(20초 워치독의 빨간 체크 이후 등) 모달을 닫고
     재제출한 결과가 앞 업로드가 끝날 때까지 감지되지 않고 그대로 사라진다.
     (동일 코드 재제출은 beginUpload의 SHA 비교에서 스킵되므로 중복 커밋은 생기지 않는다) */
  rearmAfterModalClose();
  log('정답이 나왔습니다. 업로드를 시작합니다.');
  const attempt = startUpload();
  /* 파싱은 감지 즉시 시작한다. 이 시점의 에디터 코드와 채점 결과가 방금 정답을 받은 제출이며,
     업로드는 앞 업로드 뒤에 줄을 서더라도 이 데이터로 진행한다.
     줄은 파싱이 끝나기를 기다리지 않고 지금 선다. 파싱이 늦어지는 사이 다음 제출이 먼저 줄을 서면
     커밋 순서가 뒤집혀 이전 코드가 최신 코드를 덮는다. */
  const parsed = parseData().then(
    (bojData) => ({ bojData }),
    (error) => {
      console.error('[BaekjoonHub] 프로그래머스 파싱 중 오류가 발생했습니다.', error);
      // 확정된 실패이므로 앞 업로드나 워치독을 기다리지 않고 즉시 실패 아이콘을 표시한다.
      markUploadFailedCSS(attempt);
      return null;
    },
  );
  await enqueueUpload(parsed, attempt);
}

/**
 * 업로드를 앞선 업로드 뒤에 줄 세웁니다.
 * updateHead 가 force 로 ref 를 갱신하므로, 두 업로드가 같은 부모 커밋에서 동시에 진행되면 나중 PATCH 가
 * 앞 커밋을 브랜치 이력에서 지운다. 그래서 한 번에 하나씩만 실행한다.
 * 반환된 Promise 는 reject 되지 않는다 — 앞 업로드의 실패가 뒤 업로드를 막지 않게 하기 위함이다.
 * @param {Promise<({bojData: object}|null)>} parsed - 파싱 결과. 파싱에 실패했으면(이미 실패로 표시됨) null
 * @param {{elem: HTMLElement, done: boolean, countdown: (number|null)}} attempt - startUpload 가 돌려준 시도
 * @returns {Promise<void>}
 */
function enqueueUpload(parsed, attempt) {
  const run = uploadState.queue.then(async () => {
    const result = await parsed;
    if (isNull(result)) return;
    /* 워치독은 줄을 기다린 시간이 아니라 이 업로드가 실제로 걸린 시간만 잰다.
       감지 시점부터 재면 느린 앞 업로드 뒤에서 기다리기만 한 시도가 빨간 체크로 표시된다. */
    startUploadCountDown(attempt);
    try {
      await beginUpload(result.bojData, attempt);
    } catch (error) {
      console.error('[BaekjoonHub] 프로그래머스 업로드 중 오류가 발생했습니다.', error);
      // 확정된 실패이므로 워치독을 기다리지 않고 즉시 실패 아이콘을 표시한다.
      markUploadFailedCSS(attempt);
    }
  });
  uploadState.queue = run;
  return run;
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

/* 파싱 직후 실행되는 함수 (enqueueUpload 가 한 번에 하나씩 호출한다) */
async function beginUpload(bojData, attempt) {
  log('bojData', bojData);
  if (isNotEmpty(bojData)) {
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
        markUploadedCSS(stats.branches, bojData.directory, attempt);
        console.log('원격 저장소에 동일한 파일이 존재하여 업로드를 건너뜁니다.');
        return;
      }
      /* GitHub에서 파일이 삭제되거나 없는 경우, 새 업로드로 처리 */
      console.log('캐시된 SHA가 없습니다. 새로 업로드합니다.');
    } else if (cachedSHA == calcSHA) {
      markUploadedCSS(stats.branches, bojData.directory, attempt);
      console.log(`현재 제출번호를 업로드한 기록이 있습니다. problemIdID ${bojData.problemId}`);
      return;
    }
    /* 신규 제출 번호라면 새롭게 커밋  */
    await uploadOneSolveProblemOnGit(bojData, (branches, directory) => markUploadedCSS(branches, directory, attempt));
  } else {
    console.error('[BaekjoonHub] 프로그래머스 파싱 결과가 비어 있어 업로드하지 않습니다.', bojData);
    markUploadFailedCSS(attempt);
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
