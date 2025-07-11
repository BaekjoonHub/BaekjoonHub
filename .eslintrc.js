module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    webextensions: true,
  },
  extends: ["eslint:recommended", "plugin:prettier/recommended"],
  plugins: ["prettier"],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module",
  },
  rules: {
    "prettier/prettier": "error",
    "no-unused-vars": "warn",
  },
  overrides: [
    {
      files: [
        "src/*.js", // src 폴더 바로 하단의 js 파일 (popup.js, settings.js)
        "src/scripts/baekjoon/baekjoon.js",
        "src/scripts/goormlevel/goormlevel.js",
        "src/scripts/programmers/programmers.js",
        "src/scripts/swexpertacademy/swexpertacademy.js",
      ],
      rules: {
        "no-unused-vars": "off",
      },
    },
  ],
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
};