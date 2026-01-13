/**
 * SWEA platform parsing functions
 * Handles problem description and submission code parsing
 */
import { isNull, convertSingleCharToDoubleChar } from "@/commons/util";
import { getProblemData, updateProblemData } from "@/swexpertacademy/storage";
import { languages } from "@/swexpertacademy/variables";
import { getNickname } from "@/swexpertacademy/util";
import { getDirNameByTemplate } from "@/commons/storage";
import urls from "@/constants/url";
import log from "@/commons/logger";

// Problem origin data interface
interface SWEAProblemOrigin {
  link: string;
  problemId: string;
  level: string;
  languageExtension: string;
  title: string;
  runtime: string;
  memory: string;
  code: string;
  length: string;
  submissionTime: string;
  language: string;
}

// Parsed problem data interface
interface ParsedProblemData {
  problemId: string;
  directory: string;
  message: string;
  fileName: string;
  readme: string;
  code: string;
}

// Parse code result interface
interface ParseCodeResult {
  problemId: string;
  contestProbId: string;
}

/**
 * Update text source event for code editor synchronization
 */
export function updateTextSourceEvent(): void {
  document.documentElement.setAttribute("onreset", "cEditor.save();");
  document.documentElement.dispatchEvent(new CustomEvent("reset"));
  document.documentElement.removeAttribute("onreset");
}

/**
 * Create upload data from parsed problem info
 * @param origin - Original problem data
 * @returns Formatted data for upload
 */
export async function makeData(origin: SWEAProblemOrigin): Promise<ParsedProblemData> {
  const {
    link,
    problemId,
    level,
    languageExtension,
    title,
    runtime,
    memory,
    code,
    length,
    submissionTime,
    language,
  } = origin;

  // Normalize language case (SWEA uses all uppercase like "JAVA")
  const lang =
    language === language.toUpperCase()
      ? language.substring(0, 1) + language.substring(1).toLowerCase()
      : language;

  // Build base directory path
  const baseDirPath = `SWEA/${level}/${problemId}. ${convertSingleCharToDoubleChar(title)}`;

  // Get directory from template
  const directory = await getDirNameByTemplate(baseDirPath, lang, {
    problemId,
    title,
    level,
    memory,
    runtime,
    submissionTime,
    language: lang,
    length,
    link,
  });

  const message = `[${level}] Title: ${title}, Time: ${runtime}, Memory: ${memory} -BaekjoonHub`;
  const fileName = `${convertSingleCharToDoubleChar(title)}.${languageExtension}`;
  const dateInfo = submissionTime;

  const readme =
    `# [${level}] ${title} - ${problemId} \n\n` +
    `[문제 링크](${urls.SWEA_PROBLEM_DETAIL_URL}) \n\n` +
    `### 성능 요약\n\n` +
    `메모리: ${memory}, ` +
    `시간: ${runtime}, ` +
    `코드길이: ${length} Bytes\n\n` +
    `### 제출 일자\n\n` +
    `${dateInfo}\n\n` +
    `\n\n` +
    `> 출처: SW Expert Academy, https://swexpertacademy.com/main/code/problem/problemList.do`;

  return {
    problemId,
    directory,
    message,
    fileName,
    readme,
    code,
  };
}

/**
 * Parse and store submission code
 * @returns Parse code result with problemId and contestProbId
 */
export async function parseCode(): Promise<ParseCodeResult | undefined> {
  const problemIdEl = document.querySelector("div.problem_box > h3");
  if (!problemIdEl) {
    log.error("parseCode: 문제번호 요소를 찾을 수 없습니다.");
    return;
  }
  const problemId = problemIdEl.textContent?.replace(/\..*$/, "").trim() || "";

  const contestProbIdElements = document.querySelectorAll("#contestProbId");
  if (contestProbIdElements.length === 0) {
    log.error("parseCode: contestProbId 요소를 찾을 수 없습니다.");
    return;
  }
  const contestProbId = (
    [...contestProbIdElements].slice(-1)[0] as HTMLInputElement
  ).value;

  updateTextSourceEvent();
  const textSourceEl = document.querySelector("#textSource") as HTMLTextAreaElement | null;
  const code = textSourceEl?.value || "";

  await updateProblemData(problemId, { code, contestProbId });
  return { problemId, contestProbId };
}

