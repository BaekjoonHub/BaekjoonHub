const REPO_DESCRIPTION = 'This is an auto push repository for Baekjoon Online Judge created with [BaekjoonHub](https://github.com/BaekjoonHub/BaekjoonHub).';
const MANUAL = '__manual__';
const VIEWS = ['auth', 'repo', 'done'];

const $id = (id) => document.getElementById(id);

let pickAccount = false; // 이 페이지에서 로그아웃한 뒤에는 다른 계정을 고를 수 있게 한다
let banner = null; // [i18n key, params]: 이번에 만들거나 연결한 저장소 안내
let reposLoaded = false;

const ghFetch = (token, path, init) => fetch(`https://api.github.com${path}`, {
  ...init,
  headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
});

/**
 * 빈 레포에 README.md 를 생성한다.
 *
 * 호출 측의 `res.size === 0` 만으로는 빈 레포 판정이 불안정하다. GitHub API 의
 * `repo.size` 는 비동기 통계라 `auto_init: true` 로 생성된 직후의 레포는 README 가
 * 이미 있어도 한동안 0 으로 응답한다. 그 윈도 안에 이 함수가 호출되면 이미 존재하는
 * README 에 sha 없이 PUT 하여 422 가 떨어지고, `console.error(..., err)` 로 객체를
 * 그대로 두 번째 인자에 넘기면 Chrome 확장 오류 패널이 toString 직렬화하여
 * `Failed to initialize empty repo: [object Object]` 가 누적된다 (#341).
 *
 * 1차로 README 가 실제로 있는지 GET 으로 확인하고, 없을 때만 PUT 한다. probe ~ PUT
 * 사이의 동시 생성 race 로 떨어지는 422 도 무시한다.
 */
