import { isNull, isEmpty, preProcessEmptyObj, parseNumberFromString, asyncPool, convertSingleCharToDoubleChar, unescapeHtml, filter } from "@/commons/util.js";
import log from "@/commons/logger.js";
import { getDateString, convertImageTagToAbsoluteURL } from "@/commons/ui-util.js";
import { updateProblemData, getProblemData, updateSubmitCodeData, getSubmitCodeData, updateSolvedACData, getSolvedACData } from "@/baekjoon/storage.js";
import { languages, bjLevel, RESULT_CATEGORY, uploadState } from "@/baekjoon/variables.js";
import { findUsername, isExistResultTable, markUploadFailedCSS, selectBestSubmissionList, convertResultTableHeader, langVersionRemove } from "@/baekjoon/util.js";
import { getDirNameByTemplate } from "@/commons/storage.js";
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
  const table = doc.getElementById("status-table");
  if (table === null || table === undefined || table.length === 0) return [];
  const headers = Array.from(table.rows[0].cells, (x) => convertResultTableHeader(x.innerText.trim()));

  const list = [];
  for (let i = 1; i < table.rows.length; i++) {
    const row = table.rows[i];
    const cells = Array.from(row.cells, (x, index) => {
      switch (headers[index]) {
        case "result":
          return { result: x.innerText.trim(), resultCategory: x.firstChild.getAttribute("data-color").replace("-eng", "").trim() };
        case "language":
          return unescapeHtml(x.innerText).replace(/\/.*$/g, "").trim();
        case "submissionTime": {
          const el = x.querySelector("a.real-time-update.show-date") || x.querySelector("a.show-date");
          if (isNull(el)) return null;
          return el.getAttribute("data-original-title");
        }
        case "problemId": {
          const a = x.querySelector("a.problem_title");
          if (isNull(a)) return null;
          return {
            problemId: a.getAttribute("href").replace(/^.*\/([0-9]+)$/, "$1"),
          };
        }
        default:
          return x.innerText.trim();
      }
    });
    let obj = {};
    obj.elementId = row.id;
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = cells[j];
    }
    obj = { ...obj, ...obj.result, ...obj.problemId };
    list.push(obj);
  }
  log.debug("TableList", list);
  return list;
}

/*
  문제가 맞았다면 문제 관련 데이터를 파싱하는 함수의 모음입니다.
  모든 해당 파일의 모든 함수는 findData()를 통해 호출됩니다.
*/

export async function findProblemInfoAndSubmissionCode(problemId, submissionId) {
  log.debug("findProblemInfoAndSubmissionCode - problemId:", problemId, "submissionId:", submissionId);

  if (isNull(problemId) || isNull(submissionId)) {
    log.error("findProblemInfoAndSubmissionCode - problemId or submissionId is null");
    return null;
  }

  try {
    const [description, code, solvedJson] = await Promise.all([getProblemDescriptionById(problemId), getSubmitCodeById(submissionId), getSolvedACById(problemId)]);

    log.debug("findProblemInfoAndSubmissionCode - fetched data:", {
      description: description ? "exists" : "null",
      code: code ? "exists" : "null",
      solvedJson: solvedJson ? "exists" : "null",
    });

    if (!description || !code || !solvedJson) {
      log.error("findProblemInfoAndSubmissionCode - missing data");
      return null;
    }

    const problemTags =
      solvedJson.tags
        ?.flatMap((tag) => tag.displayNames)
        ?.filter((tag) => tag.language === "ko")
        ?.map((tag) => tag.name) || [];

    const title = solvedJson.titleKo;
    const level = bjLevel[solvedJson.level];

    const problemDescription = description?.problemDescription;
    const problemInput = description?.problemInput;
    const problemOutput = description?.problemOutput;

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
  } catch (err) {
    log.error("findProblemInfoAndSubmissionCode - error occurred:", err);
    uploadState.uploading = false;
    markUploadFailedCSS();
    return null;
  }
}

/**
 * 문제의 상세 정보를 가지고, 문제의 업로드할 디렉토리, 파일명, 커밋 메시지, 문제 설명을 파싱하여 반환합니다.
 * @param {Object} data
 * @returns {Object} { directory, fileName, message, readme, code }
 */
