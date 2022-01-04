/* Github 업로드 메인 함수 */
/* 모든 업로드는 uploadGit 함수로 합니다.  파라미터는 아래와 같습니다. */
/*  
    code: 업로드하는 파일 내용
    problemName: 업로드하는 파일의 디렉토리
    fileName: 업로드하는 파일 명
    type: CommitType의 readme or code
    cb: Callback 함수(업로드 후 로딩 아이콘 처리를 맡는다
*/
function uploadGit(code, directory, fileName, type, cb = undefined) {
  /* Get necessary payload data */
  chrome.storage.local.get('BaekjoonHub_token', (t) => {
    const token = t.BaekjoonHub_token;
    if (debug) console.log('token', token);
    if (token) {
      chrome.storage.local.get('mode_type', (m) => {
        const mode = m.mode_type;
        if (mode === 'commit') {
          /* Local Storage에 저장된 Github Repository(hook) 주소를 찾습니다 */
          chrome.storage.local.get('BaekjoonHub_hook', (h) => {
            const hook = h.BaekjoonHub_hook;
            if (hook) {
              /* 현재 업로드되어 있는 코드가 있다면 해당 코드의 SHA를 구합니다. */
              const filePath = bojData.meta.problemId + bojData.meta.problemId + bojData.meta.language;
              chrome.storage.local.get('stats', (s) => {
                const { stats } = s;
                let sha = null;
                if (stats !== undefined && stats.submission !== undefined && stats.submission[filePath] !== undefined) {
                  sha = stats.submission[filePath][type];
                }

                upload(token, hook, code, directory, fileName, type, sha, cb);
              });
            }
          });
        }
      });
    }
  });
}

/* Github 업로드 함수 */
/* Github api를 사용하여 업로드를 합니다. 참고 링크 https://docs.github.com/en/rest/reference/repos#create-or-update-file-contents */
/* 함수 파라미터는 아래와 같습니다.
    token: local storage에 있는 Github Token
    hook: 등록된 Github Repository
    code: Github에 푸시할 파일 내용
    directory: 업로드할 파일 디렉토리
    filename: 업로드할 파일명
    type: CommitType의 readme or code
    sha: 현재 업로드된 파일의 SHA
    cb: Callback 함수(업로드 후 로딩 아이콘 처리를 맡는다
*/
const upload = (token, hook, code, directory, filename, type, sha, cb = undefined) => {
  // To validate user, load user object from GitHub.

  fetch(`https://api.github.com/repos/${hook}/contents/${directory}/${filename}`, {
    method: 'PUT',
    body: JSON.stringify({ message: bojData.meta.message, content: code, sha }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
    .then((res) => res.json())
    .then((data) => {
      if (debug && type == CommitType.readme) console.log('data', data);
      if (data != null && (data != data.content) != null && data.content.sha != null && data.content.sha != undefined) {
        const { sha } = data.content; // get updated SHA.
        chrome.storage.local.get('stats', (data) => {
          let { stats } = data;

          /* Local Storage에 Stats Object가 없다면 초기화한다. */
          if (stats === null || stats === {} || stats === undefined) {
            // create stats object
            stats = {};
            stats.version = '1.0.2';
            stats.submission = {};
          }
          const filePath = bojData.meta.problemId + bojData.meta.problemId + bojData.meta.language;
          const { submissionId } = bojData.submission;

          if (stats.submission[filePath] === null || stats.submission[filePath] == undefined) {
            stats.submission[filePath] = {};
          }

          stats.submission[filePath].submissionId = submissionId;
          stats.submission[filePath][type] = sha; // update sha key.
          chrome.storage.local.set({ stats }, () => {
            if (debug) console.log(`Successfully committed ${filename} to github`);
            // if callback is defined, call it
            if (cb !== undefined) {
              cb();
            }
          });
        });
      }
    });
};
