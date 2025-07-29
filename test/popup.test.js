const { Builder, By, Key, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const path = require("path");
const fs = require("fs"); // For saving screenshots



async function runTest() {
  let driver;
  try {
    const extensionPath = path.resolve(__dirname, "../dist");
    console.log("Extension path being used:", extensionPath);

    let options = new chrome.Options();
    options.addArguments(`--load-extension=${extensionPath}`);
    options.addArguments("--no-sandbox"); // Needed for CI/CD environments
    options.addArguments("--disable-dev-shm-usage"); // Needed for Docker environments
    options.addArguments("--user-data-dir=" + path.resolve(__dirname, "./temp_chrome_profile")); // Use a temporary profile
    options.addArguments("--disable-extensions-except=" + extensionPath); // Disable all other extensions
    options.setLoggingPrefs({ browser: "ALL", driver: "ALL" });

    driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();

    // Figure out the extension ID
    await driver.get("chrome://extensions/");

    const extensionsManager = await driver.wait(until.elementLocated(By.css("extensions-manager")), 10000);
    const extensionsManagerShadowRoot = await extensionsManager.getShadowRoot();

    const extensionsItemList = await driver.wait(async () => {
      const extensionsManager = await driver.findElement(By.css("extensions-manager"));
      const extensionsManagerShadowRoot = await extensionsManager.getShadowRoot();
      return extensionsManagerShadowRoot.findElement(By.css("extensions-item-list"));
    }, 10000);
    const extensionsItemListShadowRoot = await extensionsItemList.getShadowRoot();

    const extensionsItem = await driver.wait(async () => {
      return extensionsItemListShadowRoot.findElement(By.css("extensions-item"));
    }, 10000);

    const extensionId = await extensionsItem.getAttribute("id");

    // Navigate to the extension's popup page
    await driver.get(`chrome-extension://${extensionId}/popup.html`);

    // Get and log the actual page title
    const actualTitle = await driver.getTitle();
    console.log("Actual page title:", actualTitle);

    // Wait for the popup page to load and its title to be correct
    await driver.wait(until.titleContains("BaekjoonHub Popup"), 15000); // Increased timeout
    console.log("Popup page loaded successfully!");

    // If we reach here, the extension loaded and popup.html displayed correctly.
    console.log("Basic extension load and popup.html display test passed.");

    // GitHub 인증 테스트 시작
    console.log("Attempting GitHub login...");
    try {
      // Wait for the auth_mode section to be visible
      console.log("Waiting for auth_mode section to be visible...");
      let authModeSection = await driver.wait(until.elementIsVisible(driver.findElement(By.id('auth_mode'))), 60000);
      console.log("auth_mode section is visible.");

      // Wait for the authenticate button to be located
      const authenticateButtonLocator = By.id('authenticate');
      console.log("Waiting for authenticate button to be located...");
      const authenticateButton = await driver.wait(until.elementLocated(authenticateButtonLocator), 60000);
      console.log("Authenticate button located.");

      // Wait for the authenticate button to be visible
      console.log("Waiting for authenticate button to be visible...");
      await driver.wait(until.elementIsVisible(authenticateButton), 60000);
      console.log("Authenticate button is visible.");

      // Now click the button
      await authenticateButton.click();
      console.log("Authenticate button clicked. Waiting for new window for authentication...");

      // Get all window handles
      const originalWindow = await driver.getWindowHandle();
      let allWindows = await driver.getAllWindowHandles();
      console.log("Current window handles:", allWindows);

      // Wait for a new window to appear
      console.log("Waiting for a new window to appear...");
      await driver.wait(async () => {
        allWindows = await driver.getAllWindowHandles();
        console.log("Checking for new window. Current handles:", allWindows);
        return allWindows.length > 1;
      }, 30000); // Increased timeout to 30 seconds
      console.log("New window detected.");

      let newWindowHandle;
      for (const handle of allWindows) {
        if (handle !== originalWindow) {
          newWindowHandle = handle;
          break;
        }
      }

      if (newWindowHandle) {
        await driver.switchTo().window(newWindowHandle);
        console.log("Switched to new window for GitHub authentication. Closing it as we will mock authentication.");
        await driver.close(); // Close the new window immediately
        await driver.switchTo().window(originalWindow);
        console.log("Switched back to original popup window. Mocking authentication...");

        // Mock the fetch API to simulate a successful GitHub API response
        await driver.executeScript(`
          window.fetch = async (url, options) => {
            if (url === 'https://api.github.com/user') {
              return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
              });
            }
            return originalFetch(url, options);
          };
          const originalFetch = window.fetch;
        `);

        // Mock successful authentication by setting local storage values
        await driver.executeScript(`
          chrome.storage.local.set({
            baekjoonhub_token: 'mock_token_123',
            baekjoonhub_username: 'mock_user',
            baekjoonhub_mode_type: 'commit'
          }, function() {
            console.log('Mock token and username set in local storage.');
          });
        `);

        // Reload the popup page to simulate the actual behavior after authentication
        await driver.get(`chrome-extension://${extensionId}/popup.html`);
        console.log("Popup page reloaded after mocking authentication.");

        // Verify successful login on the original popup by checking UI changes...
        console.log("Verifying successful login by checking UI changes...");

      } else {
        console.log("New authentication window did not appear.");
        throw new Error("New authentication window did not appear.");
      }

        // Verify successful login on the original popup by checking UI changes...
        console.log("Verifying successful login by checking UI changes...");
        
        // Wait for auth_mode section to be hidden
        authModeSection = await driver.wait(until.elementLocated(By.id('auth_mode')), 10000);
        await driver.wait(async () => {
          const displayStyle = await authModeSection.getCssValue('display');
          return displayStyle === 'none';
        }, 10000, "Auth mode section did not become hidden.");
        console.log("Auth mode section is hidden.");

        // Wait for commit_mode or hook_mode section to be visible
        await driver.wait(until.elementLocated(By.id('commit_mode')), 10000);
        const commitModeSection = await driver.findElement(By.id('commit_mode'));
        await driver.wait(until.elementLocated(By.id('hook_mode')), 10000);
        const hookModeSection = await driver.findElement(By.id('hook_mode'));

        await driver.wait(async () => {
          const commitModeDisplay = await commitModeSection.getCssValue('display');
          const hookModeDisplay = await hookModeSection.getCssValue('display');
          return commitModeDisplay === 'block' || hookModeDisplay === 'block';
        }, 30000, "Neither commit_mode nor hook_mode section became visible.");
        console.log("Commit or Hook mode section is visible. GitHub login successful!");

    } catch (githubError) {
      console.log("GitHub login test failed:", githubError);
      // Optionally, take a screenshot specifically for GitHub login failure
      try {
        const githubLoginFailureScreenshot = await driver.takeScreenshot();
        fs.writeFileSync("github_login_failure_screenshot.png", githubLoginFailureScreenshot, "base64");
        console.log("Screenshot of GitHub login failure saved to github_login_failure_screenshot.png");
      } catch (screenshotError) {
        console.log("Failed to take screenshot after GitHub login failure:", screenshotError);
      }
      throw githubError; // Re-throw to mark the overall test as failed
    }

  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

runTest();
