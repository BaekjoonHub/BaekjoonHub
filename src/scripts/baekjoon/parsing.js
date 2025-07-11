import { isNull, isEmpty, preProcessEmptyObj, parseNumberFromString, asyncPool, convertSingleCharToDoubleChar, unescapeHtml, filter, maxValuesGroupBykey, log } from "@/commons/util.js";
import { getDateString, convertImageTagToAbsoluteURL } from "@/commons/ui-util.js";
import { updateProblemData, getProblemData, updateSubmitCodeData, getSubmitCodeData, updateSolvedACData, getSolvedACData } from "@/baekjoon/storage.js";
import { languages, bjLevel, RESULT_CATEGORY, uploadState } from "@/baekjoon/variables.js";
import { findUsername, isExistResultTable, markUploadFailedCSS, selectBestSubmissionList, convertResultTableHeader, langVersionRemove } from "@/baekjoon/util.js";
import { getDirNameByOrgOption } from "@/commons/storage.js";
import urls from "@/constants/url.js";

/**
 * url에 해당하는 html 문서를 가져오는 함수
 * @param url: url 주소
 * @returns html document
 */
export async function findHtmlDocumentByUrl(url) {
  return fetch(url, { method: "GET" })
    .then((html) => html.text())
    .then((text) => {
      const parser = new DOMParser();
      return parser.parseFromString(text, "text/html");
    });
}

export function parsingResultTableList(doc = document) {
  const table = [];
  const trs = doc.querySelectorAll("#status-table > tbody > tr");
  trs.forEach((tr) => {
    const td = tr.querySelectorAll("td");
    const submissionId = td[0].innerText.trim();
    const problemId = td[2].innerText.trim();
    const result = td[3].innerText.trim();
    const language = td[5].innerText.trim();
    const runtime = td[6].innerText.trim();
    const memory = td[7].innerText.trim();
    const codeLength = td[8].innerText.trim();
    const submissionTime = td[9].innerText.trim();
    const username = td[1].innerText.trim();
    table.push({
      submissionId,
      problemId,
      result,
      language,
      runtime,
      memory,
      codeLength,
      submissionTime,
      username,
    });
  });
  return table;
}

/**
 * user가 "맞았습니다!!" 결과를 맞은 모든 제출 결과 리스트를 가져오는 함수
 * @param username: 백준 아이디
 * @return Promise<Array<Object>>
 */
export async function findResultTableListByUsername(username) {
  const result = [];
  let doc = await findHtmlDocumentByUrl(`${urls.BAEKJOON_STATUS_URL}?user_id=${username}&result_id=4`);
  let nextPage = doc.getElementById("next_page");
  do {
    result.push(...parsingResultTableList(doc));
    if (nextPage !== null) {
      // eslint-disable-next-line no-await-in-loop
      doc = await findHtmlDocumentByUrl(nextPage.getAttribute("href"));
      nextPage = doc.getElementById("next_page");
    }
  } while (nextPage !== null);
  result.push(...parsingResultTableList(doc));

  return result;
}

/**
 * user가 "맞았습니다!!" 결과를 맞은 중복되지 않은 제출 결과 리스트를 가져오는 함수
 * @param username: 백준 아이디
 * @returns Promise<Array<Object>>
 */
export async function findUniqueResultTableListByUsername(username) {
  return selectBestSubmissionList(await findResultTableListByUsername(username));
}

export async function fetchProblemDescriptionById(problemId) {
  return fetch(`${urls.BAEKJOON_PROBLEM_URL}${problemId}`)
    .then((res) => res.text())
    .then((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      return parseProblemDescription(doc);
    });
}

export async function fetchSubmitCodeById(submissionId) {
  return fetch(`${urls.BAEKJOON_SOURCE_DOWNLOAD_URL}${submissionId}`, {
    method: "GET",
  }).then((res) => res.text());
}

export async function getProblemDescriptionById(problemId) {
  let problem = await getProblemData(problemId);
  if (isNull(problem)) {
    problem = await fetchProblemDescriptionById(problemId);
    updateProblemData(problem); // not await
  }
  return problem;
}

export async function getSubmitCodeById(submissionId) {
  let code = await getSubmitCodeData(submissionId);
  if (isNull(code)) {
    code = await fetchSubmitCodeById(submissionId);
    updateSubmitCodeData({ submissionId, code }); // not await
  }
  return code;
}

export async function getSolvedACById(problemId) {
  let jsonData = await getSolvedACData(problemId);
  if (isNull(jsonData)) {
    jsonData = await fetchSolvedACById(problemId);
    updateSolvedACData({ problemId, jsonData }); // not await
  }
  return jsonData;
}

/*
  문제가 맞았다면 문제 관련 데이터를 파싱하는 함수의 모음입니다.
  모든 해당 파일의 모든 함수는 findData()를 통해 호출됩니다.
*/

