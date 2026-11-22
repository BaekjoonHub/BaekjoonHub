/* DOJ 번들의 전역 변수 선언 파일입니다. */

/* DOJ 가 채점 중인 제출에 쓰는 결과 값 */
const DOJ_JUDGING = ['QUEUED', 'RUNNING', 'PENDING'];

/* 이 시간 안에 낸 제출만 올린다(ms). 채점이 밀려도 놓치지 않을 만큼 길게, 예전 풀이까지 올리지 않을 만큼 짧게 둔다. */
const DOJ_FRESH_MS = 60 * 60 * 1000;

/* DOJ 언어 코드(내 제출 목록의 language) → [언어 폴더 이름, 확장자]. 코드는 https://doj.kr/ko/guide/languages 의 표에 있다 (2026-11-22). */
const dojLanguages = {
  cpp17: ['C++', 'cpp'],
  cpp20: ['C++', 'cpp'],
  cpp23: ['C++', 'cpp'],
  cpp26: ['C++', 'cpp'],
  c11: ['C', 'c'],
  c23: ['C', 'c'],
  python3: ['Python', 'py'],
  pypy3: ['Python', 'py'],
  java21: ['Java', 'java'],
  kotlin: ['Kotlin', 'kt'],
  csharp: ['C#', 'cs'],
  typescript: ['TypeScript', 'ts'],
  nodejs: ['JavaScript', 'js'],
  rust: ['Rust', 'rs'],
  ruby: ['Ruby', 'rb'],
  golfscript: ['GolfScript', 'gs'],
  text: ['Text', 'txt'],
};

/**
 * @param {string} code - DOJ 언어 코드 (예: 'cpp17')
 * @returns {[string, string]} [언어 폴더 이름, 확장자]. 표에 없는 언어는 코드 그대로를 이름으로 하고 .txt 로 올린다
 */
function dojLanguage(code) {
  return Object.prototype.hasOwnProperty.call(dojLanguages, code) ? dojLanguages[code] : [`${code}`, 'txt'];
}
