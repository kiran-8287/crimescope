// Fresh reproduction + interaction test for the Regional Comparison update loop.
// Drives installed system Google Chrome (isolated persistent profile, headless).
// Captures uncaught page errors AND console errors/warnings separately.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = __dirname;
const BASE = 'http://localhost:5173';
const startedAt = new Date().toISOString();
const res = {
  startedAt, base: BASE, phase: process.env.PHASE || 'unknown',
  release: {}, interactions: {}, checks: {}, console: {}, pageErrors: [], dashRequests: {}, notes: [],
  status: { completed: false, interrupted: false },
};
const DEPTH = 'Maximum update depth exceeded';
const cons = { error: [], warning: [] };
let dash = 0;
const depthCount = () => [...cons.error, ...cons.warning].filter((s) => s.includes(DEPTH)).length;
function consoleSummary() {
  return {
    errorCount: cons.error.length,
    warningCount: cons.warning.length,
    depthWarningsTotal: depthCount(),
    depthSamples: [...new Set([...cons.error, ...cons.warning].filter((s) => s.includes(DEPTH)))].slice(0, 2),
    errorSamples: cons.error.filter((s) => !s.includes(DEPTH)).slice(0, 6),
    warningSamples: cons.warning.filter((s) => !s.includes(DEPTH)).slice(0, 6),
  };
}

