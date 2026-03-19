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
function reconstructFillBlankCode(node) {
  let result = '';
  for (const child of node.childNodes) {
    if (child.tagName === 'INPUT') {
      result += child.value;
    } else if (child.childNodes && child.childNodes.length > 0) {
      result += reconstructFillBlankCode(child);
    } else {
      result += child.textContent;
    }
  }
  return result;
}

async function parseData() {
  const link = document.querySelector('head > meta[name$=url]').content.replace(/\?.*/g, '').trim();
  const lessonEl = document.querySelector('.lesson-content') || document.querySelector('[data-lesson-id]');
  const problemId = lessonEl.getAttribute('data-lesson-id');
  const level = lessonEl.getAttribute('data-challenge-level');
  const division = [...document.querySelector('ol.breadcrumb').childNodes]
    .filter((x) => x.className !== 'active')
    .map((x) => x.innerText)
    // .filter((x) => !x.includes('코딩테스트'))
    .map((x) => convertSingleCharToDoubleChar(x))
    .reduce((a, b) => `${a}/${b}`);
  const title = document.querySelector('.algorithm-title .challenge-title').textContent.replace(/\\n/g, '').trim();
  const problem_description = document.querySelector('div.guide-section-description > div.markdown').innerHTML;
  const language_extension = document.querySelector('div.editor > ul > li.nav-item > a').innerText.split('.')[1];
  const codeTextarea = document.querySelector('textarea#code');
  const codeMirrorEl = document.querySelector('.CodeMirror');
  const fillBlankInputs = document.querySelectorAll('input[name^="input_code"]');
  let code;
  if (codeMirrorEl && codeMirrorEl.CodeMirror) {
    code = codeMirrorEl.CodeMirror.getValue();
  } else if (codeTextarea) {
    code = codeTextarea.value;
  } else if (fillBlankInputs.length > 0) {
    const pre = fillBlankInputs[0].closest('pre');
    code = reconstructFillBlankCode(pre);
  } else {
    code = '';
  }
  const result_message =
    [...document.querySelectorAll('#output .console-message')]
      .map((node) => node.textContent)
      .filter((text) => text.includes(':'))
      .reduce((cur, next) => (cur ? `${cur}<br/>${next}` : next), '') || 'Empty';
  const [runtime, memory] = [...document.querySelectorAll('td.result.passed')]
    .map((x) => x.innerText)
    .map((x) => x.replace(/[^., 0-9a-zA-Z]/g, '').trim())
    .map((x) => x.split(', '))
    .reduce((x, y) => (Number(x[0].slice(0, -2)) > Number(y[0].slice(0, -2)) ? x : y), ['0.00ms', '0.0MB'])
    .map((x) => x.replace(/(?<=[0-9])(?=[A-Za-z])/, ' '));

  /*프로그래밍 언어별 폴더 정리 옵션을 위한 언어 값 가져오기*/
  const language = document.querySelector('div#tour7 > button').textContent.trim();

  return makeData({ link, problemId, level, title, problem_description, division, language_extension, code, result_message, runtime, memory, language });
}

async function makeData(origin) {
  const { problem_description, problemId, level, result_message, division, language_extension, title, runtime, memory, code, language } = origin;
  const directory = await buildDirectory('programmers', {
    platform: '프로그래머스',
    level,
    id: problemId,
    title: convertSingleCharToDoubleChar(title),
    language,
    _defaultDir: `프로그래머스/${level}/${problemId}. ${convertSingleCharToDoubleChar(title)}`,
  });
  const levelWithLv = `${level}`.includes('lv') ? level : `lv${level}`.replace('lv', 'level ');
  const message = `[${levelWithLv}] Title: ${title}, Time: ${runtime}, Memory: ${memory} -BaekjoonHub`;
  const fileName = `${convertSingleCharToDoubleChar(title)}.${language_extension}`;
  const dateInfo = getDateString(new Date(Date.now()));
  // prettier-ignore
  const readme =
    `# [${levelWithLv}] ${title} - ${problemId} \n\n`
    + `[문제 링크](${link}) \n\n`
    + `### 성능 요약\n\n`
    + `메모리: ${memory}, `
    + `시간: ${runtime}\n\n`
    + `### 구분\n\n`
    + `${division.replace('/', ' > ')}\n\n`
    + `### 채점결과\n\n`
    + `${result_message}\n\n`
    + `### 제출 일자\n\n`
    + `${dateInfo}\n\n`
    + `### 문제 설명\n\n`
    + `${problem_description}\n\n`
    + `> 출처: 프로그래머스 코딩 테스트 연습, https://school.programmers.co.kr/learn/challenges`;
  return { problemId, directory, message, fileName, readme, code };
}

/**
 * stats에서 이미 업로드된 프로그래머스 문제 ID를 추출합니다.
 */
