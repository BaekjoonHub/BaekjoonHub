const REPO_DESCRIPTION = 'This is an auto push repository for Baekjoon Online Judge created with [BaekjoonHub](https://github.com/BaekjoonHub/BaekjoonHub).';

const $ = (sel) => document.querySelector(sel);
const $id = (id) => document.getElementById(id);

const option = () => $id('type').value;

const repositoryName = () => {
  const input = $id('name').value.trim();
  const match = input.match(/^https?:\/\/github\.com\/[^/]+\/([^/]+)/);
  if (match) {
    return match[1].replace(/\.git$/, '');
  }
  return input;
};

/* Status codes for creating of repo */
const statusCode = (res, status, name) => {
  const errorEl = $id('error');
  const successEl = $id('success');
  const unlinkEl = $id('unlink');

  switch (status) {
    case 304:
      successEl.hidden = true;
      I18N.bind(errorEl, 'welcome.error.creating304', { name }, 'text');
      errorEl.hidden = false;
      break;
    case 400:
      successEl.hidden = true;
      I18N.bind(errorEl, 'welcome.error.creating400', { name }, 'text');
      errorEl.hidden = false;
      break;
    case 401:
      successEl.hidden = true;
      I18N.bind(errorEl, 'welcome.error.creating401', { name }, 'text');
      errorEl.hidden = false;
      break;
    case 403:
      successEl.hidden = true;
      I18N.bind(errorEl, 'welcome.error.creating403', { name }, 'text');
      errorEl.hidden = false;
      break;
    case 422:
      successEl.hidden = true;
      I18N.bind(errorEl, 'welcome.error.creating422', { name }, 'text');
      errorEl.hidden = false;
      break;
    default:
      chrome.storage.local.set({ mode_type: 'commit' }, () => {
        errorEl.hidden = true;
        I18N.bind(successEl, 'welcome.success.created', { url: res.html_url, name });
        successEl.hidden = false;
        unlinkEl.hidden = false;
        $id('hook_mode').classList.add('hidden');
        $id('commit_mode').classList.remove('hidden');
      });
      chrome.storage.local.set({ BaekjoonHub_hook: res.full_name }, () => {
        console.log('Successfully set new repo hook');
      });
      break;
  }
};

const createRepo = (token, name) => {
  const AUTHENTICATION_URL = 'https://api.github.com/user/repos';
  const data = JSON.stringify({
    name,
    private: true,
    auto_init: true,
    description: REPO_DESCRIPTION,
  });

  const xhr = new XMLHttpRequest();
  xhr.addEventListener('readystatechange', function () {
    if (xhr.readyState === 4) {
      statusCode(JSON.parse(xhr.responseText), xhr.status, name);
    }
  });

  stats = {};
  stats.version = chrome.runtime.getManifest().version;
  stats.submission = {};
  chrome.storage.local.set({ stats });

  xhr.open('POST', AUTHENTICATION_URL, true);
  xhr.setRequestHeader('Authorization', `token ${token}`);
  xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
  xhr.send(data);
};

/* Status codes for linking of repo */
const linkStatusCode = (status, name) => {
  const errorEl = $id('error');
  const successEl = $id('success');
  const unlinkEl = $id('unlink');
  let bool = false;

  switch (status) {
    case 301:
      successEl.hidden = true;
      I18N.bind(errorEl, 'welcome.error.linking301', { name });
      errorEl.hidden = false;
      break;
    case 403:
      successEl.hidden = true;
      I18N.bind(errorEl, 'welcome.error.linking403', { name });
      errorEl.hidden = false;
      break;
    case 404:
      successEl.hidden = true;
      I18N.bind(errorEl, 'welcome.error.linking404', { name });
      errorEl.hidden = false;
      break;
    default:
      bool = true;
      break;
  }
  unlinkEl.hidden = false;
  return bool;
};

