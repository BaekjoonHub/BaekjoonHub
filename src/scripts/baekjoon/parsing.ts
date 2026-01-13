/**
 * Baekjoon platform parsing functions
 * Handles problem description, submission code, and result table parsing
 */
import {
  isNull,
  isEmpty,
  preProcessEmptyObj,
  parseNumberFromString,
  asyncPool,
  convertSingleCharToDoubleChar,
  unescapeHtml,
  filter,
} from "@/commons/util";
import log from "@/commons/logger";
import { getDateString, convertImageTagToAbsoluteURL } from "@/commons/ui-util";
import {
  updateProblemData,
  getProblemData,
  updateSubmitCodeData,
  getSubmitCodeData,
  updateSolvedACData,
  getSolvedACData,
} from "@/baekjoon/storage";
import { bjLevel, RESULT_CATEGORY, uploadState, getLanguageExtension } from "@/baekjoon/variables";
import {
  findUsername,
  isExistResultTable,
  markUploadFailedCSS,
  selectBestSubmissionList,
  convertResultTableHeader,
  langVersionRemove,
} from "@/baekjoon/util";
import { getDirNameByTemplate } from "@/commons/storage";
import urls from "@/constants/url";

// Submission data interface
interface SubmissionData {
  problemId?: string;
  submissionId?: string;
  username?: string;
  result?: string;
  resultCategory?: string;
  language?: string;
  runtime?: string;
  memory?: string;
  codeLength?: string;
  submissionTime?: string;
  elementId?: string;
  [key: string]: string | undefined;
}

// Problem info interface
interface ProblemInfo {
  problemId: string;
  submissionId?: string;
  title?: string;
  level?: string;
  code?: string;
  problemDescription?: string;
  problemInput?: string;
  problemOutput?: string;
  problemTags?: string[];
}

// Parsed problem description interface
interface ProblemDescription {
  problemId: string;
  problemDescription: string;
  problemInput: string;
  problemOutput: string;
}

// Solved.ac problem data interface
interface SolvedACProblem {
  problemId: number;
  titleKo: string;
  level: number;
  tags?: Array<{
    displayNames: Array<{
      language: string;
      name: string;
    }>;
  }>;
}

// Upload data interface
interface UploadData {
  directory: string;
  fileName: string;
  message: string;
  readme: string;
  code: string;
}

/**
 * Fetch HTML document from URL
 * @param url - Target URL
 * @returns Parsed HTML document
 */
export async function findHtmlDocumentByUrl(url: string): Promise<Document> {
  const response = await fetch(url, { method: "GET" });
  const text = await response.text();
  const parser = new DOMParser();
  return parser.parseFromString(text, "text/html");
}

/**
 * Parse result table from document
 * @param doc - HTML document (defaults to current document)
 * @returns Array of submission data
 */
export function parsingResultTableList(doc: Document = document): SubmissionData[] {
  const table = doc.getElementById("status-table") as HTMLTableElement | null;
  if (table === null || table === undefined || table.rows.length === 0) return [];

  const headers = Array.from(table.rows[0].cells, (x) =>
    convertResultTableHeader(x.innerText.trim())
  );

  const list: SubmissionData[] = [];
  for (let i = 1; i < table.rows.length; i++) {
    const row = table.rows[i];
    const cells = Array.from(row.cells, (x, index) => {
      switch (headers[index]) {
        case "result": {
          const firstChild = x.firstChild as HTMLElement | null;
          return {
            result: x.innerText.trim(),
            resultCategory: firstChild?.getAttribute?.("data-color")?.replace("-eng", "").trim() || "",
          };
        }
        case "language":
          return unescapeHtml(x.innerText).replace(/\/.*$/g, "").trim();
        case "submissionTime": {
          const el =
            x.querySelector("a.real-time-update.show-date") ||
            x.querySelector("a.show-date");
          if (isNull(el)) return null;
          return (el as HTMLElement).getAttribute("data-original-title");
        }
        case "problemId": {
          const a = x.querySelector("a.problem_title") as HTMLAnchorElement | null;
          if (isNull(a)) return null;
          return {
            problemId: a.getAttribute("href")?.replace(/^.*\/([0-9]+)$/, "$1") || "",
          };
        }
        default:
          return x.innerText.trim();
      }
    });

    let obj: SubmissionData = { elementId: row.id };
    for (let j = 0; j < headers.length; j++) {
      const value = cells[j];
      if (value && typeof value === "object") {
        obj = { ...obj, ...value };
      } else {
        (obj as Record<string, unknown>)[headers[j]] = value;
      }
    }
    list.push(obj);
  }

  log.debug("TableList", list);
  return list;
}

