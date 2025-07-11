import { initUploadUI, markUploadedCSS as markUploaded, markUploadFailedCSS as markFailed } from "@/commons/ui-util.js";
import { parseNumberFromString, maxValuesGroupBykey, isNull } from "@/commons/util.js";
import { uploadState } from "@/baekjoon/variables.js";

/**
 * 로딩 버튼 추가
 */
export function startUpload() {
  const target = document.getElementById("status-table")?.childNodes[1]?.childNodes[0]?.childNodes[3] || document.querySelector("div.table-responsive > table > tbody > tr > td:nth-child(5)");
  const container = initUploadUI(target, uploadState);

  // 백준 사이트에 특화된 추가 로직이 필요한 경우 여기에 구현
  if (target && target.childNodes.length > 0 && container) {
    target.childNodes[0].append(container);
  }
}

/**
 * 업로드 완료 아이콘 표시 및 링크 생성
 * @param {object} branches - 브랜치 정보
 * @param {string} directory - 디렉토리 정보
 */
export function markUploadedCSS(branches, directory) {
  markUploaded(branches, directory, uploadState);
}

/**
 * 업로드 실패 아이콘 표시
 */
export function markUploadFailedCSS() {
  markFailed(uploadState);
}

/**
 * 제출 목록 비교함수입니다
 * @param {object} a - 제출 요소 피연산자 a
 * @param {object} b - 제출 요소 피연산자 b
 * @returns {number} - a와 b 아래의 우선순위로 값을 비교하여 정수값을 반환합니다.
 * 1. 서브태스크가 있는 문제이고, 점수(result)의 차이가 있을 경우 a > b 이면 음수, a < b 이면 양수를 반환합니다.
 * 2. 실행시간(runtime)의 차이가 있을 경우 그 차이 값을 반환합니다.
 * 3. 사용메모리(memory)의 차이가 있을 경우 그 차이 값을 반환합니다.
 * 4. 코드길이(codeLength)의 차이가 있을 경우 그 차이 값을 반환합니다.
 * 5. 위의 요소가 모두 같은 경우 제출한 요소(submissionId)의 그 차이 값의 역을 반환합니다.
 * */
export function compareSubmission(a, b) {
  // prettier-ignore-start
  /* eslint-disable */
  return hasNotSubtask(a.result, b.result)
    ? a.runtime === b.runtime
      ? a.memory === b.memory
        ? a.codeLength === b.codeLength
          ? -(a.submissionId - b.submissionId)
          : a.codeLength - b.codeLength
        : a.memory - b.memory
      : a.runtime - b.runtime
    : compareResult(a.result, b.result);
  /* eslint-enable */
  // prettier-ignore-end
}

/**
 * 서브태스크가 있는 문제의 경우도 고려해 제출 결과를 비교하는 함수입니다.
 * @param {string} aResult 제출 결과 피연산자 a
 * @param {string} bResult 제출 결과 피연산자 b
 * @returns {boolean} 서브 태스크가 없는 경우 true, 서브 태스크가 있는 경우 false를 반환합니다.
 */
export function hasNotSubtask(aResult, bResult) {
  const parsedAResult = parseNumberFromString(aResult);
  const parsedBResult = parseNumberFromString(bResult);

  if (Number.isNaN(parsedAResult) && Number.isNaN(parsedBResult)) return true;

  return false;
}

/**
 * 서브태스크가 있는 문제의 경우 점수가 높은 순서로 정렬되도록 값을 반환합니다.
 * @param {string} aResult 제출 결과 피연산자 a
 * @param {string} bResult 제출 결과 피연산자 b
 * @returns {number} a의 점수가 높은 경우 음수, b의 점수가 높은 경우 양수
 */
export function compareResult(aResult, bResult) {
  const parsedAResult = parseNumberFromString(aResult);
  const parsedBResult = parseNumberFromString(bResult);

  if (typeof parsedAResult === "number" && typeof parsedBResult === "number") return -(parsedAResult - parsedBResult);
  if (Number.isNaN(parsedBResult)) return -1;
  if (Number.isNaN(parsedAResult)) return 1;
  return 0; // 모든 경우에 값을 반환하도록 추가
}

/**
 * 파싱된 문제별로 최고의 성능의 제출 내역을 하나씩 뽑아서 배열로 반환합니다.
 * @param {array} submissions - 제출 목록 배열
 * @returns {array} - 목록 중 문제별로 최고의 성능 제출 내역을 담은 배열
 */
export function selectBestSubmissionList(submissions) {
  if (submissions === null || submissions.length === 0) return [];
  return maxValuesGroupBykey(submissions, "problemId", (a, b) => -compareSubmission(a, b));
}

export function convertResultTableHeader(header) {
  switch (header) {
    case "문제번호":
    case "문제":
      return "problemId";
    case "난이도":
      return "level";
    case "결과":
      return "result";
    case "문제내용":
      return "problemDescription";
    case "언어":
      return "language";
    case "제출 번호":
      return "submissionId";
    case "아이디":
      return "username";
    case "제출시간":
    case "제출한 시간":
      return "submissionTime";
    case "시간":
      return "runtime";
    case "메모리":
      return "memory";
    case "코드 길이":
      return "codeLength";
    default:
      return "unknown";
  }
}

export function findUsername() {
  const el = document.querySelector("a.username");
  if (el === null) return null;
  const username = el?.innerText?.trim();
  if (username === null || username === "") return null;
  return username;
}

export function isExistResultTable() {
  return document.getElementById("status-table") !== null;
}
