/** NOTE: goormlevel 핵심 로직입니다. */

// Set to true to enable console log
const debug = false;

/* 
  문제 제출 맞음 여부를 확인하는 함수
  2초마다 문제를 파싱하여 확인
*/
let loader;

/* 정답 1회당 1번만 처리하기 위한 플래그. 파싱 실패 시에만 되돌려 다음 tick 에 재시도한다. */
let solveHandled = false;
/* DOM 이 영구적으로 깨진 경우 2초마다 무한 재시도하지 않도록 상한을 둔다. */
let parseFailCount = 0;
const GOORM_MAX_PARSE_RETRY = 5;

const currentPathname = window.location.pathname;

// 구름 LEVEL 연습 문제 주소임을 확인하고, 맞다면 로더를 실행
if (/^\/exam\/\d+\/[^\/]+\/quiz\/1$/.test(currentPathname)) startLoader();

function startLoader() {
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
    if (solveHandled || !getSolvedResult()) return;
    solveHandled = true;
    log('정답이 나왔습니다. 업로드를 시작합니다.');

    /* #349: 파싱 실패도 화면에 보이도록 스피너를 parseData() "앞" 에서 띄운다.
       10초를 넘기면 startUploadCountDown 이 markUploadFailedCSS 로 빨간 X 를 표시한다.
       (scripts/baekjoon/baekjoon.js 와 같은 순서이며, 여태 goorm 만 예외였다) */
    startUpload();

    let parsedData;
    try {
      parsedData = await parseData();
    } catch (error) {
      /* #349: 과거 goorm DOM 변경이 전부 "업로드 안 됨 + 콘솔 무출력" 으로 끝났다.
         debug=false 라 log() 가 no-op 이었기 때문이다. 파싱 실패는 언제나 console.error 로 남긴다. */
      console.error('[BaekjoonHub] 구름LEVEL 문제 정보 파싱에 실패했습니다. goorm DOM 구조가 변경되었을 가능성이 높습니다.', error);
      markUploadFailedCSS();
      /* 폴링을 유지한 채 플래그만 되돌려 다음 tick 에 재시도한다(렌더링 지연 대응). */
      solveHandled = false;
      parseFailCount += 1;
      if (parseFailCount >= GOORM_MAX_PARSE_RETRY) {
        console.error(`[BaekjoonHub] 구름LEVEL 파싱이 ${GOORM_MAX_PARSE_RETRY}회 연속 실패하여 감지를 중단합니다. 페이지를 새로고침하면 다시 시도합니다.`);
        stopLoader();
      }
      return;
    }

    /* 파싱이 성공했을 때만 감지를 종료한다. */
    stopLoader();
    try {
      await beginUpload(parsedData);
    } catch (error) {
      /* 업로드 실패는 재시도하지 않는다 — 2초 폴링으로 GitHub API 를 반복 호출하면 rate limit 을 태운다. */
      console.error('[BaekjoonHub] 구름LEVEL GitHub 업로드 중 오류가 발생했습니다.', error);
      markUploadFailedCSS();
    }
  }, 2000);
}

function stopLoader() {
  clearInterval(loader);
  loader = null;
}

function getSolvedResult() {
  const activeSubmitTab = [...document.querySelectorAll('#FrameBody li.nav-item > a.nav-link.active')].find(($element) => $element.textContent === '제출 결과');

  if (!!activeSubmitTab) {
    const result = [...document.querySelectorAll('#FrameBody div > p[class] > span')].find(($element) => $element.textContent === '정답입니다.');
    return !!result;
  }
  return false;
}

/* 파싱 직후 실행되는 함수 */
async function beginUpload(parsedData) {
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
        markUploadedCSS(stats.branches, directory);
        console.log('원격 저장소에 동일한 파일이 존재하여 업로드를 건너뜁니다.');
        return;
      }
      /* GitHub에서 파일이 삭제되거나 없는 경우, 새 업로드로 처리 */
      console.log('캐시된 SHA가 없습니다. 새로 업로드합니다.');
    } else if (cachedSHA == calcSHA) {
      markUploadedCSS(stats.branches, directory);
      console.log(`현재 제출번호를 업로드한 기록이 있습니다. examId: ${examId}, quizNumber: ${quizNumber}`);
      return;
    }
    /* 신규 제출 번호라면 새롭게 커밋  */
    await uploadOneSolveProblemOnGit({ code, readme, directory, fileName, message }, markUploadedCSS);
  } else {
    /* #349: parseData 는 성공했지만 코드/제목 등이 비어 있는 경우.
       isNotEmpty 가 조용히 false 를 반환하고 끝나던 경로는 사용자에게 파싱 실패와 똑같은 증상이므로
       반드시 표면화한다. (대표 원인: 언어 탭과 에디터 인덱스가 어긋나 code 가 빈 문자열) */
    console.error('[BaekjoonHub] 구름LEVEL 파싱 결과가 비어 있어 업로드하지 않습니다. 에디터/언어 탭 선택 상태를 확인해주세요.', parsedData);
    markUploadFailedCSS();
  }
}

async function versionUpdate() {
  log('start versionUpdate');
  /* 버전은 재구축과 같은 저장에 기록한다(레포 파일 목록을 읽지 못했으면 기록하지 않아 다음에 다시 재구축한다).
     재구축 결과를 받아 버전을 붙여 다시 저장하면, 그 사이 다른 탭이 남긴 업로드 기록을 덮는다. */
  const stats = await updateLocalStorageStats({ version: getVersion() });
  log('stats updated.', stats);
}
