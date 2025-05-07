/**
 * 문제를 정상적으로 풀면 제출한 소스코드를 파싱하고, 로컬스토리지에 저장하는 함수입니다.
 */
async function parseCode() {
  const problemId = document.querySelector('div.problem_box > h3').innerText.replace(/\..*$/, '').trim();
  const contestProbId = [...document.querySelectorAll('#contestProbId')].slice(-1)[0].value;
  updateTextSourceEvent();
  const code = document.querySelector('#textSource').value;
  await updateProblemData(problemId, { code, contestProbId });
  return { problemId, contestProbId };
}

/*
  cEditor 소스코드의 정보를 textSource에 저장하도록 하는 함수 입니다. 
*/
function updateTextSourceEvent() {
  document.documentElement.setAttribute('onreset', 'cEditor.save();');
  document.documentElement.dispatchEvent(new CustomEvent('reset'));
  document.documentElement.removeAttribute('onreset');
}

/*
  문제 요약과 코드를 파싱합니다.
  - directory : 레포에 기록될 폴더명
  - message : 커밋 메시지
  - fileName : 파일명
  - readme : README.md에 작성할 내용
  - code : 소스코드 내용
*/
async function parseData() {
  const nickname = document.querySelector('#searchinput').value;

  log('사용자 로그인 정보 및 유무 체크', nickname, document.querySelector('#problemForm div.info'));
  if (getNickname() !== nickname) return;
  if (isNull(document.querySelector('#problemForm div.info'))) return;

  log('결과 데이터 파싱 시작');

  const title = document
    .querySelector('div.problem_box > p.problem_title')
    .innerText.replace(/ D[0-9]$/, '')
    .replace(/^[^.]*/, '')
    .substr(1)
    .trim();
  const level = document.querySelector('div.problem_box > p.problem_title > span.badge')?.textContent || 'Unrated';
  const problemId = document.querySelector('body > div.container > div.container.sub > div > div.problem_box > p').innerText.split('.')[0].trim();
  const contestProbId = [...document.querySelectorAll('#contestProbId')].slice(-1)[0].value;
  const link = `${window.location.origin}/main/code/problem/problemDetail.do?contestProbId=${contestProbId}`;

  const language = document.querySelector('#problemForm div.info > ul > li:nth-child(1) > span:nth-child(1)').textContent.trim();
  const memory = document.querySelector('#problemForm div.info > ul > li:nth-child(2) > span:nth-child(1)').textContent.trim().toUpperCase();
  const runtime = document.querySelector('#problemForm div.info > ul > li:nth-child(3) > span:nth-child(1)').textContent.trim();
  const length = document.querySelector('#problemForm div.info > ul > li:nth-child(4) > span:nth-child(1)').textContent.trim();

  const extension = languages[language.toLowerCase()];
  const submissionTime = document.querySelector('.smt_txt > dd').textContent.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g)[0];
  
  const data = await getProblemData(problemId);
  log('data', data);
  if (isNull(data?.code)) {
    console.error('소스코드 데이터가 없습니다.');
    return;
  }
  const code = data.code;
  log('파싱 완료');

  const result = await makeData({ link, problemId, level, title, extension, code, runtime, memory, length, submissionTime, language });
  await fetchAICodeReview(result);
  return result;
}

async function makeData(origin) {
  const { link, problemId, level, extension, title, runtime, memory, code, length, submissionTime, language } = origin;
  /*
  * SWEA의 경우에는 JAVA 같이 모두 대문자인 경우가 존재합니다. 하지만 타 플랫폼들(백준, 프로그래머스)는 첫문자가 모두 대문자로 시작합니다.
  * 그래서 이와 같은 케이스를 처리를 위해 첫문자만 대문자를 유지하고 나머지 문자는 소문자로 변환합니다.
  * C++ 같은 경우에는 문자가 그대로 유지됩니다.
  * */
  const lang = (language === language.toUpperCase()) ? language.substring(0, 1) + language.substring(1).toLowerCase() : language
  const directory = await getDirNameByOrgOption(`SWEA/${level}/${problemId}. ${convertSingleCharToDoubleChar(title)}`, lang);
  const message = `[${level}] Title: ${title}, Time: ${runtime}, Memory: ${memory} -BaekjoonHub`;
  const fileName = `${convertSingleCharToDoubleChar(title)}.${extension}`;
  const dateInfo = submissionTime ?? getDateString(new Date(Date.now()));
  // prettier-ignore
  const readme =
    `# [${level}] ${title} - ${problemId} \n\n`
    + `[문제 링크](${link}) \n\n`
    + `### 성능 요약\n\n`
    + `메모리: ${memory}, `
    + `시간: ${runtime}, `
    + `코드길이: ${length} Bytes\n\n`
    + `### 제출 일자\n\n`
    + `${dateInfo}\n\n`
    + `\n\n`
    + `> 출처: SW Expert Academy, https://swexpertacademy.com/main/code/problem/problemList.do`;
  return { problemId, directory, message, fileName, readme, code };
}
