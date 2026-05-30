/**
 * 경로 정규화 유틸리티 (path normalization).
 *
 * 업로드 경로 → stats 캐시 키(SHA dedup) 변환에 쓰이는 정식 유틸입니다.
 * {@link updateObjectDatafromPath}(쓰기) / {@link getObjectDatafromPath}(조회) 양쪽에서
 * 반드시 동일하게 적용되어야 하며(어긋나면 동일 문제가 중복 업로드됨),
 * baekjoon / programmers / swexpertacademy / goormlevel 4개 플랫폼 경로에 공통으로 적용됩니다.
 *
 * 콘텐츠 스크립트(브라우저)에서는 전역 함수로 노출되고, Node 테스트에서는
 * module.exports 로 require 가능합니다(dual-mode). manifest 의 각 플랫폼 content_scripts 에서
 * storage.js 보다 먼저 로드되어야 합니다.
 */

/**
 * 백준 티어 폴더(Gold/Silver/...)를 경로에서 제거합니다.
 * 세부 티어 접미사(로마숫자 I~V, 예: "Silver V")도 함께 제거하여,
 * `${levelFull}` 템플릿 사용자의 난이도/세부등급이 바뀌어도 동일 경로로 매칭되어 중복 업로드를 방지합니다.
 * 구분자는 일반 공백(U+0020)과 제목 단어 구분자 U+2005를 모두 허용합니다.
 * ex) _owner/_repo/백준/Gold/1000.테스트/테스트.cpp    -> _owner/_repo/백준/1000.테스트/테스트.cpp
 * ex) _owner/_repo/백준/Silver V/1000.테스트/테스트.cpp -> _owner/_repo/백준/1000.테스트/테스트.cpp
 * @param {string} path - 파일의 경로 문자열
 * @returns {string} 티어(및 세부 티어) 폴더를 제거한 문자열
 */
function removeBaekjoonRank(path) {
  return path.replace(/\/(Unrated|Silver|Bronze|Gold|Platinum|Diamond|Ruby|Master)([ \u2005](I{1,3}|IV|V))?\//g, '/');
}

/**
 * 프로그래머스 레벨 폴더(0~9, lv0~lv9, Lv.0~Lv.9, unrated)를 경로에서 제거합니다.
 * `Lv.N` 표기(대문자 L·점)도 제거하여 레벨 표기가 바뀌어도 동일 경로로 매칭됩니다.
 * @param {string} path - 파일의 경로 문자열
 * @returns {string} 레벨 폴더를 제거한 문자열
 */
function removeProgrammersRank(path) {
  return path.replace(/\/([Ll]v\.[0-9]|(?:lv)?[0-9]|unrated)\//g, '/');
}

/**
 * 경로에 존재하는 공백 및 공백류 문자를 제거합니다.
 * 기존에 업로드한 문제들이 공백 차이로 이중 업로드되는 것을 방지합니다.
 * U+2005(FOUR-PER-EM SPACE)는 제목 단어 구분자로 실제 경로의 대다수를 차지하므로
 * 보이지 않는 원문 바이트 유실을 막기 위해 이스케이프로 명시합니다.
 * @param {string} path - 파일의 경로 문자열
 * @returns {string} 공백류 문자를 제거한 문자열
 */
function removeSpaces(path) {
  return path.replace(/( |\u2005|&nbsp|&#160|&#8197|%E2%80%85|%20)/g, '');
}

/**
 * SWEA 난이도 폴더(D1~D8)를 경로에서 제거합니다.
 * @param {string} path - 파일의 경로 문자열
 * @returns {string} 난이도 폴더를 제거한 문자열
 */
function removeSwexpertacademyRank(path) {
  return path.replace(/\/D([0-8]+)\//g, '/');
}

/**
 * 4개 필터를 정해진 순서로 적용해 경로를 정규화합니다.
 * 순서: baekjoonRank -> programmersRank -> spaces -> swexpertacademyRank
 * (기존 storage.js 의 호출 순서와 동일하며, 변경 시 캐시 키가 달라져 중복 업로드가 발생할 수 있습니다.)
 * @param {string} path - 정규화할 경로 문자열
 * @returns {string} 정규화된 경로 문자열
 */
function normalizePath(path) {
  return removeSwexpertacademyRank(removeSpaces(removeProgrammersRank(removeBaekjoonRank(path))));
}

// dual-mode: 브라우저 콘텐츠 스크립트에서는 전역 함수로, Node 테스트에서는 require 로 사용
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizePath,
    removeBaekjoonRank,
    removeProgrammersRank,
    removeSpaces,
    removeSwexpertacademyRank,
  };
}
