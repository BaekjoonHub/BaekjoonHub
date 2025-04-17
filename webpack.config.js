const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const webpack = require("webpack");
const fs = require("fs");

// 모든 스크립트를 일반 JavaScript로 빌드 (ES 모듈 사용하지 않음)
module.exports = {
  mode: "production",
  // Set devtool to false for production to avoid eval() usage
  devtool: false,
  entry: {
    background: "./src/scripts/background.js",
    authorize: "./src/scripts/authorize.js",
    baekjoon: "./src/scripts/baekjoon/baekjoon.js",
    programmers: "./src/scripts/programmers/programmers.js",
    swexpertacademy: "./src/scripts/swexpertacademy/swexpertacademy.js",
    goormlevel: "./src/scripts/goormlevel/goormlevel.js",
    oauth2: "./src/scripts/oauth2/oauth2.js",
    popup: "./src/popup.js",
    settings: "./src/settings.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    // ES 모듈 형식 비활성화
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanAfterEveryBuildPatterns: ["**/*.LICENSE.txt"],
      protectWebpackAssets: false,
    }),
    new CopyPlugin({
      patterns: [
        { from: "./src/manifest.json", to: "./" },
        { from: "./src/rules.json", to: "./" },
        { from: "./src/assets", to: "./assets" },
        { from: "./src/css", to: "./css" },
        { from: "./src/popup.html", to: "./" },
        { from: "./src/settings.html", to: "./" },
      ],
    }),
    // No global jQuery needed anymore
    // src/manifest.json의 version을 package.json의 version으로 덮어씌우는 플러그인
    new webpack.DefinePlugin({
      'process.env.VERSION': JSON.stringify((() => {
        // package.json에서 버전 읽기
        const manifestPath = path.resolve(__dirname, "src/manifest.json");
        const packagePath = path.resolve(__dirname, "package.json");
        
        try {
          const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
          const packageVersion = packageData.version;
          
          // manifest.json에 버전 업데이트
          const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          manifestData.version = packageVersion;
          fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
          
          console.log(`\n[VERSION SYNC] src/manifest.json 버전이 package.json의 ${packageVersion} 버전으로 업데이트되었습니다.\n`);
          return packageVersion;
        } catch (error) {
          console.error('버전 동기화 중 오류 발생:', error);
          throw error;
        }
      })())
    }),
  ],
  optimization: {
    // Disable code splitting for content scripts, but keep it for popup and settings
    splitChunks: {
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          // Only split chunks for popup and settings, not for content scripts
          chunks: (chunk) => {
            return ["popup", "settings", "oauth2"].includes(chunk.name);
          },
        },
      },
    },
  },
  resolve: {
    extensions: [".js", ".jsx", ".json"],
    alias: {
      sha1: "js-sha1",
      jszip: "jszip",
      filesaver: "file-saver",
    },
  },
};
