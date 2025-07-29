import { getObjectFromLocalStorage, saveObjectInLocalStorage } from "@/commons/storage.js";
import { isNull } from "@/commons/util.js";
import { STORAGE_KEYS } from "@/constants/registry.js";
import log from "@/commons/logger.js";

(async () => {
  const data = await getObjectFromLocalStorage(STORAGE_KEYS.SWEA);
  if (isNull(data)) {
    await saveObjectInLocalStorage({ [STORAGE_KEYS.SWEA]: {} });
  }
})();

/**
 * 문제 내 데이터를 갱신하며, 오래된 문제가 있는 경우 이를 삭제합니다.
 * @param {string} problemId 문제 번호
 * @param {object} obj 저장할 추가 내용
 */
export async function updateProblemData(problemId, obj) {
  const data = await getObjectFromLocalStorage(STORAGE_KEYS.SWEA);
  log.debug("updateProblemData", data);
  log.debug("obj", obj);
  if (isNull(data[problemId])) data[problemId] = {};
  data[problemId] = { ...data[problemId], ...obj, save_date: Date.now() };

  // 기존에 저장한 문제 중 일주일이 경과한 문제 내용들은 모두 삭제합니다.
  const dateWeekAgo = Date.now() - 7 * 86400000;
  log.debug("data before deletion", data);
  log.debug("date a week ago", dateWeekAgo);
  for (const [key, value] of Object.entries(data)) {
    // 무한 방치를 막기 위해 저장일자가 null이면 삭제
    if (isNull(value) || isNull(value.saveDate)) {
      delete data[key];
    }
    const saveDate = new Date(value.saveDate);
    // 1주가 지난 문제는 삭제
    if (dateWeekAgo > saveDate) {
      delete data[key];
    }
  }
  await saveObjectInLocalStorage({ [STORAGE_KEYS.SWEA]: data });
  return data;
}

/**
 * 문제 내 데이터를 가져옵니다.
 * @param {string} problemId 문제 번호
 * @returns {object} 문제 내 데이터
 */
export async function getProblemData(problemId) {
  const data = await getObjectFromLocalStorage(STORAGE_KEYS.SWEA);
  return data[problemId];
}
