import { getObjectFromLocalStorage, saveObjectInLocalStorage } from "@/commons/storage.js";
import { STORAGE_KEYS } from "@/constants/registry.js";
import { parseTemplateString } from "safe-template-parser";
import textTransforms from "@/commons/text-transforms.js";

import beginOAuth2 from "@/commons/oauth2.js";
import { getTextTransforms } from "./scripts/commons/text-transforms";

// Step navigation
const steps = ["step_repo_option", "step_repo_name", "step_org_method"];
let currentStep = 0;

const showStep = (stepId) => {
  document.querySelectorAll(".step").forEach((step) => {
    const element = step;
    if (element) element.style.display = "none";
  });
  const element = document.querySelector(`#${stepId}`);
  if (element) {
    element.style.display = "block";
    element.removeAttribute("hidden");
  }
};

const navigateToStep = (stepIndex) => {
  console.log(`navigateToStep: Navigating to step index ${stepIndex}`);
  if (stepIndex >= 0 && stepIndex < steps.length) {
    currentStep = stepIndex;
    showStep(steps[currentStep]);
  }
};

/**
 * Detects the mode (hook or commit) and sets the UI accordingly.
 */
const getElement = (id) => document.querySelector(`#${id}`);

const detectAndSetMode = async () => {
  console.log("detectAndSetMode: Starting mode detection.");
  const data = await getObjectFromLocalStorage([STORAGE_KEYS.MODE_TYPE, STORAGE_KEYS.HOOK, STORAGE_KEYS.TOKEN, STORAGE_KEYS.ORG_OPTION]);
  const modeType = data[STORAGE_KEYS.MODE_TYPE];
  const baekjoonHubHook = data[STORAGE_KEYS.HOOK];
  const baekjoonHubToken = data[STORAGE_KEYS.TOKEN];
  const baekjoonHubOrgOption = data[STORAGE_KEYS.ORG_OPTION];

  console.log(`detectAndSetMode: modeType=${modeType}, hook=${baekjoonHubHook}, token=${baekjoonHubToken ? "exists" : "null"}, orgOption=${baekjoonHubOrgOption}`);

  const errorElement = getElement("error");
  const successElement = getElement("success");
  const hookModeElement = getElement("hook_mode");
  const commitModeElement = getElement("commit_mode");
  const authorizeButton = getElement("authorize_button");
  const currentRepoElement = getElement("current_repo");
  const currentOrgElement = getElement("current_org");
  const customTemplateField = getElement("customTemplateField");
  const unlinkElement = getElement("unlink");

  if (modeType === "commit" && baekjoonHubHook) {
    console.log("detectAndSetMode: Mode is 'commit' and hook exists.");
    if (!baekjoonHubToken) {
      console.log("detectAndSetMode: Token is missing, showing authorization error.");
      if (errorElement) {
        errorElement.innerHTML = 'Authorization error - Grant BaekjoonHub access to your GitHub account to continue. <button id="authorize_button" class="button positive">Authorize</button>';
        errorElement.style.display = "block";
        errorElement.removeAttribute("hidden");
      }
      if (successElement) successElement.style.display = "none";
      if (hookModeElement) {
        hookModeElement.style.display = "block";
        hookModeElement.removeAttribute("hidden");
      }
      if (commitModeElement) commitModeElement.style.display = "none";
      navigateToStep(0);
      if (authorizeButton) authorizeButton.addEventListener("click", beginOAuth2);
      return;
    }

    console.log("detectAndSetMode: Token exists, showing commit mode.");
    if (hookModeElement) hookModeElement.style.display = "none";
    if (commitModeElement) {
      commitModeElement.style.display = "block";
      commitModeElement.removeAttribute("hidden");
    }
    if (currentRepoElement) currentRepoElement.textContent = baekjoonHubHook;

    // Update organization method display using the new function
    await updateOrganizationMethodDisplay();
    if (unlinkElement) {
      unlinkElement.style.display = "block";
      unlinkElement.removeAttribute("hidden");
    }
  } else {
    console.log("detectAndSetMode: Mode is not 'commit' or hook is missing, showing hook mode.");
    if (hookModeElement) {
      hookModeElement.style.display = "block";
      hookModeElement.removeAttribute("hidden");
    }
    if (commitModeElement) commitModeElement.style.display = "none";
    if (unlinkElement) unlinkElement.style.display = "none";
    navigateToStep(0);
  }
};

