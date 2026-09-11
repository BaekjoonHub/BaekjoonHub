/**
 * 언어 표기 → 파일 확장자 해석 유틸.
 *
 * 플랫폼이 화면에 보여주는 언어 표기에는 버전이 붙는다. 특히 구름LEVEL 은 드롭다운의 29개 언어가
 * "전부" 버전 표기다 — 'Java 14', 'C++ 17', 'Python 3.9', 'R 3.6.3', 'Common Lisp 2.49' …
 * 그런데 확장자 맵의 key 는 버전이 없는 표기('java', 'c++', 'python')라
 * `languages[language.toLowerCase()]` 직접 조회가 undefined 를 반환했고, 그 값이 템플릿 문자열에
 * 그대로 박혀 `제목.undefined` 파일이 업로드됐다(tests/fixtures/realPaths.txt 에 실제 사례 43건).
 *
 * 핵심 불변식(#349 의 난이도 파싱과 동일): 맵에 "정확히" 존재하는 key 만 채택한다.
 *   → 후보를 늘려도 틀린 확장자를 "합성" 하지 못하고, 실패 모드가 "오답" 이 아니라
 *     "미검출"(= fallback)로 고정된다.
 *   → 그래서 접두사 추정(startsWith)은 쓰지 않는다. 'cython' 이 'c' 에 걸려 .c 가 되는 식의
 *     조용한 오답은 .undefined 보다 나쁘다. 모르는 언어는 그냥 .txt 로 간다.
 *
 * NOTE: 이 파일은 4개 플랫폼 번들 전부에 로드된다. 콘텐츠 스크립트는 번들 하나당 전역 스코프를
 *       공유하므로, 여기에 선언한 최상위 이름은 어느 플랫폼 파일과도 겹치면 안 된다.
 *       (baekjoon/variables.js 의 `getLanguageExtension`·`languageExtensions`, goorm·SWEA
 *        variables.js 의 `languages` 와 겹치지 않도록 이름을 고른 것이다.)
 *       맵을 전역에서 읽지 않고 "인자로 받는" 것도 같은 이유다 — `languages` 전역은 4개 번들 중
 *       2개에만 존재한다.
 */

/** 언어 표기 뒤에 붙는 버전 토큰. 'Java 14', 'R 3.6.3', 'D 2.074', 'C++17' 을 모두 걷어낸다. */
const LANGUAGE_VERSION_SUFFIX = /\s*\d+(?:\.\d+)*$/;

/** 확장자를 끝내 알 수 없을 때 쓰는 값. baekjoon/variables.js getLanguageExtension 의 관례를 따른다. */
const DEFAULT_LANGUAGE_EXTENSION = 'txt';

/**
 * 언어 표기에서 파일 확장자를 해석합니다. 맵에 없으면 fallback 을 반환하며 절대 undefined 를
 * 반환하지 않습니다.
 * @param {Record<string, string>} map - 소문자 언어명 → 확장자 (플랫폼별 `languages` 상수)
 * @param {string} language - 플랫폼이 화면에 보여주는 원시 표기 (예: 'Java 14')
 * @param {string} [fallback=DEFAULT_LANGUAGE_EXTENSION]
 * @returns {string}
 */
function resolveLanguageExtension(map, language, fallback) {
  const fallbackExtension = fallback === undefined ? DEFAULT_LANGUAGE_EXTENSION : fallback;
  if (map === null || map === undefined) return fallbackExtension;
  const raw = typeof language === 'string' ? language.trim().toLowerCase() : '';
  if (raw === '') return fallbackExtension;

  /* 후보는 '원본 → 버전 제거' 순. 각 후보는 hasOwnProperty 로만 채택한다 —
     표기가 'constructor'/'toString' 일 때 프로토타입 체인이 truthy 로 잡히는 것을 막는다. */
  const candidates = [raw, raw.replace(LANGUAGE_VERSION_SUFFIX, '').trim()];
  for (const key of candidates) {
    if (key !== '' && Object.prototype.hasOwnProperty.call(map, key)) return map[key];
  }
  return fallbackExtension;
}

/**
 * 'solution.java' 같은 에디터 탭 라벨에서 확장자만 떼어냅니다.
 * 프로그래머스는 확장자 맵이 없고 탭 라벨을 그대로 쓰는데, 단일 업로드 경로가
 * `split('.')[1]` 이라 점이 없는 라벨에서 undefined 가 됐다(실제 사례: 프로그래머스 SQL 문제).
 * 대량 업로드 경로의 `split('.').pop()` 도 점이 없으면 라벨 전체를 확장자로 써버린다.
 * @param {string} label - 에디터 탭 텍스트
 * @param {string} [fallback=DEFAULT_LANGUAGE_EXTENSION]
 * @returns {string}
 */
function extensionFromFileLabel(label, fallback) {
  const fallbackExtension = fallback === undefined ? DEFAULT_LANGUAGE_EXTENSION : fallback;
  const text = typeof label === 'string' ? label.trim() : '';
  const dot = text.lastIndexOf('.');
  if (dot <= 0) return fallbackExtension; /* 점이 없거나 '.gitignore' 처럼 맨 앞이면 확장자가 아니다 */
  const extension = text.slice(dot + 1).trim();
  return extension === '' ? fallbackExtension : extension;
}

// dual-mode: 브라우저 콘텐츠 스크립트에서는 전역으로, Node 테스트에서는 require 로 사용
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { resolveLanguageExtension, extensionFromFileLabel, LANGUAGE_VERSION_SUFFIX, DEFAULT_LANGUAGE_EXTENSION };
}
