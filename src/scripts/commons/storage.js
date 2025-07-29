import { isNull } from "./util.js";
import { STORAGE_KEYS } from "@/constants/registry.js";
import { GitHub } from "./github.js";
import EnhancedTemplateService from "./enhancedtemplate.js";
import log from "@/commons/logger.js";

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
  log.info("storage.js: getObjectFromLocalStorage called with key:", key);
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(key, (value) => {
        if (Array.isArray(key)) {
          log.debug("storage.js: getObjectFromLocalStorage resolved with value:", value);
          resolve(value);
        } else {
          log.debug("storage.js: getObjectFromLocalStorage resolved with value[key]:", value[key]);
          resolve(value[key]);
        }
      });
    } catch (ex) {
      log.error("storage.js: Error in getObjectFromLocalStorage:", ex);
    }
  });
}

/**
 * @author https://gist.github.com/sumitpore/47439fcd86696a71bf083ede8bbd5466
 * Chrome의 Local StorageArea에 개체 저장
 * @param {*} obj
 */
export async function saveObjectInLocalStorage(obj) {
  log.info("storage.js: saveObjectInLocalStorage called with obj:", obj);
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(obj, () => {
        log.debug("storage.js: saveObjectInLocalStorage resolved.");
        resolve();
      });
    } catch (ex) {
      log.error("storage.js: Error in saveObjectInLocalStorage:", ex);
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
  log.info("storage.js: removeObjectFromLocalStorage called with keys:", keys);
  return new Promise((resolve) => {
    try {
      chrome.storage.local.remove(keys, () => {
        log.debug("storage.js: removeObjectFromLocalStorage resolved.");
        resolve();
      });
    } catch (ex) {
      log.error("storage.js: Error in removeObjectFromLocalStorage:", ex);
    }
  });
}

/**
 * Chrome의 Sync StorageArea에서 개체 가져오기
 * @param {string} key
 */
export async function getObjectFromSyncStorage(key) {
  log.info("storage.js: getObjectFromSyncStorage called with key:", key);
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(key, (value) => {
        log.debug("storage.js: getObjectFromSyncStorage resolved with value[key]:", value[key]);
        resolve(value[key]);
      });
    } catch (ex) {
      log.error("storage.js: Error in getObjectFromSyncStorage:", ex);
    }
  });
}

/**
 * Chrome의 Sync StorageArea에 개체 저장
 * @param {*} obj
 */
export async function saveObjectInSyncStorage(obj) {
  log.info("storage.js: saveObjectInSyncStorage called with obj:", obj);
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.set(obj, () => {
        log.debug("storage.js: saveObjectInSyncStorage resolved.");
        resolve();
      });
    } catch (ex) {
      log.error("storage.js: Error in saveObjectInSyncStorage:", ex);
    }
  });
}

/**
 * Chrome Sync StorageArea에서 개체 제거
 * @param {string or array of string keys} keys
 */
export async function removeObjectFromSyncStorage(keys) {
  log.info("storage.js: removeObjectFromSyncStorage called with keys:", keys);
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.remove(keys, () => {
        log.debug("storage.js: removeObjectFromSyncStorage resolved.");
        resolve();
      });
    } catch (ex) {
      log.error("storage.js: Error in removeObjectFromSyncStorage:", ex);
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
  const stats = await getObjectFromLocalStorage(STORAGE_KEYS.STATS);

  // stats가 null이거나 undefined인 경우 기본 객체 반환
  if (!stats) {
    const defaultStats = {
      version: "0.0.0",
      branches: {},
      submission: {},
      problems: {},
    };
    // 기본값을 저장해서 다음번에 문제가 생기지 않도록 함
    await saveStats(defaultStats);
    return defaultStats;
  }

  // 각 필드가 존재하는지 확인하고 없으면 초기화
  if (!stats.branches) stats.branches = {};
  if (!stats.submission) stats.submission = {};
  if (!stats.problems) stats.problems = {};
  if (!stats.version) stats.version = "0.0.0";

  return stats;
}

export async function getHook() {
  return getObjectFromLocalStorage(STORAGE_KEYS.HOOK);
}

