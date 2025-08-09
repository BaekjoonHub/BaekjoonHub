import js from "@eslint/js";
import globals from "globals";
import pluginPrettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import pluginImport from "eslint-plugin-import";

export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.webextensions,
      },
    },
    plugins: {
      prettier: pluginPrettier,
      import: pluginImport,
    },
    rules: {
      "prettier/prettier": "error",
      "no-unused-vars": "warn",
    },
    settings: {
      "import/resolver": {
        alias: {
          map: [["@", "./src/scripts"]],
          extensions: [".js", ".json"],
        },
        node: {
          extensions: [".js", ".json"],
        },
      },
    },
  },

  js.configs.recommended,

  {
    files: ["src/*.js", "src/scripts/baekjoon/baekjoon.js", "src/scripts/goormlevel/goormlevel.js", "src/scripts/programmers/programmers.js", "src/scripts/swexpertacademy/swexpertacademy.js"],
    rules: {
      "no-unused-vars": "off",
    },
  },

  prettierConfig,
];
