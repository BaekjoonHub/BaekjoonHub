const { Builder, By, Key, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const path = require("path");
const fs = require("fs");

async function runTest() {
  const testUsername = "testuser";
  let driver;
  try {
    const extensionPath = path.resolve(__dirname, "../dist");
    console.log("Extension path being used:", extensionPath);

    let options = new chrome.Options();
    options.addArguments(`--load-extension=${extensionPath}`);
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    options.addArguments("--user-data-dir=" + path.resolve(__dirname, "./temp_chrome_profile"));
    options.addArguments("--disable-extensions-except=" + extensionPath);
    options.setLoggingPrefs({ browser: "ALL", driver: "ALL" });

    driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();

    // Navigate to a blank page first to ensure localStorage is cleared before extension page loads
    await driver.get("about:blank");

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

    // Navigate to the extension's settings page
    await driver.get(`chrome-extension://${extensionId}/settings.html`);

    // Wait for the setupSection element to be located
    const setupSection = await driver.wait(until.elementLocated(By.id('setupSection')), 30000);

    // Explicitly wait for the setupSection's display style to be 'block'
    await driver.wait(async () => {
      const displayStyle = await setupSection.getCssValue('display');
      console.log(`Waiting for setupSection display: ${displayStyle}`);
      return displayStyle === 'block';
    }, 30000, 'setupSection did not become visible (display: block) within 30 seconds');

    console.log("Settings page loaded and setupSection is visible.");

    // Assert that settingsSection is hidden
    const settingsSection = await driver.wait(until.elementLocated(By.id('settingsSection')), 10000); // Add a wait here
    const settingsSectionDisplayStyle = await settingsSection.getCssValue('display');
    if (settingsSectionDisplayStyle !== 'none') {
      throw new Error(`settingsSection is visible (display: ${settingsSectionDisplayStyle}) but should be hidden.`);
    }
    console.log("settingsSection is hidden.");

  } catch (error) {
    console.error("Test failed:", error);
    try {
      const screenshot = await driver.takeScreenshot();
      fs.writeFileSync("settings_failure_screenshot.png", screenshot, "base64");
      console.log("Screenshot saved to settings_failure_screenshot.png");

      // Capture and print browser logs
      const logs = await driver.manage().logs().get('browser');
      console.log("Browser Logs:", logs);

    } catch (screenshotError) {
      console.error("Failed to take screenshot or logs:", screenshotError);
    }
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

runTest();