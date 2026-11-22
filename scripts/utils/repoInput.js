/**
 * 사용자가 입력한 저장소를 'owner/repo' 로 바꾼다. 받아들이는 형식:
 * https://github.com/owner/repo(.git, 뒤따르는 경로·쿼리·해시 허용), owner/repo, repo(→ username/repo).
 * 결과가 HTML 메시지에 그대로 들어가므로 두 부분 모두 GitHub 이름 문자만 허용하고, 아니면 null.
 */
function parseRepoInput(input, username) {
  const text = String(input || '').trim();
  const url = text.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)\/([^/?#]+)/i);
  let parts;
  if (url) parts = [url[1], url[2].replace(/\.git$/i, '')];
  else if (text.includes('/')) parts = text.split('/');
  else parts = [username, text];
  const valid = (s) => typeof s === 'string' && /^[A-Za-z0-9._-]+$/.test(s) && !/^\.+$/.test(s);
  return parts.length === 2 && parts.every(valid) ? parts.join('/') : null;
}

// dual-mode: 확장 페이지에서는 전역 함수로, Node 테스트에서는 require 로 사용
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseRepoInput };
}
