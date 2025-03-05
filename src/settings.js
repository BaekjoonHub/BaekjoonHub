// Define stats at module scope
let stats = {};

// DOM utility functions to replace jQuery
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Replace jQuery functions with native DOM equivalents
const getVal = (selector) => $(selector)?.value || '';
const hideElement = (selector) => { $(selector).style.display = 'none'; };
const showElement = (selector) => { $(selector).style.display = 'block'; };
const setText = (selector, text) => { $(selector).textContent = text; };
const setHTML = (selector, html) => { $(selector).innerHTML = html; };
const focus = (selector) => { $(selector).focus(); };
const setDisabled = (selector, disabled) => { $(selector).disabled = disabled; };

const option = () => {
  return getVal("#type");
};

const repositoryName = () => {
  return getVal("#name").trim();
};

/* Status codes for creating of repo */
const statusCode = (res, status, name) => {
  switch (status) {
    case 304:
      hideElement("#success");
      setText("#error", `Error creating ${name} - Unable to modify repository. Try again later!`);
      showElement("#error");
      break;

    case 400:
      hideElement("#success");
      setText("#error", `Error creating ${name} - Bad POST request, make sure you're not overriding any existing scripts`);
      showElement("#error");
      break;

    case 401:
      hideElement("#success");
      setText("#error", `Error creating ${name} - Unauthorized access to repo. Try again later!`);
      showElement("#error");
      break;

    case 403:
      hideElement("#success");
      setText("#error", `Error creating ${name} - Forbidden access to repository. Try again later!`);
      showElement("#error");
      break;

    case 422:
      hideElement("#success");
      setText("#error", `Error creating ${name} - Unprocessable Entity. Repository may have already been created. Try Linking instead (select 2nd option).`);
      showElement("#error");
      break;

    default:
      /* Change mode type to commit */
      chrome.storage.local.set({ mode_type: "commit" }, () => {
        hideElement("#error");
        setHTML("#success", `Successfully created <a target="blank" href="${res.html_url}">${name}</a>. Start <a href="https://www.acmicpc.net/">BOJ</a>!`);
        showElement("#success");
        showElement("#unlink");
        /* Show new layout */
        $("#hook_mode").style.display = "none";
        $("#commit_mode").style.display = "inherit";
      });
      /* Set Repo Hook */
      chrome.storage.local.set({ BaekjoonHub_hook: res.full_name }, () => {
        console.log("Successfully set new repo hook");
      });

      break;
  }
};

const createRepo = (token, name) => {
  const AUTHENTICATION_URL = "https://api.github.com/user/repos";
  let data = {
    name,
    private: true,
    auto_init: true,
    description: "This is an auto push repository for Baekjoon Online Judge created with [BaekjoonHub](https://github.com/BaekjoonHub/BaekjoonHub).",
  };
  data = JSON.stringify(data);

  const xhr = new XMLHttpRequest();
  xhr.addEventListener("readystatechange", function () {
    if (xhr.readyState === 4) {
      statusCode(JSON.parse(xhr.responseText), xhr.status, name);
    }
  });

  stats = {};
  stats.version = chrome.runtime.getManifest().version;
  stats.submission = {};
  chrome.storage.local.set({ stats });

  xhr.open("POST", AUTHENTICATION_URL, true);
  xhr.setRequestHeader("Authorization", `token ${token}`);
  xhr.setRequestHeader("Accept", "application/vnd.github.v3+json");
  xhr.send(data);
};

