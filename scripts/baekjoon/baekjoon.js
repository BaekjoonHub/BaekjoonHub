// Set to true to enable console log
const debug = true;

/* 
  문제 제출 맞음 여부를 확인하는 함수
  2초마다 문제를 파싱하여 확인
*/
const loader = setInterval(() => {
  const successTagpre = document.getElementById('status-table');
  if (successTagpre == null || typeof successTagpre === 'undefined') return null;
  const successTag = successTagpre.childNodes[1].childNodes[0].childNodes[3].childNodes[0].innerHTML;
  if (checkElem(successTag)) {
    if (successTag === '맞았습니다!!') {
      if (debug) console.log('풀이가 맞았습니다. 업로드를 시작합니다.');
      findData();
    } else if (successTag === '틀렸습니다') {
      clearTimeout(loader);
    }
  }
}, 2000);


/* 파싱 직후 실행되는 함수 */
const beginUpload = () => {
  if (ready()) {
    clearTimeout(loader);
    startUpload();
    chrome.storage.local.get('stats', (s) => {
      const { stats } = s;
      if (debug) console.log('stats in beginUpload()', stats);

      /* 버전 차이 업로드 */
      if (stats.version !== '1.0.2') {
        markUploadFailed();
        alert('버전 차이가 확인되었습니다. 확장 프로그램을 열어 패치노트를 확인해주세요.');
        insertUpdateButton();
        return;
      }

      const filePath = bojData.meta.problemId + bojData.meta.problemId + bojData.meta.language;
      let sha = null;
      let recentSubmissionId = null;
      if (stats !== undefined && stats.submission !== undefined && stats.submission[filePath] !== undefined) {
        sha = stats.submission[filePath].sha;
        recentSubmissionId = stats.submission[filePath].submissionId;
      }
      /* 현재 제출 번호가 기존 제출 번호와 같다면 실행 중지 */
      if (recentSubmissionId === bojData.submission.submissionId) {
        markUploaded();
        console.log(`Git up to date with submission ID ${recentSubmissionId}`);
      } else {
        /* 신규 제출 번호라면 */
        // 문제 설명 커밋
        uploadGit(b64EncodeUnicode(bojData.meta.readme), bojData.meta.directory, 'README.md', CommitType.readme);

        /* Upload code to Git */
        setTimeout(function () {
          uploadGit(
            b64EncodeUnicode(bojData.submission.code),
            bojData.meta.directory,
            bojData.meta.fileName,
            CommitType.code,
            // callback is called when the code upload to git is a success
            () => {
              markUploaded();
            },
          ); // Encode `code` to base64
        }, 2000);
      }
    });
  } else console.log('in begin upload: not ready');
};

// inject the style
injectStyle();

/* Sync to local storage */
chrome.storage.local.get('isSync', (data) => {
  keys = ['BaekjoonHub_token', 'BaekjoonHub_username', 'pipe_BaekjoonHub', 'stats', 'BaekjoonHub_hook', 'mode_type'];
  if (!data || !data.isSync) {
    keys.forEach((key) => {
      chrome.storage.sync.get(key, (data) => {
        chrome.storage.local.set({ [key]: data[key] });
      });
    });
    chrome.storage.local.set({ isSync: true }, (data) => {
      if (debug) console.log('BaekjoonHub Synced to local values');
    });
  } else {
    if (debug) console.log('Upload Completed. Local Storage status:', data);
    if (debug) console.log('BaekjoonHub Local storage already synced!');
  }
});
