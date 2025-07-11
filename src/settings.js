import { getObjectFromLocalStorage, saveObjectInLocalStorage } from "@/commons/storage.js";

import beginOAuth2 from "@/commons/oauth2.js";

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
  if (stepIndex >= 0 && stepIndex < steps.length) {
    currentStep = stepIndex;
    showStep(steps[currentStep]);
  }
};

/**
 * Detects the mode (hook or commit) and sets the UI accordingly.
 */
const detectAndSetMode = async () => {
  const data = (await getObjectFromLocalStorage(["mode_type", "baekjoonHubHook", "baekjoonHubOrgOption", "baekjoonHubToken"])) || {};
  const { mode_type: modeType, baekjoonHubHook: BaekjoonHubHook, baekjoonHubOrgOption: BaekjoonHubOrgOption, baekjoonHubToken: BaekjoonHubToken } = data;

  if (modeType === "commit" && BaekjoonHubHook) {
    if (!BaekjoonHubToken) {
      document.querySelector("#error").innerHTML =
        'Authorization error - Grant BaekjoonHub access to your GitHub account to continue. <button id="authorize_button" class="button positive">Authorize</button>';
      document.querySelector("#error").style.display = "block";
      document.querySelector("#error").removeAttribute("hidden");
      document.querySelector("#success").style.display = "none";
      document.querySelector("#hook_mode").style.display = "block";
      document.querySelector("#hook_mode").removeAttribute("hidden");
      document.querySelector("#commit_mode").style.display = "none";
      navigateToStep(0);
      document.querySelector("#authorize_button").addEventListener("click", beginOAuth2);
      return;
    }

    document.querySelector("#hook_mode").style.display = "none";
    document.querySelector("#commit_mode").style.display = "block";
    document.querySelector("#commit_mode").removeAttribute("hidden");
    document.querySelector("#current_repo").textContent = BaekjoonHubHook;
    const orgOptionValue = BaekjoonHubOrgOption || "platform";
    let orgText;
    if (orgOptionValue === "platform") {
      orgText = "By Platform";
    } else if (orgOptionValue === "language") {
      orgText = "By Language";
    } else {
      orgText = "Custom";
    }
    document.querySelector("#current_org").textContent = orgText;
    if (orgOptionValue !== "custom") {
      document.querySelector("#customTemplateField").style.display = "none";
    }
    document.querySelector("#unlink").style.display = "block";
    document.querySelector("#unlink").removeAttribute("hidden");
  } else {
    console.log("Entering hook mode");
    document.querySelector("#hook_mode").style.display = "block";
    console.log("hook_mode display set to block");
    document.querySelector("#hook_mode").removeAttribute("hidden");
    document.querySelector("#commit_mode").style.display = "none";
    document.querySelector("#unlink").style.display = "none";
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
const handleCreateRepoStatusCode = (res, status, fullName) => {
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
      saveObjectInLocalStorage({ mode_type: "commit" }).then(() => {
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
      });
      saveObjectInLocalStorage({ baekjoonHubHook: res.full_name }).then(() => {
        console.log("Successfully set new repo hook");
      });
      break;
  }
};

/**
 * Creates a new GitHub repository.
 * @param {string} token - The GitHub OAuth token.
 * @param {string} fullName - The full name of the repository to create (e.g., username/repo-name).
 */
const createRepo = async (token, fullName) => {
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
    saveObjectInLocalStorage({ stats });
  } catch (error) {
    console.error(error);
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
      saveObjectInLocalStorage({
        mode_type: "commit",
        repo: res.html_url,
      }).then(() => {
        document.querySelector("#error").style.display = "none";
        document.querySelector("#success").innerHTML =
          `Successfully linked <a target='_blank' href='${res.html_url}'>${name}</a> to BaekjoonHub. Start <a href='https://www.acmicpc.net/'>BOJ</a> now!`;
        document.querySelector("#success").style.display = "block";
        document.querySelector("#success").removeAttribute("hidden");
        document.querySelector("#unlink").style.display = "block";
        document.querySelector("#unlink").removeAttribute("hidden");
        document.querySelector("#hook_mode").style.display = "none";
        document.querySelector("#commit_mode").style.display = "block";
        document.querySelector("#commit_mode").removeAttribute("hidden");
        detectAndSetMode(); // Refresh the settings page
      });

      const stats = {};
      stats.version = chrome.runtime.getManifest().version;
      stats.submission = {};
      saveObjectInLocalStorage({ stats });

      saveObjectInLocalStorage({ baekjoonHubHook: res.full_name }).then(() => {
        console.log("Successfully set new repo hook");
      });
    } else {
      document.querySelector("#hook_mode").style.display = "block";
      document.querySelector("#hook_mode").removeAttribute("hidden");
      document.querySelector("#commit_mode").style.display = "none";
    }
  } catch (error) {
    console.error(error);
    document.querySelector("#success").style.display = "none";
    document.querySelector("#error").textContent = "Error linking repository. See console for details.";
    document.querySelector("#error").style.display = "block";
    document.querySelector("#error").removeAttribute("hidden");
  }
};

/**
 * Unlinks the currently connected repository.
 */
