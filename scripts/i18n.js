const I18N = (() => {
  const translations = {
    en: {
      // welcome.html
      'welcome.subtitle': 'Automatically sync your code from Baekjoon to GitHub',
      'welcome.getStarted.title': 'To get started with BaekjoonHub',
      'welcome.pickOption': 'Pick an Option',
      'welcome.createRepo': 'Create a new Private Repository',
      'welcome.linkRepo': 'Link an Existing Repository',
      'welcome.organizeByPlatform': 'Organize by Platform',
      'welcome.organizeByLanguage': 'Organize by Language',
      'welcome.repoNamePlaceholder': 'Repository Name',
      'welcome.getStartedBtn': 'Get Started',
      'welcome.wantMore': 'Want more features?',
      'welcome.requestFeature': 'Request a feature!',
      'welcome.starOnGithub': 'Star <span class="star-logo-name">Baekjoon</span><span class="text-brand">Hub</span> on GitHub',
      'welcome.unlinkText': 'Linked the wrong repo?',
      'welcome.unlinkAction': 'Unlink',

      // welcome.js dynamic messages
      'welcome.error.creating304': 'Error creating ${name} - Unable to modify repository. Try again later!',
      'welcome.error.creating400': 'Error creating ${name} - Bad POST request, make sure you\'re not overriding any existing scripts',
      'welcome.error.creating401': 'Error creating ${name} - Unauthorized access to repo. Try again later!',
      'welcome.error.creating403': 'Error creating ${name} - Forbidden access to repository. Try again later!',
      'welcome.error.creating422': 'Error creating ${name} - Unprocessable Entity. Repository may have already been created. Try Linking instead (select 2nd option).',
      'welcome.success.created': 'Successfully created <a target="blank" href="${url}">${name}</a>.<br/>Start solving on <a href="https://www.acmicpc.net/">BOJ</a> · <a href="https://school.programmers.co.kr/">Programmers</a> · <a href="https://swexpertacademy.com/">SWEA</a> · <a href="https://level.goorm.io/">Goorm</a>!',
      'welcome.error.linking301': 'Error linking <a target="blank" href="https://github.com/${name}">${name}</a> to BaekjoonHub. <br> This repository has been moved permanently. Try creating a new one.',
      'welcome.error.linking403': 'Error linking <a target="blank" href="https://github.com/${name}">${name}</a> to BaekjoonHub. <br> Forbidden action. Please make sure you have the right access to this repository.',
      'welcome.error.linking404': 'Error linking <a target="blank" href="https://github.com/${name}">${name}</a> to BaekjoonHub. <br> Resource not found. Make sure you enter the right repository name.',
      'welcome.success.linked': 'Successfully linked <a target="blank" href="${url}">${name}</a> to BaekjoonHub.<br/>Start solving on <a href="https://www.acmicpc.net/">BOJ</a> · <a href="https://school.programmers.co.kr/">Programmers</a> · <a href="https://swexpertacademy.com/">SWEA</a> · <a href="https://level.goorm.io/">Goorm</a>!',
      'welcome.error.noOption': 'No option selected - Pick an option from dropdown menu below that best suits you!',
      'welcome.error.noRepoName': 'No repository name added - Enter the name of your repository!',
      'welcome.attempting': 'Attempting to create Hook... Please wait.',
      'welcome.error.auth': 'Authorization error - Grant BaekjoonHub access to your GitHub account to continue (launch extension to proceed)',
      'welcome.error.improperAuth': 'Improper Authorization error - Grant BaekjoonHub access to your GitHub account to continue (launch extension to proceed)',
      'welcome.error.authTopRight': 'Authorization error - Grant BaekjoonHub access to your GitHub account to continue (click BaekjoonHub extension on the top right to proceed)',
      'welcome.error.improperAuthTopRight': 'Improper Authorization error - Grant BaekjoonHub access to your GitHub account to continue (click BaekjoonHub extension on the top right to proceed)',
      'welcome.success.unlinked': 'Successfully unlinked your current git repo. Please create/link a new hook.',
      'welcome.refreshToken': 'Refresh GitHub Token',
      'welcome.tokenStatus.valid': 'Token is valid!',
      'welcome.tokenStatus.expired': 'Token has expired or is invalid. Please re-authenticate by clicking the BaekjoonHub extension icon in the top right.',
      'welcome.tokenStatus.notFound': 'No token found. Please authenticate first.',
      'welcome.tokenStatus.error': 'Failed to verify token. Please check your network connection.',

      // popup.html
      'popup.caption': 'Sync your code from BOJ to GitHub',
      'popup.auth.text': 'Authenticate with GitHub to use <strong>Baekjoon<span style="color: #f18500">Hub</span></strong>',
      'popup.auth.button': 'Authenticate',
      'popup.hook.text': 'Set up repository hook to use <strong>Baekjoon<span style="color: #0078c3">Hub</span></strong>',
      'popup.hook.button': 'Set up Hook',
      'popup.wantMore': 'Want more features?',
      'popup.requestFeature': 'Request a feature!',

      // popup.js dynamic messages
      'popup.yourRepo': 'Your Repo:',

      // welcome
      'welcome.saveExamples': 'Save example I/O',
      'welcome.dirTemplate.title': 'Directory Path Template',
      'welcome.dirTemplate.reset': 'Reset',
      'welcome.dirTemplate.save': 'Save',
    },
    ko: {
      // welcome.html
      'welcome.subtitle': '백준에서 푼 코드, GitHub에 자동으로 올려보세요',
      'welcome.getStarted.title': 'BaekjoonHub 설정',
      'welcome.pickOption': '아래에서 선택하세요',
      'welcome.createRepo': '새 저장소 만들기 (비공개)',
      'welcome.linkRepo': '내 저장소 연결하기',
      'welcome.organizeByPlatform': '플랫폼별로 정리',
      'welcome.organizeByLanguage': '언어별로 정리',
      'welcome.repoNamePlaceholder': '저장소 이름',
      'welcome.getStartedBtn': '시작하기',
      'welcome.wantMore': '더 필요한 기능이 있나요?',
      'welcome.requestFeature': '여기서 요청해주세요!',
      'welcome.starOnGithub': 'GitHub에서 <span class="star-logo-name">Baekjoon</span><span class="text-brand">Hub</span>에 Star\u2B50 한 번 부탁드려요',
      'welcome.unlinkText': '다른 저장소로 바꾸고 싶으신가요?',
      'welcome.unlinkAction': '연결 해제',

      // welcome.js dynamic messages
      'welcome.error.creating304': '${name} 저장소를 수정할 수 없어요. 잠시 후 다시 시도해주세요!',
      'welcome.error.creating400': '${name} 생성 중 문제가 생겼어요. 기존 스크립트와 충돌이 없는지 확인해주세요.',
      'welcome.error.creating401': '${name} 저장소에 접근할 권한이 없어요. 잠시 후 다시 시도해주세요!',
      'welcome.error.creating403': '${name} 저장소에 접근이 거부됐어요. 잠시 후 다시 시도해주세요!',
      'welcome.error.creating422': '${name} 저장소가 이미 있는 것 같아요. "내 저장소 연결하기"를 선택해보세요.',
      'welcome.success.created': '<a target="blank" href="${url}">${name}</a> 저장소가 만들어졌어요!<br/><a href="https://www.acmicpc.net/">백준</a> · <a href="https://school.programmers.co.kr/">프로그래머스</a> · <a href="https://swexpertacademy.com/">SWEA</a> · <a href="https://level.goorm.io/">구름</a>에서 문제를 풀어보세요!',
      'welcome.error.linking301': '<a target="blank" href="https://github.com/${name}">${name}</a> 연결에 실패했어요. <br> 저장소가 다른 곳으로 이동된 것 같아요. 새로 만들어보세요.',
      'welcome.error.linking403': '<a target="blank" href="https://github.com/${name}">${name}</a> 연결에 실패했어요. <br> 이 저장소에 대한 접근 권한이 있는지 확인해주세요.',
      'welcome.error.linking404': '<a target="blank" href="https://github.com/${name}">${name}</a> 연결에 실패했어요. <br> 저장소를 찾을 수 없어요. 이름을 다시 확인해주세요.',
      'welcome.success.linked': '<a target="blank" href="${url}">${name}</a> 저장소가 연결됐어요!<br/><a href="https://www.acmicpc.net/">백준</a> · <a href="https://school.programmers.co.kr/">프로그래머스</a> · <a href="https://swexpertacademy.com/">SWEA</a> · <a href="https://level.goorm.io/">구름</a>에서 문제를 풀어보세요!',
      'welcome.error.noOption': '위에서 옵션을 하나 선택해주세요!',
      'welcome.error.noRepoName': '저장소 이름을 입력해주세요!',
      'welcome.attempting': '저장소 연결 중... 잠시만 기다려주세요.',
      'welcome.error.auth': 'GitHub 인증이 필요해요. 확장 프로그램을 열어 인증을 진행해주세요.',
      'welcome.error.improperAuth': 'GitHub 인증이 제대로 되지 않았어요. 확장 프로그램을 열어 다시 인증해주세요.',
      'welcome.error.authTopRight': 'GitHub 인증이 필요해요. 오른쪽 위의 BaekjoonHub 아이콘을 클릭해주세요.',
      'welcome.error.improperAuthTopRight': 'GitHub 인증이 제대로 되지 않았어요. 오른쪽 위의 BaekjoonHub 아이콘을 클릭해주세요.',
      'welcome.success.unlinked': '저장소 연결을 해제했어요. 새 저장소를 만들거나 다른 저장소를 연결해주세요.',
      'welcome.refreshToken': 'GitHub 토큰 새로고침',
      'welcome.tokenStatus.valid': '토큰이 유효합니다!',
      'welcome.tokenStatus.expired': '토큰이 만료되었거나 유효하지 않습니다. 오른쪽 위의 BaekjoonHub 아이콘을 클릭하여 재인증해주세요.',
      'welcome.tokenStatus.notFound': '토큰을 찾을 수 없습니다. 먼저 인증을 진행해주세요.',
      'welcome.tokenStatus.error': '토큰 검증에 실패했습니다. 네트워크 연결을 확인해주세요.',

      // popup.html
      'popup.caption': '백준 코드를 GitHub에 동기화',
      'popup.auth.text': '<strong>Baekjoon<span style="color: #f18500">Hub</span></strong> 사용을 위해 GitHub 인증이 필요합니다',
      'popup.auth.button': '인증하기',
      'popup.hook.text': '<strong>Baekjoon<span style="color: #0078c3">Hub</span></strong> 사용을 위해 저장소를 설정하세요',
      'popup.hook.button': '저장소 설정',
      'popup.wantMore': '더 많은 기능을 원하시나요?',
      'popup.requestFeature': '기능을 요청하세요!',

      // popup.js dynamic messages
      'popup.yourRepo': '연결된 저장소:',

      // welcome
      'welcome.saveExamples': '예제 입출력 저장',
      'welcome.dirTemplate.title': '저장 경로 템플릿',
      'welcome.dirTemplate.reset': '초기화',
      'welcome.dirTemplate.save': '저장',
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
