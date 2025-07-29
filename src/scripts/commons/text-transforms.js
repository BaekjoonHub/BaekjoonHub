/**
 * 템플릿에서 사용할 수 있는 텍스트 변환 유틸리티 함수들
 * 기존 util.js의 함수들을 템플릿에 적합하게 재구성
 */

import { b64DecodeUnicode, b64EncodeUnicode, escapeHtml, unescapeHtml, filter, combine, convertSingleCharToDoubleChar } from "./util.js";

/**
 * 문자열에서 지정한 부분 문자열을 다른 문자열로 교체합니다
 * @param {string} text - 원본 문자열
 * @param {string|RegExp} searchValue - 찾을 값(문자열 또는 정규식)
 * @param {string} replaceValue - 교체할 값
 * @returns {string} - 교체된 문자열
 */
export function replaceText(text, searchValue, replaceValue) {
  if (typeof text !== "string") return text;
  return text.replace(searchValue, replaceValue);
}

/**
 * 문자열 양쪽의 공백을 제거합니다
 * @param {string} text - 처리할 텍스트
 * @returns {string} - 공백이 제거된 텍스트
 */
export function trim(text) {
  if (typeof text !== "string") return text;
  return text.trim();
}

/**
 * 배열을 지정된 구분자로 연결합니다
 * @param {Array} arr - 연결할 배열
 * @param {string} separator - 구분자 (기본: '-')
 * @returns {string} - 연결된 문자열
 */
export function arrayJoin(arr, separator = "-") {
  if (!Array.isArray(arr)) return arr;
  return arr.join(separator);
}

/**
 * 문자열에서 첫 번째 공백 이후의 모든 내용을 제거합니다
 * 주로 level에서 "Bronze V" → "Bronze" 변환에 사용
 * @param {string} text - 처리할 텍스트
 * @returns {string} - 처리된 텍스트
 */
export function removeAfterSpace(text) {
  if (typeof text !== "string") return text;
  return text.replace(/ .*/, "");
}

/**
 * 문자열을 URL 안전한 형태로 변환합니다
 * @param {string} text - 변환할 텍스트
 * @returns {string} - URL 안전한 텍스트
 */
export function urlSafe(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/[\\s\\/\\\\:*?\"<>|]/g, "_") // 특수문자를 언더스코어로 변경
    .replace(/_{2,}/g, "_") // 연속된 언더스코어를 하나로
    .replace(/^_|_$/g, ""); // 앞뒤 언더스코어 제거
}

/**
 * 문자열을 kebab-case로 변환합니다
 * @param {string} text - 변환할 텍스트
 * @returns {string} - kebab-case로 변환된 텍스트
 */
export function toKebabCase(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
    .replace(/[\s_]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/**
 * 문자열을 snake_case로 변환합니다
 * @param {string} text - 변환할 텍스트
 * @returns {string} - snake_case로 변환된 텍스트
 */
export function toSnakeCase(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)
    .replace(/[\s-]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

/**
 * 문자열을 camelCase로 변환합니다
 * @param {string} text - 변환할 텍스트
 * @returns {string} - camelCase로 변환된 텍스트
 */
export function toCamelCase(text) {
  if (typeof text !== "string") return text;
  return text.replace(/[\s\-_]+(.)/g, (_, char) => char.toUpperCase()).replace(/^[A-Z]/, (char) => char.toLowerCase());
}

/**
 * 문자열을 PascalCase로 변환합니다
 * @param {string} text - 변환할 텍스트
 * @returns {string} - PascalCase로 변환된 텍스트
 */
export function toPascalCase(text) {
  if (typeof text !== "string") return text;
  return text.replace(/[\s\-_]+(.)/g, (_, char) => char.toUpperCase()).replace(/^[a-z]/, (char) => char.toUpperCase());
}

/**
 * 문자열의 길이를 제한합니다
 * @param {string} text - 제한할 텍스트
 * @param {number} maxLength - 최대 길이
 * @param {string} ellipsis - 말줄임표 (기본: '...')
 * @returns {string} - 길이가 제한된 텍스트
 */
export function truncate(text, maxLength = 50, ellipsis = "...") {
  if (typeof text !== "string") return text;
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * 문자열에서 숫자만 추출합니다
 * @param {string} text - 처리할 텍스트
 * @returns {string} - 숫자만 포함된 텍스트
 */
export function extractNumbers(text) {
  if (typeof text !== "string") return text;
  return text.replace(/[^0-9]/g, "");
}

/**
 * 문자열에서 영문자만 추출합니다
 * @param {string} text - 처리할 텍스트
 * @returns {string} - 영문자만 포함된 텍스트
 */
export function extractLetters(text) {
  if (typeof text !== "string") return text;
  return text.replace(/[^a-zA-Z]/g, "");
}

/**
 * 날짜를 한국어 형식으로 포맷합니다
 * @param {string} dateString - 날짜 문자열
 * @returns {string} - 한국어 형식의 날짜
 */
export function formatKoreanDate(dateString) {
  if (typeof dateString !== "string") return dateString;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export const textTransforms = {
  // 기본 함수들
  safe: convertSingleCharToDoubleChar,
  urlSafe,
  truncate,
  trim,
  extractNumbers,
  extractLetters,
  arrayJoin,
  removeAfterSpace,
  toKebabCase,
  toSnakeCase,
  toCamelCase,
  toPascalCase,

  // HTML & 인코딩
  htmlEscape: escapeHtml,
  htmlUnescape: unescapeHtml,
  base64Encode: b64EncodeUnicode,
  base64Decode: b64DecodeUnicode,
};

export function getTextTransforms() {
  return textTransforms;
}
