/* LeetCode 모듈 엔트리.
 * 전략: 제출 버튼을 후킹하고, 클릭 직전 최신 submissionId를 baseline으로 잡은 뒤
 * submissionList GraphQL을 폴링해 새 제출이 'Accepted'로 확정되면 업로드를 시작한다.
 */

const SUBMIT_BUTTON_SELECTOR = 'button[data-e2e-locator="console-submit-button"]';

(async function bootstrap() {
  if (!await checkEnable()) return;

  const username = await findUsername();
  if (!username) {
    log('LeetCode: 로그인 상태가 아니어서 부트스트랩을 중단합니다.');
    return;
  }

  hookSubmitButton();
  observeUrlChange(() => {
    // SPA 이동 시 새 페이지의 버튼에 다시 후크
    stopPoller();
    hookSubmitButton();
  });
})();

/**
 * 페이지 내 제출 버튼에 클릭 리스너를 부착한다.
 * 버튼은 SPA 라우팅 후 한 박자 늦게 렌더되므로, 발견 못 하면 짧은 인터벌로 재시도한다.
 */
function hookSubmitButton() {
  let attempts = 0;
  const tryHook = () => {
    const btn = document.querySelector(SUBMIT_BUTTON_SELECTOR);
    if (btn) {
      if (btn.dataset.bjhHooked === '1') return;
      btn.dataset.bjhHooked = '1';
      btn.addEventListener('click', onSubmitClicked, true);
      log('LeetCode submit 버튼에 후크를 부착했습니다.');
      return;
    }
    if (++attempts < 30) setTimeout(tryHook, 500);
  };
  tryHook();
}

async function onSubmitClicked() {
  if (!(await checkEnable())) return;
  const slug = getCurrentProblemSlug();
  if (!slug) return;

  // baseline: 클릭 직전 가장 최근 submission id (없으면 0)
  let baselineId = 0;
  try {
    const latest = await fetchLatestSubmission(slug);
    if (latest) baselineId = Number(latest.id) || 0;
  } catch (e) {
    log('baseline 조회 실패 (무시하고 진행):', e);
  }

  startPoller(slug, baselineId);
}

function startPoller(slug, baselineId) {
  stopPoller();
  lcPoller.slug = slug;
  lcPoller.baselineId = baselineId;
  let attempts = 0;
  startUpload(); // 스피너 표시

  const tick = async () => {
    attempts += 1;
    try {
      const latest = await fetchLatestSubmission(slug);
      if (latest && Number(latest.id) > baselineId) {
        // LeetCode가 isPending에 boolean과 'PENDING'/'NOT_PENDING' 문자열을 섞어 보내므로 둘 다 처리
        const pending = latest.isPending === true || latest.isPending === 'PENDING';
        if (!pending) {
          stopPoller();
          if (latest.statusDisplay === 'Accepted') {
            console.log(`LeetCode Accepted 감지 — 업로드 시작 (submissionId=${latest.id})`);
            try {
              const lcData = await buildLeetCodeData(latest.id);
              await beginUpload(lcData);
            } catch (e) {
              console.error('LeetCode 업로드 실패:', e);
              markUploadFailedCSS();
              if (typeof Toast !== 'undefined') Toast.raiseToast(`업로드 실패: ${e.message}`);
            }
          } else {
            // Accepted가 아니면 조용히 종료
            console.log(`LeetCode 결과: ${latest.statusDisplay} — 업로드 건너뜀`);
            markUploadFailedCSS();
          }
          return;
        }
      }
    } catch (e) {
      log('LeetCode 폴링 중 오류:', e);
    }
    if (attempts >= LC_POLL_MAX_ATTEMPTS) {
      stopPoller();
      markUploadFailedCSS();
      console.warn('LeetCode 결과 감지 타임아웃');
      return;
    }
  };

  lcPoller.timer = setInterval(tick, LC_POLL_INTERVAL_MS);
}

function stopPoller() {
  if (lcPoller.timer) {
    clearInterval(lcPoller.timer);
    lcPoller.timer = null;
  }
}
