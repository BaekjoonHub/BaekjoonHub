/**
 * solvedac 문제 데이터를 파싱해오는 함수.
 * @param {int} problemId
 */
async function SolvedApiCall(problemId) {
    return fetch(`https://solved.ac/api/v3/problem/show?problemId=${problemId}`, { method: 'GET' })
        .then((query) => query.json());
}

function handleMessage(request, sender, sendResponse) {
    if (request && request.closeWebPage === true && request.isSuccess === true) {
        /* Set username */
        browserAPI.storage.local.set(
            { BaekjoonHub_username: request.username },
        );

        /* Set token */
        browserAPI.storage.local.set(
            { BaekjoonHub_token: request.token },
        );

        /* Close pipe */
        browserAPI.storage.local.set({ pipe_BaekjoonHub: false }, () => {
            console.log('Closed pipe.');
        });

        // deprecated API - 주석 처리됨
        // browserAPI.tabs.getSelected(null, function (tab) {
        //   browserAPI.tabs.remove(tab.id);
        // });

        /* Go to onboarding for UX */
        // 크로스 브라우저 호환 URL 생성
        const extensionId = browserAPI.runtime.id;
        const urlOnboarding = typeof browser !== 'undefined' && browser.runtime ?
            browser.runtime.getURL('welcome.html') :
            `chrome-extension://${extensionId}/welcome.html`;

        browserAPI.tabs.create({ url: urlOnboarding, active: true }); // 'selected' 대신 'active' 사용 (최신 API)
    } else if (request && request.closeWebPage === true && request.isSuccess === false) {
        alert('Something went wrong while trying to authenticate your profile!');
        browserAPI.tabs.getSelected(null, function (tab) {
            browserAPI.tabs.remove(tab.id);
        });
    } else if (request && request.sender == "baekjoon" && request.task == "SolvedApiCall") {
        SolvedApiCall(request.problemId).then((res) => sendResponse(res));
        return true; // Firefox에서 비동기 응답을 위해 true 반환
    }
    return true;
}

browserAPI.runtime.onMessage.addListener(handleMessage);
