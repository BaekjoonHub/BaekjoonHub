/* NOTE: 백준 허브(for goormlevel)의 전역 변수 선언 파일입니다. */

/* 포함된 변수는 다음과 같습니다.
    languages: goormlevel에서 제공하는 프로그래밍 언어에 맞는 file extension
    uploadState: 현재 업로드 중인지를 저장하는 boolean입니다.
    difficultyLabels: 문제의 난이도를 숫자로 매핑하는 상수입니다.
*/

import constants from "@/constants/code.js";

export const languages = constants.languages.goormlevel;
export const difficultyLabels = constants.goormlevelDifficultyLabels;

/* state of upload for progress */
export const uploadState = { uploading: false };
