// Focused reproduction of the refetch-transition race on /compare.
// Polls URL + filter controls + selection chips right after a year/category change
// to show whether the selection is reconciled against a *stale* dataset.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = __dirname;
const BASE = 'http://localhost:5173';
const startedAt = new Date().toISOString();
const res = { startedAt, base: BASE, timeline: {}, notes: [] };

(async () => {
  const context = await chromium.launchPersistentContext(path.join(OUT, 'chrome-profile-yt-' + Date.now()), {
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    viewport: { width: 1400, height: 950 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = context.pages()[0] || (await context.newPage());

  const chipLabels = () => page.locator('button[aria-label^="Remove "]').evaluateAll(
    (els) => els.map((e) => (e.getAttribute('aria-label') || '').replace(/^Remove /, '')));
  const unitTypeVal = () => page.locator('label:has-text("Reporting Units") select').first().inputValue().catch(() => null);
  const stateVal = () => page.locator('label:has-text("State / UT") select').first().inputValue().catch(() => null);

  async function snap() {
    return { url: page.url(), unitType: await unitTypeVal(), state: await stateVal(), chips: await chipLabels() };
  }

  async function poll(label, ms) {
    const frames = [];
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      frames.push({ t: Date.now() - t0, ...(await snap()) });
      await page.waitForTimeout(40);
    }
    res.timeline[label] = frames;
  }

  async function pickRegion(query, exact) {
    await page.fill('input[type=search]', query);
    await page.waitForTimeout(650);
    const rows = page.locator('div[style*="max-height: 220px"] > div');
    const n = await rows.count();
    let chosen = null;
    if (exact) {
      for (let i = 0; i < n; i++) {
        const s = (await rows.nth(i).locator('strong').first().innerText().catch(() => '')).trim();
        if (s.toLowerCase() === exact.toLowerCase()) { await rows.nth(i).click(); chosen = s; break; }
      }
    }
    if (!chosen && n > 0) { chosen = (await rows.nth(0).locator('strong').first().innerText().catch(() => '')).trim(); await rows.nth(0).click(); }
    await page.waitForTimeout(450);
    return chosen;
  }

  // Baseline
  await page.goto(BASE + '/compare', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2200);
  res.baseline = await snap();

  // Select one district
  res.selection = { chosen: await pickRegion('Nicobar', 'Nicobar'), ...(await snap()) };

  // ---- YEAR change 2024 -> 2023, poll timeline ----
  await page.locator('label:has-text("Reporting Year") select').first().selectOption({ value: '2023' });
  res.afterYearImmediate = await snap();
  await poll('afterYearChange', 2600);

  // reset to 2024
  await page.locator('label:has-text("Reporting Year") select').first().selectOption({ value: '2024' });
  await page.waitForTimeout(1800);
  res.afterYearRoundTrip = await snap();
  await pickRegion('Patna', 'Patna');
  res.beforeCategory = await snap();

  // ---- CATEGORY change (regions unaffected -> selection should persist), poll timeline ----
  const catSel = page.locator('label:has-text("Crime Category") select').first();
  await catSel.selectOption({ value: 'custom' });
  await page.waitForTimeout(400);
  const catItems = page.locator('div[style*="max-height: 260px"] > div');
  if (await catItems.count() > 1) { await catItems.nth(1).click(); }
  await poll('afterCategoryChange', 2600);

  res.endedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, 'summary_year_transition.json'), JSON.stringify(res, null, 2));
  console.log(JSON.stringify(res, null, 2));
  await context.close();
  process.exit(0);
})().catch((err) => {
  res.fatal = String((err && err.stack) || err);
  fs.writeFileSync(path.join(OUT, 'summary_year_transition.json'), JSON.stringify(res, null, 2));
  console.error('FATAL:', err);
  process.exit(1);
});
