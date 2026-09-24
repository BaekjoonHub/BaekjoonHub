/* Sync to local storage */
chrome.storage.local.get('isSync', (data) => {
  keys = ['BaekjoonHub_token', 'BaekjoonHub_username', 'pipe_baekjoonhub', 'stats', 'BaekjoonHub_hook', 'mode_type'];
  if (!data || !data.isSync) {
    keys.forEach((key) => {
      chrome.storage.sync.get(key, (data) => {
        chrome.storage.local.set({ [key]: data[key] });
      });
    });
    chrome.storage.local.set({ isSync: true }, (data) => {
      // if (debug)
      console.log('BaekjoonHub Synced to local values');
    });
  } else {
    // if (debug)
    // console.log('Upload Completed. Local Storage status:', data);
    // if (debug)
    console.log('BaekjoonHub Local storage already synced!');
  }
});

/* stats 초기값이 없는 경우, 기본값을 생성하고 stats를 업데이트한다.
   만약 새로운 버전이 업데이트되었을 경우, 기존 submission은 업데이트를 위해 초기화 한다.
   (확인하기 어려운 다양한 케이스가 발생하는 것을 확인하여서 if 조건문을 복잡하게 하였다.)
*/
getStats().then((stats) => {
  if (isNull(stats)) stats = {};
  if (isNull(stats.version)) stats.version = '0.0.0';
  if (isNull(stats.branches) || stats.version !== getVersion()) stats.branches = {};
  if (isNull(stats.submission)) stats.submission = {};
  if (isNull(stats.problems) || stats.version !== getVersion()) stats.problems = {};
  saveStats(stats);
});

/**
 * @author https://gist.github.com/sumitpore/47439fcd86696a71bf083ede8bbd5466
 * Chrome의 Local StorageArea에서 개체 가져오기
 * @param {string} key
 */
async function getObjectFromLocalStorage(key) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(key, function(value) {
        resolve(value[key]);
      });
    } catch (ex) {
      reject(ex);
    }
  });
}

/**
 * @author https://gist.github.com/sumitpore/47439fcd86696a71bf083ede8bbd5466
 * Chrome의 Local StorageArea에 개체 저장
 * @param {*} obj
 */
async function saveObjectInLocalStorage(obj) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set(obj, function() {
        resolve();
      });
    } catch (ex) {
      reject(ex);
    }
  });
}

/**
 * @author https://gist.github.com/sumitpore/47439fcd86696a71bf083ede8bbd5466
 * Chrome Local StorageArea에서 개체 제거
 *
 * @param {string or array of string keys} keys
 */
async function removeObjectFromLocalStorage(keys) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.remove(keys, function() {
        resolve();
      });
    } catch (ex) {
      reject(ex);
    }
  });
}

/**
 * Chrome의 Sync StorageArea에서 개체 가져오기
 * @param {string} key
 */
async function getObjectFromSyncStorage(key) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.get(key, function(value) {
        resolve(value[key]);
      });
    } catch (ex) {
      reject(ex);
    }
  });
}

/**
 * Chrome의 Sync StorageArea에 개체 저장
 * @param {*} obj
 */
async function saveObjectInSyncStorage(obj) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.set(obj, function() {
        resolve();
      });
    } catch (ex) {
      reject(ex);
    }
  });
}

/**
 * Chrome Sync StorageArea에서 개체 제거
 * @param {string or array of string keys} keys
 */
async function removeObjectFromSyncStorage(keys) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.remove(keys, function() {
        resolve();
      });
    } catch (ex) {
      reject(ex);
    }
  });
}

async function getToken() {
  return await getObjectFromLocalStorage('BaekjoonHub_token');
}

// async function getPipe() {
//   return await getObjectFromLocalStorage('pipe_baekjoonhub');
// }

async function getGithubUsername() {
  return await getObjectFromLocalStorage('BaekjoonHub_username');
}

async function getStats() {
  return await getObjectFromLocalStorage('stats');
}

async function getHook() {
  return await getObjectFromLocalStorage('BaekjoonHub_hook');
}

/** welcome.html 의 분기 처리 dis_option에서 설정된 boolean 값을 반환합니다. */
async function getOrgOption() {
  try {
    return await getObjectFromLocalStorage('BaekjoonHub_OrgOption');
  } catch (ex) {
    console.log('The way it works has changed with updates. Update your storage. ');
    chrome.storage.local.set({ BaekjoonHub_OrgOption: "platform" }, () => {});
    return "platform";
  }
}

