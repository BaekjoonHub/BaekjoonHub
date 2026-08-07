// Set to true to enable console log
const debug = false;

/*
  문제 제출 맞음 여부를 확인하는 함수
  MutationObserver로 결과 팝업을 즉시 감지하고, 2초 폴링은 fallback으로 유지
*/
let loader;
let passObserver;
let passHandled = false;
let parseFailCount = 0;

const currentUrl = window.location.href;

// 헤더가 아직 렌더되지 않았거나 DOM 구조가 변경된 경우 querySelector가 null을 반환할 수 있으므로
// 옵셔널 체이닝으로 가드한다. (가드가 없으면 .textContent 접근 시 TypeError가 최상위에서 던져져
// content script 전체가 중단되고, 이후 problemSolver.do 업로드 분기까지 실행되지 못한다.)
const isSweaMockTest = () => document.querySelector('header > h1 > span')?.textContent?.trim() === '모의 테스트';

// SWEA 연습 문제 주소임을 확인하고, 맞는 파서를 실행
// run_at: document_end 로 주입되므로, 헤더 미렌더 등 드문 경우엔 load 시점에 한 번 더 확인한다.
if (currentUrl.includes('/main/solvingProblem/solvingProblem.do')) {
  if (isSweaMockTest()) startLoader();
  else window.addEventListener('load', () => { if (isNull(loader) && isSweaMockTest()) startLoader(); });
} else if (currentUrl.includes('/main/code/problem/problemSolver.do') && currentUrl.includes('extension=BaekjoonHub')) parseAndUpload();

if (currentUrl.includes('/main/userpage/code/userCode.do')) {
  (async () => {
    const enable = await checkEnable();
    if (!enable) return;
    const stats = await getStats();
    if (isNull(stats)) return;
    if (stats.version !== getVersion()) {
      await versionUpdate();
    }
    insertUploadAllButton();
  })();
}

function parseAndUpload() {
  //async wrapper
  (async () => {
    try {
      // run_at: document_end 주입이므로, 제출 정보 영역이 아직 없으면 잠시 대기한다.
      // (SWEA는 서버 렌더링이라 보통 즉시 존재하지만, DOM 변동에 대비한 안전장치)
      await waitForElement(['#problemForm div.info', 'div.problem_box div.info', 'div.info'], 8000);
      const bojData = await parseData();
      await beginUpload(bojData);
    } catch (error) {
      console.error('[BaekjoonHub] SWEA 파싱/업로드 중 오류가 발생했습니다.', error);
      // 확정된 실패이므로 20초 워치독을 기다리지 않고 즉시 실패 아이콘을 표시한다.
      // (로딩 UI가 아직 삽입되지 않은 경우에는 안전하게 no-op)
      markUploadFailedCSS();
    }
  })();
}

/* 결과 팝업(pass) 감지 시 1회만 실행되는 공통 핸들러 */
async function handleSolvedResult() {
  if (passHandled) return;
  // 확장 컨텍스트가 무효화된 경우 감지 중단
  if (!chrome.runtime?.id) { stopLoader(); return; }
  if (!getSolvedResult().includes('pass입니다')) return;
  passHandled = true;
  // 기능 Off시 작동하지 않도록 함
  const enable = await checkEnable();
  if (!enable) { stopLoader(); return; }
  log('정답이 나왔습니다. 코드를 파싱합니다');
  try {
    const { contestProbId } = await parseCode();
    // 파싱이 성공했을 때만 감지를 종료한다. (실패 시에는 옵저버/폴링을 유지해 재시도)
    stopLoader();
    // 자동으로 업로드 페이지로 이동
    // prettier-ignore
    window.location.href = `${window.location.origin}`
      + `/main/code/problem/problemSolver.do?`
      + `contestProbId=${contestProbId}&`
      + `nickName=${getNickname()}&`
      + `extension=BaekjoonHub`;
  } catch (error) {
    // 파싱 실패 시 옵저버/폴링이 살아 있는 상태에서 플래그만 되돌려 다음 감지 때 재시도한다.
    // DOM이 영구적으로 깨진 경우 2초마다 무한 재시도하는 것을 막기 위해 상한을 둔다.
    passHandled = false;
    parseFailCount += 1;
    if (parseFailCount >= 5) stopLoader();
    console.error('[BaekjoonHub] SWEA 코드 파싱에 실패했습니다.', error);
  }
}

