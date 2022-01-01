/* Main function for uploading code to GitHub repo, and callback cb is called if success */
// 업로드 함수 - 신규 코드 커밋에 사용됨
const upload = (token, hook, code, directory, filename, sha, msg, cb = undefined) => {
  // To validate user, load user object from GitHub.
  fetch(`https://api.github.com/repos/${hook}/contents/${directory}/${filename}`, {
    method: 'PUT',
    body: JSON.stringify({ message: msg, content: code, sha }),
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
    .then((res) => res.json())
    .then((data) => {
      if (debug) console.log('data', data);
      if (data != null || (data != data.content) != null || data.content.sha != null) {
        const { sha } = data.content; // get updated SHA.
        chrome.storage.local.get('stats', (data) => {
          let { stats } = data;
          if (stats === null || stats === {} || stats === undefined) {
            // create stats object
            stats = {};
            stats.solved = 0;
            stats.unrated = 0;
            stats.silver = 0;
            stats.gold = 0;
            stats.platinum = 0;
            stats.diamond = 0;
            stats.ruby = 0;
            stats.submission = {};
          }
          const filePath = bojData.meta.problemId + bojData.meta.problemId + bojData.meta.language;
          const { submissionId } = bojData.submission;
          stats.submission[filePath] = { submissionId, sha }; // update sha key.
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
/* Main function for updating code on GitHub Repo */
/* Currently only used for prepending discussion posts to README */
/* callback cb is called on success if it is defined */
// 업데이트 함수
const update = (token, hook, addition, directory, msg, prepend, cb = undefined) => {
  fetch(`https://api.github.com/repos/${hook}/contents/${directory}/README.md`, {
    method: 'GET',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
    .then((res) => res.json())
    .data((response) => {
      const existingContent = b64DecodeUnicode(response.content);
      let newContent = '';
      /* Discussion posts prepended at top of README */
      /* Future implementations may require appending to bottom of file */
      if (prepend) {
        newContent = b64EncodeUnicode(addition + existingContent);
      }
      /* Write file with new content to GitHub */
      upload(token, hook, newContent, directory, 'README.md', response.sha, msg, cb);
    });
};
function uploadGit(code, problemName, fileName, msg, action, prepend = true, cb = undefined) {
  /* Get necessary payload data */
  chrome.storage.local.get('BaekjoonHub_token', (t) => {
    const token = t.BaekjoonHub_token;
    if (debug) console.log('token', token);
    if (token) {
      chrome.storage.local.get('mode_type', (m) => {
        const mode = m.mode_type;
        if (mode === 'commit') {
          /* Get hook */
          chrome.storage.local.get('BaekjoonHub_hook', (h) => {
            const hook = h.BaekjoonHub_hook;
            if (hook) {
              /* Get SHA, if it exists */
              /* to get unique key */
              const filePath = problemName + fileName;
              chrome.storage.local.get('stats', (s) => {
                const { stats } = s;
                let sha = null;
                if (stats !== undefined && stats.submission !== undefined && stats.submission[filePath] !== undefined) {
                  sha = stats.submission[filePath].sha;
                }

                if (action === 'upload') {
                  /* Upload to git. */
                  upload(token, hook, code, problemName, fileName, sha, msg, cb);
                } else if (action === 'update') {
                  /* Update on git */
                  update(token, hook, code, problemName, msg, prepend, cb);
                }
              });
            }
          });
        }
      });
    }
  });
}
