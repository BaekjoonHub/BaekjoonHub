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

  if (debug) console.log('사용자 로그인 정보 및 유무 체크', nickname, document.querySelector('#problemForm div.info'));
  // 검색하는 유저 정보와 로그인한 유저의 닉네임이 같은지 체크
  // PASS를 맞은 기록 유무 체크
  if (getNickname() !== nickname) return;
  if (isNull(document.querySelector('#problemForm div.info'))) return;

  if (debug) console.log('결과 데이터 파싱 시작');

  const title = document
    .querySelector('div.problem_box > p.problem_title')
    .innerText.replace(/ D[0-9]$/, '')
    .replace(/^[^.]*/, '')
    .substr(1)
    .trim();
  // 레벨
  const level = document.querySelector('div.problem_box > p.problem_title > span.badge')?.textContent || 'Unrated';
  // 문제번호
  const problemId = document.querySelector('body > div.container > div.container.sub > div > div.problem_box > p').innerText.split('.')[0].trim();
  // 문제 콘테스트 인덱스
  const contestProbId = [...document.querySelectorAll('#contestProbId')].slice(-1)[0].value;
  // 문제 링크
  const link = `${window.location.origin}/main/code/problem/problemDetail.do?contestProbId=${contestProbId}`;

  // 문제 언어, 메모리, 시간소요
  const language = document.querySelector('#problemForm div.info > ul > li:nth-child(1) > span:nth-child(1)').textContent.trim();
  const memory = document.querySelector('#problemForm div.info > ul > li:nth-child(2) > span:nth-child(1)').textContent.trim().toUpperCase();
  const runtime = document.querySelector('#problemForm div.info > ul > li:nth-child(3) > span:nth-child(1)').textContent.trim();
  const length = document.querySelector('#problemForm div.info > ul > li:nth-child(4) > span:nth-child(1)').textContent.trim();

  // 확장자명
  const extension = languages[language.toLowerCase()];

  // 로컬스토리지에서 기존 코드에 대한 정보를 불러올 수 없다면 코드 디테일 창으로 이동 후 제출하도록 이동
  const data = await getProblemData(problemId);
  if (debug) console.log('data', data);
  if (isNull(data?.code)) {
    // 기존 문제 데이터를 로컬스토리지에 저장하고 코드 보기 페이지로 이동
    // await updateProblemData(problemId, { level, contestProbId, link, language, memory, runtime, length, extension });
    // const contestHistoryId = document.querySelector('div.box-list > div > div > span > a').href.replace(/^.*'(.*)'.*$/, '$1');
    // window.location.href = `${window.location.origin}/main/solvingProblem/solvingProblem.do?contestProbId=${contestProbId}`;
    console.error('소스코드 데이터가 없습니다.');
    return;
  }
  const code = data.code;
  if (debug) console.log('파싱 완료');
  // eslint-disable-next-line consistent-return
  return makeData({ link, problemId, level, title, extension, code, runtime, memory, length });
}

async function makeData(origin) {
  const { link, problemId, level, extension, title, runtime, memory, code, length } = origin;
  const directory = `SWEA/${level}/${problemId}. ${convertSingleCharToDoubleChar(title)}`;
  const message = `[${level}] Title: ${title}, Time: ${runtime}, Memory: ${memory} -BaekjoonHub`;
  const fileName = `${convertSingleCharToDoubleChar(title)}.${extension}`;
  // prettier-ignore
  const readme =
    `# [${level}] ${title} - ${problemId} \n\n`
    + `[문제 링크](${link}) \n\n`
    + `### 성능 요약\n\n`
    + `메모리: ${memory}, `
    + `시간: ${runtime}, `
    + `코드길이: ${length} Bytes\n\n`
    + `\n\n`
    + `> 출처: SW Expert Academy, https://swexpertacademy.com/main/code/problem/problemList.do`;
  return { problemId, directory, message, fileName, readme, code };
}
