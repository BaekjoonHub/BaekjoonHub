/**
 * Template text transformation utility functions
 * Reorganized from util.js for template use
 */
import {
  b64DecodeUnicode,
  b64EncodeUnicode,
  escapeHtml,
  unescapeHtml,
  convertSingleCharToDoubleChar,
} from "./util";

/**
 * Replace substring in string with another string
 * @param text - Original string
 * @param searchValue - Value to find (string or RegExp)
 * @param replaceValue - Value to replace with
 * @returns Replaced string
 */
export function replaceText(
  text: string,
  searchValue: string | RegExp,
  replaceValue: string
): string {
  if (typeof text !== "string") return text;
  return text.replace(searchValue, replaceValue);
}

/**
 * Trim whitespace from both ends of string
 * @param text - Text to process
 * @returns Trimmed text
 */
export function trim(text: string): string {
  if (typeof text !== "string") return text;
  return text.trim();
}

/**
 * Join array with specified separator
 * @param arr - Array to join
 * @param separator - Separator (default: '-')
 * @returns Joined string
 */
export function arrayJoin<T>(arr: T[], separator = "-"): string {
  if (!Array.isArray(arr)) return String(arr);
  return arr.join(separator);
}

/**
 * Remove everything after first space in string
 * Mainly used for converting "Bronze V" → "Bronze"
 * @param text - Text to process
 * @returns Processed text
 */
export function removeAfterSpace(text: string): string {
  if (typeof text !== "string") return text;
  return text.replace(/ .*/, "");
}

/**
 * Convert string to URL-safe format
 * @param text - Text to convert
 * @returns URL-safe text
 */
export function urlSafe(text: string): string {
  if (typeof text !== "string") return text;
  return text
    .replace(/[\s\\/\\:*?"<>|]/g, "_") // Replace special chars with underscore
    .replace(/_{2,}/g, "_") // Reduce consecutive underscores to one
    .replace(/^_|_$/g, ""); // Remove leading/trailing underscores
}

/**
 * Convert string to kebab-case
 * @param text - Text to convert
 * @returns kebab-case text
 */
export function toKebabCase(text: string): string {
  if (typeof text !== "string") return text;
  return text
    .replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
    .replace(/[\s_]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/**
 * Convert string to snake_case
 * @param text - Text to convert
 * @returns snake_case text
 */
export function toSnakeCase(text: string): string {
  if (typeof text !== "string") return text;
  return text
    .replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)
    .replace(/[\s-]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

/**
 * Convert string to camelCase
 * @param text - Text to convert
 * @returns camelCase text
 */
export function toCamelCase(text: string): string {
  if (typeof text !== "string") return text;
  return text
    .replace(/[\s\-_]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^[A-Z]/, (char) => char.toLowerCase());
}

/**
 * Convert string to PascalCase
 * @param text - Text to convert
 * @returns PascalCase text
 */
export function toPascalCase(text: string): string {
  if (typeof text !== "string") return text;
  return text
    .replace(/[\s\-_]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^[a-z]/, (char) => char.toUpperCase());
}

/**
 * Limit string length
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @param ellipsis - Ellipsis (default: '...')
 * @returns Truncated text
 */
export function truncate(text: string, maxLength = 50, ellipsis = "..."): string {
  if (typeof text !== "string") return text;
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Extract only numbers from string
 * @param text - Text to process
 * @returns Text containing only numbers
 */
export function extractNumbers(text: string): string {
  if (typeof text !== "string") return text;
  return text.replace(/[^0-9]/g, "");
}

/**
 * Extract only letters from string
 * @param text - Text to process
 * @returns Text containing only letters
 */
export function extractLetters(text: string): string {
  if (typeof text !== "string") return text;
  return text.replace(/[^a-zA-Z]/g, "");
}

/**
 * Format date to Korean format
 * @param dateString - Date string
 * @returns Korean formatted date
 */
export function formatKoreanDate(dateString: string): string {
  if (typeof dateString !== "string") return dateString;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Text transform function type - compatible with safe-template-parser
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TransformFunction = (...args: any[]) => string;

// Text transform function interface
export interface TextTransforms {
  safe: typeof convertSingleCharToDoubleChar;
  urlSafe: typeof urlSafe;
  truncate: typeof truncate;
  trim: typeof trim;
  extractNumbers: typeof extractNumbers;
  extractLetters: typeof extractLetters;
  arrayJoin: typeof arrayJoin;
  removeAfterSpace: typeof removeAfterSpace;
  toKebabCase: typeof toKebabCase;
  toSnakeCase: typeof toSnakeCase;
  toCamelCase: typeof toCamelCase;
  toPascalCase: typeof toPascalCase;
  htmlEscape: typeof escapeHtml;
  htmlUnescape: typeof unescapeHtml;
  base64Encode: typeof b64EncodeUnicode;
  base64Decode: typeof b64DecodeUnicode;
  [key: string]: TransformFunction | undefined;
}

export const textTransforms: TextTransforms = {
  // Basic functions
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

  // HTML & encoding
  htmlEscape: escapeHtml,
  htmlUnescape: unescapeHtml,
  base64Encode: b64EncodeUnicode,
  base64Decode: b64DecodeUnicode,
};

export function getTextTransforms(): TextTransforms {
  return textTransforms;
}
