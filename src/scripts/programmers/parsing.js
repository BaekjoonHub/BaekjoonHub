import { convertSingleCharToDoubleChar } from "@/commons/util.js";
import { getDateString } from "@/commons/ui-util.js";
import { getDirNameByOrgOption } from "@/commons/storage.js";
import urls from "@/constants/url.js";

/*
  문제가 맞았다면 문제 관련 데이터를 파싱하는 함수의 모음입니다.
  모든 해당 파일의 모든 함수는 parseData()를 통해 호출됩니다.
*/

/*
  bojData를 초기화하는 함수로 문제 요약과 코드를 파싱합니다.
  - directory : 레포에 기록될 폴더명
  - message : 커밋 메시지
  - fileName : 파일명
  - readme : README.md에 작성할 내용
  - code : 소스코드 내용
*/
export async function makeData(origin) {
  const { problemDescription, problemId, level, resultMessage, division, languageExtension, title, runtime, memory, code, language, link } = origin;

  // 기본 디렉토리 경로 생성
  const baseDirPath = `프로그래머스/${level}/${problemId}. ${convertSingleCharToDoubleChar(title)}`;

  // 공통 업로드 서비스를 사용하여 디렉토리 경로 생성
  const directory = await getDirNameByOrgOption(baseDirPath, language, {
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

  // prettier-ignore
  const readme = `# [${levelWithLv}] ${title} - ${problemId} \n\n`
    + `[문제 링크](${link}) 

`
    + `### 성능 요약\n\n`
    + `메모리: ${memory}, `
    + `시간: ${runtime}\n\n`
    + `### 구분\n\n`
    + `${division.replace('/', ' > ')}\n\n`
    + `### 채점결과\n\n`
    + `${resultMessage}\n\n`
    + `### 제출 일자\n\n`
    + `${dateInfo}\n\n`
    + `### 문제 설명\n\n`
    + `${problemDescription}\n\n`
    + `> 출처: 프로그래머스 코딩 테스트 연습, https://school.programmers.co.kr/learn/challenges`;

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
 * @typedef MakeDataReturnType
 * @prop {number} examSequence 시험 sequence
 * @prop {number} quizNumber 퀴즈 number
 * @prop {string} directory 레포에 기록될 폴더명
 * @prop {string} message 커밋 메시지
 * @prop {string} fileName 파일명
 * @prop {string} readme README.md에 작성할 내용
 * @prop {string} code 소스코드 내용
 */

/**
 *
 * @returns {ReturnType<makeData>}
 */
export async function parseData() {
  const link = document.querySelector("head > meta[name$=url]").content.replace(/\?.*/g, "").trim();
  const problemId = document.querySelector("div.main > div.lesson-content").getAttribute("data-lesson-id");
  const level = document.querySelector("body > div.main > div.lesson-content").getAttribute("data-challenge-level");
  const division = [...document.querySelector("ol.breadcrumb").childNodes]
    .filter((x) => x.className !== "active")
    .map((x) => x.innerText)
    // .filter((x) => !x.includes('코딩테스트'))
    .map((x) => convertSingleCharToDoubleChar(x))
    .reduce((a, b) => `${a}/${b}`);
  const title = document.querySelector(".algorithm-title .challenge-title").textContent.replace(/\\n/g, "").trim();
  const problemDescription = document.querySelector("div.guide-section-description > div.markdown").innerHTML;
  const languageExtension = document.querySelector("div.editor > ul > li.nav-item > a").innerText.split(".")[1];
  const code = document.querySelector("textarea#code").value;
  const resultMessage =
    [...document.querySelectorAll("#output .console-message")]
      .map((node) => node.textContent)
      .filter((text) => text.includes(":"))
      .reduce((cur, next) => (cur ? `${cur}<br/>${next}` : next), "") || "Empty";
  const [runtime, memory] = [...document.querySelectorAll("td.result.passed")]
    .map((x) => x.innerText)
    .map((x) => x.replace(/[^., 0-9a-zA-Z]/g, "").trim())
    .map((x) => x.split(", "))
    .reduce((x, y) => (Number(x[0].slice(0, -2)) > Number(y[0].slice(0, -2)) ? x : y), ["0.00ms", "0.0MB"])
    .map((x) => x.replace(/(?<=[0-9])(?=[A-Za-z])/, " "));

  /* 프로그래밍 언어별 폴더 정리 옵션을 위한 언어 값 가져오기 */
  const language = document.querySelector("div#tour7 > button").textContent.trim();

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
