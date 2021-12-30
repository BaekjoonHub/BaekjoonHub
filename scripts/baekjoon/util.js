// Upload icon - Set Loading Icon
/* start upload will inject a spinner on left side to the "Run Code" button */
function startUpload() {
  elem = document.getElementById('BaekjoonHub_progress_anchor_element')
  if (elem !== undefined) {
    elem = document.createElement('span')
    elem.id = "BaekjoonHub_progress_anchor_element"
    elem.className = "runcode-wrapper__8rXm"
    elem.style = "margin-left: 10px;padding-top: 0px;"
  }
  elem.innerHTML = `<div id="BaekjoonHub_progress_elem" class="BaekjoonHub_progress"></div>`
  target = document.getElementById("status-table").childNodes[1].childNodes[0].childNodes[3];
  if (target.childNodes.length > 0) {
    target.childNodes[0].append(elem);
  }
  // start the countdown
  startUploadCountDown();
}

// Upload icon - Set Completed Icon
/* This will create a tick mark before "Run Code" button signalling BaekjoonHub has done its job */
function markUploaded() {
  elem = document.getElementById("BaekjoonHub_progress_elem");
  elem.className = "";
  style = 'display: inline-block;transform: rotate(45deg);height:13px;width:5px;border-bottom:3px solid #78b13f;border-right:3px solid #78b13f;'
  elem.style = style;
}

// Upload icon - Set Failed Icon
/* This will create a failed tick mark before "Run Code" button signalling that upload failed */
function markUploadFailed() {
  elem = document.getElementById("BaekjoonHub_progress_elem");
  elem.className = "";
  style = 'display: inline-block;transform: rotate(45deg);height:13px;width:5px;border-bottom:3px solid red;border-right:3px solid red;'
  elem.style = style;
}




/* inject css style required for the upload progress feature */
function injectStyle() {
  const style = document.createElement('style');
  style.textContent = '.BaekjoonHub_progress {\
    display: inline-block; \
    pointer-events: none; \
    width: 0.8em; \
    height: 0.8em; \
    border: 0.4em solid transparent; \
    border-color: #eee; \
    border-top-color: #3E67EC; \
    border-radius: 50%; \
    animation: loadingspin 1.0s linear infinite; } @keyframes loadingspin { 100% { transform: rotate(360deg) }}';
  document.head.append(style);
}

/* Util function to check if an element exists */
function checkElem(elem) {
  return elem && elem.length > 0;
}

function ready(){
  if(bojData.meta.title === '') return false;
  if(bojData.meta.problemId === '') return false;
  if(bojData.meta.level === '') return false;
  if(bojData.meta.problemDescription === '') return false;
  if(bojData.meta.language === '') return false;
  if(bojData.meta.message === '') return false;
  if(bojData.meta.fileName === '') return false;
  if(bojData.submission.submissionId === '') return false;
  if(bojData.submission.code === '') return false;
  if(bojData.submission.memory === '') return false;
  if(bojData.submission.runtime === '') return false;
  return true;
}