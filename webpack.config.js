import path, {dirname} from "path";
import CopyPlugin from "copy-webpack-plugin";
import {CleanWebpackPlugin} from "clean-webpack-plugin";
import webpack from "webpack";
import fs from "fs";
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default (env, argv = {}) => {
    return {
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
                    {from: "./src/manifest.json", to: "./"},
                    {from: "./src/rules.json", to: "./"},
                    {from: "./src/assets", to: "./assets"},
                    {from: "./src/css", to: "./css"},
                    {from: "./src/popup.html", to: "./"},
                    {from: "./src/settings.html", to: "./"},
                ],
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
}
