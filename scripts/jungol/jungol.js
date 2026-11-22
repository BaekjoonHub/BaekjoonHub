// Set to true to enable console log
const debug = false;

/*
  정올 문제 페이지에서 제출하면 채점 결과 대화상자가 뜬다. 그 대화상자를 MutationObserver 로 바로 알아채고,
  2초 폴링은 옵저버가 놓친 경우(스크립트가 들어오기 전에 이미 떠 있던 대화상자 등)를 위해 둔다. (SWEA 와 같은 방식)
  대화상자에는 제출 번호가 없어, 그 문제에 내가 가장 최근에 낸 제출을 서버에서 찾는다.
  정답인지는 화면의 글자가 아니라 서버에서 받은 데이터로 정한다. 화면의 글자는 표시 언어에 따라 바뀐다.

  정올 서버에 요청할 때 지킬 것:
  - api.jungol.co.kr 에는 직접 요청하지 않는다. 같은 출처의 정올 페이지를 받아 거기 실린 데이터를 읽는다 (parsing.js fetchLoaded).
  - 정올 서버 호출은 페이지 받기를 포함해 1.5초에 10번을 넘기지 않는다.
*/
let observer;
let loader;
let handledDialog = null; // 이미 본 대화상자. 닫히면 비워, 같은 화면의 다음 제출을 다시 본다
let queue = Promise.resolve(); // 한 번에 하나씩 처리한다
let me = null; // 로그인한 계정 { id, handle }. 처음 받은 페이지에서 안다

const PENDING = ['CP', 'PD', 'RUN']; // 정올이 채점 중에 쓰는 결과 값
/* 채점 중으로 남아 있을 때 다시 보기까지 기다리는 시간(ms). 위의 호출 횟수 제한 안에 들도록 횟수를 적게 두고 간격을 늘려 간다. */
const RETRY_DELAYS = [300, 700, 1500, 3000];

startLoader();

function startLoader() {
  observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true });
  loader = setInterval(check, 2000);
  check();
}

function stopLoader() {
  clearInterval(loader);
  observer.disconnect();
}

function check() {
  /* 확장이 갱신되어 컨텍스트가 무효가 되면 storage 접근이 계속 reject 된다 */
  if (!chrome.runtime?.id) {
    stopLoader();
    return;
  }
  const dialog = document.querySelector('.dh-dialog .result-stack .verdict')?.closest('.dh-dialog') ?? null;
  if (dialog === handledDialog) return;
  handledDialog = dialog;
  const problemId = location.pathname.match(/^\/problem\/(\d+)/)?.[1];
  if (isNull(dialog) || isNull(problemId)) return;
  queue = queue.then(() => handleResult(dialog, problemId));
}

/** 채점 결과 대화상자 하나를 처리합니다. 내 가장 최근 제출이 정답이면 GitHub 에 올린다. reject 되지 않는다. */
async function handleResult(dialog, problemId) {
  try {
    if (!(await checkEnable())) {
      stopLoader();
      return;
    }
    let latest = await findMySubmission(problemId);
    /* 화면에 결과가 뜬 직후에는 서버 목록에 아직 채점 중으로 남아 있을 때가 있어, 짧게 다시 본다.
       그사이 같은 문제에 낸 다음 제출로 바뀌지 않도록 처음 찾은 제출을 번호로 다시 본다 */
    for (const delay of RETRY_DELAYS) {
      if (!PENDING.includes(latest?.r)) break;
      await new Promise((resolve) => setTimeout(resolve, delay));
      latest = await findMySubmission(problemId, latest.id);
    }
    if (latest?.r !== 'AC') return;
    showStatus(dialog, 'loading', 'BaekjoonHub: GitHub 에 올리는 중…');
    const detail = findLoaded(await load(`/problem/${problemId}/submission?sid=${latest.id}`), `$/submission/${latest.id}`)?.data;
    /* 대회 제출은 올리지 않는다 (대회 중에 풀이가 공개되면 안 된다) */
    if (!isNull(detail?.additional?.contestId)) {
      showStatus(dialog, 'failed', 'BaekjoonHub: 대회 제출은 GitHub 에 올리지 않습니다.');
      return;
    }
    const bojData = detail?.m_reason === 'AC' ? await makeData(detail) : null;
    if (!isNotEmpty(bojData)) throw new Error('제출한 코드를 읽지 못했습니다');
    log('bojData', bojData);
    const hook = await getHook();
    await uploadUnlessSame(bojData, (branches, directory, committed) => {
      const url = `https://github.com/${hook}/tree/${branches[hook]}/${directory.split('/').map(encodeURIComponent).join('/')}`;
      showStatus(dialog, 'done', committed ? 'BaekjoonHub: GitHub 에 올렸습니다.' : 'BaekjoonHub: 같은 코드가 이미 GitHub 에 올라가 있습니다.', url);
      if (committed) new Toast(`정올 ${bojData.problemId}번 풀이를 GitHub 에 올렸습니다.`, ToastType.Succes, 5000);
    });
  } catch (error) {
    console.error('[BaekjoonHub] 정올 업로드 중 오류가 발생했습니다.', error);
    const reason = error?.name === 'TokenExpiredError' ? 'GitHub 토큰이 만료되었습니다. BaekjoonHub 설정에서 다시 로그인해 주세요.' : error?.message || `${error}`;
    showStatus(dialog, 'failed', `BaekjoonHub: GitHub 에 올리지 못했습니다. (${reason})`);
    Toast.raiseToast(`정올 풀이를 GitHub 에 올리지 못했습니다: ${reason}`);
  }
}

/** 정올 페이지의 데이터를 받고, 거기 실린 로그인 계정을 기억합니다. */
async function load(path) {
  const nodes = await fetchLoaded(path);
  me = findLoaded(nodes, '$/account/my')?.data ?? me;
  return nodes;
}

/**
 * 이 문제에 낸 내 제출을 찾습니다. 번호를 주면 그 제출을, 주지 않으면 가장 최근 제출을 찾는다.
 * @param {string} problemId
 * @param {number} [id] - 제출 번호
 * @returns {Promise<(object|undefined)>} 제출 목록의 항목 { id, r: 결과, … }. 로그인하지 않았거나 찾지 못하면 undefined
 */
async function findMySubmission(problemId, id) {
  const listOf = async (query) => findLoaded(await load(`/submission?${query}`), '$/submission?', true)?.data?.list || [];
  const wanted = (item) => item.accountInfo?.id === me.id && (isNull(id) || item.id === id);
  /* 로그인한 계정을 아직 모르면 문제의 최근 제출 목록에서 계정과 내 제출을 함께 찾는다 */
  let list = isNull(me) ? await listOf(`problem=${problemId}`) : [];
  if (isNull(me)) return undefined;
  if (!list.some(wanted)) list = await listOf(`problem=${problemId}&account=${encodeURIComponent(me.handle)}`);
  return list.find(wanted);
}

/**
 * 채점 결과 대화상자에 업로드 상태를 한 줄로 적습니다. 대화상자가 이미 닫혔어도 문제없다.
 * @param {Element} dialog
 * @param {('loading'|'done'|'failed')} state
 * @param {string} text
 * @param {string} [url] - 올린 폴더의 GitHub 주소
 */
function showStatus(dialog, state, text, url) {
  let status = dialog.querySelector('.BaekjoonHub_status');
  if (isNull(status)) {
    status = document.createElement('div');
    status.className = 'BaekjoonHub_status';
    dialog.querySelector('.result-stack')?.append(status);
  }
  status.dataset.state = state;
  status.textContent = text;
  if (isNull(url)) return;
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = '보기';
  status.append(' ', link);
}
