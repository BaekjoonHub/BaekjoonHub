const REPO_DESCRIPTION = 'This is an auto push repository for Baekjoon Online Judge created with [BaekjoonHub](https://github.com/BaekjoonHub/BaekjoonHub).';

const option = () => {
  return $('#type').val();
};

const repositoryName = () => {
  const input = $('#name').val().trim();
  // GitHub URL이 입력된 경우 레포 이름만 추출
  const match = input.match(/^https?:\/\/github\.com\/[^/]+\/([^/]+)/);
  if (match) {
    return match[1].replace(/\.git$/, '');
  }
  return input;
};

/* Status codes for creating of repo */

const statusCode = (res, status, name) => {
  switch (status) {
    case 304:
      $('#success').hide();
      I18N.bind(document.getElementById('error'), 'welcome.error.creating304', { name }, 'text');
      $('#error').show();
      break;

    case 400:
      $('#success').hide();
      I18N.bind(document.getElementById('error'), 'welcome.error.creating400', { name }, 'text');
      $('#error').show();
      break;

    case 401:
      $('#success').hide();
      I18N.bind(document.getElementById('error'), 'welcome.error.creating401', { name }, 'text');
      $('#error').show();
      break;

    case 403:
      $('#success').hide();
      I18N.bind(document.getElementById('error'), 'welcome.error.creating403', { name }, 'text');
      $('#error').show();
      break;

    case 422:
      $('#success').hide();
      I18N.bind(document.getElementById('error'), 'welcome.error.creating422', { name }, 'text');
      $('#error').show();
      break;

    default:
      /* Change mode type to commit */
      chrome.storage.local.set({ mode_type: 'commit' }, () => {
        $('#error').hide();
        I18N.bind(document.getElementById('success'), 'welcome.success.created', { url: res.html_url, name });
        $('#success').show();
        $('#unlink').show();
        /* Show new layout */
        document.getElementById('hook_mode').style.display = 'none';
        document.getElementById('commit_mode').style.display = 'inherit';
      });
      /* Set Repo Hook */
      chrome.storage.local.set({ BaekjoonHub_hook: res.full_name }, () => {
        console.log('Successfully set new repo hook');
      });

      break;
  }
};

