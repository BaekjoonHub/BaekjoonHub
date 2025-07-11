import { log, isNull, convertSingleCharToDoubleChar } from "@/commons/util.js";
import { getProblemData, updateProblemData } from "@/swexpertacademy/storage.js";
import { languages } from "@/swexpertacademy/variables.js";
import { getNickname } from "@/swexpertacademy/util.js";
import { getDirNameByOrgOption } from "@/commons/storage.js";
import urls from "@/constants/url.js";

export function updateTextSourceEvent() {
  document.documentElement.setAttribute("onreset", "cEditor.save();");
  document.documentElement.dispatchEvent(new CustomEvent("reset"));
  document.documentElement.removeAttribute("onreset");
}

export async function makeData(origin) {
  const { link, problemId, level, extension, title, runtime, memory, code, length, submissionTime, language } = origin;
  /*
   * SWEA의 경우에는 JAVA 같이 모두 대문자인 경우가 존재합니다. 하지만 타 플랫폼들(백준, 프로그래머스)는 첫문자가 모두 대문자로 시작합니다.
   * 그래서 이와 같은 케이스를 처리를 위해 첫문자만 대문자를 유지하고 나머지 문자는 소문자로 변환합니다.
   * C++ 같은 경우에는 문자가 그대로 유지됩니다.
   * */
  const lang = language === language.toUpperCase() ? language.substring(0, 1) + language.substring(1).toLowerCase() : language;

  // 기본 디렉토리 경로 생성
  const baseDirPath = `SWEA/${level}/${problemId}. ${convertSingleCharToDoubleChar(title)}`;

  // 공통 업로드 서비스를 사용하여 디렉토리 경로 생성
  const directory = await getDirNameByOrgOption(baseDirPath, lang, {
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
  const fileName = `${convertSingleCharToDoubleChar(title)}.${extension}`;
  const dateInfo = submissionTime;
  // prettier-ignore
  const readme = `# [${level}] ${title} - ${problemId} \n\n`
    + `[문제 링크](${urls.SWEA_PROBLEM_DETAIL_URL}) 

`
    + `### 성능 요약\n\n`
    + `메모리: ${memory}, `
    + `시간: ${runtime}, `
    + `코드길이: ${length} Bytes\n\n`
    + `### 제출 일자\n\n`
    + `${dateInfo}\n\n`
    + `\n\n`
    + `> 출처: SW Expert Academy, https://swexpertacademy.com/main/code/problem/problemList.do`;
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
 * 문제를 정상적으로 풀면 제출한 소스코드를 파싱하고, 로컬스토리지에 저장하는 함수입니다。
 */
export async function parseCode() {
  const problemId = document.querySelector("div.problem_box > h3").innerText.replace(/\..*$/, "").trim();
  const contestProbId = [...document.querySelectorAll("#contestProbId")].slice(-1)[0].value;
  updateTextSourceEvent();
  const code = document.querySelector("#textSource").value;
  await updateProblemData(problemId, { code, contestProbId });
  return { problemId, contestProbId };
}

/*
  문제 요약과 코드를 파싱합니다.
  - directory : 레포에 기록될 폴더명
  - message : 커밋 메시지
  - fileName : 파일명
  - readme : README.md에 작성할 내용
  - code : 소스코드 내용
*/
export async function parseData() {
  const nickname = document.querySelector("#searchinput").value;

  log("사용자 로그인 정보 및 유무 체크", nickname, document.querySelector("#problemForm div.info"));
  // 검색하는 유저 정보와 로그인한 유저의 닉네임이 같은지 체크
  // PASS를 맞은 기록 유무 체크
  if (getNickname() !== nickname) return;
  if (isNull(document.querySelector("#problemForm div.info"))) return;

  log("결과 데이터 파싱 시작");

  const title = document
    .querySelector("div.problem_box > p.problem_title")
    .innerText.replace(/ D[0-9]$/, "")
    .replace(/^[^.]*/, "")
    .substr(1)
    .trim();
  // 레벨
  const level = document.querySelector("div.problem_box > p.problem_title > span.badge")?.textContent || "Unrated";
  // 문제번호
  const problemId = document.querySelector("body > div.container > div.container.sub > div > div.problem_box > p").innerText.split(".")[0].trim();
  // 문제 콘테스트 인덱스
  const contestProbId = [...document.querySelectorAll("#contestProbId")].slice(-1)[0].value;
  // 문제 링크
  const link = `${urls.SWEA_PROBLEM_DETAIL_URL}?contestProbId=${contestProbId}`;

  // 문제 언어, 메모리, 시간소요
  const language = document.querySelector("#problemForm div.info > ul > li:nth-child(1) > span:nth-child(1)").textContent.trim();
  const memory = document.querySelector("#problemForm div.info > ul > li:nth-child(2) > span:nth-child(1)").textContent.trim().toUpperCase();
  const runtime = document.querySelector("#problemForm div.info > ul > li:nth-child(3) > span:nth-child(1)").textContent.trim();
  const length = document.querySelector("#problemForm div.info > ul > li:nth-child(4) > span:nth-child(1)").textContent.trim();

  // 확장자명
  const extension = languages[language.toLowerCase()];

  // 제출날짜
  const submissionTime = document.querySelector(".smt_txt > dd").textContent.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g)[0];
  // 로컬스토리지에서 기존 코드에 대한 정보를 불러올 수 없다면 코드 디테일 창으로 이동 후 제출하도록 이동
  const data = await getProblemData(problemId);
  log("data", data);
  if (isNull(data?.code)) {
    console.error("소스코드 데이터가 없습니다.");
    return;
  }
  const { code } = data;
  log("파싱 완료");
  // eslint-disable-next-line consistent-return
  return makeData({
    link,
    problemId,
    level,
    title,
    extension,
    code,
    runtime,
    memory,
    length,
    submissionTime,
    language,
  });
}
