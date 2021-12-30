/* Main function for uploading code to GitHub repo, and callback cb is called if success */
const upload = (token, hook, code, directory, filename, sha, msg, cb=undefined) => {
    // To validate user, load user object from GitHub.
    const URL = `https://api.github.com/repos/${hook}/contents/${directory}/${filename}`;
    
    console.log("directory is "+directory +", file name is "+filename);
  
    /* Define Payload */
    let data = {
      message: msg,
      content: code,
      sha,
    };
  
    data = JSON.stringify(data);
  
    const xhr = new XMLHttpRequest();
    xhr.addEventListener('readystatechange', function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200 || xhr.status === 201) {
          const sha = JSON.parse(xhr.responseText).content.sha; // get updated SHA.
          chrome.storage.local.get('stats', (data2) => {
            let { stats } = data2;
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
  
            const submissionId = bojData.submission.submissionId;
            stats.submission[filePath] = { submissionId , sha}; // update sha key.
            chrome.storage.local.set({ stats }, () => {
              if(debug) console.log(
                `Successfully committed ${filename} to github`,
              );
  
              // if callback is defined, call it
              if(cb !== undefined) {
                cb();
              }
            });
          });
        }
      }
    });
    xhr.open('PUT', URL, true);
    xhr.setRequestHeader('Authorization', `token ${token}`);
    xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
    xhr.send(data);
  };
  
  /* Main function for updating code on GitHub Repo */
  /* Currently only used for prepending discussion posts to README */
  /* callback cb is called on success if it is defined */
  const update = (token, hook, addition, directory, msg, prepend, cb=undefined) => {
    const URL = `https://api.github.com/repos/${hook}/contents/${directory}/README.md`;
  
    /* Read from existing file on GitHub */
    const xhr = new XMLHttpRequest();
    xhr.addEventListener(' ', function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200 || xhr.status === 201) {
          const response = JSON.parse(xhr.responseText);
          const existingContent = decodeURIComponent(
            escape(atob(response.content)),
          );
          let newContent = '';
  
          /* Discussion posts prepended at top of README */
          /* Future implementations may require appending to bottom of file */
          if (prepend) {
            newContent = btoa(
              unescape(encodeURIComponent(addition + existingContent)),
            );
          }
  
          /* Write file with new content to GitHub */
          upload(
            token,
            hook,
            newContent,
            directory,
            'README.md',
            response.sha,
            msg,
            cb
          );
        }
      }
    });
    xhr.open('GET', URL, true);
    xhr.setRequestHeader('Authorization', `token ${token}`);
    xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
    xhr.send();
  };
  
  function uploadGit(
    code,
    problemName,
    fileName,
    msg,
    action,
    prepend = true,
    cb = undefined
  ) {
    /* Get necessary payload data */
    chrome.storage.local.get('BaekjoonHub_token', (t) => {
      const token = t.BaekjoonHub_token;
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
  
                  if (
                    stats !== undefined &&
                    stats.submission !== undefined &&
                    stats.submission[filePath] !== undefined
                  ) {
                    sha = stats.submission[filePath].sha;
                  }
                  
                  if (action === 'upload') {
                    /* Upload to git. */
                    upload(
                      token,
                      hook,
                      code,
                      problemName,
                      fileName,
                      sha,
                      msg,
                      cb
                    );
                  } else if (action === 'update') {
                    /* Update on git */
                    update(
                      token,
                      hook,
                      code,
                      problemName,
                      msg,
                      prepend,
                      cb
                    );
                  }
                });
              }
            });
          }
        });
      }
    });
  }