(async () => {
  const userDataDir = path.join(OUT, 'chrome-profile-' + Date.now());
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    viewport: { width: 1400, height: 950 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = context.pages()[0] || (await context.newPage());

  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error') cons.error.push(m.text());
    else if (t === 'warning') cons.warning.push(m.text());
  });
  page.on('pageerror', (e) => res.pageErrors.push(String((e && e.message) || e)));
  page.on('request', (r) => { if (/\/api\/v1\/dashboard/.test(r.url())) dash++; });

  const chipLabels = () => page.locator('button[aria-label^="Remove "]').evaluateAll(
    (els) => els.map((e) => (e.getAttribute('aria-label') || '').replace(/^Remove /, '')));
  const chipCount = async () => (await chipLabels()).length;

  // Displayed values from the "Reported values and classification summary" table.
  const comparisonRows = () => page
    .locator('section.panel:has(h2:text("Reported values and classification summary")) table tbody tr')
    .evaluateAll((rows) => rows.map((r) => {
      const cells = Array.from(r.querySelectorAll('td')).map((c) => (c.textContent || '').trim());
      return { region: cells[0], state: cells[1], category: cells[3], cases: cells[4] };
    }));
  const factualSummary = () => page
    .locator('section.panel:has(h2:text("Comparison:")) strong:text-is("Comparative finding:")')
    .first().evaluate((el) => (el.parentElement ? el.parentElement.textContent : '').trim()).catch(() => '');
  const parseNum = (s) => Number(String(s).replace(/[^0-9.]/g, ''));

  async function pickRegion(query, exact) {
    const rows = page.locator('div[style*="max-height: 220px"] > div');
    const input = page.locator('input[type=search]').first();
    // The search box is hidden once three units are selected; wait for it if it is
    // momentarily absent during a refetch, but never hang forever.
    const present = await input.count();
    if (present === 0) {
      res.notes.push(`pickRegion(${query}): search input absent (chips=${await chipCount()})`);
      await page.waitForTimeout(1200);
      if ((await input.count()) === 0) return null;
    }
    let n = 0;
    for (let attempt = 0; attempt < 3 && n === 0; attempt++) {
      await input.click({ timeout: 5000 });
      await input.fill(query);
      await page.waitForTimeout(650);
      n = await rows.count();
    }
    let chosen = null;
    if (exact) {
      for (let i = 0; i < n; i++) {
        const s = (await rows.nth(i).locator('strong').first().innerText().catch(() => '')).trim();
        if (s.toLowerCase() === exact.toLowerCase()) { await rows.nth(i).click(); chosen = s; break; }
      }
    }
    if (!chosen && n > 0) {
      chosen = (await rows.nth(0).locator('strong').first().innerText().catch(() => '')).trim();
      await rows.nth(0).click();
    }
    await page.waitForTimeout(450);
    return chosen;
  }

  async function setSelect(labelText, optionLabelOrValue) {
    const sel = page.locator(`label:has-text("${labelText}") select`).first();
    await sel.selectOption(optionLabelOrValue);
    await page.waitForTimeout(900);
  }

  // ---- release / run identity ----
  await page.goto(BASE + '/compare', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2200);
  res.release = await page.evaluate(async () => {
    const out = {};
    try {
      const r = await fetch('http://localhost:4000/api/v1/dashboard?year=2024&state=all&unitType=administrative_district');
      const j = await r.json();
      out.releaseId = j.meta && j.meta.releaseId;
      out.years = j.meta && j.meta.years;
      out.runId = j.analysis && j.analysis.runId;
    } catch (e) { out.error = String(e); }
    return out;
  });

  // ================= BASELINE (expect loop) =================
  const baseChips = await chipCount();
  const baseDepth = depthCount();
  res.interactions.loadNoSelection = { chipCount: baseChips, depthWarnings: baseDepth };

  // ---- select one, two, three (names verified present in the 2024 admin-district cohort) ----
  const n1 = await pickRegion('Nicobar', 'Nicobar');
  res.interactions.selectOne = { chosen: n1, chipCount: await chipCount(), depthWarnings: depthCount() };

  const n2 = await pickRegion('Patna', 'Patna');
  res.interactions.selectTwo = { chosen: n2, chipCount: await chipCount(), depthWarnings: depthCount() };

  const n3 = await pickRegion('Chennai', 'Chennai');
  res.interactions.selectThree = { chosen: n3, chips: await chipLabels(), chipCount: await chipCount(), depthWarnings: depthCount() };
  res.checks.threeUnitsSelected = (await chipCount()) === 3;

  // ---- assert on displayed selection AND displayed values ----
  const dRows = await comparisonRows();
  const dSummary = await factualSummary();
  const summaryNums = (dSummary.match(/[0-9][0-9,]*/g) || []).map((s) => Number(s.replace(/,/g, '')));
  const rowCases = dRows.map((r) => parseNum(r.cases));
  const chipsNow = await chipLabels();
  res.interactions.displayedValues = { chips: chipsNow, rows: dRows, factualSummary: dSummary };
  res.checks.selectionRenders = chipsNow.length > 0 && dRows.length === chipsNow.length;
  res.checks.valuesNumeric = rowCases.length > 0 && rowCases.every((v) => Number.isFinite(v) && v > 0);
  res.checks.summaryMatchesTable = rowCases.some((v) => summaryNums.includes(v));

  // ---- change STATE filter -> invalid units should be cleared after the new scope commits ----
  await setSelect('State / UT', { label: 'Maharashtra' }).catch(async () => {
    const opts = await page.locator('label:has-text("State / UT") select option').allTextContents();
    const target = opts.find((o) => o && !/All states/.test(o));
    if (target) await setSelect('State / UT', { label: target });
  });
  await page.waitForTimeout(2500); // let the new scope commit before asserting
  res.interactions.changeState = {
    url: page.url(), chipCount: await chipCount(), chips: await chipLabels(), depthWarnings: depthCount(),
  };

  // Return to national; if the units were truly cleared they must not reappear.
  await setSelect('State / UT', { value: 'all' });
  await page.waitForTimeout(1500);
  res.interactions.returnFromState = { chipCount: await chipCount(), chips: await chipLabels() };
  res.checks.clearedAfterStateChange = res.interactions.returnFromState.chipCount === 0;

  // re-select one
  const n4 = await pickRegion('Nicobar', 'Nicobar');
  res.interactions.reselectAfterState = { chosen: n4, chipCount: await chipCount() };

  // ---- change YEAR (keep valid units) ----
  await setSelect('Reporting Year', { value: '2023' });
  res.interactions.changeYear = { chipCount: await chipCount(), url: page.url() };
  await setSelect('Reporting Year', { value: '2024' });

  // ---- change CATEGORY via dropdown (selection should persist) ----
  const catSel = page.locator('label:has-text("Crime Category") select').first();
  await catSel.selectOption({ value: 'custom' });
  await page.waitForTimeout(500);
  const catItems = page.locator('div[style*="max-height: 260px"] > div');
  const catCount = await catItems.count();
  let selectedCat = null;
  if (catCount > 1) {
    selectedCat = (await catItems.nth(1).innerText().catch(() => '')).split('\n')[0].trim();
    await catItems.nth(1).click();
    await page.waitForTimeout(1000);
  }
  res.interactions.changeCategory = { selectedCat, chipCount: await chipCount(), depthWarnings: depthCount() };

  // ---- change UNIT TYPE -> the administrative unit is no longer eligible and must clear ----
  // The Reporting Units options are derived from the served data, which is itself filtered
  // by unit type, so switch to "all" first to expose the other unit types.
  await setSelect('Reporting Units', { value: 'all' }).catch(() => {});
  await page.waitForTimeout(1500);
  await setSelect('Reporting Units', { value: 'city_police' }).catch(() => {});
  await page.waitForTimeout(2000);
  res.interactions.changeUnitType = {
    unitType: await page.locator('label:has-text("Reporting Units") select').first().inputValue().catch(() => null),
    chipCount: await chipCount(), chips: await chipLabels(),
  };
  res.checks.clearedAfterUnitTypeChange = res.interactions.changeUnitType.chipCount === 0;
  await setSelect('Reporting Units', { value: 'all' }).catch(() => {});
  await page.waitForTimeout(1200);
  await setSelect('Reporting Units', { value: 'administrative_district' }).catch(() => {});
  await page.waitForTimeout(1200);

  // ---- clear all then reselect ----
  const clearBtn = page.locator('button:has-text("Clear all")').first();
  if (await clearBtn.count()) { await clearBtn.click(); await page.waitForTimeout(500); }
  res.interactions.clearAll = { chipCount: await chipCount() };
  const n5 = await pickRegion('Nicobar', 'Nicobar');
  res.interactions.reselectAfterClear = { chosen: n5, chipCount: await chipCount() };

  // ---- idle 3s: measure repeated requests ----
  const dashBeforeIdle = dash;
  await page.waitForTimeout(3000);
  res.dashRequests.duringIdle3s = dash - dashBeforeIdle;

  // ---- deep link ----
  await page.goto(BASE + '/compare?year=2024&state=all&unitType=administrative_district&category=all&region=Nicobar',
    { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2200);
  res.interactions.deepLink = { chips: await chipLabels(), chipCount: await chipCount(), depthWarnings: depthCount() };

  // ---- navigate away and back ----
  await page.goto(BASE + '/trends', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1200);
  await page.goto(BASE + '/compare', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1800);
  res.interactions.navigateAwayBack = { chipCount: await chipCount(), depthWarnings: depthCount() };

  // ---- refetch transition: rapid year changes, verify controls not frozen ----
  await setSelect('Reporting Year', { value: '2022' });
  await setSelect('Reporting Year', { value: '2023' });
  await setSelect('Reporting Year', { value: '2024' });
  const yearVal = await page.locator('label:has-text("Reporting Year") select').first().inputValue().catch(() => null);
  res.interactions.refetchTransition = { finalYear: yearVal, responsive: yearVal === '2024', depthWarnings: depthCount() };

  await page.screenshot({ path: path.join(OUT, 'compare_' + (process.env.PHASE || 'phase') + '.png') });

  res.console = consoleSummary();
  res.status.completed = true;
  res.endedAt = new Date().toISOString();
  const file = 'summary_' + (process.env.PHASE || 'phase') + '.json';
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(res, null, 2));
  console.log(JSON.stringify(res, null, 2));
  await context.close();
  process.exit(0);
})().catch((err) => {
  res.fatal = String((err && err.stack) || err);
  res.status.interrupted = true;
  res.console = consoleSummary();
  try { fs.writeFileSync(path.join(OUT, 'summary_' + (process.env.PHASE || 'phase') + '.json'), JSON.stringify(res, null, 2)); } catch {}
  console.error('FATAL:', err);
  process.exit(1);
});
