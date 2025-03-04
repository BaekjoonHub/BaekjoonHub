/*
 * OAuth2 0• l
 */

// oAuth2 ¥ ›1
const oAuth2 = {
  /**
   * GitHub OAuth \8§ ‹ë
   */
  begin() {
    const authUrl = 'https://github.com/login/oauth/authorize';
    const clientId = '975f8d5cf6686dd1faed';
    const redirectUri = 'https://github.com/';
    const scope = 'repo';
    
    // GitHub OAuth URL ›1
    const url = `${authUrl}?client_id=${clientId}&scope=${scope}&redirect_uri=${redirectUri}`;
    
    // OAuth xù = Ù0
    chrome.tabs.create({
      url,
      active: true,
    });
    
    // µ‡ t $
    chrome.storage.local.set({
      pipe_baekjoonhub: true,
    });
  },
};

// Ì §T– xú
window.oAuth2 = oAuth2;