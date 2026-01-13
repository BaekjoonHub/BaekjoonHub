/**
 * Utility functions for BaekjoonHub
 */

/**
 * Get current extension version
 * @returns The current extension version
 */
export function getVersion(): string {
  return chrome.runtime.getManifest().version;
}

/**
 * Check if an element exists
 * @param element - Element to check
 * @returns true if element exists and has length > 0
 */
export function elementExists(element: unknown): boolean {
  if (element === undefined || element === null) return false;
  if (typeof element === "object" && element !== null && "length" in element) {
    return (element as { length: number }).length > 0;
  }
  return false;
}

/**
 * Check if value is null or undefined
 * @param value - Value to check
 * @returns true if value is null or undefined
 */
export function isNull(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Check if value is empty (null, undefined, empty string, or empty array)
 * @param value - Value to check
 * @returns true if value is empty
 */
export function isEmpty(value: unknown): boolean {
  if (isNull(value)) return true;
  if (typeof value === "string" && value.length === 0) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "object" && value !== null && "length" in value) {
    return (value as { length: number }).length === 0;
  }
  return false;
}

/**
 * Calculate UTF-8 byte length of a string (Korean characters count as 3 bytes)
 * Normalizes \r\n to \n
 * @param str - String to calculate
 * @returns Byte length
 */
export function utf8Length(str: string): number {
  const normalizedStr = str.replace(/\r\n/g, "\n");
  return new TextEncoder().encode(normalizedStr).length;
}

/**
 * Pre-process object for upload
 * - Fills codeLength if empty
 * - Fills problem_tags with default if empty
 * @param obj - Object to process
 * @returns Processed object or null
 */
export function preProcessEmptyObj<T extends { code?: string; codeLength?: string | number; problem_tags?: string[] }>(
  obj: T | null | undefined
): T | null {
  if (isNull(obj)) {
    return null;
  }
  if (isEmpty(obj.codeLength) && !isEmpty(obj.code)) {
    (obj as Record<string, unknown>).codeLength = utf8Length(obj.code!);
  }
  if (isEmpty(obj.problem_tags) && !isEmpty(obj.code)) {
    obj.problem_tags = ["분류 없음"];
  }
  return obj;
}

/**
 * Recursively check if object/array has any non-empty values
 * @param obj - Object or array to check
 * @returns true if object has non-empty values
 */
export function isNotEmpty(obj: unknown): boolean {
  if (isEmpty(obj)) return false;
  if (typeof obj !== "object" || obj === null) return true;
  if (Array.isArray(obj) && obj.length === 0) return false;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (!isNotEmpty((obj as Record<string, unknown>)[key])) return false;
    }
  }
  return true;
}

/**
 * Escape HTML special characters
 * @param text - Text to escape
 * @returns Escaped text
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Unescape HTML entities
 * @param text - Text to unescape
 * @returns Unescaped text
 */
