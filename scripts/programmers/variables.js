/* 백준 허브의 전역 변수 선언 파일입니다. */

/* 업로드 진행 상태.
   queue: 마지막으로 줄 세운 업로드의 Promise. 한 탭의 업로드는 감지 순서대로 한 번에 하나씩 실행한다
   (enqueueUpload 참고). */
const uploadState = { queue: Promise.resolve() };

const multiloader = {
  wrap: null,
  nom: null,
  denom: null,
};
