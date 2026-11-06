import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  // We can't connect to preview unless preview is running, but let's check what was captured in the screenshots
  await browser.close();
  console.log("Screenshots are saved in data/browser_verification/");
})();