/** Initialize empty repo with README.md */
const initializeEmptyRepoWelcome = async (token, hook, branch) => {
  const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' };
  const repoName = hook.split('/')[1];
  const readmeContent = btoa(unescape(encodeURIComponent(`# ${repoName}\n${REPO_DESCRIPTION}\n`)));
  const res = await fetch(`https://api.github.com/repos/${hook}/contents/README.md`, {
    method: 'PUT', headers, body: JSON.stringify({ message: 'Initial commit - BaekjoonHub', content: readmeContent, branch }),
  });
  if (!res.ok) {
    const err = await res.json();
    console.error('Failed to initialize empty repo:', err);
  }
};

const linkRepo = (token, name) => {
  const AUTHENTICATION_URL = `https://api.github.com/repos/${name}`;
  const errorEl = $id('error');
  const successEl = $id('success');
  const unlinkEl = $id('unlink');

  const xhr = new XMLHttpRequest();
  xhr.addEventListener('readystatechange', async function () {
    if (xhr.readyState === 4) {
      const res = JSON.parse(xhr.responseText);
      const bool = linkStatusCode(xhr.status, name);
      if (xhr.status === 200) {
        if (!bool) {
          chrome.storage.local.set({ mode_type: 'hook' }, () => {
            console.log(`Error linking ${name} to BaekjoonHub`);
          });
          chrome.storage.local.set({ BaekjoonHub_hook: null }, () => {
            console.log('Defaulted repo hook to NONE');
          });
          $id('hook_mode').classList.remove('hidden');
          $id('commit_mode').classList.add('hidden');
        } else {
          if (res.size === 0) {
            try {
              await initializeEmptyRepoWelcome(token, res.full_name, res.default_branch);
              console.log('Initialized empty repo with README.md');
            } catch (e) {
              console.log('Empty repo init failed', e);
            }
          }

          chrome.storage.local.set({ mode_type: 'commit', repo: res.html_url }, () => {
            errorEl.hidden = true;
            I18N.bind(successEl, 'welcome.success.linked', { url: res.html_url, name });
            successEl.hidden = false;
            unlinkEl.hidden = false;
          });

          stats = {};
          stats.version = chrome.runtime.getManifest().version;
          stats.submission = {};
          chrome.storage.local.set({ stats });

          chrome.storage.local.set({ BaekjoonHub_hook: res.full_name }, () => {
            console.log('Successfully set new repo hook');
            chrome.storage.local.get('stats', (psolved) => {
              const { stats } = psolved;
            });
          });
          $id('hook_mode').classList.add('hidden');
          $id('commit_mode').classList.remove('hidden');
        }
      }
    }
  });

  xhr.open('GET', AUTHENTICATION_URL, true);
  xhr.setRequestHeader('Authorization', `token ${token}`);
  xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
  xhr.send();
};

const unlinkRepo = () => {
  chrome.storage.local.set({ mode_type: 'hook' }, () => {
    console.log('Unlinking repo');
  });
  chrome.storage.local.set({ BaekjoonHub_hook: null }, () => {
    console.log('Defaulted repo hook to NONE');
  });
  chrome.storage.local.set({ BaekjoonHub_disOption: 'platform' }, () => {
    console.log('DisOption Reset');
  });
  $id('hook_mode').classList.remove('hidden');
  $id('commit_mode').classList.add('hidden');
};

/* --- Dark/Light theme --- */
function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    $id('theme_icon_light').classList.remove('hidden');
    $id('theme_icon_dark').classList.add('hidden');
  } else {
    document.documentElement.classList.remove('dark');
    $id('theme_icon_light').classList.add('hidden');
    $id('theme_icon_dark').classList.remove('hidden');
  }
}

function initTheme() {
  chrome.storage.local.get('bjh_theme', (data) => {
    let theme = data.bjh_theme;
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(theme);
  });
}

$id('theme_toggle').addEventListener('click', () => {
  const isDark = document.documentElement.classList.contains('dark');
  const newTheme = isDark ? 'light' : 'dark';
  applyTheme(newTheme);
  chrome.storage.local.set({ bjh_theme: newTheme });
});

/* --- Event listeners --- */
$id('type').addEventListener('change', function () {
  $id('hook_button').disabled = !this.value;
});

