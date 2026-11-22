/* 
    (needs patch) 
    IMPLEMENTATION OF AUTHENTICATION ROUTE AFTER REDIRECT FROM GITHUB.
*/

const localAuth = {
  /**
   * Initialize
   */
  init() {
    this.KEY = 'BaekjoonHub_token';
    this.ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
    this.AUTHORIZATION_URL = 'https://github.com/login/oauth/authorize';
    this.CLIENT_ID = '975f8d5cf6686dd1faed';
    this.CLIENT_SECRET = '934b2bfc3bb3ad239bc67bdfa81a378b1616dd1e';
    this.REDIRECT_URL = 'https://github.com/BaekjoonHub/BaekjoonHub';
    this.SCOPES = ['repo'];
  },

  /**
   * Parses Access Code
   *
   * @param url The url containing the access code.
   */
  parseAccessCode(url) {
    const params = new URL(url).searchParams;
    if (params.get('error')) {
      this.fail('denied');
    } else if (params.get('code')) {
      this.requestToken(params.get('code'));
    }
  },

  /**
   * Request Token
   *
   * @param code The access code returned by provider.
   */
  requestToken(code) {
    const that = this;
    const data = new FormData();
    data.append('client_id', this.CLIENT_ID);
    data.append('client_secret', this.CLIENT_SECRET);
    data.append('code', code);

    const xhr = new XMLHttpRequest();
    xhr.addEventListener('readystatechange', function () {
      if (xhr.readyState === 4) {
        // GitHub answers 200 with error=... in the body for a bad or expired code
        const token = xhr.status === 200 && xhr.responseText.match(/access_token=([^&]*)/);
        if (token) {
          that.finish(token[1]);
        } else {
          that.fail('failed');
        }
      }
    });
    xhr.open('POST', this.ACCESS_TOKEN_URL, true);
    xhr.send(data);
  },

  /**
   * Finish
   *
   * @param token The OAuth2 token given to the application from the provider.
   */
  finish(token) {
    const that = this;
    /* Get username */
    // To validate user, load user object from GitHub.
    const AUTHENTICATION_URL = 'https://api.github.com/user';

    const xhr = new XMLHttpRequest();
    xhr.addEventListener('readystatechange', function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          const username = JSON.parse(xhr.responseText).login;
          chrome.runtime.sendMessage({
            closeWebPage: true,
            isSuccess: true,
            token,
            username,
          });
        } else {
          that.fail('failed');
        }
      }
    });
    xhr.open('GET', AUTHENTICATION_URL, true);
    xhr.setRequestHeader('Authorization', `token ${token}`);
    xhr.send();
  },

  fail(reason) {
    chrome.runtime.sendMessage({ closeWebPage: true, isSuccess: false, reason });
  },
};

localAuth.init(); // load params.
const link = window.location.href;

/* Check for open pipe */
if (link.startsWith(localAuth.REDIRECT_URL)) {
  chrome.storage.local.get('pipe_baekjoonhub', (data) => {
    // 파이프 값은 oAuth2.begin 이 만든 state 다. 예전 버전이 남긴 true 는 어떤 state 와도 같지 않다.
    const pipe = data && data.pipe_baekjoonhub;
    if (pipe && pipe === new URL(link).searchParams.get('state')) {
      localAuth.parseAccessCode(link);
    }
  });
}
