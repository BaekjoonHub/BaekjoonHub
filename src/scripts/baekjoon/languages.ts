/**
 * Baekjoon Language Extension Mapping System
 *
 * This module provides a flexible and extensible way to map programming language names
 * to their file extensions. It supports:
 * - Direct language name matching
 * - Version-agnostic matching (e.g., "Python 3.11" -> "py")
 * - Pattern-based inference for unknown languages
 * - Easy addition of new languages without modifying core logic
 */

export interface LanguageConfig {
  extension: string;
  aliases?: string[]; // Alternative names for the same language
}

/**
 * Comprehensive language to extension mapping
 * Includes all languages supported by Baekjoon (acmicpc.net)
 * Last updated: Based on official Baekjoon language list
 *
 * To add a new language:
 * 1. Add an entry to LANGUAGE_MAP with the base language name as key
 * 2. Set the extension and optionally add aliases
 */
const LANGUAGE_MAP: Record<string, LanguageConfig> = {
  // C Family (including all Clang variants)
  C: {
    extension: "c",
    aliases: [
      "C90", "C99", "C11", "C2x", "ANSI C",
      "C90 (Clang)", "C99 (Clang)", "C11 (Clang)", "C2x (Clang)",
    ],
  },
  "C++": {
    extension: "cpp",
    aliases: [
      "C++98", "C++03", "C++11", "C++14", "C++17", "C++20", "C++23", "C++26",
      "C++98 (Clang)", "C++11 (Clang)", "C++14 (Clang)", "C++17 (Clang)",
      "C++20 (Clang)", "C++23 (Clang)", "C++26 (Clang)",
    ],
  },
  "C#": {
    extension: "cs",
    aliases: ["C# 3.0 (Mono)", "C# 6.0 (Mono)"],
  },
  "Objective-C": { extension: "m" },
  "Objective-C++": { extension: "mm" },

  // JVM Languages
  Java: {
    extension: "java",
    aliases: [
      "Java 8", "Java 8 (OpenJDK)", "Java 11", "Java 15", "Java 17", "Java 21",
    ],
  },
  Kotlin: {
    extension: "kt",
    aliases: ["Kotlin (JVM)", "Kotlin (Native)"],
  },
  Scala: { extension: "scala" },
  Groovy: { extension: "groovy" },
  Clojure: { extension: "clj" },

  // Python Family
  Python: {
    extension: "py",
    aliases: ["Python 2", "Python 3", "Python 3.11", "Python 3.12"],
  },
  PyPy: { extension: "py", aliases: ["PyPy2"] },
  PyPy3: { extension: "py" },
  Cython: { extension: "pyx" },

  // JavaScript/TypeScript
  JavaScript: { extension: "js" },
  "Node.js": { extension: "js", aliases: ["node.js"] },
  TypeScript: { extension: "ts" },
  Deno: { extension: "ts" },
  Rhino: { extension: "js" },

  // Ruby (including version variants)
  Ruby: {
    extension: "rb",
    aliases: ["Ruby 1.8", "Ruby 1.9", "Ruby 2.7", "Ruby 3.0"],
  },

  // Go
  Go: { extension: "go", aliases: ["Go (gccgo)", "Golang"] },

  // Rust (including edition variants)
  Rust: {
    extension: "rs",
    aliases: ["Rust 2015", "Rust 2018", "Rust 2021", "Rust 2024"],
  },

  // Swift
  Swift: { extension: "swift" },

  // Functional Languages
  Haskell: { extension: "hs", aliases: ["GHC"] },
  OCaml: { extension: "ml" },
  "F#": {
    extension: "fs",
    aliases: ["F# (Mono)"],
  },
  Erlang: { extension: "erl" },
  Elixir: { extension: "ex" },
  Scheme: { extension: "scm", aliases: ["Chicken"] },
  Racket: { extension: "rkt" },
  "Common Lisp": { extension: "lisp", aliases: ["Lisp", "SBCL", "CLISP"] },
  Prolog: { extension: "pl", aliases: ["SWI-Prolog"] },
  Standard_ML: { extension: "sml", aliases: ["Standard ML", "SML", "MLton"] },
  Coq: { extension: "v" },

  // .NET Languages
  "Visual Basic": {
    extension: "vb",
    aliases: ["VB", "VB.NET", "VB.NET 2.0 (Mono)", "VB.NET 4.0 (Mono)"],
  },

  // PHP
  PHP: { extension: "php" },

  // Perl
  Perl: { extension: "pl" },

  // Lua
  Lua: { extension: "lua", aliases: ["LuaJIT"] },

  // R
  R: { extension: "r" },

  // Julia
  Julia: { extension: "jl" },

  // D Language
  D: { extension: "d", aliases: ["DMD", "LDC", "GDC", "D (LDC)"] },

  // Nim (formerly Nimrod)
  Nim: { extension: "nim", aliases: ["Nimrod"] },

  // Crystal
  Crystal: { extension: "cr" },

  // Pascal Family
  Pascal: { extension: "pas", aliases: ["Free Pascal", "FPC"] },

  // Fortran
  Fortran: { extension: "f95", aliases: ["Fortran 95", "Fortran 2003", "gfortran"] },

  // Ada
  Ada: { extension: "adb", aliases: ["Ada 95", "Ada 2012", "GNAT"] },

  // COBOL
  Cobol: { extension: "cob", aliases: ["COBOL", "GnuCOBOL"] },

  // Assembly
  Assembly: { extension: "asm", aliases: ["Assembly (32bit)", "Assembly (64bit)", "NASM"] },

  // Shell/Scripting
  Bash: { extension: "sh", aliases: ["Shell", "sh"] },
  Awk: { extension: "awk", aliases: ["GNU Awk", "gawk", "awk"] },
  Sed: { extension: "sed", aliases: ["GNU sed", "sed"] },
  Tcl: { extension: "tcl" },

  // Esoteric Languages
  Brainfuck: { extension: "bf", aliases: ["BF", "Brainf**k"] },
  Whitespace: { extension: "ws" },
  Befunge: { extension: "bf", aliases: ["Befunge-93", "Befunge-98"] },
  INTERCAL: { extension: "i" },
  Golfscript: { extension: "gs" },
  LOLCODE: { extension: "lol" },
  아희: { extension: "aheui", aliases: ["Aheui"] },
  엄준식: { extension: "eomumsik" },

  // Other Compiled Languages
  Pike: { extension: "pike" },
  Boo: { extension: "boo" },
  Nemerle: { extension: "n" },
  Cobra: { extension: "cobra" },
  Haxe: { extension: "hx" },
  Zig: { extension: "zig" },

  // Hardware Description Languages
  SystemVerilog: { extension: "sv" },

  // Other Languages
  Text: { extension: "txt" },
  Forth: { extension: "fth", aliases: ["gforth"] },
  FreeBASIC: { extension: "bas", aliases: ["BASIC"] },
  "ALGOL 68": { extension: "a68", aliases: ["Algol", "Algol 68"] },
  bc: { extension: "bc" },
  Minecraft: { extension: "mca" },
  APECODE: { extension: "ape" },

  // System/Low-level
  LLVM_IR: { extension: "ll", aliases: ["LLVM IR", "LLVM"] },
};