async function getModeType() {
  return await getObjectFromLocalStorage('mode_type');
}

async function getSaveExamplesOption() {
  return (await getObjectFromLocalStorage('bjhSaveExamples')) === true;
}

async function saveToken(token) {
  return await saveObjectInLocalStorage({ BaekjoonHub_token: token });
}

async function saveStats(stats) {
  return await saveObjectInLocalStorage({ stats });
}

/**
 * update stats from path recursively
 * ex) updateOptimizedStatsfromPath('_owner/_repo/백준/README.md', '1342259dssd') -> stats.submission.append({_owner: {_repo: {백준: {README.md: '1342259dssd'}}}})
 * updateOptimizedStatsfromPath('_owner/_repo/백준/1000.테스트/테스트.cpp', 'sfgbdksalf144') -> stats.submission.append({_owner: {_repo: {백준: {'1000.테스트': {'테스트.cpp': 'sfgbdksalf144'}}}}}})
 * updateOptimizedStatsfromPath('_owner/_repo/백준/1000.테스트/aaa/README.md', '123savvsvfffbb') -> stats.submission.append({_owner: {_repo: {백준: {'1000.테스트': {'aaa': {'README.md': '123savvsvfffbb'}}}}}})
 * @param {string} path - path to file
 * @param {string} sha - sha of file
 * @returns {Promise<void>}
 */
async function updateStatsSHAfromPath(path, sha) {
  const stats = await getStats();
  updateObjectDatafromPath(stats.submission, path, sha);
  await saveStats(stats);
}

function updateObjectDatafromPath(obj, path, data) {
  let current = obj;
  // split path into array and filter out empty strings
  const pathArray = normalizePath(path)
    .split('/')
    .filter((p) => p !== '');
  for (const path of pathArray.slice(0, -1)) {
    // 정규화 수렴으로 파일 sha(문자열)와 하위 경로가 같은 키를 공유할 수 있다
    // (예: 루트에 'Python' 이름의 파일 + Python3/ 폴더 키 수렴 — #346).
    // 비객체 중간 노드는 디렉토리로 대체해 재구축이 중단되지 않게 한다.
    if (isNull(current[path]) || typeof current[path] !== 'object') {
      current[path] = {};
    }
    current = current[path];
  }
  current[pathArray.pop()] = data;
}

/**
 * createTree 에 넘긴 tree 항목으로 submission 캐시를 갱신합니다.
 *
 * createTree 응답의 `tree` 는 base_tree 와 합쳐진 새 트리의 "루트 한 단계" 목록이다
 * (README.md, 백준, 프로그래머스 …). 그것으로 캐시를 갱신하면 최상위 폴더 노드가 tree SHA 문자열로
 * 덮여 해당 레포의 캐시가 통째로 무너진다(e686e20 회귀). 그래서 우리가 올린 항목만 기록한다.
 * - createBlob 으로 만든 항목은 GitHub 가 돌려준 sha 를 그대로 쓰고,
 * - content 를 직접 넣은 항목(전체 업로드)은 git blob SHA 를 로컬에서 계산한다(GitHub 의 blob SHA 와 같다).
 * - 파일(blob)이 아닌 항목(type 'tree' 등)은 캐시 대상이 아니므로 건너뛴다.
 * @param {object} submission - stats.submission
 * @param {string} hook - 'owner/repo'
 * @param {Array<{path: string, type?: string, sha?: string, content?: string}>} treeItems - createTree 에 넘긴 항목
 */
function recordTreeItemsInStats(submission, hook, treeItems) {
  treeItems.forEach((item) => {
    if (!isNull(item.type) && item.type !== 'blob') return;
    let sha = item.sha;
    if (isNull(sha) && typeof item.content === 'string') sha = calculateBlobSHA(item.content);
    if (isNull(sha)) return;
    updateObjectDatafromPath(submission, `${hook}/${item.path}`, sha);
  });
}

/**
 * 커밋이 끝난 뒤 이번 업로드 항목을 submission 캐시에 기록하고 저장합니다.
 * 업로드를 시작할 때 읽어 둔 stats 를 그대로 저장하면, 업로드가 진행되는 동안 다른 탭(다른 플랫폼 포함)이
 * 저장한 기록을 덮어쓴다(전체 업로드는 수 분이 걸린다). 그래서 저장 직전에 다시 읽고 그 위에 이번 항목만 더한다.
 * @param {string} hook - 'owner/repo'
 * @param {string} branch - 커밋한 브랜치 (stats.branches 갱신용, 없으면 그대로 둔다)
 * @param {Array<{path: string, type?: string, sha?: string, content?: string}>} treeItems - 커밋한 tree 항목
 * @returns {Promise<object>} 저장한 stats
 */
