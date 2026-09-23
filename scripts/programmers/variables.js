/* 백준 허브의 전역 변수 선언 파일입니다. */

/* 업로드 진행 상태.
   queue: 마지막으로 줄 세운 업로드의 Promise. 업로드는 한 번에 하나씩만 실행한다 —
   updateHead 가 force 로 ref 를 갱신하므로 두 업로드가 겹치면 나중 커밋이 앞 커밋을 브랜치 이력에서 지운다. */
const uploadState = { queue: Promise.resolve() };

const multiloader = {
  wrap: null,
  nom: null,
  denom: null,
};
