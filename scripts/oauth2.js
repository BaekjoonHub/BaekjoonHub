// eslint-disable-next-line no-unused-vars
const oAuth2 = {
  /**
   * Initialize
   */
  init() {
    this.KEY = 'BaekjoonHub_token';
    this.ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
    this.AUTHORIZATION_URL = 'https://github.com/login/oauth/authorize';
    this.CLIENT_ID = '975f8d5cf6686dd1faed';
    this.CLIENT_SECRET = '934b2bfc3bb3ad239bc67bdfa81a378b1616dd1e';
    // GitHub 메인(/)은 로그인 상태에서 /feed 로 리다이렉트되며 ?code= 가 사라지므로,
    // 리다이렉트되지 않는 하위 경로를 콜백으로 사용한다. (등록된 Callback URL https://github.com/ 의 하위 경로여야 함)
    this.REDIRECT_URL = 'https://github.com/BaekjoonHub/BaekjoonHub';
    this.SCOPES = ['repo'];
  },

  /**
   * Begin
   */
  begin() {
    this.init(); // secure token params.

    let url = `${this.AUTHORIZATION_URL}?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.REDIRECT_URL)}&scope=`;

    for (let i = 0; i < this.SCOPES.length; i += 1) {
      url += this.SCOPES[i];
    }

    chrome.storage.local.set({ pipe_baekjoonhub: true }, () => {
      // opening pipe temporarily

      chrome.tabs.create({ url, selected: true }, function () {
        window.close();
        chrome.tabs.getCurrent(function (tab) {
          // chrome.tabs.remove(tab.id, function () {});
        });
      });
    });
  },
};