async function recordUploadInStats(hook, branch, treeItems) {
  const stats = (await getStats()) || {};
  if (isNull(stats.submission)) stats.submission = {};
  if (isNull(stats.branches)) stats.branches = {};
  if (!isNull(branch)) stats.branches[hook] = branch;
  recordTreeItemsInStats(stats.submission, hook, treeItems);
  await saveStats(stats);
  return stats;
}

/**
 * get stats from path recursively
 * @param {string} path - path to file
 * @returns {Promise<string>} - sha of file
 */
async function getStatsSHAfromPath(path) {
  const stats = await getStats();
  return getObjectDatafromPath(stats.submission, path);
}

function getObjectDatafromPath(obj, path) {
  // path/obj가 비어 있으면(예: hook 미설정) 경로 필터에서 예외가 발생하므로 안전하게 null 반환
  if (isNull(obj) || isNull(path)) return null;
  let current = obj;
  const pathArray = normalizePath(path)
    .split('/')
    .filter((p) => p !== '');
  for (const path of pathArray.slice(0, -1)) {
    // 폴더 자리에 문자열(sha)이 있으면 그 아래 경로는 캐시에 없는 것이다.
    // (e686e20 회귀로 무너진 캐시에서 '0' 같은 세그먼트가 sha 문자열의 글자를 집어오지 않게 한다)
    if (isNull(current[path]) || typeof current[path] !== 'object') {
      return null;
    }
    current = current[path];
  }
  return current[pathArray.pop()];
}

/**
 * github repo에 있는 모든 파일 목록을 가져와서 stats 갱신
 *
 * - 트리를 읽지 못하면(타임아웃·네트워크·5xx) 기존 submission 캐시를 그대로 둔다. 예전에는 모든 실패를 빈 레포로
 *   보고 캐시를 비워 저장해, 전체 업로드가 이미 올린 문제를 전부 다시 파싱·커밋했다. 빈 레포(409)와 레포 없음(404)만
 *   빈 트리로 본다.
 * - 네트워크 작업이 끝난 뒤 stats 를 다시 읽고, 그 사이 다른 탭이 기록한 항목(recordUploadInStats)은 살린다.
 *   트리는 조회 시점의 상태라, 조회 뒤에 다른 탭이 올린 파일의 SHA 를 옛 값으로 되돌리면 안 된다.
 * @param {{version?: string}} [options] - version: 재구축에 성공했을 때 같은 저장에 함께 기록할 버전
 *   (실패하면 기록하지 않아 다음 업로드에서 다시 재구축한다)
 * @returns {Promise<object>} 저장한 stats
 */
