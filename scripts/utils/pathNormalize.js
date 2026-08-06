/**
 * 경로 정규화 유틸리티 (path normalization).
 *
 * 업로드 경로 → stats 캐시 키(SHA dedup) 변환에 쓰이는 정식 유틸입니다.
 * {@link updateObjectDatafromPath}(쓰기) / {@link getObjectDatafromPath}(조회) 양쪽에서
 * 반드시 동일하게 적용되어야 하며(어긋나면 동일 문제가 중복 업로드됨),
 * baekjoon / programmers / swexpertacademy / goormlevel 4개 플랫폼 경로에 공통으로 적용됩니다.
 * 언어 폴더명 표준화({@link normalizeLanguageName}, #346)도 이 파일이 담당하며,
 * 업로드 폴더명 생성({@link buildDirectory})과 캐시 키({@link unifyPythonFolder}) 양쪽에서 쓰입니다.
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
 * 파이썬 계열 언어명을 표준 폴더명 'Python' 으로 통일합니다 (#346).
 * 플랫폼별 원시 표기(프로그래머스 'Python3', 백준 'Python 3'/'PyPy3', SWEA 'PYTHON' 등)가
 * 그대로 폴더명이 되면 언어별 정리(Organize by Language) 모드에서 최상위 폴더가
 * Python/Python3 으로 파편화되므로, 업로드 폴더명 생성 시점({@link buildDirectory})에 적용합니다.
 * PyPy 계열도 폴더 분류 관점에서는 동일 언어로 보고 'Python' 으로 수렴합니다.
 * 파이썬 계열만 명시적으로 수렴하며 그 외 언어명은 원본 표기를 유지합니다.
 * ex) 'Python3'  -> 'Python'
 * ex) 'python 3' -> 'Python'
 * ex) 'PyPy3'    -> 'Python'
 * ex) 'Java'     -> 'Java' (무변경)
 * @param {string} language - 플랫폼에서 파싱된 언어 표기
 * @returns {string} 표준화된 언어 폴더명
 */
function normalizeLanguageName(language) {
  if (typeof language !== 'string') return language;
  return /^(python|pypy)[ \u2005]?[0-9.]*$/i.test(language.trim()) ? 'Python' : language;
}

/**
 * 경로(캐시 키) 안의 파이썬 계열 언어 폴더 세그먼트를 'Python' 으로 수렴시킵니다 (#346).
 * {@link normalizeLanguageName} 도입 이전에 업로드된 구 폴더(Python3/, PyPy3/ 등)와
 * 신 폴더(Python/)가 같은 dedup 키로 수렴해, 표준화 이후 동일 문제가 새 폴더로
 * 중복 업로드되는 것을 방지합니다.
 * 체인에서 removeSpaces 이후에 적용되므로 'Python 3' 표기는 이미 'Python3' 형태입니다.
 *
 * 오매칭 가드 3중:
 * - 캐시 키는 항상 `owner/repo/` (hook) 로 시작하므로 처음 두 세그먼트는 건드리지 않습니다.
 *   리포/계정명이 'python3' 류여도 키가 재작성되지 않으며, bare hook 조회(getStatsSHAfromPath(hook))나
 *   stats.submission[owner][repo] 직접 인덱싱과 어긋나지 않습니다.
 * - 세그먼트 전체가 파이썬 계열 표기일 때만 치환합니다 — 제목 폴더('1000.Python3풀이')는 무변경.
 * - 후행 '/' 는 lookahead 로 소비하지 않으므로 파일명(맨 끝 세그먼트)은 무변경이고,
 *   파이썬 계열 세그먼트가 연속되어도 전부 수렴합니다.
 *
 * 주의: 이 필터는 조회/기록 시점의 키만 수렴시키므로, 구버전 키로 영속된 로컬 stats 캐시는
 * 버전 범프가 트리거하는 updateLocalStorageStats 전체 재구축 시점에 새 키로 적재됩니다.
 * (따라서 이 변경은 manifest 버전 범프와 같은 릴리스로 배포되어야 합니다.)
 * ex) owner/repo/Python3/프로그래머스/... -> owner/repo/Python/프로그래머스/...
 * ex) owner/repo/PyPy3/백준/...          -> owner/repo/Python/백준/...
 * @param {string} path - 파일의 경로 문자열 (hook 접두 포함 캐시 키)
 * @returns {string} 파이썬 언어 폴더 표기를 통일한 문자열
 */
function unifyPythonFolder(path) {
  return path.replace(/^([^/]*\/[^/]*\/)([\s\S]*)$/, (all, hookPrefix, rest) =>
    hookPrefix + rest.replace(/(^|\/)(?:python|pypy)[0-9.]*(?=\/)/gi, '$1Python'));
}

/**
 * 5개 필터를 정해진 순서로 적용해 경로를 정규화합니다.
 * 순서: baekjoonRank -> programmersRank -> spaces -> swexpertacademyRank -> pythonFolder
 * (기존 storage.js 의 호출 순서와 동일하며, 변경 시 캐시 키가 달라져 중복 업로드가 발생할 수 있습니다.
 *  pythonFolder 는 #346 에서 추가 — 'Python 3' 표기까지 수렴하려면 spaces 이후에 와야 합니다.)
 * @param {string} path - 정규화할 경로 문자열
 * @returns {string} 정규화된 경로 문자열
 */
function normalizePath(path) {
  return unifyPythonFolder(removeSwexpertacademyRank(removeSpaces(removeProgrammersRank(removeBaekjoonRank(path)))));
}

// dual-mode: 브라우저 콘텐츠 스크립트에서는 전역 함수로, Node 테스트에서는 require 로 사용
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizePath,
    normalizeLanguageName,
    removeBaekjoonRank,
    removeProgrammersRank,
    removeSpaces,
    removeSwexpertacademyRank,
    unifyPythonFolder,
  };
}