const getOptionType = () => document.querySelector("#type").value;
const getRepositoryName = () => document.querySelector("#name").value.trim();
const getOrgOption = () => document.querySelector("#org_option").value;

/**
 * Handles the status code from creating a repository and provides feedback to the user.
 * @param {object} res - The response from the GitHub API.
 * @param {number} status - The HTTP status code.
 * @param {string} fullName - The full name of the repository (e.g., username/repo-name).
 */
const handleCreateRepoStatusCode = async (res, status, fullName) => {
  console.log(`handleCreateRepoStatusCode: status=${status}, res=`, res);
  switch (status) {
    case 304:
      document.querySelector("#success").style.display = "none";
      document.querySelector("#error").textContent = `Error creating ${fullName} - Unable to modify repository. Try again later!`;
      document.querySelector("#error").style.display = "block";
      document.querySelector("#error").removeAttribute("hidden");
      break;
    case 400:
      document.querySelector("#success").style.display = "none";
      document.querySelector("#error").textContent = `Error creating ${fullName} - Bad POST request, make sure you're not overriding any existing scripts`;
      document.querySelector("#error").style.display = "block";
      document.querySelector("#error").removeAttribute("hidden");
      break;
    case 401:
      document.querySelector("#success").style.display = "none";
      document.querySelector("#error").textContent = `Error creating ${fullName} - Unauthorized access to repo. Try again later!`;
      document.querySelector("#error").style.display = "block";
      document.querySelector("#error").removeAttribute("hidden");
      break;
    case 403:
      document.querySelector("#success").style.display = "none";
      document.querySelector("#error").textContent = `Error creating ${fullName} - Forbidden access to repository. Try again later!`;
      document.querySelector("#error").style.display = "block";
      document.querySelector("#error").removeAttribute("hidden");
      break;
    case 422:
      document.querySelector("#success").style.display = "none";
      document.querySelector("#error").textContent = `Error creating ${fullName} - Unprocessable Entity. Repository may have already been created. Try Linking instead (select 2nd option).`;
      document.querySelector("#error").style.display = "block";
      document.querySelector("#error").removeAttribute("hidden");
      break;
    default:
      console.log("handleCreateRepoStatusCode: Repository creation successful.");
      await saveObjectInLocalStorage({ mode_type: "commit" });
      await saveObjectInLocalStorage({ [STORAGE_KEYS.HOOK]: res.full_name });
      console.log("Successfully set new repo hook");
      document.querySelector("#error").style.display = "none";
      document.querySelector("#success").innerHTML = `Successfully created <a target='_blank' href='${res.html_url}'>${fullName}</a>. Start <a href='https://www.acmicpc.net/'>BOJ</a>!`;
      document.querySelector("#success").style.display = "block";
      document.querySelector("#success").removeAttribute("hidden");
      document.querySelector("#unlink").style.display = "block";
      document.querySelector("#unlink").removeAttribute("hidden");
      document.querySelector("#hook_mode").style.display = "none";
      document.querySelector("#commit_mode").style.display = "block";
      document.querySelector("#commit_mode").removeAttribute("hidden");
      detectAndSetMode(); // Refresh the settings page
      break;
  }
};

/**
 * Creates a new GitHub repository.
 * @param {string} token - The GitHub OAuth token.
 * @param {string} fullName - The full name of the repository to create (e.g., username/repo-name).
 */
const createRepo = async (token, fullName) => {
  console.log(`createRepo: Attempting to create repo ${fullName}`);
  const name = fullName.split("/")[1];
  const AUTHENTICATION_URL = "https://api.github.com/user/repos";
  const data = {
    name,
    private: true,
    auto_init: true,
    description: "This is an auto push repository for Baekjoon Online Judge created with [BaekjoonHub](https://github.com/BaekjoonHub/BaekjoonHub).",
  };

  try {
    const response = await fetch(AUTHENTICATION_URL, {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify(data),
    });
    const res = await response.json();
    handleCreateRepoStatusCode(res, response.status, fullName);

    const stats = {};
    stats.version = chrome.runtime.getManifest().version;
    stats.submission = {};
    await saveObjectInLocalStorage({ stats });
  } catch (error) {
    console.error("createRepo: Error creating repository.", error);
    document.querySelector("#success").style.display = "none";
    document.querySelector("#error").textContent = "Error creating repository. See console for details.";
    document.querySelector("#error").style.display = "block";
    document.querySelector("#error").removeAttribute("hidden");
  }
};

