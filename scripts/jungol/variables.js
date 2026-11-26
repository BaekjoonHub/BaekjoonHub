/* 정올 번들의 전역 변수 선언 파일입니다. */

/* 정올 언어 코드(제출 상세의 language) → [언어 폴더 이름, 확장자]
   shortcut: 자주 쓰는 언어만 있다. 없는 언어는 코드 그대로를 이름으로 하고 .txt 로 올린다. 그런 풀이가 보이면 줄을 더한다. */
const jungolLanguages = {
  C: ['C', 'c'],
  CPP: ['C++', 'cpp'],
  JAVA: ['Java', 'java'],
  PYTHON3: ['Python', 'py'],
  RUST: ['Rust', 'rs'],
  KOTLIN: ['Kotlin', 'kt'],
  PHP: ['PHP', 'php'],
  GO: ['Go', 'go'],
  CSHARP: ['C#', 'cs'],
  JAVASCRIPT: ['JavaScript', 'js'],
  TYPESCRIPT: ['TypeScript', 'ts'],
  RUBY: ['Ruby', 'rb'],
};

/**
 * @param {string} code - 정올 언어 코드 (예: 'CPP')
 * @returns {[string, string]} [언어 폴더 이름, 확장자]
 */
function jungolLanguage(code) {
  return Object.prototype.hasOwnProperty.call(jungolLanguages, code) ? jungolLanguages[code] : [`${code}`, 'txt'];
}
