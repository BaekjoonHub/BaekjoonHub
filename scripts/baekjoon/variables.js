/* 백준 허브의 전역 변수 선언 파일입니다. */
/* 포함된 변수는 다음과 같습니다. 
    languages: 백준의 언어 및 그에 맞는 file extension
    bj_level: Solved.ac의 레벨별 매핑입니다. API 호출 시 0~31까지의 번호로 레벨이 표현되는데 이를 문자열로 매핑하였습니다.
    CommitType: uploadGit에 사용되는 enum으로 readme 혹은 code를 업로드할 때 사용됩니다.
    titleRegex: 제목 형식의 regex 정의입니다.
    uploadState: 현재 업로드 중인지를 저장하는 boolean입니다.
    bojData: 깃허브에 업로드되는 사용자의 코드와 문제 요약을 담고 있습니다.
*/

// prettier-ignore
// Languages supported by BOJ
// Version/compiler variants are handled by getLanguageExtension() via startsWith matching.
/* let */ const languageExtensions = {
    "아희": "aheui",
    "엄준식": "umm",
    "Ada": "ada",
    "Algol 68": "a",
    "APECODE": "ape",
    "Assembly": "o",
    "awk": "awk",
    "Bash": "sh",
    "bc": "bc",
    "Befunge": "bf",
    "Boo": "boo",
    "Brainf**k": "bf",
    "C++": "cc",
    "C#": "cs",
    "C": "c",
    "Cobol": "cob",
    "Cobra": "cobra",
    "Coq": "v",
    "Crystal": "cr",
    "Cython": "pyx",
    "Deno": "ts",
    "D": "d",
    "F#": "fs",
    "Fortran": "f",
    "FreeBASIC": "bas",
    "Golfscript": "gs",
    "Go": "go",
    "Haskell": "hs",
    "Haxe": "py",
    "INTERCAL": "i",
    "Java": "java",
    "Kotlin": "kt",
    "LOLCODE": "lol",
    "Lua": "lua",
    "Minecraft": "mca",
    "Nemerle": "n",
    "Nimrod": "nim",
    "node.js": "js",
    "Objective-C++": "mm",
    "Objective-C": "m",
    "OCaml": "ml",
    "Pascal": "pas",
    "Perl": "pl",
    "PHP": "php",
    "Pike": "pike",
    "PyPy": "py",
    "Python": "py",
    "Rhino": "js",
    "Ruby": "rb",
    "Rust": "rs",
    "Scala": "scala",
    "Scheme": "scm",
    "sed": "sed",
    "Swift": "swift",
    "SystemVerilog": "sv",
    "Tcl": "tcl",
    "Text": "txt",
    "TypeScript": "ts",
    "VB.NET": "vb",
    "Visual Basic": "vb",
    "Whitespace": "ws",
}

/**
 * Returns the file extension for a given BOJ language string.
 * Exact match is tried first; otherwise the longest startsWith-matching key wins.
 * Falls back to 'txt' for unknown languages.
 * @param {string} language
 * @returns {string}
 */
function getLanguageExtension(language) {
  if (language in languageExtensions) return languageExtensions[language];

  const match = Object.keys(languageExtensions)
    .filter(key => language.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];

  return match ? languageExtensions[match] : 'txt';
}

// // If a new language is added, perform the update manually using the script below.
// // parsing all languages on https://help.acmicpc.net/language/info/all
// [...document.querySelectorAll('div.card')]
//   .map((x) => [x.querySelector('header > h3'), x.querySelector('ul > li:nth-child(2) > code')])
//   .filter((x) => !!x[0] && !!x[1])
//   .map((x) => x.map((el) => el.innerText))
//   .map((x) => [x[0].trim(), x[1].match(/Main\.(?!exe)(?!jar)([a-zA-Z]+)/)])
//   .filter((x) => !!x[0] && !!x[1])
//   .sort((a, b) => a[0].localeCompare(b[0]))
//   .forEach((x) => (languages[x[0]] = x[1][1]));
// languages['Coq'] = 'v';
// // sort languages by key
// languages = Object.entries(languages)
//   .sort((a, b) => a[0].localeCompare(b[0]))
//   .reduce((acc, cur) => {
//     acc[cur[0]] = cur[1];
//     return acc;
//   }, {});
// // get length of languages
// console.log("languages length: ", Object.keys(languages).length);
// console.log("languages: ", languages);

// BOJ Levels
const bj_level = {
  0: 'Unrated',
  1: 'Bronze V',
  2: 'Bronze IV',
  3: 'Bronze III',
  4: 'Bronze II',
  5: 'Bronze I',
  6: 'Silver V',
  7: 'Silver IV',
  8: 'Silver III',
  9: 'Silver II',
  10: 'Silver I',
  11: 'Gold V',
  12: 'Gold IV',
  13: 'Gold III',
  14: 'Gold II',
  15: 'Gold I',
  16: 'Platinum V',
  17: 'Platinum IV',
  18: 'Platinum III',
  19: 'Platinum II',
  20: 'Platinum I',
  21: 'Diamond V',
  22: 'Diamond IV',
  23: 'Diamond III',
  24: 'Diamond II',
  25: 'Diamond I',
  26: 'Ruby V',
  27: 'Ruby IV',
  28: 'Ruby III',
  29: 'Ruby II',
  30: 'Ruby I',
  31: 'Master',
};