/* Status codes for linking of repo */
const linkStatusCode = (status, name) => {
  let bool = false;
  switch (status) {
    case 301:
      hideElement("#success");
      setHTML("#error", `Error linking <a target="blank" href="${`https://github.com/${name}`}">${name}</a> to BaekjoonHub. <br> This repository has been moved permenantly. Try creating a new one.`);
      showElement("#error");
      break;

    case 403:
      hideElement("#success");
      setHTML("#error", `Error linking <a target="blank" href="${`https://github.com/${name}`}">${name}</a> to BaekjoonHub. <br> Forbidden action. Please make sure you have the right access to this repository.`);
      showElement("#error");
      break;

    case 404:
      hideElement("#success");
      setHTML("#error", `Error linking <a target="blank" href="${`https://github.com/${name}`}">${name}</a> to BaekjoonHub. <br> Resource not found. Make sure you enter the right repository name.`);
      showElement("#error");
      break;

    default:
      bool = true;
      break;
  }
  showElement("#unlink");
  return bool;
};

/* 
    Method for linking hook with an existing repository 
    Steps:
    1. Check if existing repository exists and the user has write access to it.
    2. Link Hook to it (chrome Storage).
*/
const linkRepo = (token, name) => {
  const AUTHENTICATION_URL = `https://api.github.com/repos/${name}`;

  const xhr = new XMLHttpRequest();
  xhr.addEventListener("readystatechange", function () {
    if (xhr.readyState === 4) {
      const res = JSON.parse(xhr.responseText);
      const bool = linkStatusCode(xhr.status, name);
      if (xhr.status === 200) {
        // BUG FIX
        if (!bool) {
          // unable to gain access to repo in commit mode. Must switch to hook mode.
          /* Set mode type to hook */
          chrome.storage.local.set({ mode_type: "hook" }, () => {
            console.log(`Error linking ${name} to BaekjoonHub`);
          });
          /* Set Repo Hook to NONE */
          chrome.storage.local.set({ BaekjoonHub_hook: null }, () => {
            console.log("Defaulted repo hook to NONE");
          });

          /* Hide accordingly */
          $("#hook_mode").style.display = "inherit";
          $("#commit_mode").style.display = "none";
        } else {
          /* Change mode type to commit */
          /* Save repo url to chrome storage */
          chrome.storage.local.set({ mode_type: "commit", repo: res.html_url }, () => {
            hideElement("#error");
            setHTML("#success", `Successfully linked <a target="blank" href="${res.html_url}">${name}</a> to BaekjoonHub. Start <a href="https://www.acmicpc.net/">BOJ</a> now!`);
            showElement("#success");
            showElement("#unlink");
          });
          /* Set Repo Hook */

          stats = {};
          stats.version = chrome.runtime.getManifest().version;
          stats.submission = {};
          chrome.storage.local.set({ stats });

          chrome.storage.local.set({ BaekjoonHub_hook: res.full_name }, () => {
            console.log("Successfully set new repo hook");
            /* Get problems solved count */
            chrome.storage.local.get("stats", (psolved) => {
              const { stats } = psolved;
            });
          });
          /* Hide accordingly */
          $("#hook_mode").style.display = "none";
          $("#commit_mode").style.display = "inherit";
        }
      }
    }
  });

  xhr.open("GET", AUTHENTICATION_URL, true);
  xhr.setRequestHeader("Authorization", `token ${token}`);
  xhr.setRequestHeader("Accept", "application/vnd.github.v3+json");
  xhr.send();
};

const unlinkRepo = () => {
  /* Set mode type to hook */
  chrome.storage.local.set({ mode_type: "hook" }, () => {
    console.log(`Unlinking repo`);
  });
  /* Set Repo Hook to NONE */
  chrome.storage.local.set({ BaekjoonHub_hook: null }, () => {
    console.log("Defaulted repo hook to NONE");
  });

  /*프로그래밍 언어별 폴더 정리 옵션 세션 저장 초기화*/
  chrome.storage.local.set({ BaekjoonHub_disOption: "platform" }, () => {
    console.log("DisOption Reset");
  });

  /* Hide accordingly */
  $("#hook_mode").style.display = "inherit";
  $("#commit_mode").style.display = "none";
};

// Add event listeners after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Type change handler
  $("#type").addEventListener("change", function() {
    const valueSelected = this.value;
    setDisabled("#hook_button", !valueSelected);
  });

  // Hook button click handler
  $("#hook_button").addEventListener("click", () => {
    /* on click should generate: 1) option 2) repository name */
    if (!option()) {
      setText("#error", "No option selected - Pick an option from dropdown menu below that best suits you!");
      showElement("#error");
    } else if (!repositoryName()) {
      setText("#error", "No repository name added - Enter the name of your repository!");
      focus("#name");
      showElement("#error");
    } else {
      hideElement("#error");
      setText("#success", "Attempting to create Hook... Please wait.");
      showElement("#success");

      /* 
        Perform processing
        - step 1: Check if current stage === hook.
        - step 2: store repo name as repoName in chrome storage.
        - step 3: if (1), POST request to repoName (iff option = create new repo) ; else display error message.
        - step 4: if proceed from 3, hide hook_mode and display commit_mode (show stats e.g: files pushed/questions-solved/leaderboard)
      */
      chrome.storage.local.get("BaekjoonHub_token", (data) => {
        const token = data.BaekjoonHub_token;
        if (token === null || token === undefined) {
          /* Not authorized yet. */
          setText("#error", "Authorization error - Grant BaekjoonHub access to your GitHub account to continue (launch extension to proceed)");
          showElement("#error");
          hideElement("#success");
        } else if (option() === "new") {
          createRepo(token, repositoryName());
        } else {
          chrome.storage.local.get("BaekjoonHub_username", (data2) => {
            const username = data2.BaekjoonHub_username;
            if (!username) {
              /* Improper authorization. */
              setText("#error", "Improper Authorization error - Grant BaekjoonHub access to your GitHub account to continue (launch extension to proceed)");
              showElement("#error");
              hideElement("#success");
            } else {
              linkRepo(token, `${username}/${repositoryName()}`);
            }
          });
        }
      });
    }

    /*프로그래밍 언어별 폴더 정리 옵션 세션 저장*/
    let org_option = getVal("#org_option");
    chrome.storage.local.set({ BaekjoonHub_OrgOption: org_option }, () => {
      console.log(`Set Organize by ${org_option}`);
    });
  });

  // Unlink click handler
  $("#unlink a").addEventListener("click", () => {
    unlinkRepo();
    hideElement("#unlink");
    setText("#success", "Successfully unlinked your current git repo. Please create/link a new hook.");
  });

  // Tab switching logic
  // $$('.tab-button').forEach(button => {
  //   button.addEventListener('click', function() {
  //     // Remove active class from all buttons and content
  //     $$('.tab-button').forEach(btn => btn.classList.remove('active'));
  //     $$('.tab-content').forEach(content => content.classList.remove('active'));
      
  //     // Add active class to clicked button and corresponding content
  //     this.classList.add('active');
  //     $(`#${this.dataset.tab}`).classList.add('active');
  //   });
  // });

  // Advanced tab unlink button
  $("#unlink_button")?.addEventListener("click", () => {
    unlinkRepo();
    hideElement("#unlink");
    setText("#success", "Successfully unlinked your current git repo. Please create/link a new hook.");
    showElement("#success");
  });

  /* Detect mode type */
  chrome.storage.local.get("mode_type", (data) => {
    const mode = data.mode_type;

    if (mode && mode === "commit") {
      /* Check if still access to repo */
      chrome.storage.local.get("BaekjoonHub_token", (data2) => {
        const token = data2.BaekjoonHub_token;
        if (token === null || token === undefined) {
          /* Not authorized yet. */
          setText("#error", "Authorization error - Grant BaekjoonHub access to your GitHub account to continue (click BaekjoonHub extension on the top right to proceed)");
          showElement("#error");
          hideElement("#success");
          /* Hide accordingly */
          $("#hook_mode").style.display = "inherit";
          $("#commit_mode").style.display = "none";
        } else {
          /* Get access to repo */
          chrome.storage.local.get("BaekjoonHub_hook", (repoName) => {
            const hook = repoName.BaekjoonHub_hook;
            if (!hook) {
              /* Not authorized yet. */
              setText("#error", "Improper Authorization error - Grant BaekjoonHub access to your GitHub account to continue (click BaekjoonHub extension on the top right to proceed)");
              showElement("#error");
              hideElement("#success");
              /* Hide accordingly */
              $("#hook_mode").style.display = "inherit";
              $("#commit_mode").style.display = "none";
            } else {
              /* Username exists, at least in storage. Confirm this */
              linkRepo(token, hook);
              
              // Display repository information in the commit mode
              setText("#current_repo", hook);
              
              // Display organization method
              chrome.storage.local.get("BaekjoonHub_OrgOption", (data3) => {
                const orgOption = data3.BaekjoonHub_OrgOption || "platform";
                setText("#current_org", orgOption === "platform" ? "By Platform" : "By Language");
              });
            }
          });
        }
      });

      $("#hook_mode").style.display = "none";
      $("#commit_mode").style.display = "inherit";
    } else {
      $("#hook_mode").style.display = "inherit";
      $("#commit_mode").style.display = "none";
    }
  });
});