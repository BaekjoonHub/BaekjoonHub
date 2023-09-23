/* 
    비활성화시 작동되지 않게 함
    가독성을 위해 따로 파일 분리함
*/
async function checkEnable() {
  try{
    const enable = await getObjectFromLocalStorage('bjhEnable');
    if (!enable) writeEnableMsgOnLog();
    return enable;
  }
  catch{
    writeEnableMsgOnLog();
    return false;
  }
}

function writeEnableMsgOnLog() {
  const errMsg = '확장이 활성화되지 않았습니다. 확장을 활성화하고 시도해주세요';
  console.log(errMsg);
}
