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
    if (isNull(current[path])) {
      return null;
    }
    current = current[path];
  }
  return current[pathArray.pop()];
}

/* github repo에 있는 모든 파일 목록을 가져와서 stats 갱신 */
async function updateLocalStorageStats() {
  const hook = await getHook();
  const token = await getToken();
  const git = new GitHub(hook, token);
  // #346 마이그레이션: 언어별 정리 모드의 구 파이썬 폴더(Python3/PyPy3 등)를 Python/ 으로 통합.
  // 재구축 전에 수행해 이후 getTree 가 통합된 경로를 읽게 한다. 실패(보호 브랜치·경합 등)해도 재구축은
  // 계속하며, 완료 플래그는 표준 상태가 확인된 재구축에서만 기록되므로 그때까지 재구축마다 재검사한다.
  try {
    await runLanguageFolderMigrationIfNeeded(git, hook);
  } catch (e) {
    log('language folder migration failed (will retry on next stats rebuild)', e);
  }
  const stats = await getStats();
  const tree_items = [];
  try {
    const tree = await git.getTree();
    if (Array.isArray(tree)) {
      tree.forEach((item) => {
        if (item.type === 'blob') {
          tree_items.push(item);
        }
      });
    }
  } catch (e) {
    // 빈 레포(커밋 없음)인 경우 tree가 없으므로 무시
    log('getTree failed (empty repo?)', e);
  }
  // GitHub tree 기반으로 submission 캐시를 재구축 (삭제된 파일 정리)
  stats.submission = {};
  tree_items.forEach((item) => {
    updateObjectDatafromPath(stats.submission, `${hook}/${item.path}`, item.sha);
  });
  try {
    const default_branch = await git.getDefaultBranchOnRepo();
    stats.branches[hook] = default_branch;
  } catch (e) {
    log('getDefaultBranchOnRepo failed', e);
  }
  await saveStats(stats);
  log('update stats', stats);
  return stats;
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
