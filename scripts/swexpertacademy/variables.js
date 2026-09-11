/* state of upload for progress */
const uploadState = { uploading: false };

// prettier-ignore
const languages = {
  'c': 'c',
  'c++': 'cpp',
  'python': 'py',
  'java': 'java'
};

const multiloader = {
  wrap: null,
  nom: null,
  denom: null,
};

// dual-mode: 브라우저 콘텐츠 스크립트에서는 전역 상수로, Node 테스트에서는 require 로 사용
// (테스트가 맵 사본이 아니라 실제 출고되는 상수를 검증하도록 하기 위함)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { languages };
}
