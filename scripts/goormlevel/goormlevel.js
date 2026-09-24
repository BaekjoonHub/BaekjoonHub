/** NOTE: goormlevel 핵심 로직입니다. */

// Set to true to enable console log
const debug = false;

/*
  문제 제출 맞음 여부를 확인하는 함수
  2초마다 채점 결과를 확인하고, 새 정답 결과가 나타날 때마다(재제출 포함) 한 번씩 처리한다
*/
let loader;

/* 이미 처리한 채점 결과(정답 span).
   구름LEVEL 은 제출할 때마다 결과 블록을 목록 맨 위에 새로 쌓고 이전 블록을 지우지 않는다(같은 정답이어도
   새 span 이 생긴다). 그래서 "처리한 span 인지" 로 새 제출을 구분한다. 예전에는 첫 정답을 처리한 뒤 감지를
   멈춰, 페이지를 새로고침하지 않으면 재제출이 업로드되지 않았다. */
const handledResults = new WeakSet();
/* 결과별 파싱 실패 횟수. 렌더링 지연이면 다음 tick 에 다시 시도하되, DOM 이 영구적으로 깨진 경우
   같은 결과를 2초마다 무한 재시도하지 않도록 상한을 둔다. */
const parseFailCounts = new WeakMap();
const GOORM_MAX_PARSE_RETRY = 5;

/* 제출 버튼을 누른 순간의 언어·코드(readGoormEditor). 결과가 나오면 그 결과에 묶어(submittedCodes) 업로드한다.
   결과를 감지하는 시점에 에디터를 읽으면, 채점(약 10초)을 기다리거나 '실행 결과' 탭을 보는 동안 고친 코드가
   채점받은 적 없이 정답으로 올라간다. 채점 중에는 제출 버튼이 비활성화되어 새 제출이 끼어들 수 없으므로,
   가장 최근 기록이 곧 맨 위 결과의 제출이다. 기록이 없으면(버튼을 거치지 않은 제출) 감지 시점의 에디터를 읽는다. */
let pendingSubmittedCode = null;
const submittedCodes = new WeakMap();

const currentPathname = window.location.pathname;

// 구름 LEVEL 연습 문제 주소임을 확인하고, 맞다면 로더를 실행
if (/^\/exam\/\d+\/[^\/]+\/quiz\/1$/.test(currentPathname)) startLoader();