export async function findProblemInfoAndSubmissionCode(problemId, submissionId) {
  log("in find with promise");
  if (!isNull(problemId) && !isNull(submissionId)) {
    return Promise.all([getProblemDescriptionById(problemId), getSubmitCodeById(submissionId), getSolvedACById(problemId)])
      .then(([description, code, solvedJson]) => {
        const problemTags = solvedJson.tags
          .flatMap((tag) => tag.displayNames)
          .filter((tag) => tag.language === "ko")
          .map((tag) => tag.name);
        const title = solvedJson.titleKo;
        const level = bjLevel[solvedJson.level];

        const { problemDescription, problemInput, problemOutput } = description;
        return {
          problemId,
          submissionId,
          title,
          level,
          code,
          problemDescription,
          problemInput,
          problemOutput,
          problemTags,
        };
      })
      .catch((err) => {
        console.log("error ocurred: ", err);
        uploadState.uploading = false;
        markUploadFailedCSS();
      });
  }
  return null;
}

/**
 * 문제의 상세 정보를 가지고, 문제의 업로드할 디렉토리, 파일명, 커밋 메시지, 문제 설명을 파싱하여 반환합니다.
 * @param {Object} data
 * @returns {Object} { directory, fileName, message, readme, code }
 */
export async function makeDetailMessageAndReadme(data) {
  const { problemId, submissionId, result, title, level, problemTags, problemDescription, problemInput, problemOutput, submissionTime, code, language, memory, runtime } = data;
  const score = parseNumberFromString(result);

  // 데이터 객체에 언어 정보 전달
  const processedLanguage = langVersionRemove(language, null);

  // 기본 디렉토리 경로 생성
  const baseDirPath = `백준/${level.replace(/ .*/, "")}/${problemId}. ${convertSingleCharToDoubleChar(title)}`;

  // 공통 업로드 서비스를 사용하여 디렉토리 경로 생성
  const directory = await getDirNameByOrgOption(baseDirPath, processedLanguage, {
    problemId,
    title,
    level,
    problemTags,
    memory,
    runtime,
    submissionTime,
    language: processedLanguage,
    problemDescription,
    problemInput,
    problemOutput,
  });

  const message = `[${level}] Title: ${runtime} ms, Memory: ${memory} KB${Number.isNaN(score) ? " " : `, Score: ${score} point `}-BaekjoonHub`;
  const category = problemTags.join(", ");
  const fileName = `${convertSingleCharToDoubleChar(title)}.${languages[language]}`;
  const dateInfo = submissionTime ?? getDateString(new Date(Date.now()));
  // prettier-ignore-start
  const readme =
    `# [${level}] ${title} - ${problemId} \n\n` +
    `[문제 링크](${urls.BAEKJOON_PROBLEM_URL}${problemId}) 

` +
    `### 성능 요약\n\n` +
    `메모리: ${memory} KB, ` +
    `시간: ${runtime} ms\n\n` +
    `### 분류\n\n` +
    `${category || "Empty"}\n\n${problemDescription ? `### 제출 일자\n\n${dateInfo}\n\n### 문제 설명\n\n${problemDescription}\n\n### 입력 \n\n ${problemInput}\n\n### 출력 \n\n ${problemOutput}\n\n` : ""}`;
  // prettier-ignore-end
  return {
    directory,
    fileName,
    message,
    readme,
    code,
  };
}

/*
  bojData를 초기화하는 함수로 문제 요약과 코드를 파싱합니다.

  - 문제 설명: problemDescription
  - Github repo에 저장될 디렉토리: directory
  - 커밋 메시지: message
  - 백준 문제 카테고리: category
  - 파일명: fileName
  - Readme 내용 : readme
*/
export async function findData(inputData) {
  try {
    const data = inputData;
    if (isNull(data)) {
      // const findFromResultTable = () => {
      //   if (isEmpty(table)) return null;
      //   table = filter(table, {
      //     resultCategory: RESULT_CATEGORY.RESULT_ACCEPTED,
      //     username: findUsername(),
      //     language: table[0].language,
      //   });
      //   data = selectBestSubmissionList(table)[0];
      // }
      // If data is null, it means we are not coming from a result table.
      // This part of the code needs to be re-evaluated based on the intended logic.
      // For now, we will assume data is always provided or handled elsewhere.
      return null;
    }
    if (Number.isNaN(Number(data.problemId)) || Number(data.problemId) < 1000)
      throw new Error(`정책상 대회 문제는 업로드 되지 않습니다. 대회 문제가 아니라고 판단된다면 이슈로 남겨주시길 바랍니다.\n문제 ID: ${data.problemId}`);
    const problemInfoAndCode = await findProblemInfoAndSubmissionCode(data.problemId, data.submissionId);
    const detail = await makeDetailMessageAndReadme(preProcessEmptyObj({ ...data, ...problemInfoAndCode }));
    return { ...data, ...detail }; // detail 만 반환해도 되나, 확장성을 위해 모든 데이터를 반환합니다.
  } catch (error) {
    console.error(error);
    return null;
  }
}

