import { log, isNull } from './util.js';
import { GitHub } from './Github.js';
import { EnhancedTemplateService } from './template/enhancedTemplate.js';

/**
 * 현재 익스텐션의 버전정보를 반환합니다.
 * @returns {string} - 현재 익스텐션의 버전정보
 */
export function getVersion() {
  return chrome.runtime.getManifest().version;
}

/**
 * @author https://gist.github.com/sumitpore/47439fcd86696a71bf083ede8bbd5466
 * Chrome의 Local StorageArea에서 개체 가져오기
 * @param {string} key
 */
export async function getObjectFromLocalStorage(key) {
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
export async function saveObjectInLocalStorage(obj) {
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
export async function removeObjectFromLocalStorage(keys) {
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
export async function getObjectFromSyncStorage(key) {
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
export async function saveObjectInSyncStorage(obj) {
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
export async function removeObjectFromSyncStorage(keys) {
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

export async function getToken() {
  return await getObjectFromLocalStorage('BaekjoonHub_token');
}

export async function getGithubUsername() {
  return await getObjectFromLocalStorage('BaekjoonHub_username');
}

export async function getStats() {
  return await getObjectFromLocalStorage('stats');
}

export async function getHook() {
  return await getObjectFromLocalStorage('BaekjoonHub_hook');
}

/** welcome.html 의 분기 처리 dis_option에서 설정된 값을 반환합니다. */
export async function getOrgOption() {
  try {
    return await getObjectFromLocalStorage('BaekjoonHub_OrgOption');
  } catch (ex) {
    console.log('The way it works has changed with updates. Update your storage.');
    chrome.storage.local.set({ BaekjoonHub_OrgOption: "platform" }, () => {});
    return "platform";
  }
}

export async function getModeType() {
  return await getObjectFromLocalStorage('mode_type');
}

export async function saveToken(token) {
  return await saveObjectInLocalStorage({ BaekjoonHub_token: token });
}

export async function saveStats(stats) {
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
export async function updateStatsSHAfromPath(path, sha) {
  const stats = await getStats();
  updateObjectDatafromPath(stats.submission, path, sha);
  await saveStats(stats);
}

export function updateObjectDatafromPath(obj, path, data) {
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
export async function getStatsSHAfromPath(path) {
  const stats = await getStats();
  return getObjectDatafromPath(stats.submission, path);
}

export function getObjectDatafromPath(obj, path) {
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
export async function updateLocalStorageStats() {
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
 * 해당 메서드는 문제 디렉토리 구조를 결정합니다.
 * 모든 플랫폼에서 동일한 방식으로 동작하도록 개선되었습니다.
 * 
 * @param {string} dirName - 기존에 사용되던 분류 방식의 디렉토리 이름입니다.
 * @param {string} language - 프로그래밍 언어입니다.
 * @param {Object} data - 문제 데이터 (선택적)
 * @returns {string} - 최종 디렉토리 경로
 */
export async function getDirNameByOrgOption(dirName, language, data = null) {
  try {
    // 플랫폼 식별
    let platform = '';
    if (dirName.startsWith('백준/')) {
      platform = '백준';
    } else if (dirName.startsWith('프로그래머스/')) {
      platform = '프로그래머스';
    } else if (dirName.startsWith('SWEA/')) {
      platform = 'SWEA';
    } else if (dirName.startsWith('goormlevel/')) {
      platform = 'goormlevel';
    } else {
      platform = 'unknown';
    }
    
    // 향상된 템플릿 서비스 사용
    if (data) {
      return await EnhancedTemplateService.getDirNameWithTemplate(platform, dirName, language, data);
    }
    
    // 데이터가 없는 경우 기본 동작
    const useCustomTemplate = await getObjectFromLocalStorage('BaekjoonHub_UseCustomTemplate');
    
    // 커스텀 템플릿 사용이 설정되어 있지만 데이터가 없는 경우 기본 구조 사용
    if (useCustomTemplate !== true) {
      // 언어별 정리 옵션 확인
      if (await getOrgOption() === "language") {
        dirName = `${language}/${dirName}`;
      }
    }
    
    return dirName;
  } catch (error) {
    console.error('디렉토리 구조 생성 중 오류가 발생했습니다:', error);
    return dirName; // 오류 발생 시 기본 디렉토리 반환
  }
}

/**
 * @deprecated
 * level과 관련된 경로를 지우는 임의의 함수 (문제 level이 변경되는 경우 중복된 업로드 파일이 생성됨을 방지하기 위한 목적)
 * ex) _owner/_repo/백준/Gold/1000.테스트/테스트.cpp -> _owner/_repo/백준/1000.테스트/테스트.cpp
 *     _owner/_repo/백준/Silver/1234.테스트/테스트.cpp -> _owner/_repo/백준/1234.테스트/테스트.cpp
 * @param {string} path - 파일의 경로 문자열
 * @returns {string} - 레벨과 관련된 경로를 제거한 문자열
 */
export function _baekjoonRankRemoverFilter(path) {
  return path.replace(/\/(Unrated|Silver|Bronze|Gold|Platinum|Diamond|Ruby|Master)\//g, '/');
}

/**
 * @deprecated
 * level과 관련된 경로를 지우는 임의의 함수 (문제 level이 변경되는 경우 중복된 업로드 파일이 생성됨을 방지하기 위한 목적)
 * @param {string} path - 파일의 경로 문자열
 * @returns {string} - 레벨과 관련된 경로를 제거한 문자열
 */
export function _programmersRankRemoverFilter(path) {
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
export function _baekjoonSpaceRemoverFilter(path) {
  return path.replace(/( | |&nbsp|&#160|&#8197|%E2%80%85|%20)/g, '');
}

/**
 * @deprecated
 * 경로에 존재하는 레벨과 관련된 경로를 지우는 임의의 함수 (문제 level이 변경되는 경우 중복된 업로드 파일이 생성됨을 방지하기 위한 목적)
 * @param {string} path - 파일의 경로 문자열
 * @returns {string} - 레벨과 관련된 경로를 제거한 문자열
 */
export function _swexpertacademyRankRemoveFilter(path) {
  return path.replace(/\/D([0-8]+)\//g, '/');
}

// Initialize storage on module load
(function initializeStorage() {
  // Sync to local storage
  chrome.storage.local.get('isSync', (data) => {
    const keys = ['BaekjoonHub_token', 'BaekjoonHub_username', 'pipe_baekjoonhub', 'stats', 'BaekjoonHub_hook', 'mode_type'];
    if (!data || !data.isSync) {
      keys.forEach((key) => {
        chrome.storage.sync.get(key, (data) => {
          chrome.storage.local.set({ [key]: data[key] });
        });
      });

      chrome.storage.local.set({ isSync: true }, () => {
        console.log('BaekjoonHub Synced to local values');
      });
    } else {
      console.log('BaekjoonHub Local storage already synced!');
    }
  });

  // Initialize stats
  getStats().then((stats) => {
    if (isNull(stats)) stats = {};
    if (isNull(stats.version)) stats.version = '0.0.0';
    if (isNull(stats.branches) || stats.version !== getVersion()) stats.branches = {};
    if (isNull(stats.submission) || stats.version !== getVersion()) stats.submission = {};
    if (isNull(stats.problems) || stats.version !== getVersion()) stats.problems = {};
    saveStats(stats);
  });
})();