$id('hook_button').addEventListener('click', () => {
  const errorEl = $id('error');
  const successEl = $id('success');

  if (!option()) {
    I18N.bind(errorEl, 'welcome.error.noOption', null, 'text');
    errorEl.hidden = false;
  } else if (!repositoryName()) {
    I18N.bind(errorEl, 'welcome.error.noRepoName', null, 'text');
    $id('name').focus();
    errorEl.hidden = false;
  } else {
    errorEl.hidden = true;
    I18N.bind(successEl, 'welcome.attempting', null, 'text');
    successEl.hidden = false;

    chrome.storage.local.get('BaekjoonHub_token', (data) => {
      const token = data.BaekjoonHub_token;
      if (token === null || token === undefined) {
        I18N.bind(errorEl, 'welcome.error.auth', null, 'text');
        errorEl.hidden = false;
        successEl.hidden = true;
      } else if (option() === 'new') {
        createRepo(token, repositoryName());
      } else {
        chrome.storage.local.get('BaekjoonHub_username', (data2) => {
          const username = data2.BaekjoonHub_username;
          if (!username) {
            I18N.bind(errorEl, 'welcome.error.improperAuth', null, 'text');
            errorEl.hidden = false;
            successEl.hidden = true;
          } else {
            linkRepo(token, `${username}/${repositoryName()}`, false);
          }
        });
      }
    });
  }

  const org_option = $id('org_option').value;
  chrome.storage.local.set({ BaekjoonHub_OrgOption: org_option }, () => {
    console.log(`Set Organize by ${org_option}`);
  });
});

$id('name').addEventListener('input', function () {
  if (this.value.trim()) {
    $id('type').value = 'link';
    $id('hook_button').disabled = false;
  }
});

$id('unlink').querySelector('a').addEventListener('click', () => {
  unlinkRepo();
  $id('unlink').hidden = true;
  I18N.bind($id('success'), 'welcome.success.unlinked', null, 'text');
});

$id('token_refresh_button').addEventListener('click', () => {
  const tokenStatusEl = $id('token_status');
  chrome.storage.local.get('BaekjoonHub_token', (data) => {
    const token = data.BaekjoonHub_token;
    if (!token) {
      I18N.bind(tokenStatusEl, 'welcome.tokenStatus.notFound', null, 'text');
      tokenStatusEl.className = 'token-status status-err';
      tokenStatusEl.hidden = false;
      return;
    }
    fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
    })
      .then((res) => {
        if (res.ok) {
          I18N.bind(tokenStatusEl, 'welcome.tokenStatus.valid', null, 'text');
          tokenStatusEl.className = 'token-status status-ok';
        } else {
          I18N.bind(tokenStatusEl, 'welcome.tokenStatus.expired');
          tokenStatusEl.className = 'token-status status-err';
        }
        tokenStatusEl.hidden = false;
      })
      .catch(() => {
        I18N.bind(tokenStatusEl, 'welcome.tokenStatus.error', null, 'text');
        tokenStatusEl.className = 'token-status status-err';
        tokenStatusEl.hidden = false;
      });
  });
});

/* Save examples toggle */
chrome.storage.local.get('bjhSaveExamples', (data) => {
  $id('examplesBox').checked = data.bjhSaveExamples === true;
});
$id('examplesBox').addEventListener('click', () => {
  chrome.storage.local.set({ bjhSaveExamples: $id('examplesBox').checked });
});

/* === Directory Template Settings === */
const TEMPLATE_PLATFORMS = ['baekjoon', 'programmers', 'swea', 'goormlevel'];

const TEMPLATE_PREVIEW_VARS = {
  baekjoon:    { platform: '백준', level: 'Gold', levelFull: 'Gold V', id: '1000', title: 'A＋B', language: 'Python' },
  programmers: { platform: '프로그래머스', level: 'lv2', id: '12345', title: '타겟 넘버', language: 'JavaScript' },
  swea:        { platform: 'SWEA', level: 'D4', id: '1234', title: '문제제목', language: 'Java' },
  goormlevel:  { platform: 'goormlevel', level: '보통', examId: '12345', id: '54321', title: '문제제목', language: 'Python' },
};

