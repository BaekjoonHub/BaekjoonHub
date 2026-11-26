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
