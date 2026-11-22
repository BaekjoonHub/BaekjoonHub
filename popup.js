/* global I18N */
/* eslint no-undef: "error" */

I18N.init();

const WELCOME_URL = chrome.runtime.getURL('welcome.html');
$('#welcome_URL').attr('href', WELCOME_URL);
$('#status_action').attr('href', WELCOME_URL);

function showStatus(textKey, actionKey) {
  $('#commit_mode').hide();
  I18N.bind($('#status_text').show()[0], textKey, null, 'text');
  I18N.bind($('#status_action').show()[0], actionKey, null, 'text');
}

function render(data) {
  const hook = data.BaekjoonHub_hook;
  if (!data.BaekjoonHub_token) {
    showStatus('popup.status.needAuth', 'popup.action.start');
  } else if (data.mode_type !== 'commit' || !hook) {
    showStatus('popup.status.needRepo', 'popup.action.pickRepo');
  } else {
    $('#status_text, #status_action').hide();
    $('#repo_link').attr('href', `https://github.com/${hook}`).text(hook);
    $('#commit_mode').show();
  }
}

chrome.storage.local.get(['BaekjoonHub_token', 'mode_type', 'BaekjoonHub_hook'], (data) => {
  render(data);
  const token = data.BaekjoonHub_token;
  if (!token) return;
  // Only a 401 proves the token is bad; offline, rate limits and 5xx keep the rendered state.
  const xhr = new XMLHttpRequest();
  xhr.addEventListener('load', () => {
    if (xhr.status === 401) {
      chrome.storage.local.set({ BaekjoonHub_token: null }, () => {
        render(Object.assign({}, data, { BaekjoonHub_token: null }));
      });
    }
  });
  xhr.open('GET', 'https://api.github.com/user', true);
  xhr.setRequestHeader('Authorization', `token ${token}`);
  xhr.send();
});

function showToggleState() {
  I18N.bind($('#toggle_state')[0], $('#onffbox').is(':checked') ? 'popup.toggle.on' : 'popup.toggle.off', null, 'text');
}

/*
  초기에 활성화 데이터가 존재하는지 확인, 없으면 새로 생성, 있으면 있는 데이터에 맞게 버튼 조정
 */
chrome.storage.local.get('bjhEnable', (data4) => {
  $('#onffbox').prop('checked', data4.bjhEnable === undefined ? true : data4.bjhEnable);
  chrome.storage.local.set({ 'bjhEnable': $('#onffbox').is(':checked') }, () => { });
  showToggleState();
});
/*
  활성화 버튼 클릭 시 storage에 활성 여부 데이터를 저장.
 */
$('#onffbox').on('change', () => {
  chrome.storage.local.set({ 'bjhEnable': $('#onffbox').is(':checked') }, () => { });
  showToggleState();
});