/**
 * Build reverse lookup maps for efficient searching
 */
const buildLookupMaps = () => {
  const exactMap = new Map<string, string>();
  const normalizedMap = new Map<string, string>();

  for (const [langName, config] of Object.entries(LANGUAGE_MAP)) {
    // Add base name
    exactMap.set(langName, config.extension);
    normalizedMap.set(normalizeLangName(langName), config.extension);

    // Add aliases
    if (config.aliases) {
      for (const alias of config.aliases) {
        exactMap.set(alias, config.extension);
        normalizedMap.set(normalizeLangName(alias), config.extension);
      }
    }
  }

  return { exactMap, normalizedMap };
};

/**
 * Normalize language name for matching
 * - Converts to lowercase
 * - Removes version numbers, parentheses, and extra whitespace
 */
export function normalizeLangName(lang: string): string {
  if (!lang) return "";

  return lang
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, "") // Remove parenthetical content
    .replace(/\s+[\d.]+.*$/, "") // Remove version numbers
    .replace(/[\s_-]+/g, "") // Remove spaces, underscores, hyphens
    .trim();
}

/**
 * Extract base language name from versioned name
 * Examples:
 *   "C++17" -> "C++"
 *   "Python 3.11" -> "Python"
 *   "Java (OpenJDK)" -> "Java"
 *   "Go (gccgo)" -> "Go"
 */
