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
  if (isNull(stats.submission) || stats.version !== getVersion()) stats.submission = {};
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
  const pathArray = _swexpertacademyRankRemoveFilter(_baekjoonSpaceRemoverFilter(_programmersRankRemoverFilter(_baekjoonRankRemoverFilter(path))))
    .split('/')
    .filter((p) => p !== '');
  for (const path of pathArray.slice(0, -1)) {
    if (isNull(current[path])) {
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
  let current = obj;
  const pathArray = _swexpertacademyRankRemoveFilter(_baekjoonSpaceRemoverFilter(_programmersRankRemoverFilter(_baekjoonRankRemoverFilter(path))))
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
  const stats = await getStats();
  const tree_items = [];
  await git.getTree().then((tree) => {
    tree.forEach((item) => {
      if (item.type === 'blob') {
        tree_items.push(item);
      }
    });
  });
  const { submission } = stats;
  tree_items.forEach((item) => {
    updateObjectDatafromPath(submission, `${hook}/${item.path}`, item.sha);
  });
  const default_branch = await git.getDefaultBranchOnRepo();
  stats.branches[hook] = default_branch;
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


/**
 * @deprecated
 * level과 관련된 경로를 지우는 임의의 함수 (문제 level이 변경되는 경우 중복된 업로드 파일이 생성됨을 방지하기 위한 목적)
 * ex) _owner/_repo/백준/Gold/1000.테스트/테스트.cpp -> _owner/_repo/백준/1000.테스트/테스트.cpp
 *     _owner/_repo/백준/Silver/1234.테스트/테스트.cpp -> _owner/_repo/백준/1234.테스트/테스트.cpp
 * @param {string} path - 파일의 경로 문자열
 * @returns {string} - 레벨과 관련된 경로를 제거한 문자열
 */
function _baekjoonRankRemoverFilter(path) {
  return path.replace(/\/(Unrated|Silver|Bronze|Gold|Platinum|Diamond|Ruby|Master)\//g, '/');
}

/**
 * @deprecated
 * level과 관련된 경로를 지우는 임의의 함수 (문제 level이 변경되는 경우 중복된 업로드 파일이 생성됨을 방지하기 위한 목적)
 * @param {string} path - 파일의 경로 문자열
 * @returns {string} - 레벨과 관련된 경로를 제거한 문자열
 */
function _programmersRankRemoverFilter(path) {
  return path.replace(/\/(lv[0-9]|unrated)\//g, '/');
}

/**
 * @deprecated
 * 경로에 존재하는 공백을 제거하는 임의의 함수 (기존의 업로드한 문제들이 이중으로 업로드 되는 오류를 방지)
 * ex) _owner/_repo/백준/1000. 테스트/테스트.cpp -> _owner/_repo/백준/1000.테스트/테스트.cpp
 *     _owner/_repo/백준/1234.%20테스트/테스트.cpp -> _owner/_repo/백준/1234.테스트/테스트.cpp
 *     _owner/_repo/백준/1234.테스트/테%E2%80%85스%E2%80%85트.cpp -> _owner/_repo/백준/1234.테스트/테스트.cpp
 * @param {string} path - 파일의 경로 문자열
 * @returns {string} - 공백과 관련된 값을 제거한 문자열
 */
function _baekjoonSpaceRemoverFilter(path) {
  return path.replace(/( | |&nbsp|&#160|&#8197|%E2%80%85|%20)/g, '');
}

/**
 * @deprecated
 * 경로에 존재하는 레벨과 관련된 경로를 지우는 임의의 함수 (문제 level이 변경되는 경우 중복된 업로드 파일이 생성됨을 방지하기 위한 목적)
 * @param {string} path - 파일의 경로 문자열
 * @returns {string} - 레벨과 관련된 경로를 제거한 문자열
 */
function _swexpertacademyRankRemoveFilter(path) {
  return path.replace(/\/D([0-8]+)\//g, '/');
}