/**
 * Parse problem data from the current page
 * @returns Parsed problem data for upload
 */
export async function parseData(): Promise<ParsedProblemData | undefined> {
  const searchInputElement = document.querySelector("#searchinput") as HTMLInputElement | null;
  if (!searchInputElement) {
    log.error("parseData: #searchinput 요소를 찾을 수 없습니다.");
    return;
  }
  const nickname = searchInputElement.value;

  log.debug(
    "사용자 로그인 정보 및 유무 체크",
    nickname,
    document.querySelector("#problemForm div.info")
  );

  // Check if user matches and has PASS record
  if (getNickname() !== nickname) return;
  if (isNull(document.querySelector("#problemForm div.info"))) return;

  log.debug("결과 데이터 파싱 시작");

  const titleElement = document.querySelector("div.problem_box > p.problem_title");
  if (!titleElement) {
    log.error("parseData: 문제 제목 요소를 찾을 수 없습니다.");
    return;
  }
  const title = titleElement.textContent
    ?.replace(/ D[0-9]$/, "")
    .replace(/^[^.]*/, "")
    .substring(1)
    .trim() || "";

  // Level
  const levelEl = document.querySelector("div.problem_box > p.problem_title > span.badge");
  const level = levelEl?.textContent || "Unrated";

  // Problem ID
  const problemIdElement = document.querySelector(
    "body > div.container > div.container.sub > div > div.problem_box > p"
  );
  if (!problemIdElement) {
    log.error("parseData: 문제번호 요소를 찾을 수 없습니다.");
    return;
  }
  const problemId = problemIdElement.textContent?.split(".")[0].trim() || "";

  // Contest problem ID
  const contestProbIdElements = document.querySelectorAll("#contestProbId");
  if (contestProbIdElements.length === 0) {
    log.error("contestProbId 요소를 찾을 수 없습니다.");
    return;
  }
  const contestProbId = (
    [...contestProbIdElements].slice(-1)[0] as HTMLInputElement
  ).value;

  // Problem link
  const link = `${urls.SWEA_PROBLEM_DETAIL_URL}?contestProbId=${contestProbId}`;

  // Language, memory, runtime, length
  const languageElement = document.querySelector(
    "#problemForm div.info > ul > li:nth-child(1) > span:nth-child(1)"
  );
  const memoryElement = document.querySelector(
    "#problemForm div.info > ul > li:nth-child(2) > span:nth-child(1)"
  );
  const runtimeElement = document.querySelector(
    "#problemForm div.info > ul > li:nth-child(3) > span:nth-child(1)"
  );
  const lengthElement = document.querySelector(
    "#problemForm div.info > ul > li:nth-child(4) > span:nth-child(1)"
  );

  if (!languageElement || !memoryElement || !runtimeElement || !lengthElement) {
    log.error("문제 정보 요소들을 찾을 수 없습니다.");
    return;
  }

  const language = languageElement.textContent?.trim() || "";
  const memory = memoryElement.textContent?.trim().toUpperCase() || "";
  const runtime = runtimeElement.textContent?.trim() || "";
  const length = lengthElement.textContent?.trim() || "";

  // File extension
  const languageExtension = languages[language.toLowerCase()] || "txt";

  // Submission time
  const submissionTimeElement = document.querySelector(".smt_txt > dd");
  if (!submissionTimeElement) {
    log.error("제출 시간 요소를 찾을 수 없습니다.");
    return;
  }
  const submissionTimeMatch = submissionTimeElement.textContent?.match(
    /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g
  );
  if (!submissionTimeMatch || submissionTimeMatch.length === 0) {
    log.error("제출 시간 형식을 파싱할 수 없습니다.");
    return;
  }
  const submissionTime = submissionTimeMatch[0];

  // Get cached code from storage
  const data = await getProblemData(problemId);
  log.debug("data", data);
  if (isNull(data?.code)) {
    log.error("소스코드 데이터가 없습니다.");
    return;
  }
  const { code } = data;
  log.debug("파싱 완료");

  return makeData({
    link,
    problemId,
    level,
    title,
    languageExtension,
    code,
    runtime,
    memory,
    length,
    submissionTime,
    language,
  });
}