const unlinkRepo = () => {
  saveObjectInLocalStorage({
    mode_type: "hook",
    baekjoonHubHook: null,
    baekjoonHubOrgOption: "platform",
  }).then(() => {
    console.log("Unlinking repo and resetting options.");
    document.querySelector("#commit_mode").style.display = "none";
    document.querySelector("#hook_mode").style.display = "block";
    document.querySelector("#hook_mode").removeAttribute("hidden");
    navigateToStep(0); // Go back to the first step
  });
};

/**
 * Fetches the user's repositories from GitHub.
 * @param {string} token - The GitHub OAuth token.
 * @returns {Promise<Array<object>>} - A promise that resolves to a list of repositories.
 */
const fetchUserRepositories = async (token) => {
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
  return repos;
};

/**
 * Creates a dropdown menu for repository selection.
 * @param {Array<object>} repositories - The list of repositories.
 */
const createRepoDropdown = (repositories) => {
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
  document.querySelector("#next_to_repo_name").disabled = !valueSelected; // This button will be removed later

  if (valueSelected === "link") {
    const data = await getObjectFromLocalStorage(["baekjoonHubToken", "baekjoonHubUsername"]);
    const { baekjoonHubToken: token, baekjoonHubUsername: username } = data || {};

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
        document.querySelector("#success").style.display = "none";
        document.querySelector("#error").textContent = `Error fetching repositories: ${error.message}`;
        document.querySelector("#error").style.display = "block";
        document.querySelector("#error").removeAttribute("hidden");
      }
    } else {
      document.querySelector("#error").innerHTML =
        'Authorization error - Grant BaekjoonHub access to your GitHub account to continue. <button id="authorize_button" class="button positive">Authorize</button>';
      document.querySelector("#error").style.display = "block";
      document.querySelector("#error").removeAttribute("hidden");
      document.querySelector("#success").style.display = "none";
      document.querySelector("#authorize_button").addEventListener("click", beginOAuth2);
    }
  } else if (valueSelected === "new") {
    const data = await getObjectFromLocalStorage(["baekjoonHubUsername"]);
    const { baekjoonHubUsername: username } = data || {};
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
 * Handles the final setup button click.
 */
const handleFinishSetupClick = async () => {
  const selectedOption = getOptionType();
  const repoName = getRepositoryName();

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

  const token = await getObjectFromLocalStorage("baekjoonHubToken");
  if (!token) {
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
  saveObjectInLocalStorage({ baekjoonHubOrgOption: orgOption }).then(() => {
    console.log(`Set Organize by ${orgOption}`);
  });
};

/**
 * Handles changes to the organization method selection.
 */
const handleOrgOptionChange = async () => {
  const orgOption = await getOrgOption(); // Await the promise
  const customTemplateField = document.querySelector("#customTemplateField");
  const customTemplateInput = document.querySelector("#customTemplate");

  if (orgOption === "custom") {
    customTemplateField.style.display = "block";
    customTemplateField.removeAttribute("hidden");
    const data = await getObjectFromLocalStorage("baekjoonHubDirTemplate");
    if (data && data.baekjoonHubDirTemplate) {
      customTemplateInput.value = data.baekjoonHubDirTemplate;
    } else {
      // Set a default custom template if none exists
      customTemplateInput.value = `{{language}}/백준/{{level.replace(/ .*/, '')}}/{{problemId}}. {{title}}`;
      saveObjectInLocalStorage({
        baekjoonHubDirTemplate: customTemplateInput.value,
      });
    }
  } else {
    customTemplateField.style.display = "none";
  }

  saveObjectInLocalStorage({ baekjoonHubOrgOption: orgOption }).then(() => {
    console.log(`Set Organize by ${orgOption}`);
  });

  handleFinishSetupClick();
};

/**
 * Loads custom template settings.
 */
const loadCustomTemplateSettings = async () => {
  const data = (await getObjectFromLocalStorage(["baekjoonHubUseCustomTemplate", "baekjoonHubDirTemplate"])) || {};
  const customTemplateField = document.querySelector("#customTemplateField");
  if (data.baekjoonHubUseCustomTemplate) {
    document.querySelector("#use_custom_template").checked = true;
    customTemplateField.style.display = "block";
    customTemplateField.removeAttribute("hidden");
    if (data.baekjoonHubDirTemplate) {
      document.querySelector("#customTemplate").value = data.baekjoonHubDirTemplate;
    }
  }
};

// DOMContentLoaded event listener
document.addEventListener("DOMContentLoaded", () => {
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
    useCustomTemplateCheckbox.addEventListener("change", function handleUseCustomTemplateChange() {
      const useCustom = this.checked;
      document.querySelector("#customTemplateField").style.display = "block";
      document.querySelector("#customTemplateField").removeAttribute("hidden");
      saveObjectInLocalStorage({ baekjoonHubUseCustomTemplate: useCustom });
    });
  }

  const customTemplateInput = document.querySelector("#customTemplate");
  if (customTemplateInput) {
    customTemplateInput.addEventListener("input", function handleCustomTemplateInput() {
      saveObjectInLocalStorage({ baekjoonHubDirTemplate: this.value });
    });
  }

  loadCustomTemplateSettings();
  detectAndSetMode();
});
