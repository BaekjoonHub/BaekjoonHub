import { log, isNull } from "./util.js";
import { STORAGE_KEYS } from "@/constants/registry.js";
import { GitHub } from "./github.js";
import EnhancedTemplateService from "./enhancedtemplate.js";

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
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(key, (value) => {
        if (Array.isArray(key)) {
          resolve(value);
        } else {
          resolve(value[key]);
        }
      });
    } catch (ex) {
      console.error(ex);
    }
  });
}

/**
 * @author https://gist.github.com/sumitpore/47439fcd86696a71bf083ede8bbd5466
 * Chrome의 Local StorageArea에 개체 저장
 * @param {*} obj
 */
export async function saveObjectInLocalStorage(obj) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(obj, () => {
        resolve();
      });
    } catch (ex) {
      console.error(ex);
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
  return new Promise((resolve) => {
    try {
      chrome.storage.local.remove(keys, () => {
        resolve();
      });
    } catch (ex) {
      console.error(ex);
    }
  });
}

/**
 * Chrome의 Sync StorageArea에서 개체 가져오기
 * @param {string} key
 */
export async function getObjectFromSyncStorage(key) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(key, (value) => {
        resolve(value[key]);
      });
    } catch (ex) {
      console.error(ex);
    }
  });
}

/**
 * Chrome의 Sync StorageArea에 개체 저장
 * @param {*} obj
 */
export async function saveObjectInSyncStorage(obj) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.set(obj, () => {
        resolve();
      });
    } catch (ex) {
      console.error(ex);
    }
  });
}

/**
 * Chrome Sync StorageArea에서 개체 제거
 * @param {string or array of string keys} keys
 */
export async function removeObjectFromSyncStorage(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.remove(keys, () => {
        resolve();
      });
    } catch (ex) {
      console.error(ex);
    }
  });
}

export async function getToken() {
  return getObjectFromLocalStorage(STORAGE_KEYS.TOKEN);
}

export async function getGithubUsername() {
  return getObjectFromLocalStorage(STORAGE_KEYS.USERNAME);
}

export async function getStats() {
  return getObjectFromLocalStorage(STORAGE_KEYS.STATS);
}

export async function getHook() {
  return getObjectFromLocalStorage(STORAGE_KEYS.HOOK);
}

/** settings.html 의 분기 처리 dis_option에서 설정된 값을 반환합니다. */
export async function getOrgOption() {
  try {
    return getObjectFromLocalStorage(STORAGE_KEYS.ORG_OPTION);
  } catch (ex) {
    console.log("The way it works has changed with updates. Update your storage.");
    saveObjectInLocalStorage({ [STORAGE_KEYS.ORG_OPTION]: "platform" });
    return "platform";
  }
}

export async function getModeType() {
  return getObjectFromLocalStorage(STORAGE_KEYS.MODE_TYPE);
}

export async function saveToken(token) {
  return saveObjectInLocalStorage({ [STORAGE_KEYS.TOKEN]: token });
}

