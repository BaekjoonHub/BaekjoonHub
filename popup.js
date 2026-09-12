/* global oAuth2, I18N */
/* eslint no-undef: "error" */

I18N.init();

let action = false;

$('#authenticate').on('click', () => {
  if (action) {
    oAuth2.begin();
  }
});

/* Get URL for welcome page */
$('#welcome_URL').attr('href', `chrome-extension://${chrome.runtime.id}/welcome.html`);
$('#hook_URL').attr('href', `chrome-extension://${chrome.runtime.id}/welcome.html`);

// Ask the background script to validate the GitHub token. The raw token is
// never loaded into popup.js's context, only an authenticated boolean is
// returned, which limits what a popup-side XSS could ever exfiltrate.
chrome.runtime.sendMessage({ task: 'checkGithubAuth' }, (response) => {
  if (!response || !response.authenticated) {
    action = true;
    $('#auth_mode').show();
  } else {
    /* Show MAIN FEATURES */
    chrome.storage.local.get('mode_type', (data2) => {
      if (data2 && data2.mode_type === 'commit') {
        $('#commit_mode').show();
        /* Get problem stats and repo link */
        chrome.storage.local.get(['stats', 'BaekjoonHub_hook'], (data3) => {
          const BaekjoonHubHook = data3.BaekjoonHub_hook;
          if (BaekjoonHubHook) {
            const repoLink = `<a target="blank" style="color: cadetblue !important;" href="https://github.com/${BaekjoonHubHook}">${BaekjoonHubHook}</a>`;
            const updateRepoUrl = () => {
              $('#repo_url').html(`${I18N.t('popup.yourRepo')} ${repoLink}`);
            };
            updateRepoUrl();
            I18N.onChange(updateRepoUrl);
          }
        });
      } else {
        $('#hook_mode').show();
      }
    });
  }
});

/*
  초기에 활성화 데이터가 존재하는지 확인, 없으면 새로 생성, 있으면 있는 데이터에 맞게 버튼 조정
 */
chrome.storage.local.get('bjhEnable', (data4) => {
  if (data4.bjhEnable === undefined) {
    $('#onffbox').prop('checked', true);
    chrome.storage.local.set({ 'bjhEnable': $('#onffbox').is(':checked') }, () => { });
  }
  else {
    $('#onffbox').prop('checked', data4.bjhEnable);
    chrome.storage.local.set({ 'bjhEnable': $('#onffbox').is(':checked') }, () => { });
  }
})
/*
  활성화 버튼 클릭 시 storage에 활성 여부 데이터를 저장.
 */
$('#onffbox').on('click', () => {
  chrome.storage.local.set({ 'bjhEnable': $('#onffbox').is(':checked') }, () => { });
});