/**
 * Handles the status code from linking an existing repository.
 * @param {number} status - The HTTP status code.
 * @param {string} name - The name of the repository.
 * @returns {boolean} - True if the link was successful, false otherwise.
 */
const handleLinkRepoStatusCode = (status, name) => {
  console.log(`handleLinkRepoStatusCode: status=${status}, name=${name}`);
  let success = false;
  switch (status) {
    case 301:
      document.querySelector("#success").style.display = "none";
      document.querySelector("#error").innerHTML =
        `Error linking <a target='_blank' href='https://github.com/${name}'>${name}</a> to BaekjoonHub. <br> This repository has been moved permanently. Try creating a new one.`;
      document.querySelector("#error").style.display = "block";
      document.querySelector("#error").removeAttribute("hidden");
      break;
    case 403:
      document.querySelector("#success").style.display = "none";
      document.querySelector("#error").innerHTML =
        `Error linking <a target='_blank' href='https://github.com/${name}'>${name}</a> to BaekjoonHub. <br> Forbidden action. Please make sure you have the right access to this repository.`;
      document.querySelector("#error").style.display = "block";
      document.querySelector("#error").removeAttribute("hidden");
      break;
    case 404:
      document.querySelector("#success").style.display = "none";
      document.querySelector("#error").innerHTML =
        `Error linking <a target='_blank' href='https://github.com/${name}'>${name}</a> to BaekjoonHub. <br> Resource not found. Make sure you enter the right repository name.`;
      document.querySelector("#error").style.display = "block";
      document.querySelector("#error").removeAttribute("hidden");
      break;
    default:
      success = true;
      break;
  }
  document.querySelector("#unlink").style.display = "block";
  document.querySelector("#unlink").removeAttribute("hidden");
  return success;
};

/**
 * Links an existing GitHub repository.
 * @param {string} token - The GitHub OAuth token.
 * @param {string} name - The full name of the repository to link (e.g., username/repo-name).
 */
