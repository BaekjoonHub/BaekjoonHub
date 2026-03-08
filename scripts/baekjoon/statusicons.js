/**
 * 백준 페이지에서 이미 GitHub에 업로드된 문제 옆에 체크 아이콘을 표시합니다.
 */

function extractUploadedProblemIds(stats, hook) {
  const uploadedIds = new Set();
  if (isNull(stats) || isNull(stats.submission) || isNull(hook)) return uploadedIds;

  const parts = hook.split('/');
  if (parts.length < 2) return uploadedIds;
  const owner = parts[0];
  const repo = parts[1];

  const ownerObj = stats.submission[owner];
  if (isNull(ownerObj)) return uploadedIds;
  const repoObj = ownerObj[repo];
  if (isNull(repoObj)) return uploadedIds;

  function extractFromNode(node) {
    if (isNull(node)) return;
    for (const key of Object.keys(node)) {
      const match = key.match(/^(\d+)/);
      if (match) {
        uploadedIds.add(match[1]);
      }
    }
  }

  // 직접 모드: submission[owner][repo]["백준"]["1234.제목"]
  if (!isNull(repoObj['백준'])) {
    extractFromNode(repoObj['백준']);
  }

  // language 모드: submission[owner][repo][lang]["백준"]["1234.제목"]
  for (const key of Object.keys(repoObj)) {
    if (key === '백준') continue;
    const langNode = repoObj[key];
    if (!isNull(langNode) && typeof langNode === 'object' && !isNull(langNode['백준'])) {
      extractFromNode(langNode['백준']);
    }
  }

  return uploadedIds;
}

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

  const uploadedIds = extractUploadedProblemIds(stats, hook);
  if (uploadedIds.size === 0) return;

  const links = document.querySelectorAll('a[href]');
  const problemPattern = /\/problem\/(\d+)$/;

  for (const link of links) {
    if (link.dataset.bjhChecked) continue;
    link.dataset.bjhChecked = 'true';

    const match = link.getAttribute('href').match(problemPattern);
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