/*
  Fetch를 사용하여 정보를 구하는 함수로 다음 정보를 확인합니다。

    - 문제 설명: problem_description
    - 문제 입력값: problem_input
    - 문제 출력값: problem_output
    - 제출 코드: code
    - 문제 제목: title
    - 문제 등급: level
    - Github repo에 저장될 디렉토리: directory
    - 커밋 메시지: message
    - 백준 문제 카테고리: category
*/
export function parseProblemDescription(doc = document) {
  convertImageTagToAbsoluteURL(doc.getElementById("problem_description")); // 이미지에 상대 경로가 있을 수 있으므로 이미지 경로를 절대 경로로 전환 합니다.
  const [problemId, problemDescription, problemInput, problemOutput] = [
    doc
      .getElementsByTagName("title")[0]
      .textContent.split(":")[0]
      .replace(/[^0-9]/, ""),
    unescapeHtml(doc.getElementById("problem_description").innerHTML.trim()),
    doc.getElementById("problem_input")?.innerHTML.trim?.().unescapeHtml?.() || "Empty",
    doc.getElementById("problem_output")?.innerHTML.trim?.().unescapeHtml?.() || "Empty",
  ];
  if (problemId && problemDescription) {
    log(`문제번호 ${problemId}의 내용을 저장합니다.`);
    updateProblemData({
      problemId,
      problemDescription,
      problemInput,
      problemOutput,
    });
    return {
      problemId,
      problemDescription,
      problemInput,
      problemOutput,
    };
  }
  return {};
}

export async function fetchSolvedACById(problemId) {
  return chrome.runtime.sendMessage({
    sender: "baekjoon",
    task: "SolvedApiCall",
    problemId,
  });
}

/**
 * 문제의 목록을 문제 번호로 한꺼번에 반환합니다。
 * (한번 조회 시 100개씩 나눠서 진행)
 * @param {Array} problemIds
 * @returns {Promise<Array>}
 */

export async function fetchProblemInfoByIds(problemIds) {
  const dividedProblemIds = [];
  for (const problemIdChunk of problemIds) {
    dividedProblemIds.push(problemIdChunk.slice(0, 100));
  }
  return asyncPool(1, dividedProblemIds, async (pids) => {
    const result = await fetch(`https://solved.ac/api/v3/problem/lookup?problemIds=${pids.join("%2C")}`, { method: "GET" });
    return result.json();
  }).then((results) => results.flatMap((result) => result));
}

/**
 * 문제의 상세 정보 목록을 문제 번호 목록으로 한꺼번에 반환합니다。
 * (한번 조회 시 2개씩 병렬로 진행)
 * @param {Array} problemIds
 * @returns {Promise<Array>}
 */
export async function fetchProblemDescriptionsByIds(problemIds) {
  return asyncPool(2, problemIds, async (problemId) => getProblemDescriptionById(problemId));
}

/**
 * submissionId들을 통해 코드들을 가져옵니다. (부하를 줄이기 위해 한번에 2개씩 가져옵니다.)
 * @param {Array} submissionIds
 * @returns {Promise<Array>}
 */
export async function fetchSubmissionCodeByIds(submissionIds) {
  return asyncPool(2, submissionIds, async (submissionId) => getSubmitCodeById(submissionId));
}

/**
 * user가 problemId 에 제출한 리스트를 가져오는 함수
 * @param problemId: 문제 번호
 * @param username: 백준 아이디
 * @return Promise<Array<String>>
 */
export async function findResultTableByProblemIdAndUsername(problemId, username) {
  return fetch(`https://www.acmicpc.net/status?from_mine=1&problem_id=${problemId}&user_id=${username}`, { method: "GET" })
    .then((html) => html.text())
    .then((text) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");
      return parsingResultTableList(doc);
    });
}

/**
 * 백준에서 표기된 프로그래밍 언어의 버전을 없애고 업로드 하기 위함입니다。
 * 버전에 차이가 중요하게 여겨진다면, 'ignore'에 예외 케이스를 추가하세요。
 * 해당 코드는 'lang'이 "PyPy3" 같이 주어진다면은 버전을 제거하지 않습니다。
 * 예외에 추가 되어있거나, "Python 3.8" 혹은 "Java 11" 같이 주어진다면 버전이 제거될것입니다。
 * @param {string} lang - 처리 하고자 하는 언어입니다。
 * @param {Set} ignores - 예외 처리 하고자 하는 언어를 추가 해주세요。
 * @return {string} - 분기 처리에 따른 lang
 *  */