const linkRepo = async (token, name) => {
  console.log(`linkRepo: Attempting to link repo ${name}`);
  const AUTHENTICATION_URL = `https://api.github.com/repos/${name}`;

  try {
    const response = await fetch(AUTHENTICATION_URL, {
      method: "GET",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    const res = await response.json();
    const success = handleLinkRepoStatusCode(response.status, name);
    if (response.status === 200 && success) {
      console.log("linkRepo: Repository linking successful.");
      await saveObjectInLocalStorage({
        [STORAGE_KEYS.MODE_TYPE]: "commit",
        repo: res.html_url,
      });
      document.querySelector("#error").style.display = "none";
      document.querySelector("#success").innerHTML =
        `Successfully linked <a target='_blank' href='https://github.com/${name}'>${name}</a> to BaekjoonHub. Start <a href='https://www.acmicpc.net/'>BOJ</a> now!`;
      document.querySelector("#success").style.display = "block";
      document.querySelector("#success").removeAttribute("hidden");
      document.querySelector("#unlink").style.display = "block";
      document.querySelector("#unlink").removeAttribute("hidden");
      document.querySelector("#hook_mode").style.display = "none";
      document.querySelector("#commit_mode").style.display = "block";
      document.querySelector("#commit_mode").removeAttribute("hidden");
      detectAndSetMode(); // Refresh the settings page

      const stats = {};
      stats.version = chrome.runtime.getManifest().version;
      stats.submission = {};
      await saveObjectInLocalStorage({ stats });

      await saveObjectInLocalStorage({ [STORAGE_KEYS.HOOK]: res.full_name });
      console.log("Successfully set new repo hook");
    } else {
      console.log("linkRepo: Repository linking failed or not successful.");
      document.querySelector("#hook_mode").style.display = "block";
      document.querySelector("#hook_mode").removeAttribute("hidden");
      document.querySelector("#commit_mode").style.display = "none";
    }
  } catch (error) {
    console.error("linkRepo: Error linking repository.", error);
    document.querySelector("#success").style.display = "none";
    document.querySelector("#error").textContent = "Error linking repository. See console for details.";
    document.querySelector("#error").style.display = "block";
    document.querySelector("#error").removeAttribute("hidden");
  }
};

/**
 * Unlinks the currently connected repository.
 */
const unlinkRepo = async () => {
  console.log("unlinkRepo: Unlinking repository.");
  await saveObjectInLocalStorage({
    [STORAGE_KEYS.MODE_TYPE]: "hook",
    [STORAGE_KEYS.HOOK]: null,
    [STORAGE_KEYS.ORG_OPTION]: "platform",
  });
  console.log("Unlinking repo and resetting options.");
  document.querySelector("#commit_mode").style.display = "none";
  document.querySelector("#hook_mode").style.display = "block";
  document.querySelector("#hook_mode").removeAttribute("hidden");
  navigateToStep(0); // Go back to the first step
};

/**
 * Fetches the user's repositories from GitHub.
 * @param {string} token - The GitHub OAuth token.
 * @returns {Promise<Array<object>>} - A promise that resolves to a list of repositories.
 */
const fetchUserRepositories = async (token) => {
  console.log("fetchUserRepositories: Fetching user repositories.");
  const REPOS_URL = `https://api.github.com/user/repos?per_page=100`;
  const response = await fetch(REPOS_URL, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch repositories: ${response.status}`);
  }
  const repos = await response.json();
  repos.sort((a, b) => a.name.localeCompare(b.name));
  console.log("fetchUserRepositories: Repositories fetched.", repos);
  return repos;
};

/**
 * Creates a dropdown menu for repository selection.
 * @param {Array<object>} repositories - The list of repositories.
 */
const createRepoDropdown = (repositories) => {
  console.log("createRepoDropdown: Creating repository dropdown.");
  const select = document.createElement("select");
  select.id = "name";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Select a Repository";
  select.appendChild(defaultOption);

  repositories.forEach((repo) => {
    const option = document.createElement("option");
    option.value = `${repo.owner.login}/${repo.name}`;
    option.textContent = `${repo.owner.login}/${repo.name} ${repo.private ? "(Private)" : "(Public)"}`;
    select.appendChild(option);
  });

  const repoNameField = document.querySelector("#step_repo_name .field");
  repoNameField.innerHTML = '<label for="name">Full Repository Name</label>';
  repoNameField.appendChild(select);
  // Re-add event listener for the new select element
  select.addEventListener("change", () => {
    if (getRepositoryName() !== "") {
      navigateToStep(2);
    }
  });
};

/**
 * Prefills the text input with the username.
 * @param {string} username - The GitHub username.
 */
const prefillTextInput = (username) => {
  console.log(`prefillTextInput: Prefilling text input with username: ${username}`);
  const repoNameField = document.querySelector("#step_repo_name .field");
  repoNameField.innerHTML = `<label for="name">Full Repository Name</label><input autocomplete="off" id="name" placeholder="${username}/repository-name" value="${username}/" type="text" />`;
  // Re-add event listener for the new input element
  document.querySelector("#name").addEventListener("input", () => {
    const repoName = getRepositoryName();
    const selectedOption = getOptionType();
    const isValid = repoName !== "" && (selectedOption !== "new" || repoName.includes("/"));
    if (isValid) {
      navigateToStep(2);
    }
  });
};

/**
 * Handles changes to the repository type selection.
 */
const handleRepoTypeChange = async function handleRepoTypeChange() {
  const valueSelected = this.value;
  console.log(`handleRepoTypeChange: Selected repository type: ${valueSelected}`);
  document.querySelector("#next_to_repo_name").disabled = !valueSelected; // This button will be removed later

  if (valueSelected === "link") {
    const data = await getObjectFromLocalStorage([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USERNAME]);
    const { [STORAGE_KEYS.TOKEN]: token, [STORAGE_KEYS.USERNAME]: username } = data || {};

    if (token && username) {
      document.querySelector("#success").textContent = "Fetching your repositories... Please wait.";
      document.querySelector("#success").style.display = "block";
      document.querySelector("#success").removeAttribute("hidden");
      document.querySelector("#error").style.display = "none";

      try {
        const repos = await fetchUserRepositories(token);
        document.querySelector("#success").style.display = "none";
        createRepoDropdown(repos);
        navigateToStep(1); // Move to step 2 after dropdown is created
      } catch (error) {
        console.error("handleRepoTypeChange: Error fetching repositories.", error);
        document.querySelector("#success").style.display = "none";
        document.querySelector("#error").textContent = `Error fetching repositories: ${error.message}`;
        document.querySelector("#error").style.display = "block";
        document.querySelector("#error").removeAttribute("hidden");
      }
    } else {
      console.log("handleRepoTypeChange: Token or username missing for linking, showing authorization error.");
      document.querySelector("#error").innerHTML =
        'Authorization error - Grant BaekjoonHub access to your GitHub account to continue. <button id="authorize_button" class="button positive">Authorize</button>';
      document.querySelector("#error").style.display = "block";
      document.querySelector("#error").removeAttribute("hidden");
      document.querySelector("#success").style.display = "none";
      document.querySelector("#authorize_button").addEventListener("click", beginOAuth2);
    }
  } else if (valueSelected === "new") {
    const data = await getObjectFromLocalStorage([STORAGE_KEYS.USERNAME]);
    const { [STORAGE_KEYS.USERNAME]: username } = data || {};
    if (username) {
      prefillTextInput(username);
    } else {
      const repoNameField = document.querySelector("#step_repo_name .field");
      repoNameField.innerHTML = '<label for="name">Full Repository Name</label><input autocomplete="off" id="name" placeholder="username/repository-name" type="text" />';
      // Add event listener for the new input element
      document.querySelector("#name").addEventListener("input", () => {
        const repoName = getRepositoryName();
        const selectedOption = getOptionType();
        const isValid = repoName !== "" && (selectedOption !== "new" || repoName.includes("/"));
        if (isValid) {
          navigateToStep(2);
        }
      });
    }
    navigateToStep(1); // Move to step 2 after text input is created
  }
};

/**
 * Handles the final setup button click.\
 */
const handleFinishSetupClick = async () => {
  const selectedOption = getOptionType();
  const repoName = getRepositoryName();
  console.log(`handleFinishSetupClick: Selected option=${selectedOption}, repoName=${repoName}`);

  if (!repoName) {
    document.querySelector("#error").textContent = "No repository entered - Please enter a repository in 'username/repository-name' format!";
    document.querySelector("#error").style.display = "block";
    document.querySelector("#error").removeAttribute("hidden");
    navigateToStep(1); // Go back to repo name step
    document.querySelector("#name").focus();
    return;
  }
  if (selectedOption === "new" && !repoName.includes("/")) {
    document.querySelector("#error").textContent = "Invalid repository format - Please use 'username/repository-name' format!";
    document.querySelector("#error").style.display = "block";
    document.querySelector("#error").removeAttribute("hidden");
    navigateToStep(1); // Go back to repo name step
    document.querySelector("#name").focus();
    return;
  }

  document.querySelector("#error").style.display = "none";
  document.querySelector("#success").textContent = "Attempting to create Hook... Please wait.";
  document.querySelector("#success").style.display = "block";
  document.querySelector("#success").removeAttribute("hidden");

  const token = await getObjectFromLocalStorage(STORAGE_KEYS.TOKEN);
  if (!token) {
    console.log("handleFinishSetupClick: Token missing, showing authorization error.");
    document.querySelector("#error").innerHTML =
      'Authorization error - Grant BaekjoonHub access to your GitHub account to continue. <button id="authorize_button" class="button positive">Authorize</button>';
    document.querySelector("#error").style.display = "block";
    document.querySelector("#error").removeAttribute("hidden");
    document.querySelector("#success").style.display = "none";
    document.querySelector("#authorize_button").addEventListener("click", beginOAuth2);
    return;
  }

  if (selectedOption === "new") {
    createRepo(token, repoName);
  } else {
    linkRepo(token, repoName);
  }

  const orgOption = getOrgOption();
  await saveObjectInLocalStorage({ [STORAGE_KEYS.ORG_OPTION]: orgOption });
  console.log(`handleFinishSetupClick: Set Organize by ${orgOption}`);
};

/**
 * Handles changes to the organization method selection.
 */
const handleOrgOptionChange = async () => {
  const orgOption = getOrgOption(); // Await the promise
  console.log(`handleOrgOptionChange: Selected organization option: ${orgOption}`);
  const customTemplateField = document.querySelector("#customTemplateField");
  const customTemplateInput = document.querySelector("#customTemplate");

  if (orgOption === "custom") {
    if (customTemplateField) {
      customTemplateField.style.display = "block";
      customTemplateField.removeAttribute("hidden");
    }
    const data = await getObjectFromLocalStorage(STORAGE_KEYS.DIR_TEMPLATE);
    if (data && data[STORAGE_KEYS.DIR_TEMPLATE]) {
      if (customTemplateInput) {
        customTemplateInput.value = data[STORAGE_KEYS.DIR_TEMPLATE];
      }
    } else {
      // Set a default custom template if none exists
      if (customTemplateInput) {
        customTemplateInput.value = `{{language}}/백준/{{level.replace(/ .*/, '')}}/{{problemId}}. {{title}}`;
      }
      await saveObjectInLocalStorage({
        [STORAGE_KEYS.DIR_TEMPLATE]: customTemplateInput ? customTemplateInput.value : `{{language}}/백준/{{level.replace(/ .*/, '')}}/{{problemId}}. {{title}}`,
      });
    }
  } else {
    if (customTemplateField) {
      customTemplateField.style.display = "none";
    }
  }

  await saveObjectInLocalStorage({ [STORAGE_KEYS.ORG_OPTION]: orgOption });
  console.log(`handleOrgOptionChange: Set Organize by ${orgOption}`);

  handleFinishSetupClick();
};

/**
 * Updates the organization method display based on current settings
 */
const updateOrganizationMethodDisplay = async () => {
  const currentOrgElement = document.querySelector("#current_org");
  if (!currentOrgElement) return;

  const data = await getObjectFromLocalStorage([STORAGE_KEYS.ORG_OPTION, STORAGE_KEYS.USE_CUSTOM_TEMPLATE]);
  const orgOption = data[STORAGE_KEYS.ORG_OPTION] || "platform";
  const useCustomTemplate = data[STORAGE_KEYS.USE_CUSTOM_TEMPLATE];

  if (useCustomTemplate) {
    currentOrgElement.textContent = "Custom";
  } else {
    let orgText;
    if (orgOption === "platform") {
      orgText = "By Platform";
    } else if (orgOption === "language") {
      orgText = "By Language";
    } else {
      orgText = "Custom";
    }
    currentOrgElement.textContent = orgText;
  }
};

/**
 * Loads custom template settings.
 */
const loadCustomTemplateSettings = async () => {
  console.log("loadCustomTemplateSettings: Loading custom template settings.");
  const data = (await getObjectFromLocalStorage([STORAGE_KEYS.USE_CUSTOM_TEMPLATE, STORAGE_KEYS.DIR_TEMPLATE])) || {};
  const templatePreviewContainer = document.querySelector("#template_preview_container");
  const useCustomTemplateCheckbox = document.querySelector("#use_custom_template");
  const templateDisplay = document.querySelector("#current_template_display");

  if (data[STORAGE_KEYS.USE_CUSTOM_TEMPLATE]) {
    if (useCustomTemplateCheckbox) {
      useCustomTemplateCheckbox.checked = true;
    }
    if (templatePreviewContainer) {
      templatePreviewContainer.style.display = "block";
      templatePreviewContainer.removeAttribute("hidden");
    }
    if (data[STORAGE_KEYS.DIR_TEMPLATE] && templateDisplay) {
      templateDisplay.textContent = data[STORAGE_KEYS.DIR_TEMPLATE];
    }
  } else {
    // Set default template if none exists
    const defaultTemplate = "{{language}}/백준/{{levelShort}}/{{problemId}}. {{title}}";
    if (templateDisplay) {
      templateDisplay.textContent = defaultTemplate;
    }
    if (!data[STORAGE_KEYS.DIR_TEMPLATE]) {
      await saveObjectInLocalStorage({ [STORAGE_KEYS.DIR_TEMPLATE]: defaultTemplate });
    }
  }

  // Update organization method display
  await updateOrganizationMethodDisplay();
};

/**
 * Template preview generator using parseTemplateString
 */
const generateTemplatePreview = (template) => {
  try {
    // Get sample data from input fields
    const getSampleData = () => {
      const platform = document.querySelector("#sample_platform")?.value || "백준";
      const problemId = document.querySelector("#sample_problemId")?.value || "1000";
      const title = document.querySelector("#sample_title")?.value || "A+B";
      const level = document.querySelector("#sample_level")?.value || "Bronze V";
      const language = document.querySelector("#sample_language")?.value || "Python";

      return {
        // 공통 데이터
        platform,
        problemId,
        title,
        level,
        language,
        memory: "30616KB",
        runtime: "68ms",
        submissionTime: "2024-01-15 10:30:00",

        // 백준 전용 데이터
        problem_tags: ["수학", "구현", "사칙연산"],
        problem_tags_string: "수학-구현-사칙연산",
        problem_description: "두 정수 A와 B를 입력받은 다음, A+B를 출력하는 프로그램을 작성하시오.",
        problem_input: "첫째 줄에 A와 B가 주어진다. (0 < A, B < 10)",
        problem_output: "첫째 줄에 A+B를 출력한다.",

        // 플랫폼 전용 데이터
        division: "연습문제",
        result_message: "정답",
        length: "150",
        link: "https://www.acmicpc.net/problem/1000",
        examSequence: "1",
        quizNumber: "1",
        difficulty: "1",
      };
    };

    const sampleData = getSampleData();

    // 샘플 데이터에 변환 함수들 병합
    const templateData = {
      ...sampleData,
    };
    // parseTemplateString을 사용하여 템플릿 처리
    const finalResult = parseTemplateString(template, templateData, getTextTransforms());
    return finalResult;
  } catch (error) {
    console.error("Template preview generation error:", error);

    // 기본적인 변수 폴백
    try {
      let fallbackResult = template;

      // 기본 변수
      const basicReplacements = {
        platform: "백준",
        problemId: "1000",
        title: "A+B",
        level: "Bronze V",
        language: "Python",
      };

      Object.entries(basicReplacements).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        fallbackResult = fallbackResult.replace(regex, value);
      });

      return fallbackResult;
    } catch (fallbackError) {
      return `Error: ${error.message || "Invalid template format"}`;
    }
  }
};

/**
 * Inline template editor functionality
 */
const initializeInlineTemplateEditor = () => {
  const templateInput = document.querySelector("#template_input");
  const templatePreview = document.querySelector("#template_preview");
  const templateDisplay = document.querySelector("#current_template_display");
  const saveBtn = document.querySelector("#save_template");
  const resetBtn = document.querySelector("#reset_template");

  // Variable tags click functionality
  const variableTags = document.querySelectorAll(".variable-tag");

  variableTags.forEach((tag) => {
    tag.addEventListener("click", () => {
      if (templateInput) {
        const cursorPos = templateInput.selectionStart;
        const textBefore = templateInput.value.substring(0, cursorPos);
        const textAfter = templateInput.value.substring(templateInput.selectionEnd);
        const newText = textBefore + tag.textContent + textAfter;
        templateInput.value = newText;
        templateInput.focus();
        templateInput.setSelectionRange(cursorPos + tag.textContent.length, cursorPos + tag.textContent.length);
        updatePreview();
      }
    });
  });

  const updatePreview = () => {
    if (templatePreview && templateInput) {
      const preview = generateTemplatePreview(templateInput.value);
      templatePreview.textContent = preview;
    }
  };

  const loadCurrentTemplate = async () => {
    if (templateInput && templateDisplay) {
      // Load current template
      const data = await getObjectFromLocalStorage(STORAGE_KEYS.DIR_TEMPLATE);
      const currentTemplate = data || "{{language}}/백준/{{removeAfterSpace(level)}}/{{problemId}}. {{title}}";
      templateInput.value = currentTemplate;
      templateDisplay.textContent = currentTemplate;
      updatePreview();
    }
  };

  const saveTemplate = async () => {
    if (templateInput && templateDisplay) {
      const newTemplate = templateInput.value.trim();
      if (newTemplate) {
        await saveObjectInLocalStorage({ [STORAGE_KEYS.DIR_TEMPLATE]: newTemplate });
        templateDisplay.textContent = newTemplate;
        console.log("Template saved:", newTemplate);
      }
    }
  };

  const resetTemplate = async () => {
    const defaultTemplate = "{{language}}/백준/{{removeAfterSpace(level)}}/{{problemId}}. {{title}}";
    if (templateInput && templateDisplay) {
      templateInput.value = defaultTemplate;
      templateDisplay.textContent = defaultTemplate;
      await saveObjectInLocalStorage({ [STORAGE_KEYS.DIR_TEMPLATE]: defaultTemplate });
      updatePreview();
    }
  };

  // Event listeners
  if (saveBtn) saveBtn.addEventListener("click", saveTemplate);
  if (resetBtn) resetBtn.addEventListener("click", resetTemplate);

  // Input event for live preview
  if (templateInput) {
    templateInput.addEventListener("input", updatePreview);
  }

  // Sample data input change listeners
  const sampleInputs = document.querySelectorAll("#sample_platform, #sample_problemId, #sample_title, #sample_level, #sample_language");
  sampleInputs.forEach((input) => {
    input.addEventListener("input", updatePreview);
  });

  // Initialize
  loadCurrentTemplate();
};

// DOMContentLoaded event listener
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded: Initializing settings page.");
  // Navigation listeners
  // document.querySelector('#next_to_repo_name').addEventListener('click', () => navigateToStep(1)); // Removed as navigation is now automatic
  document.querySelector("#back_to_repo_option").addEventListener("click", () => navigateToStep(0));
  document.querySelector("#next_to_org_method").addEventListener("click", () => navigateToStep(2));
  document.querySelector("#back_to_repo_name").addEventListener("click", () => navigateToStep(1));

  // Step 1: Repo Option
  document.querySelector("#type").addEventListener("change", handleRepoTypeChange);

  // Step 2: Repo Name (initial setup for validation)
  document.querySelector("#name").addEventListener("input", () => {
    const repoName = getRepositoryName();
    const selectedOption = getOptionType();
    const isValid = repoName !== "" && (selectedOption !== "new" || repoName.includes("/"));
    document.querySelector("#next_to_org_method").disabled = !isValid;
    if (isValid) {
      navigateToStep(2);
    }
  });

  document.querySelector("#org_option").addEventListener("change", handleOrgOptionChange);

  // Finish button (no longer needed as it's automated)
  // document.querySelector('#finish_setup').addEventListener('click', handleFinishSetupClick);

  // Unlink buttons
  document.querySelector("#unlink a").addEventListener("click", () => {
    unlinkRepo();
    document.querySelector("#success").textContent = "Successfully unlinked your current git repo. Please create/link a new hook.";
  });
  document.querySelector("#unlinkButton")?.addEventListener("click", () => {
    unlinkRepo();
    document.querySelector("#success").textContent = "Successfully unlinked your current git repo. Please create/link a new hook.";
    document.querySelector("#success").style.display = "block";
    document.querySelector("#success").removeAttribute("hidden");
  });

  // Settings in commit_mode
  const useCustomTemplateCheckbox = document.querySelector("#use_custom_template");
  if (useCustomTemplateCheckbox) {
    useCustomTemplateCheckbox.addEventListener("change", async function handleUseCustomTemplateChange() {
      const useCustom = this.checked;
      const templatePreviewContainer = document.querySelector("#template_preview_container");

      if (templatePreviewContainer) {
        if (useCustom) {
          templatePreviewContainer.style.display = "block";
          templatePreviewContainer.removeAttribute("hidden");
        } else {
          templatePreviewContainer.style.display = "none";
        }
      }

      await saveObjectInLocalStorage({ [STORAGE_KEYS.USE_CUSTOM_TEMPLATE]: useCustom });

      // Update organization method display
      await updateOrganizationMethodDisplay();
    });
  }

  // Enable toggle functionality
  const loadEnableSettings = async () => {
    const enableCheckbox = document.querySelector("#enable_toggle");
    if (enableCheckbox) {
      // Load current enable setting
      const enableStatus = await getObjectFromLocalStorage(STORAGE_KEYS.ENABLE);
      console.log(`Enable setting loaded: ${enableStatus}`);
      if (enableStatus === undefined) {
        enableCheckbox.checked = true; // Default to true
        await saveObjectInLocalStorage({ [STORAGE_KEYS.ENABLE]: true });
      } else {
        enableCheckbox.checked = enableStatus;
      }

      enableCheckbox.addEventListener("change", async function handleEnableChange() {
        console.log(`Enable setting changed to: ${this.checked}`);
        await saveObjectInLocalStorage({ [STORAGE_KEYS.ENABLE]: this.checked });
      });
    }
  };
  loadEnableSettings();

  loadCustomTemplateSettings();
  initializeInlineTemplateEditor();
  detectAndSetMode();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log("chrome.storage.onChanged: Storage change detected.", changes);
  if (namespace === "local" && (changes[STORAGE_KEYS.MODE_TYPE] || changes[STORAGE_KEYS.HOOK] || changes[STORAGE_KEYS.TOKEN])) {
    detectAndSetMode();
  }
});
