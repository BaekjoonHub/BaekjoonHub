/* 백준 허브의 전역 변수 선언 파일입니다. */
/* 포함된 변수는 다음과 같습니다.
    levels: 현재 등록된 프로그래머스 연습 문제의 레벨 구분입니다.
    uploadState: 현재 업로드 중인지를 저장하는 boolean입니다.
*/

import constants from "@/constants/code.js";

export const languages = constants.languages;
export const bjLevel = constants.bjLevel;
export const RESULT_CATEGORY = constants.RESULT_CATEGORY;
export const RESULT_MESSAGE = constants.RESULT_MESSAGE;

/* state of upload for progress */
export const uploadState = { uploading: false };

export const multiloader = {
  wrap: null,
  nom: null,
  denom: null,
};