function startLoader() {
  // 캡처 단계에서 받아, 페이지가 제출을 처리하기 전에 에디터를 읽는다
  document.addEventListener('click', captureSubmittedCode, true);
  loader = setInterval(async () => {
    /* 확장 컨텍스트가 무효화(업데이트/재설치/리로드)된 경우 감지를 중단한다. */
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
  document.removeEventListener('click', captureSubmittedCode, true);
}

/* 제출 버튼 클릭이면 그 순간의 언어·코드를 기록한다. 비활성(채점 중) 버튼은 제출되지 않으므로 무시한다. */
function captureSubmittedCode(event) {
  const target = event.target;
  const button = typeof target?.closest === 'function' ? target.closest('#btn-submit') : null;
  if (isNull(button) || button.disabled) return;
  try {
    pendingSubmittedCode = readGoormEditor();
  } catch (error) {
    pendingSubmittedCode = null;
    console.error('[BaekjoonHub] 구름LEVEL 제출 코드를 읽지 못했습니다. 결과가 나오면 그때의 에디터 코드를 올립니다.', error);
  }
}

/* 결과에 제출 기록을 묶는다. 파싱을 다시 시도해도 같은 기록을 쓰도록 결과별로 한 번만 가져간다. */
function takeSubmittedCode(result) {
  if (!submittedCodes.has(result)) {
    submittedCodes.set(result, pendingSubmittedCode);
    pendingSubmittedCode = null;
  }
  return submittedCodes.get(result);
}

/* 새 정답 결과가 보이면 한 번 처리한다. 결과 span 1개당 한 번만 실행된다. */
async function handleSolvedResult() {
  const result = getSolvedResultElement();
  if (isNull(result) || handledResults.has(result)) return;
  // 여기까지 모두 동기 코드이므로, 아래 기록이 끝나기 전에 다음 tick 이 끼어들 수 없다
  handledResults.add(result);
  log('정답이 나왔습니다. 업로드를 시작합니다.');

  /* #349: 파싱 실패도 화면에 보이도록 아이콘을 parseData() "앞" 에서 띄운다. */
  const attempt = startUpload(result);
  /* 파싱은 감지 즉시 시작한다. 제출 버튼을 누를 때 기록한 코드와 이 결과 블록의 채점 결과가 방금 정답을 받은
     제출이며, 업로드는 앞 업로드 뒤에 줄을 서더라도 이 데이터로 진행한다. 줄은 파싱이 끝나기를 기다리지 않고 지금 선다. */
  const parsed = parseData(getResultBlock(result), takeSubmittedCode(result)).then(
    (parsedData) => ({ parsedData }),
    (error) => {
      /* #349: 과거 goorm DOM 변경이 전부 "업로드 안 됨 + 콘솔 무출력" 으로 끝났다.
         debug=false 라 log() 가 no-op 이었기 때문이다. 파싱 실패는 언제나 console.error 로 남긴다. */
      console.error('[BaekjoonHub] 구름LEVEL 문제 정보 파싱에 실패했습니다. goorm DOM 구조가 변경되었을 가능성이 높습니다.', error);
      const failCount = (parseFailCounts.get(result) || 0) + 1;
      parseFailCounts.set(result, failCount);
      if (failCount < GOORM_MAX_PARSE_RETRY) {
        /* 렌더링 지연일 수 있으므로 이 결과를 다음 tick 에 다시 처리한다. 아이콘은 다시 붙으므로 떼어 낸다. */
        removeUploadIcon(attempt);
        handledResults.delete(result);
      } else {
        console.error(`[BaekjoonHub] 구름LEVEL 파싱이 ${GOORM_MAX_PARSE_RETRY}회 연속 실패하여 이 결과는 업로드하지 않습니다. 다시 제출하면 새로 시도합니다.`);
        markUploadFailedCSS(attempt);
      }
      return null;
    },
  );
  await enqueueUpload(parsed, attempt);
}

/**
 * 업로드를 앞선 업로드 뒤에 줄 세웁니다. 한 탭에서는 한 번에 하나씩, 감지 순서대로 실행한다.
 * 커밋 자체는 fast-forward 로만 반영되어(commitTreeItems) 겹쳐도 이력이 지워지지 않지만, 줄을 세우면
 * 커밋 순서가 제출 순서를 따르고, 뒤 업로드가 앞 업로드의 캐시 기록(같은 코드 재제출 스킵)을 읽을 수 있다.
 * 반환된 Promise 는 reject 되지 않는다 — 앞 업로드의 실패가 뒤 업로드를 막지 않게 하기 위함이다.
 * @param {Promise<({parsedData: object}|null)>} parsed - 파싱 결과. 파싱에 실패했으면 null
 * @param {{elem: HTMLElement, done: boolean, countdown: (number|null)}} attempt - startUpload 가 돌려준 시도
 * @returns {Promise<void>}
 */
function enqueueUpload(parsed, attempt) {
  const run = uploadState.queue.then(async () => {
    const result = await parsed;
    if (isNull(result)) return;
    /* 워치독은 줄을 기다린 시간이 아니라 이 업로드가 실제로 걸린 시간만 잰다. */
    startUploadCountDown(attempt);
    try {
      await beginUpload(result.parsedData, attempt);
    } catch (error) {
      /* 업로드 실패는 재시도하지 않는다 — 2초 폴링으로 GitHub API 를 반복 호출하면 rate limit 을 태운다. */
      console.error('[BaekjoonHub] 구름LEVEL GitHub 업로드 중 오류가 발생했습니다.', error);
      markUploadFailedCSS(attempt);
    }
  });
  uploadState.queue = run;
  return run;
}

/**
 * 가장 최근 채점 결과가 '정답입니다.' 이면 그 span 을 반환합니다. 아니면 null.
 *
 * 결과 블록은 최신 제출이 맨 위에 오고(채점 중에는 '처리중...'), 이전 블록이 아래에 그대로 남는다.
 * 그래서 "처음 보이는 정답 span" 이 아니라 "맨 위(최신) 결과가 정답인지" 를 본다. 최신 제출이 오답이거나
 * 채점 중인데 아래의 이전 정답을 집으면, 지금 에디터의 코드를 정답으로 올리게 된다.
 * 결과 문단은 모두 같은 클래스(빌드마다 바뀌는 해시)를 쓰므로, 같은 탭 패널에서 그 클래스를 가진 첫 문단을
 * 최신 결과로 본다.
 * @returns {HTMLElement|null}
 */
function getSolvedResultElement() {
  const activeSubmitTab = [...document.querySelectorAll('#FrameBody li.nav-item > a.nav-link.active')].find(($element) => $element.textContent === '제출 결과');
  if (!activeSubmitTab) return null;
  const solved = [...document.querySelectorAll('#FrameBody div > p[class] > span')].find(($element) => $element.textContent === '정답입니다.');
  if (isNull(solved)) return null;
  const paragraph = solved.parentElement;
  // 클래스가 비어 있으면 결과 문단을 가려낼 수 없으므로 예전처럼 처음 보이는 정답을 쓴다
  if (!paragraph.className) return solved;
  const scope = paragraph.closest('.tab-pane') || document;
  const latest = [...scope.querySelectorAll('p')].find(($element) => $element.className === paragraph.className);
  return latest === paragraph ? solved : null;
}

/**
 * 채점 결과 span 이 속한 결과 블록(결과 문단 + 테스트 케이스 표)을 반환합니다.
 * 결과 블록이 쌓이므로 실행 시간·메모리는 이 블록의 표에서만 읽어야 한다(패널 전체를 읽으면 이전 제출의
 * 행까지 평균에 섞인다). span 에서 위로 올라가며 표를 포함하는 가장 가까운 조상을 찾는다.
 * @param {HTMLElement} resultSpan
 * @returns {HTMLElement|null} 찾지 못하면 null (parseData 가 기존 방식으로 읽는다)
 */
function getResultBlock(resultSpan) {
  const pane = resultSpan.closest('.tab-pane');
  for (let node = resultSpan.parentElement; !isNull(node) && node !== pane; node = node.parentElement) {
    if (!isNull(node.querySelector('table'))) return node;
  }
  return null;
}

/* 파싱 직후 실행되는 함수 (enqueueUpload 가 한 번에 하나씩 호출한다) */
async function beginUpload(parsedData, attempt) {
  log('parsedData', parsedData);
  if (isNotEmpty(parsedData)) {
    const {
      // 시험 uid
      examId,
      // 시험 uid와 연계된 퀴즈 uid
      quizNumber,
      // 커밋 메시지
      message,
      // 폴더 이름
      directory,
      // 파일 이름
      fileName,
      // README.md 내용
      readme,
      // 정답 코드
      code,
    } = parsedData;
    const stats = await getStats();
    const hook = await getHook();
    const token = await getToken();

    const currentVersion = stats.version;
    /* 버전 차이가 발생하거나, 해당 hook에 대한 데이터가 없는 경우 localstorage의 Stats 값을 업데이트하고, version을 최신으로 변경한다 */
    if (isNull(currentVersion) || currentVersion !== getVersion() || isNull(await getStatsSHAfromPath(hook))) {
      await versionUpdate();
    }

    /* 현재 제출하려는 소스코드가 기존 업로드한 내용과 같다면 중지 */
    const cachedSHA = await getStatsSHAfromPath(`${hook}/${directory}/${fileName}`);
    const calcSHA = calculateBlobSHA(code);
    log('cachedSHA', cachedSHA, 'calcSHA', calcSHA);

    if (isNull(cachedSHA)) {
      /* 로컬 캐시가 없는 경우 원격 저장소에서 파일 존재 여부 실시간 확인 */
      const remoteFile = await getFile(hook, token, `${directory}/${fileName}`);
      if (remoteFile && remoteFile.sha === calcSHA) {
        markUploadedCSS(stats.branches, directory, attempt);
        console.log('원격 저장소에 동일한 파일이 존재하여 업로드를 건너뜁니다.');
        return;
      }
      /* GitHub에서 파일이 삭제되거나 없는 경우, 새 업로드로 처리 */
      console.log('캐시된 SHA가 없습니다. 새로 업로드합니다.');
    } else if (cachedSHA == calcSHA) {
      markUploadedCSS(stats.branches, directory, attempt);
      console.log(`현재 제출번호를 업로드한 기록이 있습니다. examId: ${examId}, quizNumber: ${quizNumber}`);
      return;
    }
    /* 신규 제출 번호라면 새롭게 커밋  */
    await uploadOneSolveProblemOnGit({ code, readme, directory, fileName, message }, (branches, dir) => markUploadedCSS(branches, dir, attempt));
  } else {
    /* #349: parseData 는 성공했지만 코드/제목 등이 비어 있는 경우.
       isNotEmpty 가 조용히 false 를 반환하고 끝나던 경로는 사용자에게 파싱 실패와 똑같은 증상이므로
       반드시 표면화한다. (대표 원인: 언어 탭과 에디터 인덱스가 어긋나 code 가 빈 문자열) */
    console.error('[BaekjoonHub] 구름LEVEL 파싱 결과가 비어 있어 업로드하지 않습니다. 에디터/언어 탭 선택 상태를 확인해주세요.', parsedData);
    markUploadFailedCSS(attempt);
  }
}

async function versionUpdate() {
  log('start versionUpdate');
  /* 버전은 재구축과 같은 저장에 기록한다(레포 파일 목록을 읽지 못했으면 기록하지 않아 다음에 다시 재구축한다).
     재구축 결과를 받아 버전을 붙여 다시 저장하면, 그 사이 다른 탭이 남긴 업로드 기록을 덮는다. */
  const stats = await updateLocalStorageStats({ version: getVersion() });
  log('stats updated.', stats);
}
