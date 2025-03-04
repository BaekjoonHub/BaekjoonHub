// Import all dependencies directly
// Common utilities
import * as GlobalUtil from "../util.js";
import * as Github from "../Github.js";
import * as GlobalStorage from "../storage.js";
import * as Toast from "../toast.js";
import * as Enable from "../enable.js";

// Platform-specific utilities
import { languages, uploadState } from "./variables.js";
import * as Parsing from "./parsing.js";
import * as Storage from "./storage.js";
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

const currentUrl = window.location.href;

// SWEA 연습 문제 주소임을 확인하고, 맞는 파서를 실행
if (currentUrl.includes("/main/solvingProblem/solvingProblem.do") && document.querySelector("header > h1 > span").textContent === "모의 테스트") startLoader();
else if (currentUrl.includes("/main/code/problem/problemSolver.do") && currentUrl.includes("extension=BaekjoonHub")) parseAndUpload();

function parseAndUpload() {
  //async wrapper
  (async () => {
    const bojData = await parseData();
    await beginUpload(bojData);
  })();
}
function startLoader() {
  loader = setInterval(async () => {
    // 기능 Off시 작동하지 않도록 함
    const enable = await checkEnable();
    if (!enable) stopLoader();
    // 제출 후 채점하기 결과가 성공적으로 나왔다면 코드를 파싱하고,
    // 결과 페이지로 안내한다.
    else if (getSolvedResult().includes("pass입니다")) {
      log("정답이 나왔습니다. 코드를 파싱합니다");
      stopLoader();
      try {
        const { contestProbId } = await parseCode();
        // prettier-ignore
        await makeSubmitButton(`${window.location.origin}`
          + `/main/code/problem/problemSolver.do?`
          + `contestProbId=${contestProbId}&`
          + `nickName=${getNickname()}&`
          + `extension=BaekjoonHub`);
      } catch (error) {
        log(error);
      }
    }
  }, 2000);
}

function getSolvedResult() {
  return document.querySelector("div.popup_layer.show > div > p.txt")?.innerText.trim().toLowerCase() || "";
}

function stopLoader() {
  clearInterval(loader);
}

/* 파싱 직후 실행되는 함수 */
async function beginUpload(bojData) {
  log("bojData", bojData);
  startUpload();
  if (isNotEmpty(bojData)) {
    const stats = await getStats();
    const hook = await getHook();

    const currentVersion = stats.version;
    /* 버전 차이가 발생하거나, 해당 hook에 대한 데이터가 없는 경우 localstorage의 Stats 값을 업데이트하고, version을 최신으로 변경한다 */
    if (isNull(currentVersion) || currentVersion !== getVersion() || isNull(await getStatsSHAfromPath(hook))) {
      await versionUpdate();
    }

    /* 현재 제출하려는 소스코드가 기존 업로드한 내용과 같다면 중지 */
    cachedSHA = await getStatsSHAfromPath(`${hook}/${bojData.directory}/${bojData.fileName}`);
    calcSHA = calculateBlobSHA(bojData.code);
    log("cachedSHA", cachedSHA, "calcSHA", calcSHA);
    if (cachedSHA == calcSHA) {
      markUploadedCSS(stats.branches, bojData.directory);
      console.log(`현재 제출번호를 업로드한 기록이 있습니다. problemIdID ${bojData.problemId}`);
      return;
    }
    /* 신규 제출 번호라면 새롭게 커밋  */
    await uploadOneSolveProblemOnGit(bojData, markUploadedCSS);
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
const { log, isNull, isEmpty, isNotEmpty, calculateBlobSHA, getStats, getHook, getVersion, getStatsSHAfromPath, saveStats, updateLocalStorageStats } = GlobalUtil;

const { startUpload, markUploadedCSS, parseCode, getNickname, makeSubmitButton } = Util;

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
