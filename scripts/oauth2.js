// eslint-disable-next-line no-unused-vars
const oAuth2 = {
  /**
   * Initialize
   */
  init() {
    this.AUTHORIZATION_URL = 'https://github.com/login/oauth/authorize';
    this.CLIENT_ID = '975f8d5cf6686dd1faed';
    // GitHub 메인(/)은 로그인 상태에서 /feed 로 리다이렉트되며 ?code= 가 사라지므로,
    // 리다이렉트되지 않는 하위 경로를 콜백으로 사용한다. (등록된 Callback URL https://github.com/ 의 하위 경로여야 함)
    this.REDIRECT_URL = 'https://github.com/BaekjoonHub/BaekjoonHub';
  },

  /**
   * Begin
   */
  begin(selectAccount) {
    this.init(); // secure token params.

    let url = `${this.AUTHORIZATION_URL}?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.REDIRECT_URL)}&scope=repo`;
    if (selectAccount) url += '&prompt=select_account';

    // state: authorize.js 가 콜백 주소의 state 와 비교해, 이 확장이 시작한 요청의 콜백만 처리한다 (남이 만든 ?code= 링크 차단)
    const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    url += `&state=${state}`;

    chrome.storage.local.set({ pipe_baekjoonhub: state }, () => {
      // opening pipe temporarily
      window.location.href = url;
    });
  },
};
