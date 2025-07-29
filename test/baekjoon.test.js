const { Builder, By, Key, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const path = require("path");
const fs = require("fs");

async function runBaekjoonTest() {
  let driver;
  try {
    const extensionPath = path.resolve(__dirname, "../dist");
    console.log("Extension path being used:", extensionPath);

    let options = new chrome.Options();
    options.addArguments(`--load-extension=${extensionPath}`);
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    options.addArguments("--lang=ko-KR");
    options.addArguments("--user-data-dir=" + path.resolve(__dirname, "./temp_chrome_profile"));
    options.addArguments("--disable-extensions-except=" + extensionPath);
    options.setLoggingPrefs({ browser: "ALL", driver: "ALL" });

    driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();

    // Set extension to be enabled in localStorage BEFORE navigating to any page
    await driver.executeScript(() => {
      localStorage.setItem("baekjoonhub_enable", "true");
      localStorage.setItem("baekjoonhub_hook", "bojhub/BaekjoonHub"); // Replace with a valid GitHub repo
      localStorage.setItem("baekjoonhub_token", "gho_YOUR_GITHUB_TOKEN"); // Replace with a valid GitHub token
    });
    console.log("BaekjoonHub extension enabled in localStorage.");

    console.log("Navigating to login page...");
    await driver.get("https://www.acmicpc.net/login");

    await driver.wait(until.elementLocated(By.name("login_user_id")), 10000);
    console.log("Login page loaded.");

    console.log("Entering credentials...");
    await driver.findElement(By.name("login_user_id")).sendKeys("bojhub");
    await driver.findElement(By.name("login_password")).sendKeys("baekjoonhub1!", Key.RETURN);

    console.log("Waiting for login to complete...");
    await driver.wait(until.elementLocated(By.css(".username")), 20000);
    console.log("Login successful.");

    const targetUrl = "https://www.acmicpc.net/status?user_id=bojhub&problem_id=1000&from_mine=1";
    console.log(`Navigating to: ${targetUrl}`);
    await driver.get(targetUrl);

    console.log("Waiting for extension to initiate upload...");
    // Wait for the progress element to appear, indicating the upload process has started.
    const progressElement = await driver.wait(until.elementLocated(By.id("baekjoonHubProgressElem")), 20000);
    console.log("Upload process initiated.");

    console.log("Upload completed successfully! Test passed.");

  } catch (error) {
    console.error("Test failed:", error);
    try {
      const screenshot = await driver.takeScreenshot();
      fs.writeFileSync("baekjoon_failure_screenshot.png", screenshot, "base64");
      console.log("Screenshot saved to baekjoon_failure_screenshot.png");

      const logs = await driver.manage().logs().get('browser');
      console.log("Browser Logs:", logs);

    } catch (captureError) {
      console.error("Failed to capture screenshot or logs:", captureError);
    }
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

runBaekjoonTest();