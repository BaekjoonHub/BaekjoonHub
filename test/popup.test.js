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

    // // GitHub 인증 테스트 시작
    // console.log("Attempting GitHub login...");
    // try {
    //   // Wait for the auth_mode section to be visible
    //   const authModeSection = await driver.wait(until.elementIsVisible(driver.findElement(By.id('auth_mode'))), 60000);
    //
    //   // Wait for the authenticate button to be clickable
    //   const authenticateButton = await driver.wait(until.elementToBeClickable(By.id('authenticate')), 60000);
    //   await authenticateButton.click();
    //   console.log("Authenticate button clicked. Waiting for new window for authentication...");
    //
    //   // Get all window handles
    //   const originalWindow = await driver.getWindowHandle();
    //   let allWindows = await driver.getAllWindowHandles();
    //
    //   // Wait for a new window to appear
    //   await driver.wait(async () => {
    //     allWindows = await driver.getAllWindowHandles();
    //     return allWindows.length > 1;
    //   }, 10000);
    //
    //   let newWindowHandle;
    //   for (const handle of allWindows) {
    //     if (handle !== originalWindow) {
    //       newWindowHandle = handle;
    //       break;
    //     }
    //   }
    //
    //   if (newWindowHandle) {
    //     await driver.switchTo().window(newWindowHandle);
    //     console.log("Switched to new window for GitHub authentication. Waiting 60 seconds for user to complete authentication...");
    //     await driver.sleep(60000); // 60 seconds wait for user to complete OAuth
    //
    //     // After 60 seconds, try to close the new window if it's still open and switch back
    //     try {
    //       await driver.close();
    //       console.log("Authentication window closed.");
    //     } catch (closeError) {
    //       console.log("Authentication window might have already closed or an error occurred trying to close it:", closeError.message);
    //     }
    //     await driver.switchTo().window(originalWindow);
    //     console.log("Switched back to original popup window.");
    //
    //     // Verify successful login on the original popup (e.g., by checking for a logout button or absence of authenticate button)
    //     await driver.wait(until.elementLocated(By.id('logout-button')), 10000); // Adjust ID if different
    //     console.log("GitHub login successful! (Logout button found on original popup)");
    //
    //   } else {
    //     throw new Error("New authentication window did not appear.");
    //   }
    //
    // } catch (githubError) {
    //   console.error("GitHub login test failed:", githubError);
    //   // Optionally, take a screenshot specifically for GitHub login failure
    //   try {
    //     const githubLoginFailureScreenshot = await driver.takeScreenshot();
    //     fs.writeFileSync("github_login_failure_screenshot.png", githubLoginFailureScreenshot, "base64");
    //     console.log("Screenshot of GitHub login failure saved to github_login_failure_screenshot.png");
    //   } catch (screenshotError) {
    //     console.error("Failed to take screenshot after GitHub login failure:", screenshotError);
    //   }
    //   throw githubError; // Re-throw to mark the overall test as failed
    // }

  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

runTest();
