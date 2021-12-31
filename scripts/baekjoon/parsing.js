// Parse all BOJ Data
function findData() {
  // language, submisssionId, problemId, memory, runtime
  findFromResultTable();
  // problemDescription
  findProblemDescription();
  // code, message, title, difficulty
  findCode();
  bojData.meta.fileName = `${bojData.meta.title.replace(/\s+/g, '-').replace(titleRegex, '')}${languages[bojData.meta.language]}`;
  bojData.meta.readme += `# [${bojData.meta.level}] ${bojData.meta.title} - ${bojData.meta.problemId} \n\n`;
  bojData.meta.readme += `[문제 링크](https://www.acmicpc.net/problem/${bojData.meta.problemId}) \n\n`;
  bojData.meta.readme += '### 성능 요약\n\n';
  bojData.meta.readme += `메모리: ${bojData.submission.memory} KB, `;
  bojData.meta.readme += `시간: ${bojData.submission.runtime} ms\n\n`;
  bojData.meta.readme += `### 분류\n\n`;
  bojData.meta.readme += `${bojData.meta.category}\n\n`;
  bojData.meta.readme += `${bojData.meta.problemDescription}\n\n`;

  console.log(bojData);
}

function findFromResultTable() {
  bojData.submission.memory = document.getElementById('status-table').childNodes[1].childNodes[0].childNodes[4].innerText;
  bojData.submission.runtime = document.getElementById('status-table').childNodes[1].childNodes[0].childNodes[5].innerText;
  bojData.meta.language = document.getElementById('status-table').childNodes[1].childNodes[0].childNodes[6].childNodes[0].innerHTML;
  findSubmissionId();
  findProblemId();
  findSolvedAPI();
}

/* Function for finding and parsing the full code. */
/* - At first find the submission details url. */
/* - Then send a request for the details page. */
/* - Finally, parse the code from the html reponse. */
/* - Also call the callback if available when upload is success */
function findCode() {
  /* Get the submission details url from the submission page. */
  let submissionURL = '';
  // const e = document.getElementsByClassName('status-column__3SUg');
  if (checkElem(bojData.submission.submissionId)) {
    // for normal problem submisson
    submissionURL = `https://www.acmicpc.net/source/${bojData.submission.submissionId}`;
    if (debug) console.log(`https://www.acmicpc.net/source/${bojData.submission.submissionId}`);
  } else {
    return;
  }

  if (submissionURL !== undefined || submissionURL !== '') {
    /* Request for the submission details page */
    const xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState === 4 && this.status === 200) {
        /* received submission details as html reponse. */
        const doc = new DOMParser().parseFromString(this.responseText, 'text/html');
        const code = doc.getElementsByClassName('codemirror-textarea')[0].innerHTML;
        bojData.submission.code = code.unescapeHtml();
      }
    };
    xhttp.open('GET', submissionURL, false);
    xhttp.send();
  }
}

function findSolvedAPI() {
  const levelxhttp = new XMLHttpRequest();
  levelxhttp.onreadystatechange = function () {
    if (this.readyState === 4 && this.status === 200) {
      /* received submission details as html reponse. */
      const leveldoc = JSON.parse(this.response);
      bojData.meta.title = `${leveldoc.titleKo}`;
      bojData.meta.level = bj_level[leveldoc.level];
      bojData.meta.directory = `백준/${bojData.meta.level.replace(/ .*/, '')}/${bojData.meta.problemId}.${bojData.meta.title.replace(/\s+/g, '-').replace(titleRegex, '')}`;
      bojData.meta.message = `[${bojData.meta.level}] Title: ${bojData.meta.title}, Time: ${bojData.submission.runtime} ms, Memory: ${bojData.submission.memory} KB -BaekjoonHub`;
      let string = '';
      leveldoc.tags.forEach((tag) => (string += `${categories[tag.key]}(${tag.key}), `));
      console.log(string.length);
      const { length } = string;
      bojData.meta.category = string.substring(0, length - 2);
      if (debug) console.log(leveldoc);
    }
  };
  levelxhttp.open('GET', `https://solved.ac/api/v3/problem/show?problemId=${bojData.meta.problemId}`, false);
  levelxhttp.send();
}
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

/* Parser function for the question and tags */
function findProblemDescription() {
  let questionDescription = '';
  let submissionURL;
  if (checkElem(bojData.meta.problemId)) {
    submissionURL = `https://www.acmicpc.net/problem/${bojData.meta.problemId}`;
  } else {
    return;
  }

  if (submissionURL != undefined) {
    /* Request for the submission details page */
    const xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState === 4 && this.status === 200) {
        /* received submission details as html reponse. */
        const doc = new DOMParser().parseFromString(this.responseText, 'text/html');

        questionDescription += `### 문제 설명\n\n${doc.getElementById('problem_description').innerText.replace(/\t/g, ' ').unescapeHtml().trim()}\n`;
        questionDescription += `### 입력 \n\n ${doc.getElementById('problem_input').innerText.unescapeHtml().trim()}\n`;
        questionDescription += `### 출력 \n\n ${doc.getElementById('problem_output').innerText.unescapeHtml().trim()}\n`;
      }
    };
    xhttp.open('GET', submissionURL, false);
    xhttp.send();
    bojData.meta.problemDescription = questionDescription;
  }
}

/* Since we dont yet have callbacks/promises that helps to find out if things went bad */
/* we will start 10 seconds counter and even after that upload is not complete, then we conclude its failed */
function startUploadCountDown() {
  uploadState.uploading = true;
  uploadState.countdown = setTimeout(() => {
    if ((uploadState.uploading = true)) {
      // still uploading, then it failed
      uploadState.uploading = false;
      markUploadFailed();
    }
  }, 10000);
}
