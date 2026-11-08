const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = __dirname;
const BASE = 'http://localhost:5173';
const out = { startedAt: new Date().toISOString() };

(async () => {
  const ctx = await chromium.launchPersistentContext(path.join(OUT, 'chrome-profile-focused-' + Date.now()), {
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true, viewport: { width: 1400, height: 950 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  let loopWarnings = 0;
  const otherErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') {
      if (/Maximum update depth exceeded/.test(m.text())) loopWarnings++;
      else otherErrors.push(m.text());
    }
  });

  // Quality page: read the Retained observations stat
  await page.goto(BASE + '/quality', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const statTexts = await page.locator('.stat').allInnerTexts();
  out.qualityStats = statTexts.slice(0, 4);
  const qBody = await page.locator('body').innerText();
  out.qualityReady = {
    hasIndianGrouped546198: /5,46,198/.test(qBody),
    hasWesternGrouped546198: /546,198/.test(qBody),
    selectedYearLabel: (await page.locator('label:has-text("Reporting Year") select').first().inputValue().catch(() => null)),
  };

  // Compare page: quantify the render loop (unmodified code)
  loopWarnings = 0;
  await page.goto(BASE + '/compare', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  out.comparePage = { maximumUpdateDepthWarnings: loopWarnings, stillRendered: !/We couldn.t load this view/i.test(await page.locator('body').innerText()) };

  // Capture the 2020 recovery notice text
  await page.goto(BASE + '/?year=2020', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const notice = await page.locator('.notice.amber').first().innerText().catch(() => null);
  out.recoveryNotice = notice;
  out.recoveryFinalYear = await page.locator('label:has-text("Reporting Year") select').first().inputValue().catch(() => null);
  out.otherConsoleErrors = otherErrors.slice(0, 10);
  out.endedAt = new Date().toISOString();

  fs.writeFileSync(path.join(OUT, 'focused_check.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await ctx.close();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
