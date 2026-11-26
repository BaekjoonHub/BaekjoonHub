/* 팝업의 스위치(bjhEnable)가 꺼져 있으면 업로드하지 않는다 */
async function checkEnable() {
  const enable = await getObjectFromLocalStorage('bjhEnable');
  if (!enable) console.log('확장이 활성화되지 않았습니다. 확장을 활성화하고 시도해주세요');
  return enable;
}