/** @deprecated settings.html 의 분기 처리 dis_option에서 설정된 값을 반환합니다. 현재는 사용되지 않습니다. */
export async function getOrgOption() {
  try {
    return getObjectFromLocalStorage(STORAGE_KEYS.ORG_OPTION);
  } catch (ex) {
    log.warn("The way it works has changed with updates. Update your storage.");
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
  // obj가 null이거나 undefined인 경우 에러 로그만 찍고 처리하지 않음
  if (!obj) {
    log.error("updateObjectDatafromPath: obj is null or undefined", { obj, path, data });
    return;
  }

  try {
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

    const lastKey = pathArray.pop();
    if (lastKey) {
      current[lastKey] = data;
    }
  } catch (error) {
    log.error("updateObjectDatafromPath error:", error, { obj, path, data });
  }
}

export function getObjectDatafromPath(obj, path) {
  // obj가 null이거나 undefined인 경우 null 반환
  if (!obj) {
    log.warn("getObjectDatafromPath: obj is null or undefined", { obj, path });
    return null;
  }

  try {
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

    const lastKey = pathArray.pop();
    return lastKey ? current[lastKey] : null;
  } catch (error) {
    log.error("getObjectDatafromPath error:", error, { obj, path });
    return null;
  }
}

export async function updateStatsSHAfromPath(path, sha) {
  const stats = await getStats();

  if (!stats.submission) {
    stats.submission = {};
  }

  updateObjectDatafromPath(stats.submission, path, sha);
  await saveStats(stats);
}

export async function getStatsSHAfromPath(path) {
  const stats = await getStats();

  if (!stats.submission) {
    return null;
  }

  return getObjectDatafromPath(stats.submission, path);
}

export async function updateLocalStorageStats() {
  try {
    const hook = await getHook();
    const token = await getToken();

    if (!hook || !token) {
      log.error("Missing hook or token for updateLocalStorageStats", { hook, token });
      return await getStats(); // 기존 stats 반환
    }

    const git = new GitHub(hook, token);
    let stats = await getStats(); // getStats에서 이미 초기화된 객체를 반환함
    const treeItems = [];

    // 이중 확인 - getStats에서 이미 초기화되지만 한번 더 확인
    if (!stats.submission) {
      stats.submission = {};
    }
    if (!stats.branches) {
      stats.branches = {};
    }

    try {
      const tree = await git.getTree();
      // tree가 유효한 배열인지 확인
      if (Array.isArray(tree)) {
        tree.forEach((item) => {
          if (item && item.type === "blob" && item.path) {
            treeItems.push(item);
          }
        });
      } else {
        log.warn("getTree returned invalid data:", tree);
      }
    } catch (error) {
      log.error("Error getting tree from GitHub:", error);
    }

    // submission이 존재하는지 다시 한번 확인
    if (stats.submission) {
      treeItems.forEach((item) => {
        try {
          updateObjectDatafromPath(stats.submission, `${hook}/${item.path}`, item.sha);
        } catch (error) {
          log.error("Error updating object data from path:", error, item);
        }
      });
    }

    try {
      const defaultBranch = await git.getDefaultBranchOnRepo();
      if (defaultBranch && stats.branches) {
        stats.branches[hook] = defaultBranch;
      }
    } catch (error) {
      log.error("Error getting default branch:", error);
      // branches가 존재할 때만 기본값 설정
      if (stats.branches) {
        stats.branches[hook] = "main";
      }
    }

    await saveStats(stats);
    log.debug("update stats", stats);
    return stats;
  } catch (error) {
    log.error("Critical error in updateLocalStorageStats:", error);
    // 오류 발생 시 기본 stats 반환
    return await getStats();
  }
}

export async function getDirNameByTemplate(dirName, language, data = null) {
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

    const useCustomTemplate = await getObjectFromLocalStorage(STORAGE_KEYS.USE_CUSTOM_TEMPLATE);
    const customTemplate = await getObjectFromLocalStorage(STORAGE_KEYS.DIR_TEMPLATE);

    if (useCustomTemplate && customTemplate) {
      return EnhancedTemplateService.getDirNameWithTemplate(platform, dirName, language, data, true, customTemplate, "custom");
    }

    // 기본 템플릿 사용 (언어별 정리)
    return `${language}/${dirName}`;
  } catch (error) {
    log.error("디렉토리 구조 생성 중 오류가 발생했습니다:", error);
    return dirName;
  }
}

export function initializeStorage() {
  getObjectFromLocalStorage(STORAGE_KEYS.IS_SYNC).then((data) => {
    const keys = [STORAGE_KEYS.TOKEN, STORAGE_KEYS.USERNAME, STORAGE_KEYS.PIPE, STORAGE_KEYS.STATS, STORAGE_KEYS.HOOK, STORAGE_KEYS.MODE_TYPE];
    if (data && data.isSync) {
      log.info("BaekjoonHub Local storage already synced!");
      return;
    }

    keys.forEach(async (key) => {
      const localValue = await getObjectFromLocalStorage(key);
      if (isNull(localValue)) {
        chrome.storage.sync.get(key, (data) => {
          saveObjectInLocalStorage({ [key]: data[key] });
        });
      }
    });

    saveObjectInLocalStorage({ [STORAGE_KEYS.IS_SYNC]: true }).then(() => {
      log.info("BaekjoonHub Synced to local values");
    });
  });

  getStats().then((stats) => {
    // getStats에서 이미 기본값을 반환하므로 stats는 항상 유효한 객체
    let needsUpdate = false;

    if (!stats.version || stats.version === "0.0.0") {
      stats.version = getVersion();
      needsUpdate = true;
    }

    if (!stats.branches || stats.version !== getVersion()) {
      stats.branches = {};
      needsUpdate = true;
    }

    if (!stats.submission || stats.version !== getVersion()) {
      stats.submission = {};
      needsUpdate = true;
    }

    if (!stats.problems || stats.version !== getVersion()) {
      stats.problems = {};
      needsUpdate = true;
    }

    // 버전이 다르면 업데이트
    if (stats.version !== getVersion()) {
      stats.version = getVersion();
      needsUpdate = true;
    }

    if (needsUpdate) {
      saveStats(stats);
    }
  });
}
