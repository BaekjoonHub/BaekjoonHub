// Set to true to enable console log
const debug = false;

const loader = setInterval(() => {

  const successTagpre = document.getElementById("status-table");
  if(successTagpre == null || typeof successTagpre === 'undefined') return null;

  var success = false;
  const successTag = successTagpre.childNodes[1].childNodes[0].childNodes[3].childNodes[0].innerHTML;
  if (checkElem(successTag)){
    if(successTag === "맞았습니다!!"){
      if(debug) console.log("맞았네..???");
      findData();
      success=true;
    }
    else if(successTag === "틀렸습니다"){
      clearTimeout(loader);
    }
  }
  if(success&&ready()) {
    clearTimeout(loader);
    
    startUpload();
    chrome.storage.local.get('stats', (s) => {
      const { stats } = s;
      if(debug) console.log(stats);
      const filePath = bojData.meta.problemId + bojData.meta.problemId + bojData.meta.language;
      let sha = null;
      let recentSubmissionId = null;
      if (
        stats !== undefined &&
        stats.submission !== undefined &&
        stats.submission[filePath] !== undefined
      ) {
        sha = stats.submission[filePath].sha;
        recentSubmissionId = stats.submission[filePath].submissionId;
      }

      if(recentSubmissionId === bojData.submission.submissionId){
        if(uploadState['countdown']) clearTimeout(uploadState['countdown']); 
        delete uploadState['countdown']
        uploadState.uploading = false; 
        markUploaded(); 
        console.log("Git up to date with submission ID "+recentSubmissionId);
        return;
      }
      else{
        if(debug) console.log("Stats:");
        if(debug) console.log(stats);
        if(debug) console.log(bojData.meta.title.replace(/\s+/g, '-')); 

        if (sha === null) {
          uploadGit(
            btoa(unescape(encodeURIComponent(bojData.meta.readme))),
            bojData.meta.directory,
            'README.md',
            readmeMsg,
            'upload',
          );
        }
        /* Upload code to Git */
        setTimeout(function () {
          uploadGit(
            btoa(unescape(encodeURIComponent(bojData.submission.code))),
            bojData.meta.directory,
            bojData.meta.fileName,
            bojData.meta.message,
            'upload',
            true,
            // callback is called when the code upload to git is a success
            () => { 
              if(uploadState['countdown']) clearTimeout(uploadState['countdown']); 
              delete uploadState['countdown']
              uploadState.uploading = false; 
              markUploaded(); 
            }
          ); // Encode `code` to base64
        }, 2000);
      }
    });    
  }
}, 1000);

// inject the style
injectStyle();

/* Sync to local storage */
chrome.storage.local.get('isSync', (data) => {
  keys = [
    'BaekjoonHub_token',
    'BaekjoonHub_username',
    'pipe_BaekjoonHub',
    'stats',
    'BaekjoonHub_hook',
    'mode_type',
  ];
  if (!data || !data.isSync) {
    keys.forEach((key) => {
      chrome.storage.sync.get(key, (data) => {
        chrome.storage.local.set({ [key]: data[key] });
      });
    });
    chrome.storage.local.set({ isSync: true }, (data) => {
      if(debug) console.log('BaekjoonHub Synced to local values');
    });
  } else {
    if(debug) console.log(data);
    if(debug) console.log('BaekjoonHub Local storage already synced!');
  }
});

