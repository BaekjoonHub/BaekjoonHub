/**
  /main/code/problem/problemDetail.do 에 접근하였을 때에 문제id, 난이도 정보를 저장하기 위해 사용합니다.
*/
async function parseLevel() {
  const level = document.querySelector('div.problem_box > p.problem_title > span.badge').textContent;
  const problemId = document.querySelector('body > div.container > div.container.sub > div > div.problem_box > p').innerText.split('.')[0].trim();
  const contestProblemId = document.querySelector('#contestProbId').value;

  // Only contentProbId, categoryId, categoryType key information is left in the query list of url.
  const query = new URLSearchParams(window.location.search);
  let link = window.location.href.split('?')[0] + '?';
  let queryString = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const key of ['contestProbId', 'categoryId', 'categoryType']) {
    if (query.has(key)) {
      queryString.add(`${key}=${query.get(key)}`);
    }
  }
  link += queryString.join('&');
  await updateProblemData(problemId, { level, contestProblemId, link });
}

/**
  /main/code/problem/problemSolver.do 에 접근하였을 때에 사용합니다.
  기존 저장해둔 데이터의 검증과 함께 메모리, 실행시간, 사용언어가 파싱되고, 최종 제출 됩니다. 
  (가장 마지막에 제출된 결과가 제출됩니다)
*/
async function parseSolver() {}
/*
  bojData를 초기화하는 함수로 문제 요약과 코드를 파싱합니다.
  - directory : 레포에 기록될 폴더명
  - message : 커밋 메시지
  - fileName : 파일명
  - readme : README.md에 작성할 내용
  - code : 소스코드 내용
*/
async function parseData() {
  const link = document.querySelector('head > meta[name$=url]').content;
  const problemId = document.querySelector('div.main > div.lesson-content').getAttribute('data-lesson-id');
  const level = levels[problemId] || 'unrated';
  const division = [...document.querySelector('ol.breadcrumb').childNodes]
    .filter((x) => x.className !== 'active')
    .map((x) => x.innerText)
    // .filter((x) => !x.includes('코딩테스트'))
    .map((x) => convertSingleCharToDoubleChar(x))
    .reduce((a, b) => `${a}/${b}`);
  const title = document.querySelector('#tab > li.algorithm-title').textContent.replace(/\\n/g, '').trim();
  const problem_description = document.querySelector('div.guide-section-description > div.markdown').innerHTML;
  const language_extension = document.querySelector('div.editor > ul > li.nav-item > a').getAttribute('data-language');
  const code = document.querySelector('textarea#code').value;
  const result_message =
    [...document.querySelectorAll('#output > pre.console-content > div.console-message')]
      .map((x) => x.innerText)
      .filter((x) => x.includes(': '))
      .reduce((x, y) => `${x}<br/>${y}`, '') || 'Empty';
  const [runtime, memory] = [...document.querySelectorAll('td.result.passed')]
    .map((x) => x.innerText)
    .map((x) => x.replace(/[^., 0-9a-zA-Z]/g, '').trim())
    .map((x) => x.split(', '))
    .reduce((x, y) => (Number(x[0]) > Number(y[0]) ? x : y), ['0.00ms', '0.0MB'])
    .map((x) => x.replace(/(?<=[0-9])(?=[A-Za-z])/, ' '));

  return makeData({ link, problemId, level, title, problem_description, division, language_extension, code, result_message, runtime, memory });
}

async function makeData(origin) {
  const { problem_description, problemId, level, result_message, division, language_extension, title, runtime, memory, code } = origin;
  const directory = `프로그래머스/${level}/${problemId}. ${convertSingleCharToDoubleChar(title)}`;
  const message = `[${level.replace('lv', 'level ')}] Title: ${title}, Time: ${runtime}, Memory: ${memory} -BaekjoonHub`;
  const fileName = `${convertSingleCharToDoubleChar(title)}.${language_extension}`;
  // prettier-ignore
  const readme =
    `# [${level.replace('lv', 'level ')}] ${title} - ${problemId} \n\n`
    + `[문제 링크](${link}) \n\n`
    + `### 성능 요약\n\n`
    + `메모리: ${memory}, `
    + `시간: ${runtime}\n\n`
    + `### 구분\n\n`
    + `${division.replace('/', ' > ')}\n\n`
    + `### 채점결과\n\n`
    + `${result_message}\n\n`
    + `### 문제 설명\n\n`
    + `${problem_description}\n\n`
    + `> 출처: 프로그래머스 코딩 테스트 연습, https://programmers.co.kr/learn/challenges`;
  return { problemId, directory, message, fileName, readme, code };
}