const TEMPLATE_DEFAULTS = {
  baekjoon:    '${platform}/${level}/${id}. ${title}',
  programmers: '${platform}/${level}/${id}. ${title}',
  swea:        '${platform}/${level}/${id}. ${title}',
  goormlevel:  '${platform}/${level}/${id}. ${title}',
};

function updateTemplatePreview(platform) {
  const input = $id(`tmpl_${platform}`);
  const preview = $id(`tmpl_preview_${platform}`);
  if (!input || !preview) return;
  const template = input.value || TEMPLATE_DEFAULTS[platform];
  const vars = TEMPLATE_PREVIEW_VARS[platform];
  const result = template.replace(/\$\{(\w+)\}/g, (match, key) => {
    return vars.hasOwnProperty(key) ? vars[key] : '';
  });
  preview.textContent = `\u279C ${result}`;
}

function loadTemplateSettings() {
  TEMPLATE_PLATFORMS.forEach((platform) => {
    const key = `BaekjoonHub_dirTemplate_${platform}`;
    chrome.storage.local.get(key, (data) => {
      const input = $id(`tmpl_${platform}`);
      if (input && data[key]) {
        input.value = data[key];
      }
      updateTemplatePreview(platform);
    });
  });
}

function saveTemplateSettings() {
  TEMPLATE_PLATFORMS.forEach((platform) => {
    const input = $id(`tmpl_${platform}`);
    if (!input) return;
    const key = `BaekjoonHub_dirTemplate_${platform}`;
    const value = input.value.trim();
    if (value) {
      chrome.storage.local.set({ [key]: value });
    } else {
      chrome.storage.local.remove(key);
    }
  });
}

function resetTemplateSettings() {
  TEMPLATE_PLATFORMS.forEach((platform) => {
    const input = $id(`tmpl_${platform}`);
    if (input) input.value = '';
    const key = `BaekjoonHub_dirTemplate_${platform}`;
    chrome.storage.local.remove(key);
    updateTemplatePreview(platform);
  });
}

TEMPLATE_PLATFORMS.forEach((platform) => {
  const input = $id(`tmpl_${platform}`);
  if (input) {
    input.addEventListener('input', () => updateTemplatePreview(platform));
  }
});

$id('tmpl_save').addEventListener('click', () => {
  saveTemplateSettings();
  const successEl = $id('success');
  successEl.textContent = 'Directory template saved.';
  successEl.hidden = false;
  setTimeout(() => { successEl.hidden = true; }, 2000);
});

$id('tmpl_reset').addEventListener('click', () => {
  resetTemplateSettings();
});

/* Initialize i18n, theme, and detect mode type */
I18N.init(() => {
  initTheme();

  chrome.storage.local.get('mode_type', (data) => {
    const mode = data.mode_type;
    const errorEl = $id('error');
    const successEl = $id('success');

    if (mode && mode === 'commit') {
      chrome.storage.local.get('BaekjoonHub_token', (data2) => {
        const token = data2.BaekjoonHub_token;
        if (token === null || token === undefined) {
          I18N.bind(errorEl, 'welcome.error.authTopRight', null, 'text');
          errorEl.hidden = false;
          successEl.hidden = true;
          $id('hook_mode').classList.remove('hidden');
          $id('commit_mode').classList.add('hidden');
        } else {
          chrome.storage.local.get('BaekjoonHub_hook', (repoName) => {
            const hook = repoName.BaekjoonHub_hook;
            if (!hook) {
              I18N.bind(errorEl, 'welcome.error.improperAuthTopRight', null, 'text');
              errorEl.hidden = false;
              successEl.hidden = true;
              $id('hook_mode').classList.remove('hidden');
              $id('commit_mode').classList.add('hidden');
            } else {
              linkRepo(token, hook);
            }
          });
        }
      });

      $id('hook_mode').classList.add('hidden');
      $id('commit_mode').classList.remove('hidden');
      loadTemplateSettings();
    } else {
      $id('hook_mode').classList.remove('hidden');
      $id('commit_mode').classList.add('hidden');
    }
  });
});
