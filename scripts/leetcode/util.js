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

/**
 * 제출 상세 페이지에서 표시되는 수동 업로드 버튼을 페이지 우측 하단에 부착한다.
 * 같은 submissionId로 중복 부착되지 않도록 가드한다.
 * URL이 바뀔 때(다른 submissionId로 이동 또는 다른 페이지) {@link removeManualUploadButton}로 제거.
 */
function injectManualUploadButton(submissionId, onUpload) {
  const existing = document.getElementById('bjh-lc-manual-upload');
  if (existing && existing.dataset.sid === String(submissionId)) return;
  if (existing) existing.remove();

  const btn = document.createElement('button');
  btn.id = 'bjh-lc-manual-upload';
  btn.className = 'bjh-lc-manual-upload-btn';
  btn.dataset.sid = String(submissionId);
  btn.textContent = 'GitHub에 업로드';
  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.classList.remove('success', 'fail');
    btn.textContent = '업로드 중...';
    try {
      await onUpload(submissionId);
      btn.classList.add('success');
      btn.textContent = '업로드 완료';
    } catch (e) {
      console.error('LeetCode 수동 업로드 실패:', e);
      btn.classList.add('fail');
      btn.textContent = '업로드 실패';
      btn.disabled = false;
    }
  });
  document.body.appendChild(btn);
}

function removeManualUploadButton() {
  const btn = document.getElementById('bjh-lc-manual-upload');
  if (btn) btn.remove();
}

/**
 * 프로필 페이지 진입 시 좌측 하단에 "전체 제출 업로드" 버튼을 부착한다.
 * 클릭하면 onUpload(username) 콜백을 실행하고, 진행 상태는 multiloader DOM에 표기된다.
 */
function insertUploadAllButton(username, onUpload) {
  const existing = document.getElementById('bjh-lc-upload-all');
  if (existing && existing.dataset.user === String(username)) return;
  if (existing) existing.remove();

  const btn = document.createElement('button');
  btn.id = 'bjh-lc-upload-all';
  btn.className = 'bjh-lc-upload-all-btn';
  btn.dataset.user = String(username);
  btn.textContent = '전체 제출 업로드';
  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    if (!confirm('GitHub에 최근 Accepted 제출들을 일괄 업로드하시겠습니까?\n(LeetCode API 한계상 최근 약 50건만 조회됩니다.)')) return;
    btn.disabled = true;
    btn.classList.remove('success', 'fail');
    insertMultiLoader();
    try {
      await onUpload(username);
      btn.classList.add('success');
    } catch (e) {
      console.error('LeetCode 전체 업로드 실패:', e);
      btn.classList.add('fail');
      MultiloaderFail(e?.message || String(e));
    } finally {
      btn.disabled = false;
    }
  });
  document.body.appendChild(btn);
}

function removeUploadAllButton() {
  const btn = document.getElementById('bjh-lc-upload-all');
  if (btn) btn.remove();
  const ml = document.getElementById('bjh-lc-multiloader');
  if (ml) ml.remove();
  multiloader.wrap = null;
  multiloader.nom = null;
  multiloader.denom = null;
}

function insertMultiLoader() {
  const old = document.getElementById('bjh-lc-multiloader');
  if (old) old.remove();
  const wrap = document.createElement('div');
  wrap.id = 'bjh-lc-multiloader';
  wrap.className = 'bjh-lc-multiloader';
  wrap.textContent = '준비 중…';
  document.body.appendChild(wrap);
  multiloader.wrap = wrap;
  multiloader.nom = null;
  multiloader.denom = null;
}

function setMultiLoaderDenom(num) {
  if (isNull(multiloader.wrap)) return;
  if (isNull(multiloader.denom)) {
    multiloader.wrap.textContent = '';
    const nom = document.createElement('span');
    nom.className = 'bjh-lc-multiloader-num';
    nom.textContent = '0';
    const denom = document.createElement('span');
    denom.className = 'bjh-lc-multiloader-num';
    denom.textContent = String(num);
    multiloader.wrap.appendChild(nom);
    multiloader.wrap.appendChild(document.createTextNode(' / '));
    multiloader.wrap.appendChild(denom);
    multiloader.nom = nom;
    multiloader.denom = denom;
  } else {
    multiloader.denom.textContent = String(num);
  }
}

function incMultiLoader(n) {
  if (isNull(multiloader.nom)) return;
  multiloader.nom.textContent = String(Number(multiloader.nom.textContent) + n);
}

function MultiloaderUpToDate() {
  if (!isNull(multiloader.wrap)) multiloader.wrap.textContent = 'Up To Date';
}

function MultiloaderSuccess() {
  if (!isNull(multiloader.wrap)) multiloader.wrap.textContent = 'SUCCESS';
}

function MultiloaderFail(message) {
  if (isNull(multiloader.wrap)) return;
  multiloader.wrap.textContent = 'FAILED';
  multiloader.wrap.classList.add('bjh-lc-multiloader-fail');
  if (!isEmpty(message)) multiloader.wrap.setAttribute('title', message);
}
