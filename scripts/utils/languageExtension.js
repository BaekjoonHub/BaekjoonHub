/**
 * 언어 표기 → 파일 확장자 해석 유틸.
 *
 * 플랫폼이 보여 주는 언어 표기에는 버전이 붙을 수 있는데('Java 14', 'C++17', 'R 3.6.3') 확장자 맵의 key 에는 버전이 없다.
 * 맵을 그대로 조회하면 undefined 가 파일 이름에 박혀 `제목.undefined` 가 올라갔다(공개 BaekjoonHub 레포 약 100곳의 경로에서 실제 사례 43건).
 *
 * 불변식(#349 의 난이도 파싱과 같다): 맵에 "정확히" 있는 key 만 채택한다. 접두사 추정(startsWith)은 쓰지 않는다 —
 * 'cython' 이 'c' 에 걸려 .c 가 되는 조용한 오답은 .undefined 보다 나쁘다. 모르는 언어는 .txt 로 간다.
 *
 * 이 파일은 모든 플랫폼 번들에 로드되므로 최상위 이름이 플랫폼 파일과 겹치면 안 되고(baekjoon/variables.js 의
 * getLanguageExtension·languageExtensions, SWEA variables.js 의 languages), 맵은 전역에서 읽지 않고 인자로 받는다.
 */

/** 언어 표기 뒤에 붙는 버전 토큰. 'Java 14', 'R 3.6.3', 'D 2.074', 'C++17' 을 모두 걷어낸다. */
const LANGUAGE_VERSION_SUFFIX = /\s*\d+(?:\.\d+)*$/;

/**
 * 언어 표기에서 파일 확장자를 해석합니다. 맵에 없으면 'txt' 를 반환하며 undefined 를 반환하지 않습니다.
 * @param {Record<string, string>} map - 소문자 언어명 → 확장자 (플랫폼별 `languages` 상수)
 * @param {string} language - 플랫폼이 화면에 보여주는 원시 표기 (예: 'Java 14')
 * @returns {string}
 */
function resolveLanguageExtension(map, language) {
  const raw = typeof language === 'string' ? language.trim().toLowerCase() : '';
  /* 후보는 '원본 → 버전 제거' 순. hasOwnProperty 로만 채택한다 — 표기가 'constructor' 일 때 프로토타입 체인이 잡히는 것을 막는다. */
  for (const key of [raw, raw.replace(LANGUAGE_VERSION_SUFFIX, '').trim()]) {
    if (key !== '' && Object.prototype.hasOwnProperty.call(map, key)) return map[key];
  }
  return 'txt';
}

/**
 * 'solution.java' 같은 에디터 탭 라벨에서 확장자만 떼어냅니다. (프로그래머스는 확장자 맵 없이 탭 라벨을 쓴다)
 * 점이 없거나('solution') 맨 앞이거나('.gitignore') 맨 끝이면 'txt' 다. 예전의 `split('.')[1]` 은 점이 없는 라벨(SQL 문제)에서 undefined 가 됐다.
 * @param {string} label - 에디터 탭 텍스트
 * @returns {string}
 */
function extensionFromFileLabel(label) {
  const text = typeof label === 'string' ? label.trim() : '';
  const dot = text.lastIndexOf('.');
  return (dot > 0 && text.slice(dot + 1).trim()) || 'txt';
}

// dual-mode: 브라우저 콘텐츠 스크립트에서는 전역으로, Node 테스트에서는 require 로 사용
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { resolveLanguageExtension, extensionFromFileLabel };
}
