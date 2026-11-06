const { chromium } = require('playwright');

(async () => {
  console.log("Attempting to launch system Chrome...");
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  console.log('Chrome launched successfully! Version:', browser.version());
  const page = await browser.newPage();
  await page.setContent('<h1>CrimeScope Test</h1>');
  const title = await page.$eval('h1', el => el.textContent);
  console.log('Page content verified:', title);
  await browser.close();
  console.log('Browser test complete.');
})().catch(err => {
  console.error('Launch failed:', err);
  process.exit(1);
});

