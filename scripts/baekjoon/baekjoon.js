// Set to true to enable console log
const debug = true;

// 메인 함수
const loader = setInterval(() => {
  const successTagpre = document.getElementById('status-table');
  if (successTagpre == null || typeof successTagpre === 'undefined') return null;
  const successTag = successTagpre.childNodes[1].childNodes[0].childNodes[3].childNodes[0].innerHTML;
  if (checkElem(successTag)) {
    if (successTag === '맞았습니다!!') {
      if (debug) console.log('맞았네..???');
      findData();
    } else if (successTag === '틀렸습니다') {
      clearTimeout(loader);
    }
  }
}, 2000);
const beginUpload = () => {
  if (ready()) {
    clearTimeout(loader);

    startUpload();
    chrome.storage.local.get('stats', (s) => {
      const { stats } = s;
      if (debug) console.log(stats);
      const filePath = bojData.meta.problemId + bojData.meta.problemId + bojData.meta.language;
      let sha = null;
      let recentSubmissionId = null;
      if (stats !== undefined && stats.submission !== undefined && stats.submission[filePath] !== undefined) {
        sha = stats.submission[filePath].sha;
        recentSubmissionId = stats.submission[filePath].submissionId;
      }
      // 현재 제출 번호가 기존 제출 번호와 같다면 실행 중지
      if (recentSubmissionId === bojData.submission.submissionId) {
        if (uploadState.countdown) clearTimeout(uploadState.countdown);
        delete uploadState.countdown;
        uploadState.uploading = false;
        markUploaded();
        console.log(`Git up to date with submission ID ${recentSubmissionId}`);
      }
      // 신규 제출 번호라면
      else {
        if (debug) console.log('Stats:');
        if (debug) console.log(stats);
        if (debug) console.log(bojData.meta.title.replace(/\s+/g, '-'));

        // TODO: mumwa
        // local storage의 submissionId와 현재 파싱된 bojData의 submissionId가 다를 때,
        // 기존에 제출 내역이 있다면(기존 submissionId가 null이 아니라면) readme update
        // Update의 역할:
        //    실행 시간, 메모리 사용량 업데이트
        // 신규 문제라면 문제 설명 커밋
        if (sha === null) {
          uploadGit(b64EncodeUnicode(bojData.meta.readme), bojData.meta.directory, 'README.md', readmeMsg, 'upload');
        }

        // TODO: mumwa
        // local storage의 submissionId와 현재 파싱된 bojData의 submissionId가 다를 때,
        // 기존에 제출 내역이 있다면(기존 submissionId가 null이 아니라면) 코드 업데이트
        // 기존 제출 내역이 없다면 신규 코드 커밋
        // 변경 방법:
        //    uploadGit() 함수의 action 값을 'update'으로 바꾼다
        //    update() 함수를 위의 목적에 맞게 변경한다.
        // 코드 커밋
        /* Upload code to Git */
        setTimeout(function () {
          uploadGit(
            b64EncodeUnicode(bojData.submission.code),
            bojData.meta.directory,
            bojData.meta.fileName,
            bojData.meta.message,
            'upload',
            true,
            // callback is called when the code upload to git is a success
            () => {
              if (uploadState.countdown) clearTimeout(uploadState.countdown);
              delete uploadState.countdown;
              uploadState.uploading = false;
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
    if (debug) console.log(data);
    if (debug) console.log('BaekjoonHub Local storage already synced!');
  }
});