function startLoader() {
  // 팝업 표시(.popup_layer 에 show 클래스 부여 또는 노드 삽입)를 즉시 감지한다.
  // 2초 폴링 대비 평균 ~1초의 감지 지연을 제거한다.
  passObserver = new MutationObserver(() => {
    // 팝업 관련 변화가 아니면 getSolvedResult()의 querySelector 한 번으로 끝나므로 부담이 적다.
    handleSolvedResult();
  });
  passObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  // 옵저버가 놓치는 경우(스크립트 주입 전에 이미 팝업이 떠 있는 경우 등)를 위한 fallback 폴링
  loader = setInterval(async () => {
    if (!chrome.runtime?.id) { stopLoader(); return; }
    const enable = await checkEnable();
    if (!enable) { stopLoader(); return; }
    handleSolvedResult();
  }, 2000);

  // 주입 시점에 이미 결과가 떠 있는 경우 즉시 처리
  handleSolvedResult();
}

function getSolvedResult() {
  return document.querySelector('div.popup_layer.show > div > p.txt')?.innerText.trim().toLowerCase() || '';
}

function stopLoader() {
  clearInterval(loader);
  loader = null;
  if (passObserver) {
    passObserver.disconnect();
    passObserver = null;
  }
}

/**
 * selector 후보 중 하나가 DOM에 나타날 때까지 대기합니다.
 * 이미 존재하면 즉시 resolve하며, timeout 초과 시 null을 resolve합니다(throw하지 않음).
 * @param {string[]} selectors - 시도할 selector 목록
 * @param {number} timeoutMs - 최대 대기 시간(ms)
 * @returns {Promise<Element|null>}
 */
function waitForElement(selectors, timeoutMs = 8000) {
  const find = () => {
    for (const s of selectors) {
      try {
        const el = document.querySelector(s);
        if (el) return el;
      } catch (e) { /* 유효하지 않은 selector 무시 */ }
    }
    return null;
  };
  const found = find();
  if (found) return Promise.resolve(found);
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const observer = new MutationObserver(() => {
      const el = find();
      if (el) done(el);
    });
    const timer = setInterval(() => {
      const el = find();
      if (el || Date.now() >= deadline) done(el);
    }, 100);
    function done(el) {
      clearInterval(timer);
      observer.disconnect();
      resolve(el);
    }
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

/* 파싱 직후 실행되는 함수 */
async function beginUpload(bojData) {
  log('bojData', bojData);
  /* 파싱 결과가 유효할 때만 로딩 UI를 띄우고 업로드를 진행한다.
     파싱 실패 시 로딩 UI 없이 조용히 종료한다 (프로그래머스와 동일한 동작). */
  if (isNotEmpty(bojData)) {
    startUpload();
    const stats = await getStats();
    const hook = await getHook();
    const token = await getToken();

    /* GitHub 저장소(hook)/토큰/stats가 준비되지 않은 경우 크래시 대신 실패로 처리한다. */
    if (isNull(hook) || isNull(token) || isNull(stats)) {
      console.error('[BaekjoonHub] GitHub 저장소(hook)/토큰/stats가 준비되지 않아 업로드를 진행할 수 없습니다.', {
        hasHook: !isNull(hook),
        hasToken: !isNull(token),
        hasStats: !isNull(stats),
      });
      markUploadFailedCSS();
      return;
    }

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
  } else {
    console.error('[BaekjoonHub] SWEA 파싱 결과가 비어 있어 업로드를 진행하지 않습니다.');
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
