const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('path');

async function openBrowserWithProfile() {
    const userDataDir = path.resolve(__dirname, 'temp_chrome_profile');
    const profileDirectory = 'Default'; // Assuming 'Default' is the profile name within temp_chrome_profile

    let options = new chrome.Options();
    options.addArguments(`--user-data-dir=${userDataDir}`);
    options.addArguments(`--profile-directory=${profileDirectory}`);
    options.addArguments('--no-sandbox'); // Recommended for CI/CD environments, might be useful here
    options.addArguments('--disable-dev-shm-usage'); // Recommended for Docker/Linux environments

    let driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

    try {
        console.log(`Chrome 브라우저를 프로필 '${profileDirectory}'로 열었습니다.`);
        // Optionally navigate to a page, e.g., the extensions page or a blank page
        await driver.get('chrome://extensions');
        console.log('브라우저가 chrome://extensions 페이지로 이동했습니다.');

        const waitTime = 120 * 1000; // 2 minutes in milliseconds
        console.log(`${waitTime / 1000}초 동안 기다립니다...`);
        await driver.sleep(waitTime);
        console.log('대기 시간이 종료되었습니다.');

    } catch (error) {
        console.error('브라우저를 여는 중 오류가 발생했습니다:', error);
    } finally {
        if (driver) {
            console.log('브라우저를 닫습니다.');
            await driver.quit();
        }
    }
}

openBrowserWithProfile();
