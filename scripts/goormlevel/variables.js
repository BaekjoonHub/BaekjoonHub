/* NOTE: 백준 허브(for goormlevel)의 전역 변수 선언 파일입니다. */

/* 포함된 변수는 다음과 같습니다. 
    languages: goormlevel에서 제공하는 프로그래밍 언어에 맞는 file extension
    uploadState: 업로드 진행 상태입니다.
    difficultyLabels: 문제의 난이도를 숫자로 매핑하는 상수입니다.
*/

/* 업로드 진행 상태.
   queue: 마지막으로 줄 세운 업로드의 Promise. 한 탭의 업로드는 감지 순서대로 한 번에 하나씩 실행한다
   (goormlevel.js 의 enqueueUpload 참고). */
const uploadState = { queue: Promise.resolve() };

// prettier-ignore
/**
 * Languages supported by goormlevel
 * lowercase로 비교하기 때문에 항상 소문자로 관리
 * 프로그래밍 언어와 확장자를 매핑한 상수
 */
const languages = /** @type {const} */ ({
    "c": "c",
    "c++": "cc",
    "java": "java",
    "python": "py",
    "python3": "py",
    "go": "go",
    "swift": "swift",
    "javascript": "js",
    "typescript": "ts",
    "ruby": "rb",
    "kotlin": "kt",
    "scala": "scala",
    "vb.net": "vb",
    "pascal": "pas",
    "lua": "lua",
    "objective-c": "m",
    "r": "r",
    "rust": "rs",
    "clojure": "clj",
    "smalltalk": "st",
    "dart": "dart",
    "haskell": "hs",
    "perl": "pl",
    "common lisp": "lisp",
    "lisp": "lisp",
    "php": "php",
    "c#": "cs",
    "cobol": "cob",
    "d": "d",
    "erlang": "erl"
});

const difficultyLabels = /** @type {const} */ ({
  '매우 쉬움': 1,
  쉬움: 2,
  보통: 3,
  어려움: 4,
  '매우 어려움': 5,
});

// dual-mode: 브라우저 콘텐츠 스크립트에서는 전역 상수로, Node 테스트에서는 require 로 사용
// (테스트가 라벨 맵 사본이 아니라 실제 출고되는 상수를 검증하도록 하기 위함)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { difficultyLabels, languages };
}
