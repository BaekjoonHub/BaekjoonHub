/**
 * Programmers platform parsing functions
 * Handles problem description and submission code parsing
 */
import { convertSingleCharToDoubleChar } from "@/commons/util";
import { getDateString } from "@/commons/ui-util";
import { getDirNameByTemplate } from "@/commons/storage";
import log from "@/commons/logger";
import { ReadmeBuilder } from "@/commons/readme-builder";

// Problem data interface for Programmers
interface ProgrammersProblemOrigin {
  problemDescription: string;
  problemId: string;
  level: string;
  resultMessage: string;
  division: string;
  languageExtension: string;
  title: string;
  runtime: string;
  memory: string;
  code: string;
  language: string;
  link: string;
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

/**
 * Create upload data from parsed problem info
 * @param origin - Original problem data
 * @returns Formatted data for upload
 */
export async function makeData(origin: ProgrammersProblemOrigin): Promise<ParsedProblemData> {
  const {
    problemDescription,
    problemId,
    level,
    resultMessage,
    division,
    languageExtension,
    title,
    runtime,
    memory,
    code,
    language,
    link,
  } = origin;

  // Build base directory path
  const baseDirPath = `프로그래머스/${level}/${problemId}. ${convertSingleCharToDoubleChar(title)}`;

  // Get directory from template
  const directory = await getDirNameByTemplate(baseDirPath, language, {
    problemId,
    title,
    level,
    division,
    memory,
    runtime,
    submissionTime: getDateString(new Date(Date.now())),
    language,
    problemDescription,
    resultMessage,
    link,
  });

  const levelWithLv = `${level}`.includes("lv") ? level : `lv${level}`.replace("lv", "level ");
  const message = `[${levelWithLv}] Title: ${title}, Time: ${runtime}, Memory: ${memory} -BaekjoonHub`;
  const fileName = `${convertSingleCharToDoubleChar(title)}.${languageExtension}`;
  const dateInfo = getDateString(new Date(Date.now()));

  const readme = new ReadmeBuilder()
    .addTitle(levelWithLv, title, problemId)
    .addProblemLink(link)
    .addPerformance(memory, runtime)
    .addSection("구분", division.replace("/", " > "))
    .addSection("채점결과", resultMessage)
    .addSubmissionDate(dateInfo)
    .addProblemDescription(problemDescription)
    .addSource("프로그래머스 코딩 테스트 연습", "https://school.programmers.co.kr/learn/challenges")
    .build();

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
 * Parse problem data from the current page
 * @returns Parsed problem data for upload
 */
export async function parseData(): Promise<ParsedProblemData> {
  const linkMeta = document.querySelector('head > meta[name$="url"]') as HTMLMetaElement | null;
  const link = linkMeta?.content?.replace(/\?.*/g, "").trim() || "";

  const lessonContent = document.querySelector("div.main > div.lesson-content");
  const problemId = lessonContent?.getAttribute("data-lesson-id") || "";

  const bodyLessonContent = document.querySelector("body > div.main > div.lesson-content");
  const level = bodyLessonContent?.getAttribute("data-challenge-level") || "";

  const breadcrumb = document.querySelector("ol.breadcrumb");
  const division = breadcrumb
    ? [...breadcrumb.childNodes]
        .filter((x) => (x as Element).className !== "active")
        .map((x) => (x as HTMLElement).innerText)
        .map((x) => convertSingleCharToDoubleChar(x))
        .reduce((a, b) => `${a}/${b}`)
    : "";

  const titleElement = document.querySelector(".algorithm-title .challenge-title");
  const title = titleElement?.textContent?.replace(/\\n/g, "").trim() || "";

  const descElement = document.querySelector("div.guide-section-description > div.markdown");
  const problemDescription = descElement?.innerHTML || "";

  const editorTab = document.querySelector("div.editor > ul > li.nav-item > a") as HTMLElement | null;
  const languageExtension = editorTab?.innerText?.split(".")[1] || "txt";

  // Try multiple methods to get the code
  let code = "";

  // Method 1: Standard textarea#code
  const textareaCode = document.querySelector("textarea#code") as HTMLTextAreaElement | null;
  if (textareaCode?.value) {
    code = textareaCode.value;
    log.debug("[BaekjoonHub]: Found code in textarea");
  }

  // Method 2: data-type="code" input (fill-in-the-blank problems)
  if (!code) {
    const codeInput = document.querySelector(
      "input[data-type='code'][data-language]"
    ) as HTMLInputElement | null;
    if (codeInput?.value) {
      code = codeInput.value;
      log.debug("[BaekjoonHub]: Found code in data-type input");
    }
  }

  // Method 3: Find hidden inputs with numeric IDs (submitted code storage)
  if (!code) {
    const allInputs = document.querySelectorAll("input[type='hidden']");
    for (const input of allInputs) {
      const inputEl = input as HTMLInputElement;
      if (inputEl.id && /^\d+$/.test(inputEl.id) && inputEl.value) {
        // Check for Java code pattern
        if (inputEl.value.includes("public class") || inputEl.value.includes("import java")) {
          code = inputEl.value;
          log.debug("[BaekjoonHub]: Found code in hidden input:", inputEl.id);
          break;
        }
      }
    }
  }

  // Method 4: Fill-in-the-blank problems - combine template with user input
  if (!code) {
    const algorithmType = document
      .querySelector("div.lesson-content")
      ?.getAttribute("data-algorithm-type");
    if (algorithmType === "fill" || document.querySelector(".code-editor input[type='text']")) {
      log.debug("[BaekjoonHub]: Processing as fill-in-the-blank problem");

      const initialCodeElement = document.querySelector(
        "input[id^='initial_code_']"
      ) as HTMLInputElement | null;
      if (initialCodeElement?.value) {
        let initialCode = initialCodeElement.value;

        // Get user input values
        const inputFields = document.querySelectorAll("input[id^='input_code_'][type='text']");
        const userInputs = Array.from(inputFields).map(
          (input) => (input as HTMLInputElement).value || ""
        );

        // Replace @@@ markers with user inputs
        if (initialCode.includes("@@@")) {
          userInputs.forEach((input) => {
            initialCode = initialCode.replace("@@@", input);
          });
        }
        code = initialCode;
        log.debug("[BaekjoonHub]: Fill-in-the-blank code generated");
      }
    }
  }

  // Method 5: Extract from code editor DOM (last resort)
  if (!code) {
    const codeEditor = document.querySelector(".code-editor");
    if (codeEditor) {
      const codeContainer = codeEditor.querySelector(".rouge-code");
      if (codeContainer) {
        const clonedContainer = codeContainer.cloneNode(true) as HTMLElement;

        // Replace input fields with their values
        const inputs = clonedContainer.querySelectorAll("input[type='text']");
        inputs.forEach((input) => {
          const inputEl = input as HTMLInputElement;
          const value = inputEl.value || "";
          const textNode = document.createTextNode(value);
          inputEl.parentNode?.replaceChild(textNode, inputEl);
        });

        code = clonedContainer.textContent || "";
        log.debug("[BaekjoonHub]: Extracted code from DOM");
      }
    }
  }

  log.debug("[BaekjoonHub]: Final code length:", code.length);

  if (!code) {
    log.warn("[BaekjoonHub]: Could not find code");
    code = "";
  }

  // Parse result message
  const resultMessage =
    [...document.querySelectorAll("#output .console-message")]
      .map((node) => node.textContent || "")
      .filter((text) => text.includes(":"))
      .reduce((cur, next) => (cur ? `${cur}<br/>${next}` : next), "") || "Empty";

  // Parse runtime and memory
  const [runtime, memory] = [...document.querySelectorAll("td.result.passed")]
    .map((x) => (x as HTMLElement).innerText)
    .map((x) => x.replace(/[^., 0-9a-zA-Z]/g, "").trim())
    .map((x) => x.split(", "))
    .reduce(
      (x, y) => (Number(x[0].slice(0, -2)) > Number(y[0].slice(0, -2)) ? x : y),
      ["0.00ms", "0.0MB"]
    )
    .map((x) => x.replace(/(?<=[0-9])(?=[A-Za-z])/, " "));

  // Get language for folder organization
  const languageButton = document.querySelector("div#tour7 > button");
  const language = languageButton?.textContent?.trim() || "";

  return makeData({
    link,
    problemId,
    level,
    title,
    problemDescription,
    division,
    languageExtension,
    code,
    resultMessage,
    runtime,
    memory,
    language,
  });
}
