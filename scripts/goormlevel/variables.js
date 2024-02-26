/* NOTE: 백준 허브(for goormlevel)의 전역 변수 선언 파일입니다. */

/* 포함된 변수는 다음과 같습니다. 
    languages: goormlevel에서 제공하는 프로그래밍 언어에 맞는 file extension
    uploadState: 현재 업로드 중인지를 저장하는 boolean입니다.
*/

/* state of upload for progress */
const uploadState = /** @type {const} */ ({ uploading: false });

// prettier-ignore
/**
 * Languages supported by goormlevel
 * lowercase로 비교하기 때문에 항상 소문자로 관리
 * 프로그래밍 언어와 확장자를 매핑한 상수
 */
const languages = /** @type {const} */ ({
    "c": 'c',
    "c++": 'cc',
    "ruby": 'rb',
    "dart": 'dart',
    "lisp": 'lsp',
    "haskell": 'hs',
    "python": 'py',
    "kotlin": 'kt',
    "go": 'go',
    "swift": 'swift',
    "javascript": 'js',
    "c#": 'cs',
    "java": 'java',
    "pascal": 'pas',
    "objective-c": 'm',
    "rust": 'rs',
    "scala": 'scala',
    "cobol": 'cob',
    "d": 'd',
    "smalltalk": 'st',
    "clojure": 'clj',
    "vb.net": 'vb',
    "lua": 'lua',
    "erlang": 'erl',
});
