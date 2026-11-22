/* 백준 번들의 전역 변수 */

// prettier-ignore
// Languages supported by BOJ (출처: https://help.acmicpc.net/language/info/all 의 언어 이름과 Main.<확장자>)
// Version/compiler variants are handled by getLanguageExtension() via startsWith matching.
const languageExtensions = {
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

// solved.ac 가 0~31 의 번호로 주는 레벨의 이름
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

/* state of upload for progress */
const uploadState = { uploading: false };

const multiloader = {
  wrap: null,
  nom: null,
  denom: null,
};