/**
 * Find problem info and submission code
 * @param problemId - Problem ID
 * @param submissionId - Submission ID
 * @returns Problem info with code or null
 */
export async function findProblemInfoAndSubmissionCode(
  problemId: string,
  submissionId: string
): Promise<ProblemInfo | null> {
  log.debug("findProblemInfoAndSubmissionCode - problemId:", problemId, "submissionId:", submissionId);

  if (isNull(problemId) || isNull(submissionId)) {
    log.error("findProblemInfoAndSubmissionCode - problemId or submissionId is null");
    return null;
  }

  try {
    const [description, code, solvedJson] = await Promise.all([
      getProblemDescriptionById(problemId),
      getSubmitCodeById(submissionId),
      getSolvedACById(problemId),
    ]);

    log.debug("findProblemInfoAndSubmissionCode - fetched data:", {
      description: description ? "exists" : "null",
      code: code ? "exists" : "null",
      solvedJson: solvedJson ? "exists" : "null",
    });

    if (!description || !code || !solvedJson) {
      log.error("findProblemInfoAndSubmissionCode - missing data");
      return null;
    }

    const solvedData = solvedJson as SolvedACProblem;
    const problemTags =
      solvedData.tags
        ?.flatMap((tag) => tag.displayNames)
        ?.filter((tag) => tag.language === "ko")
        ?.map((tag) => tag.name) || [];

    const title = solvedData.titleKo;
    const level = bjLevel[solvedData.level];

    const problemDescription = (description as ProblemDescription).problemDescription;
    const problemInput = (description as ProblemDescription).problemInput;
    const problemOutput = (description as ProblemDescription).problemOutput;

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
 * Create detail message and readme for upload
 * @param data - Problem and submission data
 * @returns Upload data with directory, filename, message, and readme
 */
export async function makeDetailMessageAndReadme(data: Record<string, unknown>): Promise<UploadData | null> {
  log.debug("makeDetailMessageAndReadme - input data:", data);

  if (isNull(data)) {
    log.error("makeDetailMessageAndReadme - data is null");
    return null;
  }

  // Support both old and new variable names
  const problemId = data.problemId as string;
  const submissionId = data.submissionId as string;
  const result = data.result as string | undefined;
  const title = data.title as string;
  const level = data.level as string;
  const problemTags = (data.problemTags || data.problem_tags || []) as string[];
  const problemDescription = (data.problemDescription || data.problem_description) as string | undefined;
  const problemInput = (data.problemInput || data.problem_input) as string | undefined;
  const problemOutput = (data.problemOutput || data.problem_output) as string | undefined;
  const submissionTime = data.submissionTime as string | undefined;
  const code = data.code as string;
  const language = data.language as string;
  const memory = data.memory as string;
  const runtime = data.runtime as string;

  // Validate required data
  if (isNull(problemId) || isNull(title) || isNull(code) || isNull(language)) {
    log.error("makeDetailMessageAndReadme - Missing required data:", {
      problemId,
      title,
      code: code ? "exists" : "null",
      language,
    });
    return null;
  }

  const score = parseNumberFromString(result || "");
  const processedLanguage = langVersionRemove(language, null);

  // Build base directory path
  const baseDirPath = `백준/${level.replace(/ .*/, "")}/${problemId}. ${convertSingleCharToDoubleChar(title)}`;

  // Get directory from template
  let directory: string;
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
    directory = baseDirPath;
  }

  // Build commit message
  const message = `[${level}] Title: ${title}, Time: ${runtime} ms, Memory: ${memory} KB${Number.isNaN(score) ? "" : `, Score: ${score} point`} -BaekjoonHub`;

  const category = problemTags.join(", ");
  const fileName = `${convertSingleCharToDoubleChar(title)}.${getLanguageExtension(language)}`;
  const dateInfo = submissionTime ?? getDateString(new Date(Date.now()));

  // Build readme content
  const readme =
    `# [${level}] ${title} - ${problemId} \n\n` +
    `[문제 링크](${urls.BAEKJOON_PROBLEM_URL}${problemId}) \n\n` +
    `### 성능 요약\n\n` +
    `메모리: ${memory} KB, ` +
    `시간: ${runtime} ms\n\n` +
    `### 분류\n\n` +
    `${category || "Empty"}\n\n` +
    `${problemDescription ? `### 문제 설명\n\n${problemDescription}` : ""}` +
    `${problemInput ? `### 문제 입력\n\n${problemInput}` : ""}` +
    `${problemOutput ? `### 문제 출력\n\n${problemOutput}` : ""}\n\n` +
    `${dateInfo ? `### 제출 일자\n\n${dateInfo}` : ""}`;

  return {
    directory,
    fileName,
    message,
    readme,
    code,
  };
}

/**
 * Find complete problem data for upload
 * @param inputData - Input submission data
 * @returns Complete problem data or null
 */
export async function findData(inputData?: SubmissionData | null): Promise<Record<string, unknown> | null> {
  try {
    let data = inputData;
    log.debug("findData - inputData:", data);

    // Get from result table if no input data (legacy compatibility)
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

      // Filter for accepted submissions
      table = filter(table, {
        resultCategory: RESULT_CATEGORY.RESULT_ACCEPTED,
        username: findUsername() ?? undefined,
        language: table[0]["language"],
      }) as SubmissionData[];

      if (isEmpty(table)) {
        log.error("findData - No accepted submissions found");
        return null;
      }

      data = selectBestSubmissionList(table)[0];
    }

    // Validate required data
    if (isNull(data?.problemId) || isNull(data?.submissionId)) {
      log.error("findData - Missing required data:", {
        problemId: data?.problemId,
        submissionId: data?.submissionId,
      });
      return null;
    }

    // Contest problem validation
    if (Number.isNaN(Number(data.problemId)) || Number(data.problemId) < 1000) {
      throw new Error(
        `정책상 대회 문제는 업로드 되지 않습니다. 대회 문제가 아니라고 판단된다면 이슈로 남겨주시길 바랍니다.\n문제 ID: ${data.problemId}`
      );
    }

    // Get problem info and code
    const problemInfoAndCode = await findProblemInfoAndSubmissionCode(
      data.problemId!,
      data.submissionId!
    );
    log.debug("findData - problemInfoAndCode:", problemInfoAndCode);

    if (isNull(problemInfoAndCode)) {
      log.error("findData - Failed to fetch problem info and code");
      return null;
    }

    // Merge data
    const mergedData = preProcessEmptyObj({ ...data, ...problemInfoAndCode });
    log.debug("findData - mergedData:", mergedData);

    // Create detail info
    const detail = await makeDetailMessageAndReadme(mergedData as Record<string, unknown>);
    if (isNull(detail)) {
      log.error("findData - Failed to create detail message and readme");
      return null;
    }

    return { ...data, ...problemInfoAndCode, ...detail };
  } catch (error) {
    log.error("findData - Error:", error);
    return null;
  }
}