async function updateLocalStorageStats({ version = null } = {}) {
  const hook = await getHook();
  const token = await getToken();
  // 연결된 레포나 토큰이 없으면 읽을 것이 없다. 요청을 보내지 않고, 버전도 기록하지 않아 연결한 뒤 재구축한다.
  if (isNull(hook) || isNull(token)) {
    const current = (await getStats()) || {};
    if (isNull(current.submission)) current.submission = {};
    if (isNull(current.branches)) current.branches = {};
    return current;
  }
  const git = new GitHub(hook, token);
  // #346 마이그레이션: 언어별 정리 모드의 구 파이썬 폴더(Python3/PyPy3 등)를 Python/ 으로 통합.
  // 재구축 전에 수행해 이후 getTree 가 통합된 경로를 읽게 한다. 실패(보호 브랜치·경합 등)해도 재구축은
  // 계속하며, 완료 플래그는 표준 상태가 확인된 재구축에서만 기록되므로 그때까지 재구축마다 재검사한다.
  try {
    await runLanguageFolderMigrationIfNeeded(git, hook);
  } catch (e) {
    log('language folder migration failed (will retry on next stats rebuild)', e);
  }
  // 트리 조회 직전의 캐시. 조회 뒤 달라진 항목이 다른 탭의 기록이다.
  const before = flattenSubmission((await getStats())?.submission);
  let tree_items = null; // null: 트리를 읽지 못함
  try {
    const tree = await git.getTree();
    tree_items = Array.isArray(tree) ? tree.filter((item) => item.type === 'blob') : [];
  } catch (e) {
    if (isEmptyRepoError(e)) {
      tree_items = [];
    } else {
      console.error('[BaekjoonHub] 레포 파일 목록을 가져오지 못해 업로드 기록 캐시를 그대로 둡니다. 다음 업로드에서 다시 시도합니다.', e);
    }
  }
  let default_branch = null;
  try {
    default_branch = await git.getDefaultBranchOnRepo();
  } catch (e) {
    log('getDefaultBranchOnRepo failed', e);
  }

  const stats = (await getStats()) || {};
  if (isNull(stats.submission)) stats.submission = {};
  if (isNull(stats.branches)) stats.branches = {};
  if (!isNull(tree_items)) {
    // GitHub tree 기반으로 submission 캐시를 재구축 (삭제된 파일 정리)
    const rebuilt = {};
    tree_items.forEach((item) => {
      updateObjectDatafromPath(rebuilt, `${hook}/${item.path}`, item.sha);
    });
    flattenSubmission(stats.submission).forEach((sha, path) => {
      if (before.get(path) !== sha) updateObjectDatafromPath(rebuilt, path, sha);
    });
    stats.submission = rebuilt;
    if (!isNull(version)) stats.version = version;
  }
  if (!isNull(default_branch)) stats.branches[hook] = default_branch;
  await saveStats(stats);
  log('update stats', stats);
  return stats;
}

/** 트리 조회 실패가 "레포에 커밋이 없음/레포 없음" 이라 빈 트리로 봐도 되는지 */
function isEmptyRepoError(error) {
  return error instanceof GitHubApiError && !(error instanceof GitHubTimeoutError) && (error.status === 409 || error.status === 404);
}

/**
 * 중첩된 submission 캐시를 '경로 → sha' 목록으로 폅니다.
 * @param {object} submission
 * @returns {Map<string, string>}
 */
function flattenSubmission(submission) {
  const out = new Map();
  const walk = (node, prefix) => {
    if (isNull(node) || typeof node !== 'object') return;
    Object.entries(node).forEach(([key, value]) => {
      const path = prefix === '' ? key : `${prefix}/${key}`;
      if (typeof value === 'string') out.set(path, value);
      else walk(value, path);
    });
  };
  walk(submission, '');
  return out;
}

/**
 * 해당 메서드는 프로그래밍 언어별 정리 옵션을 사용할 경우 언어별로 분류 하기 위함입니다.
 * 스토리지에 저장된 {@link getOrgOption}값에 따라 분기 처리됩니다.
 *
 * @param {string} dirName - 기존에 사용되던 분류 방식의 디렉토리 이름입니다.
 * @param {string} language - 'BaekjoonHub_disOption'이 True일 경우에 분리에 사용될 언어 입니다.
 * */
async function getDirNameByOrgOption(dirName, language) {
  if (await getOrgOption() === "language") dirName = `${language}/${dirName}`;
  return dirName;
}

// CSP-safe 템플릿 치환 (eval/new Function 미사용)
function applyDirectoryTemplate(template, variables) {
  return template.replace(/\$\{(\w+)\}/g, (match, key) => {
    return variables.hasOwnProperty(key) ? variables[key] : '';
  });
}

// 플랫폼별 템플릿 저장/조회
async function getDirectoryTemplate(platform) {
  const key = `BaekjoonHub_dirTemplate_${platform}`;
  return await getObjectFromLocalStorage(key);
}

async function saveDirectoryTemplate(platform, template) {
  const key = `BaekjoonHub_dirTemplate_${platform}`;
  return await saveObjectInLocalStorage({ [key]: template });
}

async function buildDirectory(platform, variables) {
  // 언어 폴더명 표준화(#346): 플랫폼별 원시 표기(Python3/PyPy3 등)를 'Python' 으로 통일.
  // 템플릿의 ${language} 와 언어별 정리(getDirNameByOrgOption) 두 분기 모두에 적용된다.
  if (typeof variables.language === 'string') {
    variables = { ...variables, language: normalizeLanguageName(variables.language) };
  }
  const template = await getDirectoryTemplate(platform);
  if (template) {
    return applyDirectoryTemplate(template, variables);
  }
  return getDirNameByOrgOption(variables._defaultDir, variables.language);
}
