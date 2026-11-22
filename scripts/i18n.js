const I18N = (() => {
  const translations = {
    en: {
      // welcome.html
      'welcome.subtitle': 'Automatically sync your code from Baekjoon to GitHub',
      'welcome.wantMore': 'Want more features?',
      'welcome.requestFeature': 'Request a feature!',
      'welcome.starOnGithub': 'Star <span class="star-logo-name">Baekjoon</span><span class="text-brand">Hub</span> on GitHub',

      // welcome: steps
      'welcome.step.auth': 'Connect GitHub',
      'welcome.step.repo': 'Choose repository',
      'welcome.step.done': 'Done',

      // welcome: step 1 (GitHub account)
      'welcome.auth.title': 'Connect your GitHub account',
      'welcome.auth.desc': 'When your solution is accepted, BaekjoonHub uploads it to your GitHub repository automatically.',
      'welcome.auth.scopeNote': 'GitHub asks for access to all of your repositories, but BaekjoonHub only uploads files to the one repository you choose in the next step.',
      'welcome.auth.button': 'Continue with GitHub',
      'welcome.auth.error.denied': 'You cancelled the GitHub permission request. Try again to connect.',
      'welcome.auth.error.failed': 'Could not connect to GitHub. Please try again in a moment.',
      'welcome.auth.error.expired': 'Your GitHub connection has expired. Please connect again.',

      // welcome: step 2 (repository)
      'welcome.repo.title': 'Choose where to upload your solutions',
      'welcome.repo.signedInAs': 'Connected as <strong>@${username}</strong>',
      'welcome.repo.modeNew': 'Create a new repository',
      'welcome.repo.modeExisting': 'Use an existing repository',
      'welcome.repo.nameLabel': 'Repository name',
      'welcome.repo.namePlaceholder': 'e.g. algorithm',
      'welcome.repo.visibilityLabel': 'Visibility',
      'welcome.repo.private': 'Private (only you can see it)',
      'welcome.repo.public': 'Public (anyone can see it)',
      'welcome.repo.listLabel': 'Your repositories',
      'welcome.repo.listLoading': 'Loading…',
      'welcome.repo.listPlaceholder': 'Select a repository',
      'welcome.repo.listManual': 'Not in the list? Type it in…',
      'welcome.repo.listFailed': 'Could not load your repositories. Type the repository below.',
      'welcome.repo.manualLabel': 'Repository (owner/name or GitHub URL)',
      'welcome.repo.submitNew': 'Create and connect',
      'welcome.repo.submitExisting': 'Connect',
      'welcome.repo.submitting': 'Connecting…',
      'welcome.repo.cancel': 'Cancel',

      // welcome.js dynamic messages
      'welcome.error.creating304': 'Error creating ${name} - Unable to modify repository. Try again later!',
      'welcome.error.creating400': 'Error creating ${name} - Bad POST request, make sure you\'re not overriding any existing scripts',
      'welcome.error.creating403': 'Error creating ${name} - Forbidden access to repository. Try again later!',
      'welcome.error.creating422': 'Error creating ${name} - A repository with this name may already exist. Choose "Use an existing repository" instead.',
      'welcome.success.created': 'Successfully created <a target="blank" href="${url}">${name}</a>.<br/>Start solving on <a href="https://acmicpc.net/">BOJ</a> · <a href="https://school.programmers.co.kr/">Programmers</a> · <a href="https://swexpertacademy.com/">SWEA</a> · <a href="https://jungol.co.kr/">JUNGOL</a> · <a href="https://doj.kr/">DOJ</a>!',
      'welcome.error.linking301': 'Error linking <a target="blank" href="https://github.com/${name}">${name}</a> to BaekjoonHub. <br> This repository has been moved permanently. Try creating a new one.',
      'welcome.error.linking403': 'Error linking <a target="blank" href="https://github.com/${name}">${name}</a> to BaekjoonHub. <br> Forbidden action. Please make sure you have the right access to this repository.',
      'welcome.error.linking404': 'Error linking <a target="blank" href="https://github.com/${name}">${name}</a> to BaekjoonHub. <br> Resource not found. Make sure you enter the right repository name.',
      'welcome.success.linked': 'Successfully linked <a target="blank" href="${url}">${name}</a> to BaekjoonHub.<br/>Start solving on <a href="https://acmicpc.net/">BOJ</a> · <a href="https://school.programmers.co.kr/">Programmers</a> · <a href="https://swexpertacademy.com/">SWEA</a> · <a href="https://jungol.co.kr/">JUNGOL</a> · <a href="https://doj.kr/">DOJ</a>!',
      'welcome.error.noRepoName': 'Enter a name for the repository.',
      'welcome.error.noRepoSelected': 'Select a repository first.',
      'welcome.error.invalidRepo': 'That does not look like a repository. Use owner/name or a GitHub URL.',
      'welcome.error.noPush': 'You do not have write access to <a target="blank" href="https://github.com/${name}">${name}</a>. Choose a repository you can push to.',
      'welcome.error.archived': '<a target="blank" href="https://github.com/${name}">${name}</a> is archived, so nothing can be uploaded to it. Choose another repository.',
      'welcome.error.unknown': 'Something went wrong (GitHub responded with ${status}). Please try again.',
      'welcome.error.network': 'Could not reach GitHub. Check your network connection and try again.',

      // welcome: step 3 (connection)
      'welcome.conn.title': 'Connection',
      'welcome.conn.account': 'GitHub account',
      'welcome.conn.repo': 'Repository',
      'welcome.conn.logout': 'Log out',
      'welcome.conn.changeRepo': 'Change repository',
      'welcome.conn.logoutConfirm': 'Log out of GitHub? Automatic uploads stop until you connect again.',
      'welcome.conn.status.checking': 'Checking the connection…',
      'welcome.conn.status.ok': 'Connected. Accepted solutions are uploaded automatically.',
      'welcome.conn.status.repoGone': 'BaekjoonHub cannot access this repository. It may have been deleted or renamed, or your access was removed. Please choose another repository.',
      'welcome.conn.status.archived': 'This repository is archived, so nothing can be uploaded to it. Please choose another repository.',
      'welcome.conn.status.unknown': 'Could not check the connection. Check your network.',

      // welcome: step 3 (upload settings)
      'welcome.settings.title': 'Upload settings',
      'welcome.settings.saved': 'Saved',
      'welcome.settings.organize': 'Folder layout',
      'welcome.organizeByPlatform': 'Organize by Platform',
      'welcome.organizeByLanguage': 'Organize by Language',
      'welcome.settings.organizeHint': 'Organizing by language puts a language folder first, e.g. Python/백준/Gold/1000. A+B. It does not apply to a platform that has its own path template below.',
      'welcome.saveExamples': 'Save example I/O',
      'welcome.keepVersions': 'Keep each different solution as a numbered file (_002, _003 ...)',
      'welcome.dirTemplate.title': 'Directory Path Template',
      'welcome.dirTemplate.hint': 'Leave a field empty to use the default path. Variables you can use:',
      'welcome.dirTemplate.reset': 'Reset',
      'welcome.platform.baekjoon': 'Baekjoon',
      'welcome.platform.programmers': 'Programmers',
      'welcome.platform.swea': 'SWEA',
      'welcome.platform.jungol': 'JUNGOL',
      'welcome.platform.doj': 'DOJ',

      // popup.html
      'popup.caption': 'Sync your code from BOJ to GitHub',
      'popup.status.needAuth': 'Connect your GitHub account to get started.',
      'popup.status.needRepo': 'Choose a repository for your solutions.',
      'popup.action.start': 'Get started',
      'popup.action.pickRepo': 'Choose repository',
      'popup.toggle.label': 'Auto upload',
      'popup.toggle.on': 'On',
      'popup.toggle.off': 'Off',
      'popup.settings': 'Settings',
      'popup.wantMore': 'Want more features?',
      'popup.requestFeature': 'Request a feature!',

      // popup.js dynamic messages
      'popup.yourRepo': 'Your Repo:',
    },
    ko: {
      // welcome.html
      'welcome.subtitle': '백준에서 푼 코드, GitHub에 자동으로 올려보세요',
      'welcome.wantMore': '더 필요한 기능이 있나요?',
      'welcome.requestFeature': '여기서 요청해주세요!',
      'welcome.starOnGithub': 'GitHub에서 <span class="star-logo-name">Baekjoon</span><span class="text-brand">Hub</span>에 Star⭐ 한 번 부탁드려요',

      // welcome: 단계
      'welcome.step.auth': 'GitHub 연결',
      'welcome.step.repo': '저장소 선택',
      'welcome.step.done': '완료',

      // welcome: 1단계 (GitHub 계정)
      'welcome.auth.title': 'GitHub 계정을 연결해주세요',
      'welcome.auth.desc': '문제를 맞히면 풀이를 내 GitHub 저장소에 자동으로 올려드려요.',
      'welcome.auth.scopeNote': 'GitHub는 모든 저장소에 대한 권한을 요청하지만, BaekjoonHub는 다음 단계에서 고른 저장소 하나에만 파일을 올립니다.',
      'welcome.auth.button': 'GitHub로 계속하기',
      'welcome.auth.error.denied': 'GitHub 권한 요청을 취소하셨어요. 연결하려면 다시 시도해주세요.',
      'welcome.auth.error.failed': 'GitHub 연결에 실패했어요. 잠시 후 다시 시도해주세요.',
      'welcome.auth.error.expired': 'GitHub 연결이 만료됐어요. 다시 연결해주세요.',

      // welcome: 2단계 (저장소)
      'welcome.repo.title': '풀이를 올릴 저장소를 골라주세요',
      'welcome.repo.signedInAs': '<strong>@${username}</strong> 계정으로 연결됐어요',
      'welcome.repo.modeNew': '새 저장소 만들기',
      'welcome.repo.modeExisting': '기존 저장소 연결',
      'welcome.repo.nameLabel': '저장소 이름',
      'welcome.repo.namePlaceholder': '예: algorithm',
      'welcome.repo.visibilityLabel': '공개 범위',
      'welcome.repo.private': '비공개 (나만 볼 수 있어요)',
      'welcome.repo.public': '공개 (누구나 볼 수 있어요)',
      'welcome.repo.listLabel': '내 저장소',
      'welcome.repo.listLoading': '불러오는 중…',
      'welcome.repo.listPlaceholder': '저장소를 선택하세요',
      'welcome.repo.listManual': '목록에 없나요? 직접 입력…',
      'welcome.repo.listFailed': '저장소 목록을 불러오지 못했어요. 아래에 직접 입력해주세요.',
      'welcome.repo.manualLabel': '저장소 (소유자/이름 또는 GitHub 주소)',
      'welcome.repo.submitNew': '만들고 연결하기',
      'welcome.repo.submitExisting': '연결하기',
      'welcome.repo.submitting': '연결하는 중…',
      'welcome.repo.cancel': '취소',

      // welcome.js dynamic messages
      'welcome.error.creating304': '${name} 저장소를 수정할 수 없어요. 잠시 후 다시 시도해주세요!',
      'welcome.error.creating400': '${name} 생성 중 문제가 생겼어요. 기존 스크립트와 충돌이 없는지 확인해주세요.',
      'welcome.error.creating403': '${name} 저장소에 접근이 거부됐어요. 잠시 후 다시 시도해주세요!',
      'welcome.error.creating422': '${name} 저장소가 이미 있는 것 같아요. "기존 저장소 연결"을 선택해보세요.',
      'welcome.success.created': '<a target="blank" href="${url}">${name}</a> 저장소가 만들어졌어요!<br/><a href="https://acmicpc.net/">백준</a> · <a href="https://school.programmers.co.kr/">프로그래머스</a> · <a href="https://swexpertacademy.com/">SWEA</a> · <a href="https://jungol.co.kr/">정올</a> · <a href="https://doj.kr/">DOJ</a>에서 문제를 풀어보세요!',
      'welcome.error.linking301': '<a target="blank" href="https://github.com/${name}">${name}</a> 연결에 실패했어요. <br> 저장소가 다른 곳으로 이동된 것 같아요. 새로 만들어보세요.',
      'welcome.error.linking403': '<a target="blank" href="https://github.com/${name}">${name}</a> 연결에 실패했어요. <br> 이 저장소에 대한 접근 권한이 있는지 확인해주세요.',
      'welcome.error.linking404': '<a target="blank" href="https://github.com/${name}">${name}</a> 연결에 실패했어요. <br> 저장소를 찾을 수 없어요. 이름을 다시 확인해주세요.',
      'welcome.success.linked': '<a target="blank" href="${url}">${name}</a> 저장소가 연결됐어요!<br/><a href="https://acmicpc.net/">백준</a> · <a href="https://school.programmers.co.kr/">프로그래머스</a> · <a href="https://swexpertacademy.com/">SWEA</a> · <a href="https://jungol.co.kr/">정올</a> · <a href="https://doj.kr/">DOJ</a>에서 문제를 풀어보세요!',
      'welcome.error.noRepoName': '저장소 이름을 입력해주세요.',
      'welcome.error.noRepoSelected': '저장소를 먼저 선택해주세요.',
      'welcome.error.invalidRepo': '저장소 형식이 올바르지 않아요. 소유자/이름 또는 GitHub 주소로 입력해주세요.',
      'welcome.error.noPush': '<a target="blank" href="https://github.com/${name}">${name}</a> 저장소에 쓰기 권한이 없어요. 푸시할 수 있는 저장소를 골라주세요.',
      'welcome.error.archived': '<a target="blank" href="https://github.com/${name}">${name}</a> 저장소는 보관(archive)되어 있어 올릴 수 없어요. 다른 저장소를 골라주세요.',
      'welcome.error.unknown': '문제가 생겼어요 (GitHub 응답 ${status}). 잠시 후 다시 시도해주세요.',
      'welcome.error.network': 'GitHub에 연결하지 못했어요. 네트워크 상태를 확인하고 다시 시도해주세요.',

      // welcome: 3단계 (연결 정보)
      'welcome.conn.title': '연결 정보',
      'welcome.conn.account': 'GitHub 계정',
      'welcome.conn.repo': '저장소',
      'welcome.conn.logout': '로그아웃',
      'welcome.conn.changeRepo': '저장소 변경',
      'welcome.conn.logoutConfirm': 'GitHub 연결을 해제할까요? 다시 연결할 때까지 자동 업로드가 멈춥니다.',
      'welcome.conn.status.checking': '연결 상태 확인 중…',
      'welcome.conn.status.ok': '정상 연결됨. 맞힌 풀이가 자동으로 올라갑니다.',
      'welcome.conn.status.repoGone': '이 저장소에 접근할 수 없어요. 삭제되었거나 이름이 바뀌었거나 권한이 없어진 것 같아요. 저장소를 다시 선택해주세요.',
      'welcome.conn.status.archived': '이 저장소는 보관(archive)되어 있어 올릴 수 없어요. 저장소를 다시 선택해주세요.',
      'welcome.conn.status.unknown': '연결 상태를 확인하지 못했어요. 네트워크 상태를 확인해주세요.',

      // welcome: 3단계 (업로드 설정)
      'welcome.settings.title': '업로드 설정',
      'welcome.settings.saved': '저장됨',
      'welcome.settings.organize': '폴더 정리 방식',
      'welcome.organizeByPlatform': '플랫폼별로 정리',
      'welcome.organizeByLanguage': '언어별로 정리',
      'welcome.settings.organizeHint': '언어별로 정리하면 Python/백준/Gold/1000. A+B 처럼 언어 폴더가 맨 앞에 붙어요. 아래에서 경로 템플릿을 직접 지정한 플랫폼에는 적용되지 않습니다.',
      'welcome.saveExamples': '예제 입출력 저장',
      'welcome.keepVersions': '다시 푼 문제의 서로 다른 풀이를 번호 붙은 파일로 모두 보관 (_002, _003 ...)',
      'welcome.dirTemplate.title': '저장 경로 템플릿',
      'welcome.dirTemplate.hint': '비워두면 기본 경로를 씁니다. 쓸 수 있는 변수:',
      'welcome.dirTemplate.reset': '초기화',
      'welcome.platform.baekjoon': '백준',
      'welcome.platform.programmers': '프로그래머스',
      'welcome.platform.swea': 'SWEA',
      'welcome.platform.jungol': '정올',
      'welcome.platform.doj': 'DOJ',

      // popup.html
      'popup.caption': '백준 코드를 GitHub에 동기화',
      'popup.status.needAuth': 'GitHub 계정 연결이 필요해요.',
      'popup.status.needRepo': '풀이를 올릴 저장소를 선택해주세요.',
      'popup.action.start': '시작하기',
      'popup.action.pickRepo': '저장소 선택',
      'popup.toggle.label': '자동 업로드',
      'popup.toggle.on': '켜짐',
      'popup.toggle.off': '꺼짐',
      'popup.settings': '설정',
      'popup.wantMore': '더 많은 기능을 원하시나요?',
      'popup.requestFeature': '기능을 요청하세요!',

      // popup.js dynamic messages
      'popup.yourRepo': '연결된 저장소:',
    },
  };

  let currentLang = 'en';
  const onChangeCallbacks = [];

  function detectLang() {
    const lang = navigator.language || navigator.userLanguage || 'en';
    return lang.startsWith('ko') ? 'ko' : 'en';
  }

  function init(callback) {
    chrome.storage.local.get('bjh_lang', (data) => {
      if (data.bjh_lang) {
        currentLang = data.bjh_lang;
      } else {
        currentLang = detectLang();
      }
      applyTranslations();
      const toggleBtn = document.getElementById('lang_toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleLanguage);
      }
      if (callback) callback();
    });
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = translations[currentLang][key];
      if (val !== undefined) el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      const val = translations[currentLang][key];
      if (val !== undefined) el.innerHTML = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const val = translations[currentLang][key];
      if (val !== undefined) el.placeholder = val;
    });
    // Update dynamically bound elements
    document.querySelectorAll('[data-i18n-bound-key]').forEach((el) => {
      const key = el.getAttribute('data-i18n-bound-key');
      const params = JSON.parse(el.getAttribute('data-i18n-bound-params') || '{}');
      const mode = el.getAttribute('data-i18n-bound-mode') || 'html';
      if (mode === 'text') {
        el.textContent = t(key, params);
      } else {
        el.innerHTML = t(key, params);
      }
    });
    // Update language toggle button text
    const toggleBtn = document.getElementById('lang_toggle');
    if (toggleBtn) {
      toggleBtn.textContent = currentLang === 'ko' ? 'EN' : '한국어';
    }
  }

  function t(key, params) {
    let val = translations[currentLang][key] || translations['en'][key] || key;
    if (params) {
      Object.keys(params).forEach((k) => {
        val = val.replace(new RegExp('\\$\\{' + k + '\\}', 'g'), params[k]);
      });
    }
    return val;
  }

  // 동적 텍스트를 요소에 바인딩 — 언어 전환 시 자동 갱신
  // mode: 'text' | 'html' (default 'html')
  function bind(el, key, params, mode) {
    const m = mode || 'html';
    el.setAttribute('data-i18n-bound-key', key);
    el.setAttribute('data-i18n-bound-params', JSON.stringify(params || {}));
    el.setAttribute('data-i18n-bound-mode', m);
    if (m === 'text') {
      el.textContent = t(key, params);
    } else {
      el.innerHTML = t(key, params);
    }
  }

  function onChange(callback) {
    onChangeCallbacks.push(callback);
  }

  function setLanguage(lang) {
    currentLang = lang;
    chrome.storage.local.set({ bjh_lang: lang });
    applyTranslations();
    onChangeCallbacks.forEach((cb) => cb(lang));
  }

  function getCurrentLang() {
    return currentLang;
  }

  function toggleLanguage() {
    setLanguage(currentLang === 'ko' ? 'en' : 'ko');
  }

  return { init, t, bind, setLanguage, getCurrentLang, toggleLanguage, applyTranslations, onChange };
})();
