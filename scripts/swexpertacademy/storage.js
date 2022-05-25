/*
    로컬스토리지에 swea 객체가 없는 경우 생성
*/
getObjectFromLocalStorage('swea').then((data) => {
  if (isNull(data)) {
    saveObjectInLocalStorage({ swea: {} });
  }
});

/**
 * 문제 내 데이터를 갱신하며, 오래된 문제가 있는 경우 이를 삭제합니다.
 * @param {string} problemId 문제 번호
 * @param {object} obj 저장할 추가 내용
 */
async function updateProblemData(problemId, obj) {
  return getObjectFromLocalStorage('swea').then((data) => {
    if (debug) console.log('updateProblemData', data);
    if (debug) console.log('obj', obj);
    if (isNull(data[problemId])) data[problemId] = {};
    data[problemId] = { ...data[problemId], ...obj, save_date: Date.now() };

    // 기존에 저장한 문제 중 일주일이 경과한 문제 내용들은 모두 삭제합니다.
    const date_week_ago = Date.now() - 7 * 86400000;
    if (debug) console.log('data before deletion', data);
    if (debug) console.log('date a week ago', date_week_ago);
    for (const [key, value] of Object.entries(data)) {
      // 무한 방치를 막기 위해 저장일자가 null이면 삭제
      if (isNull(value) || isNull(value.save_date)) {
        delete data[key];
      }
      const save_date = new Date(value.save_date);
      // 1주가 지난 문제는 삭제
      if (date_week_ago > save_date) {
        delete data[key];
      }
    }
    saveObjectInLocalStorage({ swea: data });
    return data;
  });
}

/**
 * 문제 내 데이터를 가져옵니다.
 * @param {string} problemId 문제 번호
 * @returns {object} 문제 내 데이터
 */
async function getProblemData(problemId) {
  return getObjectFromLocalStorage('swea').then((data) => data[problemId]);
}
