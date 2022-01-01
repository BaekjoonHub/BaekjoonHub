// Parse all BOJ Data
function findData() {
  // language, submisssionId, problemId, memory, runtime
  findFromResultTable();
  // problemDescription
  findWithPromise();

  console.log(bojData);
}

function findFromResultTable() {
  const submissionEle = document.getElementById('status-table').childNodes[1].childNodes[0];
  bojData.submission.memory = submissionEle.childNodes[4].innerText;
  bojData.submission.runtime = submissionEle.childNodes[5].innerText;
  bojData.meta.language = submissionEle.childNodes[6].childNodes[0].innerHTML;
  findSubmissionId();
  findProblemId();
}

function findWithPromise() {
  if (debug) console.log('in find with promise');
  if (checkElem(bojData.meta.problemId) && checkElem(bojData.submission.submissionId)) {
    const DescriptionParse = fetch(`https://www.acmicpc.net/problem/${bojData.meta.problemId}`, { method: 'GET' });
    const CodeParse = fetch(`https://www.acmicpc.net/source/download/${bojData.submission.submissionId}`, { method: 'GET' });
    const SolvedAPI = fetch(`https://solved.ac/api/v3/problem/show?problemId=${bojData.meta.problemId}`, { method: 'GET' });
    Promise.all([DescriptionParse, CodeParse, SolvedAPI])
      .then(([despResponse, codeResponse, solvedResponse]) => Promise.all([despResponse.text(), codeResponse.text(), solvedResponse.json()]))
      .then(([descriptionText, codeText, solvedJson]) => {
        /* Get Question Description */
        let questionDescription = '';
        const parser = new DOMParser();
        const doc = parser.parseFromString(descriptionText, 'text/html');
        if (doc != null) {
          // eslint-disable-next-line prettier/prettier
          questionDescription = `### 문제 설명\n\n${unescapeHtml(doc.getElementById('problem_description').innerHTML.trim())}\n\n`
                              + `### 입력 \n\n ${unescapeHtml(doc.getElementById('problem_input').innerHTML.trim())}\n\n`
                              + `### 출력 \n\n ${unescapeHtml(doc.getElementById('problem_output').innerHTML.trim())}\n\n`;
        }
        bojData.meta.problemDescription = questionDescription;
        if (debug) console.log('findWithPromise - description', questionDescription);
        /* Get Code */
        bojData.submission.code = codeText;
        if (debug) console.log('findWithPromise - code', codeText);
        /* Get Solved Response */
        bojData.meta.title = solvedJson.titleKo.replace(/\s+/g, '-');
        bojData.meta.level = bj_level[solvedJson.level];
        bojData.meta.directory = `백준/${bojData.meta.level.replace(/ .*/, '')}/${bojData.meta.problemId}.${bojData.meta.title.replace(/\s+/g, '-').replace(titleRegex, '')}`;
        bojData.meta.message = `[${bojData.meta.level}] Title: ${bojData.meta.title}, Time: ${bojData.submission.runtime} ms, Memory: ${bojData.submission.memory} KB -BaekjoonHub`;
        let str = '';
        solvedJson.tags.forEach((tag) => (str += `${categories[tag.key]}(${tag.key}), `));
        if (debug) console.log(str.length);
        const { length } = str;
        bojData.meta.category = str.substring(0, length - 2);
        if (debug) console.log('findWithPromise - leveldoc', solvedJson);
        /* Create Readme */
        bojData.meta.fileName = bojData.meta.title + languages[bojData.meta.language];
        // eslint-disable-next-line prettier/prettier
        bojData.meta.readme = `# [${bojData.meta.level}] ${bojData.meta.title} - ${bojData.meta.problemId} \n\n` 
                            + `[문제 링크](https://www.acmicpc.net/problem/${bojData.meta.problemId}) \n\n`
                            + `### 성능 요약\n\n`
                            + `메모리: ${bojData.submission.memory} KB, `
                            + `시간: ${bojData.submission.runtime} ms\n\n`
                            + `### 분류\n\n`
                            + `${bojData.meta.category}\n\n`
                            + `${bojData.meta.problemDescription}\n\n`;

        if (debug) console.log('findData', bojData);
        beginUpload();
      })
      .catch((err) => {
        console.log('error ocurred: ', err);
        uploadState.uploading = false;
        markUploadFailed();
      });
  }
}

// function findSolvedAPI() {
//   const levelxhttp = new XMLHttpRequest();
//   levelxhttp.onreadystatechange = function () {
//     if (this.readyState === 4 && this.status === 200) {
//       /* received submission details as html reponse. */
//       const leveldoc = JSON.parse(this.response);
//       bojData.meta.title = `${leveldoc.titleKo}`;
//       bojData.meta.level = bj_level[leveldoc.level];
//       bojData.meta.directory = `백준/${bojData.meta.level.replace(/ .*/, '')}/${bojData.meta.problemId}.${bojData.meta.title.replace(/\s+/g, '-').replace(titleRegex, '')}`;
//       bojData.meta.message = `[${bojData.meta.level}] Title: ${bojData.meta.title}, Time: ${bojData.submission.runtime} ms, Memory: ${bojData.submission.memory} KB -BaekjoonHub`;
//       let string = '';
//       leveldoc.tags.forEach((tag) => (string += `${categories[tag.key]}(${tag.key}), `));
//       console.log(string.length);
//       const { length } = string;
//       bojData.meta.category = string.substring(0, length - 2);
//       if (debug) console.log(leveldoc);
//     }
//   };
//   levelxhttp.open('GET', `https://solved.ac/api/v3/problem/show?problemId=${bojData.meta.problemId}`, false);
//   levelxhttp.send();
// }
// Get Submission Number
function findSubmissionId() {
  const problemElem = document.getElementById('status-table').childNodes[1].childNodes[0].childNodes[0];
  bojData.submission.submissionId = problemElem.innerText;
}

function findProblemId() {
  const problemElem = document.getElementById('status-table').childNodes[1].childNodes[0].childNodes[2];

  if (debug) console.log('getProblemId: ');
  if (debug) console.log(problemElem);
  let resultId = '';
  for (let i = 0; i <= problemElem.childElementCount; i++) {
    const temp_name = problemElem.childNodes[i].innerHTML;
    if (temp_name == null || temp_name == 'undefined' || temp_name == undefined) continue;
    if (temp_name.length > resultId.length) {
      if (debug) console.log(`adding: ${temp_name}`);
      resultId = temp_name;
    }
  }
  if (debug) console.log(resultId);
  bojData.meta.problemId = resultId;
}

/* Since we dont yet have callbacks/promises that helps to find out if things went bad */
/* we will start 10 seconds counter and even after that upload is not complete, then we conclude its failed */
function startUploadCountDown() {
  uploadState.uploading = true;
  uploadState.countdown = setTimeout(() => {
    if (uploadState.uploading === true) {
      // still uploading, then it failed
      uploadState.uploading = false;
      markUploadFailed();
    }
  }, 10000);
}