function extractUploadedProblemIdsForProgrammers(stats, hook) {
  const uploadedIds = new Set();
  if (isNull(stats) || isNull(stats.submission) || isNull(hook)) return uploadedIds;

  const parts = hook.split('/');
  if (parts.length < 2) return uploadedIds;
  const owner = parts[0];
  const repo = parts[1];

  const ownerObj = stats.submission[owner];
  if (isNull(ownerObj)) return uploadedIds;
  const repoObj = ownerObj[repo];
  if (isNull(repoObj)) return uploadedIds;

  function extractFromNode(node) {
    if (isNull(node)) return;
    for (const key of Object.keys(node)) {
      const match = key.match(/^(\d+)/);
      if (match) {
        uploadedIds.add(match[1]);
      }
    }
  }

  // 직접 모드: submission[owner][repo]["프로그래머스"]["12345.제목"]
  if (!isNull(repoObj['프로그래머스'])) {
    extractFromNode(repoObj['프로그래머스']);
  }

  // language 모드: submission[owner][repo][lang]["프로그래머스"]["12345.제목"]
  for (const key of Object.keys(repoObj)) {
    if (key === '프로그래머스') continue;
    const langNode = repoObj[key];
    if (!isNull(langNode) && typeof langNode === 'object' && !isNull(langNode['프로그래머스'])) {
      extractFromNode(langNode['프로그래머스']);
    }
  }

  return uploadedIds;
}

/**
 * 프로그래머스 풀이 목록 페이지에서 모든 풀이 완료된 문제를 파싱합니다.
 */
async function findAllSolvedProblems() {
  const problems = [];
  let page = 1;
  while (true) {
    const res = await fetch(`/api/v2/school/challenges/?perPage=100&statuses[]=solved&order=acceptance_desc&search=&page=${page}`);
    if (!res.ok) break;
    const data = await res.json();
    if (!data.result || data.result.length === 0) break;
    for (const item of data.result) {
      problems.push({
        problemId: String(item.id),
        title: item.title,
        level: `lv${item.level}`,
      });
    }
    if (page >= data.totalPages) break;
    page++;
  }
  return problems;
}

/**
 * 개별 문제 페이지에서 코드와 메타데이터를 가져옵니다.
 */
async function fetchProblemCodeAndData(problemInfo) {
  const { problemId, title, level } = problemInfo;
  try {
    const res = await fetch(`/learn/courses/30/lessons/${problemId}`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Extract code from textarea#code
    const codeEl = doc.querySelector('textarea#code');
    const code = codeEl ? codeEl.value : '';
    if (!code) return null;

    // Extract language extension from editor tab
    const langTab = doc.querySelector('div.editor ul li.nav-item a, .editor .nav-item a');
    const language_extension = langTab ? langTab.textContent.trim().split('.').pop() : 'txt';

    // Extract problem description
    const descEl = doc.querySelector('div.guide-section-description > div.markdown');
    const problem_description = descEl ? descEl.innerHTML : '';

    // Extract division from breadcrumb
    const breadcrumb = doc.querySelector('ol.breadcrumb');
    const division = breadcrumb
      ? [...breadcrumb.querySelectorAll('li')]
          .filter((x) => !x.classList.contains('active'))
          .map((x) => x.textContent.trim())
          .map((x) => convertSingleCharToDoubleChar(x))
          .filter((x) => x)
          .join('/')
      : '코딩테스트 연습';

    // Extract language name for org option
    const langBtnEl = doc.querySelector('div#tour7 > button, .language-select button');
    const language = langBtnEl ? langBtnEl.textContent.trim() : language_extension;

    const link = `https://school.programmers.co.kr/learn/courses/30/lessons/${problemId}`;

    return await makeDataForBulkUpload({ link, problemId, level, title, problem_description, division, language_extension, code, language });
  } catch (e) {
    console.error(`Failed to fetch problem ${problemId}:`, e);
    return null;
  }
}

/**
 * 일괄 업로드용 데이터를 생성합니다.
 */
async function makeDataForBulkUpload(origin) {
  const { problem_description, problemId, level, division, language_extension, title, code, language, link } = origin;
  const directory = await buildDirectory('programmers', {
    platform: '프로그래머스',
    level,
    id: problemId,
    title: convertSingleCharToDoubleChar(title),
    language,
    _defaultDir: `프로그래머스/${level}/${problemId}. ${convertSingleCharToDoubleChar(title)}`,
  });
  const levelWithLv = `${level}`.includes('lv') ? level : `lv${level}`.replace('lv', 'level ');
  const message = `[${levelWithLv}] Title: ${title} -BaekjoonHub`;
  const fileName = `${convertSingleCharToDoubleChar(title)}.${language_extension}`;
  const dateInfo = getDateString(new Date(Date.now()));
  const readme =
    `# [${levelWithLv}] ${title} - ${problemId} \n\n`
    + `[문제 링크](${link}) \n\n`
    + `### 구분\n\n`
    + `${division.replace('/', ' > ')}\n\n`
    + `### 제출 일자\n\n`
    + `${dateInfo}\n\n`
    + `### 문제 설명\n\n`
    + `${problem_description}\n\n`
    + `> 출처: 프로그래머스 코딩 테스트 연습, https://school.programmers.co.kr/learn/challenges`;
  return { problemId, directory, message, fileName, readme, code };
}