export async function saveStats(stats) {
  return saveObjectInLocalStorage({ [STORAGE_KEYS.STATS]: stats });
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
export function _baekjoonRankRemoverFilter(path) {
  return path.replace(/\/(Unrated|Silver|Bronze|Gold|Platinum|Diamond|Ruby|Master)\//g, "/");
}

export function _programmersRankRemoverFilter(path) {
  return path.replace(/\/(lv[0-9]|unrated)\//g, "/");
}

export function _baekjoonSpaceRemoverFilter(path) {
  return path.replace(/( | |&nbsp|&#160|&#8197|%E2%80%85|%20)/g, "");
}

export function _swexpertacademyRankRemoveFilter(path) {
  return path.replace(/\/D([0-8]+)\//g, "/");
}

export function updateObjectDatafromPath(obj, path, data) {
  let current = obj;
  const pathArray = _swexpertacademyRankRemoveFilter(_baekjoonSpaceRemoverFilter(_programmersRankRemoverFilter(_baekjoonRankRemoverFilter(path))))
    .split("/")
    .filter((p) => p !== "");

  for (const p of pathArray.slice(0, -1)) {
    if (isNull(current[p])) {
      current[p] = {};
    }
    current = current[p];
  }

  current[pathArray.pop()] = data;
}

export function getObjectDatafromPath(obj, path) {
  let current = obj;
  const pathArray = _swexpertacademyRankRemoveFilter(_baekjoonSpaceRemoverFilter(_programmersRankRemoverFilter(_baekjoonRankRemoverFilter(path))))
    .split("/")
    .filter((p) => p !== "");

  for (const p of pathArray.slice(0, -1)) {
    if (isNull(current[p])) {
      return null;
    }
    current = current[p];
  }

  return current[pathArray.pop()];
}

export async function updateStatsSHAfromPath(path, sha) {
  const stats = await getStats();
  updateObjectDatafromPath(stats.submission, path, sha);
  await saveStats(stats);
}

export async function getStatsSHAfromPath(path) {
  const stats = await getStats();
  return getObjectDatafromPath(stats.submission, path);
}

export async function updateLocalStorageStats() {
  const hook = await getHook();
  const token = await getToken();
  const git = new GitHub(hook, token);
  const stats = await getStats();
  const treeItems = [];

  await git.getTree().then((tree) => {
    tree.forEach((item) => {
      if (item.type === "blob") {
        treeItems.push(item);
      }
    });
  });

  const { submission } = stats;
  treeItems.forEach((item) => {
    updateObjectDatafromPath(submission, `${hook}/${item.path}`, item.sha);
  });

  const defaultBranch = await git.getDefaultBranchOnRepo();
  stats.branches[hook] = defaultBranch;
  await saveStats(stats);
  log("update stats", stats);
  return stats;
}

export async function getDirNameByOrgOption(dirName, language, data = null) {
  try {
    let platform = "";
    if (dirName.startsWith("백준/")) {
      platform = "백준";
    } else if (dirName.startsWith("프로그래머스/")) {
      platform = "프로그래머스";
    } else if (dirName.startsWith("SWEA/")) {
      platform = "SWEA";
    } else if (dirName.startsWith("goormlevel/")) {
      platform = "goormlevel";
    }

    const orgOption = await getOrgOption();
    const customTemplate = await getObjectFromLocalStorage(STORAGE_KEYS.DIR_TEMPLATE);

    if (orgOption === "custom") {
      return EnhancedTemplateService.getDirNameWithTemplate(platform, dirName, language, data, true, customTemplate, "custom");
    }
    if (orgOption === "language") {
      return `${language}/${dirName}`;
    }

    return dirName;
  } catch (error) {
    console.error("디렉토리 구조 생성 중 오류가 발생했습니다:", error);
    return dirName;
  }
}

export function initializeStorage() {
  getObjectFromLocalStorage(STORAGE_KEYS.IS_SYNC).then((data) => {
    const keys = [STORAGE_KEYS.TOKEN, STORAGE_KEYS.USERNAME, STORAGE_KEYS.PIPE, STORAGE_KEYS.STATS, STORAGE_KEYS.HOOK, STORAGE_KEYS.MODE_TYPE];
    if (data && data.isSync) {
      console.log("BaekjoonHub Local storage already synced!");
      return;
    }

    keys.forEach((key) => {
      chrome.storage.sync.get(key, (data) => {
        saveObjectInLocalStorage({ [key]: data[key] });
      });
    });

    saveObjectInLocalStorage({ [STORAGE_KEYS.IS_SYNC]: true }).then(() => {
      console.log("BaekjoonHub Synced to local values");
    });
  });

  getStats().then((stats) => {
    let newStats = stats;
    if (isNull(newStats)) newStats = {};
    if (isNull(newStats.version)) newStats.version = "0.0.0";
    if (isNull(newStats.branches) || newStats.version !== getVersion()) newStats.branches = {};
    if (isNull(newStats.submission) || newStats.version !== getVersion()) newStats.submission = {};
    if (isNull(newStats.problems) || newStats.version !== getVersion()) newStats.problems = {};
    saveStats(newStats);
  });
}