/**
 * Parse problem description from document
 * @param doc - HTML document (defaults to current document)
 * @returns Problem description data
 */
export function parseProblemDescription(doc: Document = document): ProblemDescription {
  log.debug("parseProblemDescription - doc:", doc);

  try {
    // Convert relative image paths to absolute
    const problemDescElement = doc.getElementById("problem_description");
    if (problemDescElement) {
      convertImageTagToAbsoluteURL(problemDescElement);
    }

    const titleElement = doc.querySelector("title");
    const problemId = titleElement?.textContent?.split(":")[0]?.replace(/[^0-9]/g, "") || "";

    const problemDescription = problemDescElement
      ? unescapeHtml(problemDescElement.innerHTML.trim())
      : "";
    const problemInputEl = doc.getElementById("problem_input");
    const problemOutputEl = doc.getElementById("problem_output");

    const problemInput = problemInputEl?.innerHTML?.trim()
      ? unescapeHtml(problemInputEl.innerHTML.trim())
      : "Empty";
    const problemOutput = problemOutputEl?.innerHTML?.trim()
      ? unescapeHtml(problemOutputEl.innerHTML.trim())
      : "Empty";

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
 * Find unique best submissions by username
 * @param username - Baekjoon username
 * @returns Best submissions without duplicates
 */
export async function findUniqueResultTableListByUsername(
  username: string
): Promise<SubmissionData[]> {
  const resultList = await findResultTableListByUsername(username);
  return selectBestSubmissionList(resultList);
}

/**
 * Fetch problem description by ID
 * @param problemId - Problem ID
 * @returns Problem description data
 */
export async function fetchProblemDescriptionById(
  problemId: string | number
): Promise<ProblemDescription | null> {
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

/**
 * Fetch submission code by ID
 * @param submissionId - Submission ID
 * @returns Code string or null
 */
export async function fetchSubmitCodeById(submissionId: string | number): Promise<string | null> {
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

/**
 * Get problem description by ID (with caching)
 * @param problemId - Problem ID
 * @returns Problem description data
 */
export async function getProblemDescriptionById(
  problemId: string | number
): Promise<ProblemDescription | null> {
  let problem: ProblemDescription | null = (await getProblemData(problemId)) as ProblemDescription | null;
  log.debug("getProblemDescriptionById - cached problem:", problem);

  if (isNull(problem)) {
    problem = await fetchProblemDescriptionById(problemId);
    log.debug("getProblemDescriptionById - fetched problem:", problem);
    if (problem) {
      updateProblemData(problem as unknown as { problemId: string });
    }
  }
  return problem;
}

/**
 * Get submission code by ID (with caching)
 * @param submissionId - Submission ID
 * @returns Code string or null
 */
export async function getSubmitCodeById(submissionId: string | number): Promise<string | null> {
  let code = await getSubmitCodeData(submissionId);

  if (isNull(code)) {
    code = await fetchSubmitCodeById(submissionId);
    if (code) {
      updateSubmitCodeData({ submissionId, code });
    }
  }
  return code;
}

/**
 * Get Solved.ac data by problem ID (with caching)
 * @param problemId - Problem ID
 * @returns Solved.ac problem data or null
 */
export async function getSolvedACById(problemId: string | number): Promise<unknown | null> {
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
        updateSolvedACData({ problemId, jsonData });
      }
    } catch (error) {
      log.error("getSolvedACById - Error:", error);
      return null;
    }
  }
  return jsonData;
}

/**
 * Find result table list by username (stub)
 */
async function findResultTableListByUsername(username: string): Promise<SubmissionData[]> {
  // Stub implementation
  return [];
}

/**
 * Fetch Solved.ac data by problem ID via background script
 * @param problemId - Problem ID
 * @returns Solved.ac problem data
 */
export async function fetchSolvedACById(problemId: string | number): Promise<unknown> {
  return chrome.runtime.sendMessage({
    sender: "baekjoon",
    task: "SolvedApiCall",
    problemId,
  });
}

/**
 * Fetch multiple problem infos by IDs (100 at a time)
 * @param problemIds - Array of problem IDs
 * @returns Array of problem data
 */
export async function fetchProblemInfoByIds(problemIds: (string | number)[][]): Promise<unknown[]> {
  const dividedProblemIds: (string | number)[][] = [];
  for (const problemIdChunk of problemIds) {
    dividedProblemIds.push(problemIdChunk.slice(0, 100));
  }
  const results = await asyncPool(1, dividedProblemIds, async (pids) => {
    const result = await fetch(
      `https://solved.ac/api/v3/problem/lookup?problemIds=${pids.join("%2C")}`,
      { method: "GET" }
    );
    return result.json();
  });
  return results.flatMap((result) => result as unknown[]);
}

/**
 * Fetch multiple problem descriptions by IDs (2 concurrent)
 * @param problemIds - Array of problem IDs
 * @returns Array of problem descriptions
 */
export async function fetchProblemDescriptionsByIds(
  problemIds: (string | number)[]
): Promise<(ProblemDescription | null)[]> {
  return asyncPool(2, problemIds, async (problemId) =>
    getProblemDescriptionById(problemId)
  );
}

/**
 * Fetch multiple submission codes by IDs (2 concurrent)
 * @param submissionIds - Array of submission IDs
 * @returns Array of code strings
 */
export async function fetchSubmissionCodeByIds(
  submissionIds: (string | number)[]
): Promise<(string | null)[]> {
  return asyncPool(2, submissionIds, async (submissionId) =>
    getSubmitCodeById(submissionId)
  );
}

/**
 * Find result table by problem ID and username
 * @param problemId - Problem ID
 * @param username - Baekjoon username
 * @returns Array of submission data
 */
export async function findResultTableByProblemIdAndUsername(
  problemId: string | number,
  username: string
): Promise<SubmissionData[]> {
  const response = await fetch(
    `https://www.acmicpc.net/status?from_mine=1&problem_id=${problemId}&user_id=${username}`,
    { method: "GET" }
  );
  const text = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");
  return parsingResultTableList(doc);
}
