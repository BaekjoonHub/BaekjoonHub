/* 
  백준 업데이트 시 호환성을 보장하기 위한 스크립트입니다.
  버전마다 내용이 다르며 버전이 다를 때만 사용되어야합니다.
*/

function insertUpdateButton() {
  let elem = document.getElementById('BaekjoonHub_update_element');
  if (elem !== undefined) {
    elem = document.createElement('span');
    elem.id = 'BaekjoonHub_update_element';
    elem.className = 'runcode-wrapper__8rXm';
    elem.style = 'margin-left: 10px;padding-top: 0px;';
  }

  const button = document.createElement('button');
  button.className = 'BaekjoonHub_update';
  button.id = 'BaekjoonHub_update_elem';
  button.innerHTML = '업데이트 실행';
  button.onclick = updateAlert;
  elem.append(button);

  const target = document.getElementById('status-table').childNodes[1].childNodes[0].childNodes[3];
  if (target.childNodes.length > 0) {
    target.childNodes[0].append(elem);
  }
}

function updateAlert() {
  console.log('click');
  if (confirm('업데이트 사항을 확인하였습니다')) {
    updateLocalStorage();
  }
}

/* 추후 개발 예정 */
function updateLocalStorage() {}
