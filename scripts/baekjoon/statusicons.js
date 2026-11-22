/**
 * 백준 페이지에서 이미 GitHub에 업로드된 문제 옆에 체크 아이콘을 표시합니다.
 */

async function injectUploadStatusIcons() {
  const enabled = await checkEnable();
  if (!enabled) return;

  let stats = await getStats();
  const hook = await getHook();
  if (isNull(stats) || isNull(hook)) return;

  // submission 캐시가 비어있으면 GitHub에서 동기화
  if (isNull(stats.submission) || Object.keys(stats.submission).length === 0) {
    try {
      stats = await updateLocalStorageStats();
    } catch (e) {
      return;
    }
  }

  const uploadedIds = extractUploadedProblemIds(stats, hook, '백준');
  if (uploadedIds.size === 0) return;

  const links = document.querySelectorAll('a[href]');
  const problemPattern = /^\/problem\/(\d+)\/?$/;

  for (const link of links) {
    if (link.dataset.bjhChecked) continue;
    link.dataset.bjhChecked = 'true';

    // 문제 페이지 상단 탭(ul.problem-menu)의 a 는 block 이라 뒤에 붙인 아이콘이 탭 아래 줄에 따로 보인다
    if (!/^(www\.)?acmicpc\.net$/.test(link.hostname) || link.closest('.problem-menu')) continue;
    const match = link.pathname.match(problemPattern);
    if (!match) continue;

    const problemId = match[1];
    if (uploadedIds.has(problemId)) {
      const icon = document.createElement('span');
      icon.className = 'bjh-uploaded-icon';
      icon.title = 'GitHub에 업로드됨';
      link.insertAdjacentElement('afterend', icon);
    }
  }
}

injectUploadStatusIcons();
