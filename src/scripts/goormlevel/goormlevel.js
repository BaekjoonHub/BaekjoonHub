/** NOTE: goormlevel 핵심 로직입니다. */

// Import all dependencies directly
// Common utilities
import * as GlobalUtil from "../util.js";
import * as Github from "../Github.js";
import * as GlobalStorage from "../storage.js";
import * as Toast from "../toast.js";
import * as Enable from "../enable.js";

// Platform-specific utilities
import { languages, difficultyLabels, uploadState } from "./variables.js";
import * as Parsing from "./parsing.js";
import * as UploadFunctions from "./uploadfunctions.js";
import * as Util from "./util.js";

// Import third-party libraries from NPM packages
import sha1 from "js-sha1";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// Set to true to enable console log
const debug = true;

/* 
  문제 제출 맞음 여부를 확인하는 함수
  2초마다 문제를 파싱하여 확인
*/
let loader;

const currentPathname = window.location.pathname;

// 구름 LEVEL 연습 문제 주소임을 확인하고, 맞다면 로더를 실행
if (/^\/exam\/\d+\/[^\/]+\/quiz\/1$/.test(currentPathname)) startLoader();

function startLoader() {
  loader = setInterval(async () => {
    // 기능 Off시 작동하지 않도록 함
    const enable = await checkEnable();
    if (!enable) stopLoader();
    // 제출 후 채점하기 결과가 성공적으로 나왔다면 코드를 파싱하고, 업로드를 시작한다
    else if (getSolvedResult()) {
      log("정답이 나왔습니다. 업로드를 시작합니다.");
      stopLoader();
      try {
        const parsedData = await parseData();
        await beginUpload(parsedData);
      } catch (error) {
        log(error);
      }
    }
  }, 2000);
}

function stopLoader() {
  clearInterval(loader);
}

function getSolvedResult() {
  const activeSubmitTab = [...document.querySelectorAll("#FrameBody li.nav-item > a.nav-link.active")].find(($element) => $element.textContent === "제출 결과");

  if (!!activeSubmitTab) {
    const result = [...document.querySelectorAll("#FrameBody div > p[class] > span")].find(($element) => $element.textContent === "정답입니다.");
    return !!result;
  }
  return false;
}

/* 파싱 직후 실행되는 함수 */
async function beginUpload(parsedData) {
  log("parsedData", parsedData);
  if (isNotEmpty(parsedData)) {
    startUpload();

    const {
      // 시험 uid
      examSequence,
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

    const currentVersion = stats.version;
    /* 버전 차이가 발생하거나, 해당 hook에 대한 데이터가 없는 경우 localstorage의 Stats 값을 업데이트하고, version을 최신으로 변경한다 */
    if (isNull(currentVersion) || currentVersion !== getVersion() || isNull(await getStatsSHAfromPath(hook))) {
      await versionUpdate();
    }

    /* 현재 제출하려는 소스코드가 기존 업로드한 내용과 같다면 중지 */
    const cachedSHA = await getStatsSHAfromPath(`${hook}/${directory}/${fileName}`);
    const calcSHA = calculateBlobSHA(code);
    log("cachedSHA", cachedSHA, "calcSHA", calcSHA);
    if (cachedSHA == calcSHA) {
      markUploadedCSS(stats.branches, directory);
      console.log(`현재 제출번호를 업로드한 기록이 있습니다. examSequence: ${examSequence}, quizNumber: ${quizNumber}`);
      return;
    }
    /* 신규 제출 번호라면 새롭게 커밋  */
    await uploadOneSolveProblemOnGit({ code, readme, directory, fileName, message }, markUploadedCSS);
  }
}

async function versionUpdate() {
  log("start versionUpdate");
  const stats = await updateLocalStorageStats();
  // update version.
  stats.version = getVersion();
  await saveStats(stats);
  log("stats updated.", stats);
}

// Map functions from dependencies to global namespace
const {
  log,
  isNull,
  isEmpty,
  isNotEmpty,
  calculateBlobSHA,
  getStats,
  getHook,
  getVersion,
  getStatsSHAfromPath,
  saveStats,
  updateLocalStorageStats,
  getDirNameByOrgOption,
  convertSingleCharToDoubleChar,
} = GlobalUtil;

const { startUpload, markUploadedCSS, getDateString } = Util;

const { parseData } = Parsing;

const { uploadOneSolveProblemOnGit } = UploadFunctions;

// Import storage functions and make them available in global scope
const { getObjectFromLocalStorage, getObjectFromSyncStorage, saveObjectInLocalStorage, saveObjectInSyncStorage } = GlobalStorage;

// Explicitly attach to window to make them available in global scope
window.getObjectFromLocalStorage = getObjectFromLocalStorage;
window.getObjectFromSyncStorage = getObjectFromSyncStorage;
window.saveObjectInLocalStorage = saveObjectInLocalStorage;
window.saveObjectInSyncStorage = saveObjectInSyncStorage;

const { checkEnable } = Enable;