export async function makeDetailMessageAndReadme(data) {
  log.debug("makeDetailMessageAndReadme - input data:", data);

  if (isNull(data)) {
    log.error("makeDetailMessageAndReadme - data is null");
    return null;
  }

  // 구 버전과 새 버전의 변수명 모두 지원
  const problemId = data.problemId;
  const submissionId = data.submissionId;
  const result = data.result;
  const title = data.title;
  const level = data.level;
  const problemTags = data.problemTags || data.problem_tags || [];
  const problemDescription = data.problemDescription || data.problem_description;
  const problemInput = data.problemInput || data.problem_input;
  const problemOutput = data.problemOutput || data.problem_output;
  const submissionTime = data.submissionTime;
  const code = data.code;
  const language = data.language;
  const memory = data.memory;
  const runtime = data.runtime;

  // 필수 데이터 검증
  if (isNull(problemId) || isNull(title) || isNull(code) || isNull(language)) {
    log.error("makeDetailMessageAndReadme - Missing required data:", {
      problemId: problemId,
      title: title,
      code: code ? "exists" : "null",
      language: language,
    });
    return null;
  }

  const score = parseNumberFromString(result || "");

  // 데이터 객체에 언어 정보 전달
  const processedLanguage = langVersionRemove(language, null);

  // 기본 디렉토리 경로 생성
  const baseDirPath = `백준/${level.replace(/ .*/, "")}/${problemId}. ${convertSingleCharToDoubleChar(title)}`;

  // 템플릿을 사용한 디렉토리 경로 생성
  let directory;
  try {
    directory = await getDirNameByTemplate(baseDirPath, processedLanguage, {
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
  } catch (error) {
    log.error("makeDetailMessageAndReadme - getDirNameByTemplate error:", error);
    // 오류 발생시 기본 디렉토리 사용
    directory = baseDirPath;
  }

  // 수정된 커밋 메시지 (Title 부분 수정)
  const message = `[${level}] Title: ${title}, Time: ${runtime} ms, Memory: ${memory} KB${Number.isNaN(score) ? "" : `, Score: ${score} point`} -BaekjoonHub`;

  const category = problemTags.join(", ");
  const fileName = `${convertSingleCharToDoubleChar(title)}.${languages[language]}`;
  const dateInfo = submissionTime ?? getDateString(new Date(Date.now()));

  // prettier-ignore-start
  const readme =
    `# [${level}] ${title} - ${problemId} \n\n` +
    `[문제 링크](${urls.BAEKJOON_PROBLEM_URL}${problemId}) \n\n` +
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

/**
 * problemData를 초기화하는 함수로 문제 요약과 코드를 파싱합니다.
 * - 문제 설명: problemDescription
 * - Github repo에 저장될 디렉토리: directory
 * - 커밋 메시지: message
 * - 백준 문제 카테고리: category
 * - 파일명: fileName
 * - Readme 내용 : readme
 */
export async function findData(inputData) {
  try {
    let data = inputData;
    log.debug("findData - inputData:", data);

    // 데이터가 없는 경우 결과 테이블에서 가져오기 (구 버전 호환성)
    if (isNull(data)) {
      log.debug("findData - No input data, searching from result table");

      if (!isExistResultTable()) {
        log.error("findData - Result table not found");
        return null;
      }

      let table = parsingResultTableList();
      if (isEmpty(table)) {
        log.error("findData - Empty result table");
        return null;
      }

      // 맞은 문제만 필터링
      table = filter(table, {
        resultCategory: RESULT_CATEGORY.RESULT_ACCEPTED,
        username: findUsername(),
        language: table[0]["language"],
      });

      if (isEmpty(table)) {
        log.error("findData - No accepted submissions found");
        return null;
      }

      data = selectBestSubmissionList(table)[0];
    }

    // 필수 데이터 검증
    if (isNull(data.problemId) || isNull(data.submissionId)) {
      log.error("findData - Missing required data:", {
        problemId: data.problemId,
        submissionId: data.submissionId,
      });
      return null;
    }

    // 대회 문제 검증
    if (Number.isNaN(Number(data.problemId)) || Number(data.problemId) < 1000) {
      throw new Error(`정책상 대회 문제는 업로드 되지 않습니다. 대회 문제가 아니라고 판단된다면 이슈로 남겨주시길 바랍니다.\n문제 ID: ${data.problemId}`);
    }

    // 문제 정보와 코드 가져오기
    const problemInfoAndCode = await findProblemInfoAndSubmissionCode(data.problemId, data.submissionId);
    log.debug("findData - problemInfoAndCode:", problemInfoAndCode);

    if (isNull(problemInfoAndCode)) {
      log.error("findData - Failed to fetch problem info and code");
      return null;
    }

    // 데이터 합치기
    const mergedData = preProcessEmptyObj({ ...data, ...problemInfoAndCode });
    log.debug("findData - mergedData:", mergedData);

    // 상세 정보 생성
    const detail = await makeDetailMessageAndReadme(mergedData);
    if (isNull(detail)) {
      log.error("findData - Failed to create detail message and readme");
      return null;
    }

    // 최종 데이터 반환
    return { ...data, ...problemInfoAndCode, ...detail };
  } catch (error) {
    log.error("findData - Error:", error);
    return null;
  }
}

/*
  Fetch를 사용하여 정보를 구하는 함수로 다음 정보를 확인합니다.
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
  log.debug("parseProblemDescription - doc:", doc);

  try {
    // 이미지에 상대 경로가 있을 수 있으므로 이미지 경로를 절대 경로로 전환
    const problemDescElement = doc.getElementById("problem_description");
    if (problemDescElement) {
      convertImageTagToAbsoluteURL(problemDescElement);
    }

    const titleElement = doc.querySelector("title");
    const problemId = titleElement?.textContent?.split(":")[0]?.replace(/[^0-9]/g, "") || "";

    const problemDescription = problemDescElement ? unescapeHtml(problemDescElement.innerHTML.trim()) : "";
    const problemInput = doc.getElementById("problem_input")?.innerHTML?.trim() ? unescapeHtml(doc.getElementById("problem_input").innerHTML.trim()) : "Empty";
    const problemOutput = doc.getElementById("problem_output")?.innerHTML?.trim() ? unescapeHtml(doc.getElementById("problem_output").innerHTML.trim()) : "Empty";

    return {
      problemId,
      problemDescription,
      problemInput,
      problemOutput,
    };
  } catch (error) {
    log.error("parseProblemDescription - Error:", error);
    return {
      problemId: "",
      problemDescription: "",
      problemInput: "Empty",
      problemOutput: "Empty",
    };
  }
}

/**
 * 결과를 맞은 중복되지 않은 제출 결과 리스트를 가져오는 함수
 * @param username: 백준 아이디
 * @returns Promise<Array<Object>>
 */
export async function findUniqueResultTableListByUsername(username) {
  const resultList = await findResultTableListByUsername(username);
  return selectBestSubmissionList(resultList);
}

export async function fetchProblemDescriptionById(problemId) {
  log.debug("fetchProblemDescriptionById - fetching problemId:", problemId);

  try {
    const response = await fetch(`${urls.BAEKJOON_PROBLEM_URL}${problemId}`);
    const html = await response.text();
    log.debug("fetchProblemDescriptionById - fetched html length:", html.length);

    const doc = new DOMParser().parseFromString(html, "text/html");
    return parseProblemDescription(doc);
  } catch (error) {
    log.error("fetchProblemDescriptionById - Error:", error);
    return null;
  }
}

export async function fetchSubmitCodeById(submissionId) {
  try {
    const response = await fetch(`${urls.BAEKJOON_SOURCE_DOWNLOAD_URL}${submissionId}`, {
      method: "GET",
    });
    return await response.text();
  } catch (error) {
    log.error("fetchSubmitCodeById - Error:", error);
    return null;
  }
}

export async function getProblemDescriptionById(problemId) {
  let problem = await getProblemData(problemId);
  log.debug("getProblemDescriptionById - cached problem:", problem);

  if (isNull(problem)) {
    problem = await fetchProblemDescriptionById(problemId);
    log.debug("getProblemDescriptionById - fetched problem:", problem);
    if (problem) {
      updateProblemData(problem); // not await
    }
  }
  return problem;
}

export async function getSubmitCodeById(submissionId) {
  let code = await getSubmitCodeData(submissionId);

  if (isNull(code)) {
    code = await fetchSubmitCodeById(submissionId);
    if (code) {
      updateSubmitCodeData({ submissionId, code }); // not await
    }
  }
  return code;
}

export async function getSolvedACById(problemId) {
  let jsonData = await getSolvedACData(problemId);

  if (isNull(jsonData)) {
    try {
      log.debug(`Fetching solved.ac data for problemId: ${problemId}`);
      jsonData = await chrome.runtime.sendMessage({
        sender: "baekjoon",
        task: "SolvedApiCall",
        problemId,
      });

      if (jsonData) {
        updateSolvedACData({ problemId, jsonData }); // not await
      }
    } catch (error) {
      log.error("getSolvedACById - Error:", error);
      return null;
    }
  }
  return jsonData;
}

async function findResultTableListByUsername(username) {
  // 실제 구현은 프로젝트의 다른 파일에서 가져와야 합니다
  // 이는 기존 코드를 유지하기 위한 스텁입니다
  return [];
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