export function unescapeHtml(text: string): string {
  const unescaped: Record<string, string> = {
    "&amp;": "&",
    "&#38;": "&",
    "&lt;": "<",
    "&#60;": "<",
    "&gt;": ">",
    "&#62;": ">",
    "&apos;": "'",
    "&#39;": "'",
    "&quot;": '"',
    "&#34;": '"',
    "&nbsp;": " ",
    "&#160;": " ",
  };
  return text.replace(/&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34|nbsp|#160);/g, (m) => unescaped[m]);
}

/**
 * Convert single-width characters to full-width characters
 * @param text - Text to convert
 * @returns Converted text with full-width characters
 */
export function convertSingleCharToDoubleChar(text: string): string {
  const map: Record<string, string> = {
    "!": "！",
    "%": "％",
    "&": "＆",
    "(": "（",
    ")": "）",
    "*": "＊",
    "+": "＋",
    ",": "，",
    ".": "．",
    "/": "／",
    ":": "：",
    ";": "；",
    "<": "＜",
    "=": "＝",
    ">": "＞",
    "?": "？",
    "@": "＠",
    "[": "［",
    "\\": "＼",
    "]": "］",
    "^": "＾",
    "_": "＿",
    "`": "｀",
    "{": "｛",
    "|": "｜",
    "}": "｝",
    "~": "～",
    " ": " ", // FOUR-PER-EM SPACE
    "-": "－",
  };
  return text.replace(/[!%&()*+,./:;<=>?@[\]\\^`{|}~ -]/g, (m) => map[m]);
}

/**
 * Encode string to base64 with Unicode support
 * @param str - String to encode
 * @returns Base64 encoded string
 */
export function b64EncodeUnicode(str: string): string {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_match, p1) => String.fromCharCode(parseInt(p1, 16))));
}

/**
 * Decode base64 string with Unicode support
 * @param b64str - Base64 string to decode
 * @returns Decoded string
 */
export function b64DecodeUnicode(b64str: string): string {
  return decodeURIComponent(
    atob(b64str)
      .split("")
      .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
      .join("")
  );
}

/**
 * Parse first number from string
 * @param str - String to parse
 * @returns Parsed number or NaN
 */
export function parseNumberFromString(str: string): number {
  const numbers = str.match(/\d+/g);
  if (isNotEmpty(numbers) && numbers && numbers.length > 0) {
    return Number(numbers[0]);
  }
  return NaN;
}

/**
 * Group array by key(s)
 * @param array - Array to group
 * @param key - Key or keys to group by
 * @returns Grouped object
 */
export function groupBy<T extends Record<string, unknown>>(
  array: T[],
  key: keyof T | (keyof T)[]
): Record<string, T[]> {
  const keys = Array.isArray(key) ? key : [key];
  return array.reduce(
    (rv, x) => {
      const groupKey = keys.map((k) => String(x[k])).join("||");
      rv[groupKey] = rv[groupKey] || [];
      rv[groupKey].push(x);
      return rv;
    },
    {} as Record<string, T[]>
  );
}

/**
 * Get max values per group
 * @param arr - Array to process
 * @param key - Key or keys to group by
 * @param compare - Comparison function
 * @returns Array of max values per group
 */
export function maxValuesGroupBykey<T extends Record<string, unknown>>(
  arr: T[],
  key: keyof T | (keyof T)[],
  compare: (a: T, b: T) => number
): T[] {
  const map = groupBy(arr, key);
  const result: T[] = [];
  for (const value of Object.values(map)) {
    const maxValue = value.reduce((max, current) => (compare(max, current) > 0 ? max : current));
    result.push(maxValue);
  }
  return result;
}

/**
 * Filter array by conditions
 * @param arr - Array to filter
 * @param conditions - Filter conditions
 * @returns Filtered array
 */
export function filter<T extends Record<string, unknown>>(
  arr: T[],
  conditions: Partial<Record<keyof T, string>>
): T[] {
  return arr.filter((item) => {
    for (const [key, value] of Object.entries(conditions)) {
      const itemValue = String(item[key as keyof T] ?? "");
      if (!itemValue.includes(value as string)) return false;
    }
    return true;
  });
}

/**
 * Calculate GitHub blob SHA
 * @param content - File content
 * @returns SHA hash
 */
export async function calculateBlobSHA(content: string): Promise<string> {
  const textEncoder = new TextEncoder();
  const data = textEncoder.encode(`blob ${new Blob([content]).size}\0${content}`);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hexHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hexHash;
}

/**
 * Async pool for concurrent operations with limit
 * @param poolLimit - Maximum concurrent operations
 * @param array - Array to process
 * @param iteratorFn - Async iterator function
 * @returns Promise resolving to array of results
 */
export async function asyncPool<T, R>(
  poolLimit: number,
  array: T[],
  iteratorFn: (item: T, array: T[]) => Promise<R>
): Promise<R[]> {
  const ret: Promise<R>[] = [];
  const executing: Promise<void>[] = [];

  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item, array));
    ret.push(p);

    if (poolLimit <= array.length) {
      const e: Promise<void> = p.then(() => {
        executing.splice(executing.indexOf(e), 1);
      });
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

/**
 * Combine two arrays by merging objects at same index
 * @param a - First array
 * @param b - Second array
 * @returns Combined array
 */
export function combine<A extends object, B extends object>(a: A[], b: B[]): (A & B)[] {
  return a.map((x, i) => ({ ...x, ...b[i] }));
}
