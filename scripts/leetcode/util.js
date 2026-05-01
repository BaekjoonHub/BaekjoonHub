/* LeetCode 화면에서 진행 상태 아이콘을 표기하는 헬퍼 */

/**
 * LeetCode 결과 패널 옆에 업로드 진행 스피너를 부착한다.
 * 결과 영역이 SPA로 갱신되기 때문에 매 호출마다 기존 anchor를 제거하고 새로 만든다.
 */
function startUpload() {
  const existing = document.getElementById('BaekjoonHub_progress_anchor_element');
  if (existing) existing.remove();

  const anchor = document.createElement('span');
  anchor.id = 'BaekjoonHub_progress_anchor_element';
  anchor.style = 'display:inline-block;margin-left:10px;vertical-align:middle;';
  anchor.innerHTML = `<div id="BaekjoonHub_progress_elem" class="BaekjoonHub_progress"></div>`;

  const target =
    document.querySelector('[data-e2e-locator="submission-result"]') ||
    document.querySelector('[data-e2e-locator="console-result"]') ||
    document.querySelector('button[data-e2e-locator="console-submit-button"]');
  if (!target) return;
  if (target.parentElement) target.parentElement.appendChild(anchor);
  else target.appendChild(anchor);

  uploadState.uploading = true;
  if (uploadState.countdown) clearTimeout(uploadState.countdown);
  uploadState.countdown = setTimeout(() => {
    if (uploadState.uploading === true) markUploadFailedCSS();
  }, 15000);
}

function markUploadedCSS(branches, directory) {
  uploadState.uploading = false;
  const elem = document.getElementById('BaekjoonHub_progress_elem');
  if (!elem) return;
  elem.className = 'markuploaded';
  const owner = Object.keys(branches)[0];
  if (owner) {
    const url = `https://github.com/${owner}/tree/${branches[owner]}/${directory}`;
    elem.style.cursor = 'pointer';
    elem.addEventListener('click', () => window.open(url, '_blank'));
  }
}

function markUploadFailedCSS() {
  uploadState.uploading = false;
  const elem = document.getElementById('BaekjoonHub_progress_elem');
  if (!elem) return;
  elem.className = 'markuploadfailed';
}

/**
 * SPA 라우팅 변화를 감지하기 위해 history API를 래핑한다.
 * pushState/replaceState/popstate 모두에 동일한 콜백을 연결한다.
 */
function observeUrlChange(cb) {
  let last = location.href;
  const fire = () => {
    if (location.href !== last) {
      last = location.href;
      try { cb(); } catch (e) { console.error(e); }
    }
  };
  const wrap = (fn) => function () {
    const ret = fn.apply(this, arguments);
    fire();
    return ret;
  };
  history.pushState = wrap(history.pushState);
  history.replaceState = wrap(history.replaceState);
  window.addEventListener('popstate', fire);
  // SPA가 history를 거치지 않고 DOM만 갈아끼우는 경우 대비
  new MutationObserver(fire).observe(document.body, { childList: true, subtree: true });
}