export function extractBaseLangName(lang: string): string {
  if (!lang) return "";

  // Special cases that should not have version stripped
  const preserveVersionLanguages = new Set(["PyPy3", "PyPy2", "node.js", "Node.js"]);
  if (preserveVersionLanguages.has(lang)) {
    return lang;
  }

  // Remove parenthetical content first (e.g., "Java (OpenJDK)" -> "Java")
  let baseName = lang.replace(/\s*\([^)]*\)\s*/g, "").trim();

  // Handle C++ versions (C++11, C++14, etc.)
  if (/^C\+\+\d+$/.test(baseName)) {
    return "C++";
  }

  // Handle C versions (C99, C11, etc.)
  if (/^C\d+$/.test(baseName)) {
    return "C";
  }

  // Remove version numbers after space (e.g., "Python 3" -> "Python")
  baseName = baseName.replace(/\s+[\d.]+.*$/, "").trim();

  return baseName;
}

// Build lookup maps at module load time
const { exactMap, normalizedMap } = buildLookupMaps();

/**
 * Pattern-based extension inference for unknown languages
 * Used as a last resort when exact and normalized matching fails
 * Patterns are checked in order, so more specific patterns should come first
 */
const EXTENSION_PATTERNS: Array<{ pattern: RegExp; extension: string }> = [
  // C/C++ family (check C++ before C)
  { pattern: /^c\+\+/i, extension: "cpp" },
  { pattern: /^c#/i, extension: "cs" },
  { pattern: /^c\d+\s*\(clang\)/i, extension: "c" }, // C99 (Clang) 등
  { pattern: /^c\d*$/i, extension: "c" }, // C, C99, C11 등
  { pattern: /^f#/i, extension: "fs" },
  { pattern: /objective.?c\+\+/i, extension: "mm" },
  { pattern: /objective.?c/i, extension: "m" },

  // Python family
  { pattern: /python|pypy/i, extension: "py" },
  { pattern: /cython/i, extension: "pyx" },

  // JVM languages
  { pattern: /^java/i, extension: "java" },
  { pattern: /^kotlin/i, extension: "kt" },
  { pattern: /^scala/i, extension: "scala" },
  { pattern: /^groovy/i, extension: "groovy" },
  { pattern: /^clojure/i, extension: "clj" },

  // Other popular languages
  { pattern: /^swift/i, extension: "swift" },
  { pattern: /^go\b/i, extension: "go" },
  { pattern: /^rust/i, extension: "rs" },
  { pattern: /^ruby/i, extension: "rb" },
  { pattern: /javascript|node\.?js|rhino/i, extension: "js" },
  { pattern: /typescript|deno/i, extension: "ts" },
  { pattern: /^php/i, extension: "php" },
  { pattern: /^perl/i, extension: "pl" },

  // Functional languages
  { pattern: /^haskell|^ghc/i, extension: "hs" },
  { pattern: /^ocaml/i, extension: "ml" },
  { pattern: /^erlang/i, extension: "erl" },
  { pattern: /^elixir/i, extension: "ex" },
  { pattern: /^racket/i, extension: "rkt" },
  { pattern: /scheme/i, extension: "scm" },
  { pattern: /lisp|^sbcl|^clisp/i, extension: "lisp" },
  { pattern: /prolog/i, extension: "pl" },
  { pattern: /standard.?ml|^sml|^mlton/i, extension: "sml" },
  { pattern: /^coq/i, extension: "v" },

  // .NET languages
  { pattern: /visual.?basic|^vb/i, extension: "vb" },

  // Scripting languages
  { pattern: /^lua/i, extension: "lua" },
  { pattern: /^r\b/i, extension: "r" },
  { pattern: /^julia/i, extension: "jl" },
  { pattern: /^tcl/i, extension: "tcl" },

  // Systems languages
  { pattern: /^d\s*(\(|$)/i, extension: "d" },
  { pattern: /^nim|nimrod/i, extension: "nim" },
  { pattern: /^crystal/i, extension: "cr" },
  { pattern: /^zig/i, extension: "zig" },

  // Legacy/traditional languages
  { pattern: /pascal|^fpc/i, extension: "pas" },
  { pattern: /fortran/i, extension: "f95" },
  { pattern: /^ada/i, extension: "adb" },
  { pattern: /cobol/i, extension: "cob" },
  { pattern: /assembly|^asm|^nasm/i, extension: "asm" },

  // Shell/Scripting
  { pattern: /^bash|^shell|^sh$/i, extension: "sh" },
  { pattern: /^awk/i, extension: "awk" },
  { pattern: /^sed/i, extension: "sed" },

  // Esoteric languages
  { pattern: /brainfuck|brainf\*\*k|^bf$/i, extension: "bf" },
  { pattern: /whitespace/i, extension: "ws" },
  { pattern: /befunge/i, extension: "bf" },
  { pattern: /intercal/i, extension: "i" },
  { pattern: /golfscript/i, extension: "gs" },
  { pattern: /lolcode/i, extension: "lol" },
  { pattern: /아희|aheui/i, extension: "aheui" },
  { pattern: /엄준식/i, extension: "eomumsik" },

  // Other compiled languages
  { pattern: /^pike/i, extension: "pike" },
  { pattern: /^boo/i, extension: "boo" },
  { pattern: /^nemerle/i, extension: "n" },
  { pattern: /^cobra/i, extension: "cobra" },
  { pattern: /^haxe/i, extension: "hx" },

  // HDL
  { pattern: /systemverilog|\.sv$/i, extension: "sv" },

  // Other
  { pattern: /^text$/i, extension: "txt" },
  { pattern: /^forth/i, extension: "fth" },
  { pattern: /basic/i, extension: "bas" },
  { pattern: /algol/i, extension: "a68" },
  { pattern: /^bc$/i, extension: "bc" },
  { pattern: /minecraft/i, extension: "mca" },
  { pattern: /apecode/i, extension: "ape" },
  { pattern: /llvm/i, extension: "ll" },
];

/**
 * Infer extension from language name using patterns
 */
function inferExtensionFromPattern(lang: string): string | null {
  for (const { pattern, extension } of EXTENSION_PATTERNS) {
    if (pattern.test(lang)) {
      return extension;
    }
  }
  return null;
}

/**
 * Get file extension for a programming language
 *
 * The function tries to match in the following order:
 * 1. Exact match in the lookup map
 * 2. Base language name match (version stripped)
 * 3. Normalized name match
 * 4. Pattern-based inference
 * 5. Default to "txt"
 *
 * @param language - The language name from Baekjoon
 * @param defaultExt - Default extension if no match found (default: "txt")
 * @returns File extension without the dot
 *
 * @example
 * getLanguageExtension("Python 3.11") // "py"
 * getLanguageExtension("C++20")       // "cpp"
 * getLanguageExtension("Java (OpenJDK)") // "java"
 * getLanguageExtension("Unknown Lang")   // "txt"
 */
export function getLanguageExtension(language: string, defaultExt: string = "txt"): string {
  if (!language) return defaultExt;

  // 1. Try exact match
  const exactMatch = exactMap.get(language);
  if (exactMatch) return exactMatch;

  // 2. Try base language name (version stripped)
  const baseName = extractBaseLangName(language);
  const baseMatch = exactMap.get(baseName);
  if (baseMatch) return baseMatch;

  // 3. Try normalized match
  const normalizedMatch = normalizedMap.get(normalizeLangName(language));
  if (normalizedMatch) return normalizedMatch;

  // 4. Try pattern-based inference
  const patternMatch = inferExtensionFromPattern(language);
  if (patternMatch) return patternMatch;

  // 5. Return default
  return defaultExt;
}

/**
 * Check if a language is supported (has a known extension mapping)
 *
 * @param language - The language name to check
 * @returns true if the language has a known extension mapping
 */
export function isLanguageSupported(language: string): boolean {
  return getLanguageExtension(language, "") !== "";
}

/**
 * Get all supported languages
 *
 * @returns Array of all supported language names
 */
export function getSupportedLanguages(): string[] {
  return Array.from(exactMap.keys());
}

/**
 * Add a custom language mapping at runtime
 * Useful for user-defined extensions or temporary additions
 *
 * @param language - The language name
 * @param extension - The file extension (without dot)
 * @param aliases - Optional array of alternative names
 */
export function addLanguageMapping(language: string, extension: string, aliases?: string[]): void {
  exactMap.set(language, extension);
  normalizedMap.set(normalizeLangName(language), extension);

  if (aliases) {
    for (const alias of aliases) {
      exactMap.set(alias, extension);
      normalizedMap.set(normalizeLangName(alias), extension);
    }
  }
}

/**
 * Legacy compatibility export
 * Maps language names to extensions in the same format as the old system
 *
 * @deprecated Use getLanguageExtension() instead for new code
 */
export const languages: Record<string, string> = new Proxy(
  {},
  {
    get(_target, prop: string) {
      return getLanguageExtension(prop);
    },
    has(_target, prop: string) {
      return isLanguageSupported(prop);
    },
  }
);

export default {
  getLanguageExtension,
  isLanguageSupported,
  getSupportedLanguages,
  addLanguageMapping,
  extractBaseLangName,
  normalizeLangName,
  languages,
};