const initializeEmptyRepoWelcome = async (token, hook, branch) => {
  const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' };
  const probeUrl = `https://api.github.com/repos/${hook}/contents/README.md?ref=${encodeURIComponent(branch)}`;
  const probe = await fetch(probeUrl, { headers });
  if (probe.ok) {
    // README 이미 존재 — 초기화 불필요.
    return;
  }
  if (probe.status !== 404) {
    const probeErr = await probe.json().catch(() => ({}));
    console.error('Failed to probe README before empty-repo init:', probeErr.message || JSON.stringify(probeErr));
    return;
  }

  const repoName = hook.split('/')[1];
  const readmeContent = btoa(unescape(encodeURIComponent(`# ${repoName}\n${REPO_DESCRIPTION}\n`)));
  const res = await fetch(`https://api.github.com/repos/${hook}/contents/README.md`, {
    method: 'PUT', headers, body: JSON.stringify({ message: 'Initial commit - BaekjoonHub', content: readmeContent, branch }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // probe ~ PUT 사이의 동시 생성 race 로 이미 README 가 만들어진 경우(422 "sha wasn't supplied") 는 noop.
    if (res.status === 422 && /sha/i.test(err.message || '')) return;
    console.error('Failed to initialize empty repo:', err.message || JSON.stringify(err));
  }
};

/* --- Views --- */
function showView(name) {
  const current = VIEWS.indexOf(name);
  VIEWS.forEach((v) => $id(`view_${v}`).classList.toggle('hidden', v !== name));
  document.querySelectorAll('#steps li').forEach((li) => {
    const i = VIEWS.indexOf(li.dataset.step);
    li.classList.toggle('is-done', i < current || name === 'done');
    li.classList.toggle('is-active', i === current);
    if (i === current) li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
  });
}

function showAuth(error) {
  const el = $id('auth_error');
  if (error) I18N.bind(el, `welcome.auth.error.${error}`, null, 'text');
  el.classList.toggle('hidden', !error);
  showView('auth');
}

// 어디서든 401 이면 토큰만 지운다. 저장소 연결은 남겨 두어 다시 인증하면 바로 완료 화면으로 온다.
function expire() {
  chrome.storage.local.set({ BaekjoonHub_token: null }, () => showAuth('expired'));
}

function showRepo(fromDone) {
  chrome.storage.local.get('BaekjoonHub_username', ({ BaekjoonHub_username: username }) => {
    const account = $id('repo_account');
    if (username) I18N.bind(account, 'welcome.repo.signedInAs', { username });
    account.classList.toggle('hidden', !username);
    $id('repo_cancel').classList.toggle('hidden', !fromDone);
    $id('repo_error').classList.add('hidden');
    showView('repo');
  });
}

function showDone() {
  chrome.storage.local.get(['BaekjoonHub_token', 'BaekjoonHub_username', 'BaekjoonHub_hook'], (d) => {
    const bannerEl = $id('done_banner');
    if (banner) I18N.bind(bannerEl, banner[0], banner[1]);
    bannerEl.classList.toggle('hidden', !banner);
    banner = null;
    $id('conn_account').textContent = d.BaekjoonHub_username ? `@${d.BaekjoonHub_username}` : '';
    const repoLink = $id('conn_repo');
    repoLink.textContent = d.BaekjoonHub_hook;
    repoLink.href = `https://github.com/${d.BaekjoonHub_hook}`;
    showView('done');
    checkConnection(d.BaekjoonHub_token, d.BaekjoonHub_hook);
  });
}

let connectionCheck = 0;
async function checkConnection(token, hook) {
  const check = ++connectionCheck;
  const el = $id('conn_status');
  const set = (state, cls) => {
    // 저장소를 바꾼 뒤 늦게 도착한 이전 저장소의 결과는 버린다
    if (check !== connectionCheck) return;
    I18N.bind(el, `welcome.conn.status.${state}`, null, 'text');
    el.className = `conn-status ${cls || ''}`;
  };
  set('checking');
  try {
    const res = await ghFetch(token, `/repos/${hook}`);
    if (res.status === 401) return expire();
    const body = res.ok ? await res.json() : {};
    const canPush = !(body.permissions && body.permissions.push === false);
    if (body.archived) set('archived', 'status-err');
    else if (res.ok && canPush) set('ok', 'status-ok');
    else if (res.ok || [301, 403, 404].includes(res.status)) set('repoGone', 'status-err');
    else set('unknown');
  } catch (e) {
    set('unknown');
  }
}

/* --- Step 1: GitHub account --- */
$id('auth_button').addEventListener('click', () => oAuth2.begin(pickAccount));

/* --- Step 2: repository --- */
const repoMode = () => ($id('repo_mode_existing').checked ? 'existing' : 'new');

function setSubmitting(busy) {
  const button = $id('repo_submit');
  button.disabled = busy;
  const key = busy ? 'submitting' : repoMode() === 'existing' ? 'submitExisting' : 'submitNew';
  I18N.bind(button, `welcome.repo.${key}`, null, 'text');
}

function showRepoError(key, params, mode) {
  const el = $id('repo_error');
  I18N.bind(el, key, params, mode);
  el.classList.remove('hidden');
}

function addOption(select, value, key) {
  const option = document.createElement('option');
  option.value = value;
  if (key) I18N.bind(option, key, null, 'text');
  else option.textContent = value;
  select.appendChild(option);
  return option;
}

const updateManual = () => $id('repo_manual_field').classList.toggle('hidden', $id('repo_select').value !== MANUAL);

function loadRepos() {
  reposLoaded = true;
  const select = $id('repo_select');
  select.textContent = '';
  addOption(select, '', 'welcome.repo.listLoading').disabled = true;
  chrome.storage.local.get('BaekjoonHub_token', async ({ BaekjoonHub_token: token }) => {
    let repos = null;
    try {
      // shortcut: only the first 100 repositories by latest push; the rest via manual entry. Upgrade to pagination if users ask.
      const res = await ghFetch(token, '/user/repos?per_page=100&sort=pushed');
      if (res.status === 401) return expire();
      // 보관(archive)된 저장소는 push 권한이 true 로 오지만 올릴 수 없다
      if (res.ok) repos = (await res.json()).filter((r) => r.permissions && r.permissions.push && !r.archived);
    } catch (e) {
      // 목록을 못 받으면 직접 입력으로 넘어간다.
    }
    select.textContent = '';
    if (repos) {
      const placeholder = addOption(select, '', 'welcome.repo.listPlaceholder');
      placeholder.disabled = true;
      placeholder.selected = true;
      repos.forEach((r) => addOption(select, r.full_name));
    }
    addOption(select, MANUAL, 'welcome.repo.listManual').selected = !repos;
    $id('repo_list_failed').classList.toggle('hidden', !!repos);
    updateManual();
  });
}

document.querySelectorAll('input[name="repo_mode"]').forEach((radio) => radio.addEventListener('change', () => {
  const existing = repoMode() === 'existing';
  $id('repo_new_panel').classList.toggle('hidden', existing);
  $id('repo_existing_panel').classList.toggle('hidden', !existing);
  $id('repo_error').classList.add('hidden');
  if (!$id('repo_submit').disabled) setSubmitting(false); // 요청 중에는 버튼을 다시 켜지 않는다
  if (existing && !reposLoaded) loadRepos();
}));

$id('repo_select').addEventListener('change', updateManual);

function linked(res, key) {
  chrome.storage.local.set({
    mode_type: 'commit',
    repo: res.html_url,
    BaekjoonHub_hook: res.full_name,
    stats: { version: chrome.runtime.getManifest().version, submission: {} },
  }, () => {
    banner = [key, { url: res.html_url, name: res.full_name }];
    showDone();
  });
}

async function submitRepo(token, name, existing) {
  try {
    const res = existing
      ? await ghFetch(token, `/repos/${name}`)
      : await ghFetch(token, '/user/repos', {
        method: 'POST',
        body: JSON.stringify({ name, private: document.querySelector('input[name="repo_visibility"]:checked').value === 'private', auto_init: true, description: REPO_DESCRIPTION }),
      });
    if (res.status === 401) return expire();
    const body = await res.json().catch(() => ({}));
    if (res.ok && existing && body.archived) return showRepoError('welcome.error.archived', { name });
    if (res.ok && existing && body.permissions && body.permissions.push === false) {
      return showRepoError('welcome.error.noPush', { name });
    }
    if (res.ok) {
      if (existing && body.size === 0) {
        await initializeEmptyRepoWelcome(token, body.full_name, body.default_branch).catch((e) => console.log('Empty repo init failed', e));
      }
      return linked(body, existing ? 'welcome.success.linked' : 'welcome.success.created');
    }
    // 연결 오류 메시지는 HTML(저장소 링크), 생성 오류 메시지는 사용자가 친 이름이 들어가므로 TEXT.
    if (existing && [301, 403, 404].includes(res.status)) return showRepoError(`welcome.error.linking${res.status}`, { name });
    if (!existing && [304, 400, 403, 422].includes(res.status)) return showRepoError(`welcome.error.creating${res.status}`, { name }, 'text');
    showRepoError('welcome.error.unknown', { status: res.status }, 'text');
  } catch (e) {
    showRepoError('welcome.error.network', null, 'text');
  }
}

$id('repo_form').addEventListener('submit', (e) => {
  e.preventDefault();
  if ($id('repo_submit').disabled) return;
  $id('repo_error').classList.add('hidden');
  const existing = repoMode() === 'existing';
  setSubmitting(true); // 저장소를 읽기 전에 잠가 연속 제출을 막는다
  chrome.storage.local.get(['BaekjoonHub_token', 'BaekjoonHub_username'], async (d) => {
    try {
      let name;
      if (!existing) {
        name = $id('repo_name').value.trim();
        if (!name) {
          $id('repo_name').focus();
          return showRepoError('welcome.error.noRepoName', null, 'text');
        }
      } else {
        const selected = $id('repo_select').value;
        if (!selected) return showRepoError('welcome.error.noRepoSelected', null, 'text');
        name = selected === MANUAL ? parseRepoInput($id('repo_manual').value, d.BaekjoonHub_username) : selected;
        if (!name) {
          $id('repo_manual').focus();
          return showRepoError('welcome.error.invalidRepo', null, 'text');
        }
      }
      await submitRepo(d.BaekjoonHub_token, name, existing);
    } finally {
      setSubmitting(false);
    }
  });
});

$id('repo_cancel').addEventListener('click', showDone);

/* --- Step 3: connection --- */
$id('change_repo_button').addEventListener('click', () => showRepo(true));

$id('logout_button').addEventListener('click', () => {
  if (!confirm(I18N.t('welcome.conn.logoutConfirm'))) return;
  chrome.storage.local.set({ BaekjoonHub_token: null, BaekjoonHub_username: null, BaekjoonHub_hook: null, mode_type: 'hook' }, () => {
    pickAccount = true;
    showAuth(null);
  });
});

/* --- Step 3: upload settings (each change saves immediately) --- */
let savedTimer;
function flashSaved() {
  const el = $id('settings_saved');
  el.textContent = I18N.t('welcome.settings.saved');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { el.textContent = ''; }, 1500);
}

const TEMPLATE_PLATFORMS = ['baekjoon', 'programmers', 'swea', 'jungol', 'doj'];
const templateKey = (platform) => `BaekjoonHub_dirTemplate_${platform}`;

const TEMPLATE_PREVIEW_VARS = {
  baekjoon:    { platform: '백준', level: 'Gold', levelFull: 'Gold V', id: '1000', title: 'A＋B', language: 'Python' },
  programmers: { platform: '프로그래머스', level: '2', id: '12345', title: '타겟 넘버', language: 'JavaScript' },
  swea:        { platform: 'SWEA', level: 'D4', id: '1234', title: '문제제목', language: 'Java' },
  jungol:      { platform: '정올', level: 'Bronze', levelFull: 'Bronze V', id: '1000', title: '두 정수 더하기', language: 'C++' },
  doj:         { platform: 'DOJ', level: 'Silver', levelFull: 'Silver V', id: '1', title: '레몬 게임', language: 'C++' },
};

const TEMPLATE_DEFAULTS = {
  baekjoon:    '${platform}/${level}/${id}. ${title}',
  programmers: '${platform}/${level}/${id}. ${title}',
  swea:        '${platform}/${level}/${id}. ${title}',
  jungol:      '${platform}/${level}/${id}. ${title}',
  doj:         '${platform}/${level}/${id}. ${title}',
};

function updateTemplatePreview(platform) {
  const template = $id(`tmpl_${platform}`).value || TEMPLATE_DEFAULTS[platform];
  const vars = TEMPLATE_PREVIEW_VARS[platform];
  const result = template.replace(/\$\{(\w+)\}/g, (match, key) => (vars.hasOwnProperty(key) ? vars[key] : ''));
  $id(`tmpl_preview_${platform}`).textContent = `➜ ${result}`;
}

function loadSettings() {
  const keys = ['BaekjoonHub_OrgOption', 'bjhSaveExamples', 'bjhKeepSolutionVersions', ...TEMPLATE_PLATFORMS.map(templateKey)];
  chrome.storage.local.get(keys, (d) => {
    $id('org_option').value = d.BaekjoonHub_OrgOption === 'language' ? 'language' : 'platform';
    $id('examplesBox').checked = d.bjhSaveExamples === true;
    $id('keepVersionsBox').checked = d.bjhKeepSolutionVersions === true;
    TEMPLATE_PLATFORMS.forEach((platform) => {
      $id(`tmpl_${platform}`).value = d[templateKey(platform)] || '';
      updateTemplatePreview(platform);
    });
  });
}

$id('org_option').addEventListener('change', (e) => chrome.storage.local.set({ BaekjoonHub_OrgOption: e.target.value }, flashSaved));
$id('examplesBox').addEventListener('change', (e) => chrome.storage.local.set({ bjhSaveExamples: e.target.checked }, flashSaved));
$id('keepVersionsBox').addEventListener('change', (e) => chrome.storage.local.set({ bjhKeepSolutionVersions: e.target.checked }, flashSaved));

TEMPLATE_PLATFORMS.forEach((platform) => {
  const input = $id(`tmpl_${platform}`);
  // 입력할 때마다 저장한다: change 는 포커스를 잃을 때만 생겨, 입력 직후 탭을 닫으면 저장되지 않는다
  input.addEventListener('input', () => {
    updateTemplatePreview(platform);
    const value = input.value.trim();
    if (value) chrome.storage.local.set({ [templateKey(platform)]: value }, flashSaved);
    else chrome.storage.local.remove(templateKey(platform), flashSaved);
  });
});

$id('tmpl_reset').addEventListener('click', () => {
  TEMPLATE_PLATFORMS.forEach((platform) => {
    $id(`tmpl_${platform}`).value = '';
    updateTemplatePreview(platform);
  });
  chrome.storage.local.remove(TEMPLATE_PLATFORMS.map(templateKey), flashSaved);
});

/* --- Dark/Light theme --- */
function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  $id('theme_icon_light').classList.toggle('hidden', !dark);
  $id('theme_icon_dark').classList.toggle('hidden', dark);
}

function initTheme() {
  chrome.storage.local.get('bjh_theme', (data) => {
    applyTheme(data.bjh_theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  });
}

$id('theme_toggle').addEventListener('click', () => {
  const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
  applyTheme(newTheme);
  chrome.storage.local.set({ bjh_theme: newTheme });
});

/* --- Start: pick the view from storage --- */
const authError = new URLSearchParams(location.search).get('auth_error');
if (authError) history.replaceState(null, '', location.pathname);

I18N.init(() => {
  initTheme();
  loadSettings();
  setSubmitting(false);
  chrome.storage.local.get(['BaekjoonHub_token', 'BaekjoonHub_hook', 'mode_type'], (d) => {
    // 저장소는 남아 있는데 토큰이 없으면 만료로 지워진 것이다 (로그아웃은 저장소도 지운다)
    const lost = d.BaekjoonHub_hook ? 'expired' : null;
    if (!d.BaekjoonHub_token) showAuth(authError ? (authError === 'denied' ? 'denied' : 'failed') : lost);
    else if (d.mode_type === 'commit' && d.BaekjoonHub_hook) showDone();
    else showRepo(false);
  });
});
