// Set to true to enable console log
const debug = true;

/* 
  문제 제출 맞음 여부를 확인하는 함수
  2초마다 문제를 파싱하여 확인
*/
let loader;

const currentUrl = window.location.href;

// 프로그래머스 연습 문제 주소임을 확인하고, 맞다면 로더를 실행한다
if (currentUrl.includes('/learn/courses') && currentUrl.includes('lessons')) startLoader();

function startLoader() {
  loader = setInterval(async () => {
    // 제출 후 채점하기 결과가 성공적으로 나왔다면 코드를 파싱하고, 업로드를 시작한다
    if (get_solved_result().includes('정답')) {
      if (debug) console.log("정답이 나왔습니다. 업로드를 시작합니다.");
      stopLoader();
      // parsing code, and upload github
      // 이후에 은근 딜레이가 있어서, 다른 사람이 맞은 현황으로 페이지 이동을 자동으로 해줘야할 것 같습니다.
      // 아래는 파싱할 수 있는 항목들 종합입니다.
      // 문제 번호 : document.querySelector("div.main > div.lesson-content").getAttribute("lesson-id")
      // 문제 제목 : document.querySelector("#tab > li.algorithm-title").textContent.replace(/\\n/g, '').trim()
      // 문제 내용 : document.querySelector("div.guide-section-description > div.markdown").innerHTML
      // 작성 언어 : document.querySelector("div.editor > ul > li.nav-item > a").getAttribute("data-language")
      // 작성 코드 : [...document.querySelectorAll("pre.CodeMirror-line")].map(x => x.innerText).reduce( (x, y) => x + '\n' + y);
      // 체점 결과 : [...document.querySelectorAll("#output > pre.console-content > div.console-message")].map(x => x.innerText).filter(x => x.includes("합계: ")).reduce( (x, y) => x + '\n' + y)
      // 시용 메모리 & 시간측정 : let [time, memory] = [...document.querySelectorAll("td.result.passed")].map(x => x.innerText).map(x => x.replace(/[^\., 0-9a-zA-Z]/g, '').trim()).map(x => x.split(", ")).reduce( (x, y) => Number(x[0]) > Number(y[0]) ? x : y)
    }
  }, 2000);
}

function stopLoader() {
  clearInterval(loader);
}

function get_solved_result() {
  const result = document.querySelector('div.modal-header > h4');
  if (result) return result.innerText;
  return '';
}

// function get_csrf_token() {
//   const csrfToken = document.querySelector('meta[name=csrf-token]').getAttribute('content');
//   return csrfToken;
// }
// function get_all_problems() {
//   /* TODO: 하나의 데이터만 가져오는 구조이므로 page를 계속적으로
//   아래 있는 네이베이션바의 "다음"버튼이 비활성화 될때까지 반복으로 진행한다.
//   진행하며 존재하는 알고리즘 카드인 div.col-item > div.card-algorithm > a 의 href 속성값을 가져와 리스트화하고,
//   이를 차후 fetch GET를 진행하여 작성한 알고리즘을 가져와 github에 업로드를 진행한다.
//   */
//   const data = new URLSearchParams();
//   data.set('challenge_statuses[]', 'solved');
//   data.set('page', '1');
//   fetch(`/learn/challenges/filter_lessons?${data.toString()}`, {
//     method: 'GET',
//     credentials: 'same-origin',
//     headers: {
//       'x-requested-with': 'XMLHttpRequest',
//       'x-csrf-token': `${get_csrf_token()}`,
//     },
//   })
//     .then((res) => res.text())
//     .then((res) => {
//       const html = /\$\('.algorithm-list'\).html\('(.*)'\);/.exec(res)[1];
//       const doc = new DOMParser().parseFromString(html.replace(/\\"/g, '"').replace(/\\n/g, '').replace(/\\/g, ''), 'text/html');
//       if (debug) console.log(doc);
//     });
// }
