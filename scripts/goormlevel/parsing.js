/** NOTE
 * 문제가 맞았다면 문제 관련 데이터를 파싱하는 함수의 모음입니다.
 * 모든 해당 파일의 모든 함수는 parseData()를 통해 호출됩니다.
 */

/**
 *
 * @returns {ReturnType<makeData>}
 */
async function parseData() {
  const { href: link, pathname } = window.location;

  const pathnameList = pathname.split('/');

  const examSequence = Number(pathnameList[2]) || 0;
  const quizNumber = Number(pathnameList[5]) || 0;
  const difficulty = document.querySelectorAll('#ratingTooltipTarget > div > label').length;

  const titlePrefix = 'title-';
  const title = document.querySelector(`div[aria-label^="${titlePrefix}"]`).ariaLabel.replace(titlePrefix, '');

  /*프로그래밍 언어별 폴더 정리 옵션을 위한 언어 값 가져오기*/
  const currentLanguage = document.querySelector('.Tour__selectLang button').textContent.trim();

  const languageList = [...document.querySelectorAll('#FrameBody .Tour__selectLang div[role="menu"] button[role="menuitem"]')].map(($element) => $element.textContent);
  const currentLanguageIndex = languageList.findIndex((language) => currentLanguage === language);
  const code = [...document.querySelectorAll('#fileEditor textarea[readonly]')].map(($element) => $element.value)[currentLanguageIndex] || '';

  const $dataList = [...document.querySelectorAll('.tab-content .tab-pane.active table tbody tr')].filter(($element) => $element.childNodes[1].textContent === 'PASS');
  const { memory, runtime } = $dataList
    .map(($element) => {
      const memory = Number($element.childNodes[5].textContent.trim());
      const runtime = Number($element.childNodes[6].textContent.trim());
      return { memory, runtime };
    })
    .reduce(
      (acc, cur, index) => {
        if (index === $dataList.length - 1) {
          return {
            memory: `${((acc.memory + cur.memory) / $dataList.length / 1024).toFixed(2)} MB`,
            runtime: `${((acc.runtime + cur.runtime) / $dataList.length).toFixed(2)} ms`,
          };
        }
        return {
          memory: acc.memory + cur.memory,
          runtime: acc.runtime + cur.runtime,
        };
      },
      { memory: 0, runtime: 0 },
    );

  return makeData({
    // 문제 링크
    link,
    // 시험 uid
    examSequence,
    // 시험 uid와 연계된 퀴즈 uid
    quizNumber,
    // 난이도
    difficulty,
    // 제목
    title,
    // 프로그래밍 언어
    language: currentLanguage || '',
    // 코드
    code,
    // 평균 메모리 사용량
    memory,
    // 평균 실행 시간
    runtime,
  });
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
 * @returns {MakeDataReturnType}
 */
async function makeData({
  // 문제 링크
  link,
  // 시험 uid
  examSequence,
  // 시험 uid와 연계된 퀴즈 uid
  quizNumber,
  // 난이도
  difficulty,
  // 제목
  title,
  // 프로그래밍 언어
  language,
  // 코드
  code,
  // 평균 메모리 사용량
  memory,
  // 평균 실행 시간
  runtime,
}) {
  const languageExtension = languages[language.toLowerCase()];
  const directory = await getDirNameByOrgOption(`goormlevel/${examSequence}/${quizNumber}. ${convertSingleCharToDoubleChar(title)}`, language);
  const message = `[goormlevel] Title: ${title}, Time: ${runtime}, Memory: ${memory}, Difficulty: ${difficulty} -BaekjoonHub`;
  const fileName = `${convertSingleCharToDoubleChar(title)}.${languageExtension}`;
  const dateInfo = getDateString(new Date(Date.now()));
  // prettier-ignore
  const readme =
    `# ${title} - ${examSequence}/${quizNumber} \n\n`
    + `[문제 링크](${link}) \n\n`
    + `### 성능 요약\n\n`
    + `메모리: ${memory}, `
    + `시간: ${runtime}\n\n`
    + `### 제출 일자\n\n`
    + `${dateInfo}\n\n`

  return { examSequence, quizNumber, directory, message, fileName, readme, code };
}