const createRepo = (token, name) => {
  const AUTHENTICATION_URL = 'https://api.github.com/user/repos';
  let data = {
    name,
    private: true,
    auto_init: true,
    description: REPO_DESCRIPTION,
  };
  data = JSON.stringify(data);

  const xhr = new XMLHttpRequest();
  xhr.addEventListener('readystatechange', function() {
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
  let bool = false;
  switch (status) {
    case 301:
      $('#success').hide();
      I18N.bind(document.getElementById('error'), 'welcome.error.linking301', { name });
      $('#error').show();
      break;

    case 403:
      $('#success').hide();
      I18N.bind(document.getElementById('error'), 'welcome.error.linking403', { name });
      $('#error').show();
      break;

    case 404:
      $('#success').hide();
      I18N.bind(document.getElementById('error'), 'welcome.error.linking404', { name });
      $('#error').show();
      break;

    default:
      bool = true;
      break;
  }
  $('#unlink').show();
  return bool;
};

/* 
    Method for linking hook with an existing repository 
    Steps:
    1. Check if existing repository exists and the user has write access to it.
    2. Link Hook to it (chrome Storage).
*/
/** 빈 레포(커밋 없음)에 초기 README.md 커밋을 생성합니다. */
const initializeEmptyRepoWelcome = async (token, hook, branch) => {
  const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'content-type': 'application/json' };
  const repoName = hook.split('/')[1];
  const readmeContent = btoa(unescape(encodeURIComponent(`# ${repoName}\n${REPO_DESCRIPTION}\n`)));
  // Contents API — 빈 레포에서도 안정적으로 동작
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

  const xhr = new XMLHttpRequest();
  xhr.addEventListener('readystatechange', async function() {
    if (xhr.readyState === 4) {
      const res = JSON.parse(xhr.responseText);
      const bool = linkStatusCode(xhr.status, name);
      if (xhr.status === 200) {
        // BUG FIX
        if (!bool) {
          // unable to gain access to repo in commit mode. Must switch to hook mode.
          /* Set mode type to hook */
          chrome.storage.local.set({ mode_type: 'hook' }, () => {
            console.log(`Error linking ${name} to BaekjoonHub`);
          });
          /* Set Repo Hook to NONE */
          chrome.storage.local.set({ BaekjoonHub_hook: null }, () => {
            console.log('Defaulted repo hook to NONE');
          });

          /* Hide accordingly */
          document.getElementById('hook_mode').style.display = 'inherit';
          document.getElementById('commit_mode').style.display = 'none';
        } else {
          // 빈 레포인 경우 초기 커밋 생성 (size === 0이면 빈 레포)
          if (res.size === 0) {
            try {
              await initializeEmptyRepoWelcome(token, res.full_name, res.default_branch);
              console.log('Initialized empty repo with README.md');
            } catch (e) {
              console.log('Empty repo init failed', e);
            }
          }

          /* Change mode type to commit */
          /* Save repo url to chrome storage */
          chrome.storage.local.set({ mode_type: 'commit', repo: res.html_url }, () => {
            $('#error').hide();
            I18N.bind(document.getElementById('success'), 'welcome.success.linked', { url: res.html_url, name });
            $('#success').show();
            $('#unlink').show();
          });
          /* Set Repo Hook */

          stats = {};
          stats.version = chrome.runtime.getManifest().version;
          stats.submission = {};
          chrome.storage.local.set({ stats });

          chrome.storage.local.set({ BaekjoonHub_hook: res.full_name }, () => {
            console.log('Successfully set new repo hook');
            /* Get problems solved count */
            chrome.storage.local.get('stats', (psolved) => {
              const { stats } = psolved;
            });
          });
          /* Hide accordingly */
          document.getElementById('hook_mode').style.display = 'none';
          document.getElementById('commit_mode').style.display = 'inherit';
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
  /* Set mode type to hook */
  chrome.storage.local.set({ mode_type: 'hook' }, () => {
    console.log(`Unlinking repo`);
  });
  /* Set Repo Hook to NONE */
  chrome.storage.local.set({ BaekjoonHub_hook: null }, () => {
    console.log('Defaulted repo hook to NONE');
  });

  /*프로그래밍 언어별 폴더 정리 옵션 세션 저장 초기화*/
  chrome.storage.local.set({ BaekjoonHub_disOption: "platform" }, () => {
    console.log('DisOption Reset');
  });

  /* Hide accordingly */
  document.getElementById('hook_mode').style.display = 'inherit';
  document.getElementById('commit_mode').style.display = 'none';
};

/* Check for value of select tag, Get Started disabled by default */

$('#type').on('change', function() {
  const valueSelected = this.value;
  if (valueSelected) {
    $('#hook_button').attr('disabled', false);
  } else {
    $('#hook_button').attr('disabled', true);
  }
});

$('#hook_button').on('click', () => {
  /* on click should generate: 1) option 2) repository name */
  if (!option()) {
    I18N.bind(document.getElementById('error'), 'welcome.error.noOption', null, 'text');
    $('#error').show();
  } else if (!repositoryName()) {
    I18N.bind(document.getElementById('error'), 'welcome.error.noRepoName', null, 'text');
    $('#name').focus();
    $('#error').show();
  } else {
    $('#error').hide();
    I18N.bind(document.getElementById('success'), 'welcome.attempting', null, 'text');
    $('#success').show();

    /* 
      Perform processing
      - step 1: Check if current stage === hook.
      - step 2: store repo name as repoName in chrome storage.
      - step 3: if (1), POST request to repoName (iff option = create new repo) ; else display error message.
      - step 4: if proceed from 3, hide hook_mode and display commit_mode (show stats e.g: files pushed/questions-solved/leaderboard)
    */
    chrome.storage.local.get('BaekjoonHub_token', (data) => {
      const token = data.BaekjoonHub_token;
      if (token === null || token === undefined) {
        /* Not authorized yet. */
        I18N.bind(document.getElementById('error'), 'welcome.error.auth', null, 'text');
        $('#error').show();
        $('#success').hide();
      } else if (option() === 'new') {
        createRepo(token, repositoryName());
      } else {
        chrome.storage.local.get('BaekjoonHub_username', (data2) => {
          const username = data2.BaekjoonHub_username;
          if (!username) {
            /* Improper authorization. */
            I18N.bind(document.getElementById('error'), 'welcome.error.improperAuth', null, 'text');
            $('#error').show();
            $('#success').hide();
          } else {
            linkRepo(token, `${username}/${repositoryName()}`, false);
          }
        });
      }
    });
  }

  /*프로그래밍 언어별 폴더 정리 옵션 세션 저장*/
  let org_option = $('#org_option').val();
  chrome.storage.local.set({ BaekjoonHub_OrgOption: org_option }, () => {
    console.log(`Set Organize by ${org_option}`);
  });
});

$('#name').on('input', function () {
  if ($(this).val().trim()) {
    $('#type').val('link');
    $('#hook_button').attr('disabled', false);
  }
});

$('#unlink a').on('click', () => {
  unlinkRepo();
  $('#unlink').hide();
  I18N.bind(document.getElementById('success'), 'welcome.success.unlinked', null, 'text');
});

$('#token_refresh_button').on('click', () => {
  chrome.storage.local.get('BaekjoonHub_token', (data) => {
    const token = data.BaekjoonHub_token;
    if (!token) {
      I18N.bind(document.getElementById('token_status'), 'welcome.tokenStatus.notFound', null, 'text');
      $('#token_status').css('color', '#ff6b6b').show();
      return;
    }
    fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
    })
      .then((res) => {
        if (res.ok) {
          I18N.bind(document.getElementById('token_status'), 'welcome.tokenStatus.valid', null, 'text');
          $('#token_status').css('color', '#51cf66').show();
        } else {
          I18N.bind(document.getElementById('token_status'), 'welcome.tokenStatus.expired');
          $('#token_status').css('color', '#ff6b6b').show();
        }
      })
      .catch(() => {
        I18N.bind(document.getElementById('token_status'), 'welcome.tokenStatus.error', null, 'text');
        $('#token_status').css('color', '#ff6b6b').show();
      });
  });
});

/* Initialize i18n and detect mode type */
I18N.init(() => {

chrome.storage.local.get('mode_type', (data) => {
  const mode = data.mode_type;

  if (mode && mode === 'commit') {
    /* Check if still access to repo */
    chrome.storage.local.get('BaekjoonHub_token', (data2) => {
      const token = data2.BaekjoonHub_token;
      if (token === null || token === undefined) {
        /* Not authorized yet. */
        I18N.bind(document.getElementById('error'), 'welcome.error.authTopRight', null, 'text');
        $('#error').show();
        $('#success').hide();
        /* Hide accordingly */
        document.getElementById('hook_mode').style.display = 'inherit';
        document.getElementById('commit_mode').style.display = 'none';
      } else {
        /* Get access to repo */
        chrome.storage.local.get('BaekjoonHub_hook', (repoName) => {
          const hook = repoName.BaekjoonHub_hook;
          if (!hook) {
            /* Not authorized yet. */
            I18N.bind(document.getElementById('error'), 'welcome.error.improperAuthTopRight', null, 'text');
            $('#error').show();
            $('#success').hide();
            /* Hide accordingly */
            document.getElementById('hook_mode').style.display = 'inherit';
            document.getElementById('commit_mode').style.display = 'none';
          } else {
            /* Username exists, at least in storage. Confirm this */
            linkRepo(token, hook);
          }
        });
      }
    });

    document.getElementById('hook_mode').style.display = 'none';
    document.getElementById('commit_mode').style.display = 'inherit';
  } else {
    document.getElementById('hook_mode').style.display = 'inherit';
    document.getElementById('commit_mode').style.display = 'none';
  }
});

}); /* end I18N.init callback */