/* 채점 결과에 대한 각 구분 정보 */
const RESULT_CATEGORY = {
  RESULT_PENDING: 'wait',
  RESULT_PENDING_REJUDGE: 'rejudge-wait',
  RESULT_NO_JUDGE: 'no-judge',
  RESULT_PREPARE_FOR_JUDGE: 'compile',
  RESULT_JUDGING: 'judging',
  RESULT_ACCEPTED: 'ac',
  RESULT_PARTIALLY_ACCEPTED: 'pac',
  RESULT_PRESENTATION_ERROR: 'pe',
  RESULT_WRONG_ANSWER: 'wa',
  RESULT_ACCEPTED_NOT_CORRECT: 'awa',
  RESULT_TIME_LIMIT_EXCEEDED: 'tle',
  RESULT_MEMORY_LIMIT_EXCEEDED: 'mle',
  RESULT_OUTPUT_LIMIT_EXCEEDED: 'ole',
  RESULT_RUNTIME_ERROR: 'rte',
  RESULT_COMPILATION_ERROR: 'ce',
  RESULT_UNVAILABLE: 'co',
  RESULT_DELETED: 'del',
};

/* 채점 결과에 대한 각 메시지 구분 맵핑 */
const RESULT_MESSAGE = {
  [RESULT_CATEGORY.RESULT_PENDING]: '기다리는 중',
  [RESULT_CATEGORY.RESULT_PENDING_REJUDGE]: '재채점을 기다리는 중',
  [RESULT_CATEGORY.RESULT_NO_JUDGE]: '채점하지 않음',
  [RESULT_CATEGORY.RESULT_PREPARE_FOR_JUDGE]: '채점 준비 중',
  [RESULT_CATEGORY.RESULT_JUDGING]: '채점 중',
  [RESULT_CATEGORY.RESULT_ACCEPTED]: '맞았습니다!!',
  [RESULT_CATEGORY.RESULT_PARTIALLY_ACCEPTED]: '맞았습니다!!',
  [RESULT_CATEGORY.RESULT_PRESENTATION_ERROR]: '출력 형식이 잘못되었습니다',
  [RESULT_CATEGORY.RESULT_WRONG_ANSWER]: '틀렸습니다',
  [RESULT_CATEGORY.RESULT_ACCEPTED_NOT_CORRECT]: '!맞았습니다',
  [RESULT_CATEGORY.RESULT_TIME_LIMIT_EXCEEDED]: '시간 초과',
  [RESULT_CATEGORY.RESULT_MEMORY_LIMIT_EXCEEDED]: '메모리 초과',
  [RESULT_CATEGORY.RESULT_OUTPUT_LIMIT_EXCEEDED]: '출력 초과',
  [RESULT_CATEGORY.RESULT_RUNTIME_ERROR]: '런타임 에러',
  [RESULT_CATEGORY.RESULT_COMPILATION_ERROR]: '컴파일 에러',

  
  [RESULT_CATEGORY.RESULT_ENG_PENDING]: 'Pending',
  [RESULT_CATEGORY.RESULT_ENG_PENDING_REJUDGE]: '재채점을 기다리는 중',
  [RESULT_CATEGORY.RESULT_ENG_NO_JUDGE]: '채점하지 않음',
  [RESULT_CATEGORY.RESULT_ENG_PREPARE_FOR_JUDGE]: 'Preparing for Judging',
  [RESULT_CATEGORY.RESULT_ENG_JUDGING]: 'Judging',
  [RESULT_CATEGORY.RESULT_ENG_ACCEPTED]: 'Accepted',
  [RESULT_CATEGORY.RESULT_ENG_PARTIALLY_ACCEPTED]: 'Accepted',
  [RESULT_CATEGORY.RESULT_ENG_PRESENTATION_ERROR]: 'Presentation Error',
  [RESULT_CATEGORY.RESULT_ENG_WRONG_ANSWER]: 'Wrong Answer',
  [RESULT_CATEGORY.RESULT_ENG_ACCEPTED_NOT_CORRECT]: '!맞았습니다',
  [RESULT_CATEGORY.RESULT_ENG_TIME_LIMIT_EXCEEDED]: 'Time Limit Exceeded',
  [RESULT_CATEGORY.RESULT_ENG_MEMORY_LIMIT_EXCEEDED]: 'Memory Limit Exceeded',
  [RESULT_CATEGORY.RESULT_ENG_OUTPUT_LIMIT_EXCEEDED]: 'Output Limit Exceeded',
  [RESULT_CATEGORY.RESULT_ENG_RUNTIME_ERROR]: 'Runtime Error',
  [RESULT_CATEGORY.RESULT_ENG_COMPILATION_ERROR]: 'Compilation Error',
};

/* state of upload for progress */
const uploadState = { uploading: false };

const multiloader = {
  wrap: null,
  nom: null,
  denom: null,
};
