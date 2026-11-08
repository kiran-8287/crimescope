const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname);
const BASE = 'http://localhost:5173';
const startedAt = new Date().toISOString();
const results = { startedAt, base: BASE, pages: {}, checks: {}, consoleErrors: [], screenshots: [] };

const PAGES = [
  ['/', 'overview'],
  ['/compare', 'compare'],
  ['/trends', 'trends'],
  ['/quality', 'quality'],
  ['/pca', 'pca'],
  ['/clusters', 'clusters'],
  ['/anomalies', 'anomalies'],
  ['/rules', 'rules'],
  ['/methodology', 'methodology'],
];

(async () => {
  const userDataDir = path.join(OUT, 'chrome-profile-' + Date.now());
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    viewport: { width: 1400, height: 950 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = context.pages()[0] || (await context.newPage());
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  async function shot(name) {
    const p = path.join(OUT, name + '.png');
    await page.screenshot({ path: p, fullPage: false });
    results.screenshots.push(name + '.png');
  }

  // ---- Page load checks ----
  for (const [route, key] of PAGES) {
    const start = Date.now();
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1500);
    const bodyText = await page.locator('body').innerText();
    const hasFatal = /We couldn.t load this view/i.test(bodyText);
    const loading = /Loading CrimeScope/i.test(bodyText);
    results.pages[key] = {
      route, loadMs: Date.now() - start,
      hasFatalError: hasFatal, stillLoading: loading,
      contentLength: bodyText.length,
    };
    await shot('page_' + key);
  }

  // ---- Year selector options ----
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const selects = await page.locator('select').all();
  let yearOptions = null;
  for (const s of selects) {
    const opts = (await s.locator('option').allTextContents()).map((t) => t.trim());
    if (opts.some((o) => /^20\d\d$/.test(o))) { yearOptions = opts.filter((o) => /^20\d\d$/.test(o)); break; }
  }
  results.checks.yearSelector = {
    options: yearOptions,
    has2020: !!yearOptions && yearOptions.includes('2020'),
    onlySupported: !!yearOptions && yearOptions.every((y) => ['2021', '2022', '2023', '2024'].includes(y)),
  };

  // ---- Stale 2020 bookmark recovery ----
  await page.goto(BASE + '/?year=2020', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2500);
  const recoverText = await page.locator('body').innerText();
  const recoverUrl = page.url();
  results.checks.bookmark2020 = {
    finalUrl: recoverUrl,
    urlNoLonger2020: !/year=2020/.test(recoverUrl),
    noFatalError: !/We couldn.t load this view/i.test(recoverText),
    hasNotice: /outside the active 2021.2024 scope/i.test(recoverText),
    loadedOverview: /Overview|Reported|National/i.test(recoverText),
  };
  await shot('recover_2020');

  // ---- API sanity from the browser origin ----
  results.checks.apiFromBrowser = await page.evaluate(async () => {
    const out = {};
    try {
      const r = await fetch('http://localhost:4000/api/v1/dashboard?year=2020');
      out.year2020Status = r.status;
    } catch (e) { out.year2020Error = String(e); }
    try {
      const r = await fetch('http://localhost:4000/api/v1/dashboard?year=2024&view=quality');
      const j = await r.json();
      out.releaseId = j.meta && j.meta.releaseId;
      out.supportedYears = j.meta && j.meta.years;
      out.observations = j.qualitySummary && j.qualitySummary.observations;
    } catch (e) { out.year2024Error = String(e); }
    return out;
  });

  // ---- Quality page totals ----
  await page.goto(BASE + '/quality', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const qText = await page.locator('body').innerText();
  results.checks.qualityPage = {
    mentions546198: /546[,]?198/.test(qText),
    mentions2020Only: /2020.*(Andhra|AP).*only/i.test(qText) || /Andhra Pradesh only/i.test(qText),
  };

  // ---- Filter interaction ----
  await page.goto(BASE + '/compare', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const stateSel = page.locator('label:has-text("State / UT") select').first();
  let filterResult = {};
  try {
    const opts = await stateSel.locator('option').allTextContents();
    const target = opts.find((o) => o && o !== 'All states / UTs (National)');
    if (target) {
      await stateSel.selectOption({ label: target });
      await page.waitForTimeout(1500);
      filterResult.stateSelected = target;
      filterResult.urlHasState = /state=/.test(page.url());
    } else { filterResult.stateOptions = opts.length; }
  } catch (e) { filterResult.error = String(e); }
  results.checks.filters = filterResult;
  await shot('filter_state');

  // ---- Analysis pages compatible results ----
  for (const [route, key, needle] of [
    ['/pca', 'pca', /PC1|variance|Principal/i],
    ['/clusters', 'clusters', /cluster|cohort|district/i],
    ['/anomalies', 'anomalies', /z-score|unusual|observation/i],
    ['/rules', 'rules', /support|confidence|lift|rule/i],
  ]) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const t = await page.locator('body').innerText();
    results.checks[key] = { rendered: needle.test(t), hasFatal: /We couldn.t load this view/i.test(t) };
  }

  // ---- CSV export (client-side) contains no 2020 ----
  await page.goto(BASE + '/trends', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  let csvInfo = { attempted: false };
  const exportBtn = page.locator('button:has-text("Export CSV")').first();
  if (await exportBtn.count()) {
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }),
        exportBtn.click(),
      ]);
      const fp = await download.path();
      const content = fs.readFileSync(fp, 'utf8');
      csvInfo = {
        attempted: true,
        filename: download.suggestedFilename(),
        rows: content.split('\n').length - 1,
        contains2020: /(^|,|\n)2020(,|\n)/.test(content),
      };
    } catch (e) { csvInfo = { attempted: true, error: String(e) }; }
  }
  results.checks.csvExport = csvInfo;

  // ---- Trends comparability notice ----
  const trendsText = await page.locator('body').innerText();
  results.checks.trendsScope = {
    mentionsPartial2020Archived: /partial 2020|2020 Andhra|archived/i.test(trendsText),
    mentionsVerifiedCohort: /2022.2023|verified.*cohort|comparable cohort/i.test(trendsText),
  };

  // ---- Repeated navigation responsiveness ----
  const navStart = Date.now();
  let navErrors = 0;
  for (let i = 0; i < 3; i++) {
    for (const [route] of PAGES) {
      try { await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 20000 }); await page.waitForTimeout(300); }
      catch (e) { navErrors++; }
    }
  }
  results.checks.repeatedNavigation = { passes: 3, totalRoutes: PAGES.length, navErrors, elapsedMs: Date.now() - navStart };

  results.consoleErrors = errors.slice(0, 20);
  results.endedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));

  await context.close();
  process.exit(0);
})().catch((err) => {
  fs.writeFileSync(path.join(__dirname, 'summary.json'), JSON.stringify({ startedAt, fatal: String(err && err.stack || err) }, null, 2));
  console.error('FATAL:', err);
  process.exit(1);
});
