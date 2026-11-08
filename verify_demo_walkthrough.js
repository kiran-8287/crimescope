/**
 * Demo rehearsal walkthrough.
 *
 * Follows docs/demo_run_sheet.md step 1..9 IN ORDER using an isolated Playwright
 * context with the installed system Chrome (the interactive browser is not
 * touched). Records the AUTOMATED duration of each step separately from any human
 * speaking time, captures a screenshot and the rendered page text per step, and
 * asserts the demo sheet's expected values against the DOM (digit-normalised so
 * Indian vs western digit grouping does not matter).
 *
 * Evidence -> data/verification/demo_walkthrough_<timestamp>/
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5173';
const API = 'http://localhost:4000/api/v1';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = path.join('data', 'verification', `demo_walkthrough_${Date.now()}`);
fs.mkdirSync(OUT, { recursive: true });

const digits = s => String(s).replace(/[^0-9]/g, '');
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const servingPointer = JSON.parse(fs.readFileSync('data/serving/current.json', 'utf8'));
const runPointer = JSON.parse(fs.readFileSync('analysis/output/runs/current.json', 'utf8'));

const results = {
  startedAt: new Date().toISOString(),
  testedUrl: BASE,
  activeRelease: servingPointer.release_id,
  activeRun: runPointer.run_id,
  steps: [],
  consoleErrors: [],
  pageErrors: [],
  status: 'interrupted',
};

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') results.consoleErrors.push(m.text()); });
  page.on('pageerror', e => results.pageErrors.push(String((e && e.message) || e)));

  const waitStable = async () => {
    await page.waitForFunction(() => document.body && document.body.innerText.length > 150, null, { timeout: 45000 });
    await page.waitForTimeout(800);
  };

  let current = null;
  const step = async (n, name, route, fn) => {
    current = { step: n, name, route, checks: {}, startedAt: new Date().toISOString() };
    const t0 = Date.now();
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await waitStable();
    if (fn) await fn(page);
    const text = await page.locator('body').innerText();
    fs.writeFileSync(path.join(OUT, `step${n}_text.txt`), text);
    await page.screenshot({ path: path.join(OUT, `step${n}.png`), fullPage: true });
    current.screenshot = `step${n}.png`;
    current.textFile = `step${n}_text.txt`;
    const d = digits(text);
    current.has = {
      pca_pc1: text.includes('15.9'),
      pca_pc2: text.includes('4.6'),
      pca_cum: text.includes('20.5'),
    };
    current.autoDurationMs = Date.now() - t0;
    results.steps.push(current);
    console.log(`[step ${n}] ${name} — auto ${current.autoDurationMs} ms`);
  };
  const assertDigits = (label, text, needle) => { current.checks[label] = digits(text).includes(digits(needle)); };
  const assertText = (label, text, needle) => { current.checks[label] = text.includes(needle); };

  // ---- 1 Overview ----
  await step(1, 'Overview', '/', async p => {
    const yr = p.locator('select').first();
    if (await yr.count()) await yr.selectOption('2024').catch(() => {});
  });
  {
    const t = fs.readFileSync(path.join(OUT, 'step1_text.txt'), 'utf8');
    assertDigits('has_774_units', t, '774');
    assertDigits('has_2024_total_2740258', t, '2,740,258');
    assertText('has_contextual_marker', t, '›');
  }

  // ---- 2 Regional Comparison ----
  await step(2, 'Regional Comparison', '/compare', async p => {
    const search = p.locator('input[placeholder*="Type district"]').first();
    if (await search.count()) {
      await search.fill('Gondia');
      await p.waitForTimeout(600);
      await p.getByText('Gondia', { exact: false }).first().click().catch(() => {});
      await p.waitForTimeout(800);
    }
  });
  {
    const t = fs.readFileSync(path.join(OUT, 'step2_text.txt'), 'utf8');
    assertText('compare_table_or_units', t, 'Gondia');
    results.steps[1].checks.no_update_loop =
      !results.consoleErrors.some(c => /Maximum update depth/i.test(c)) &&
      !results.pageErrors.some(e => /Maximum update depth/i.test(e));
  }

  // ---- 3 Trends ----
  let annualText = '';
  await step(3, 'Trends', '/trends', async p => {
    annualText = await p.locator('body').innerText();
    fs.writeFileSync(path.join(OUT, 'step3_annual_text.txt'), annualText);
    await p.getByRole('button', { name: /Verified Comparable Cohorts/ }).first().click().catch(() => {});
    await p.waitForTimeout(800);
  });
  {
    const t = fs.readFileSync(path.join(OUT, 'step3_text.txt'), 'utf8');
    assertDigits('annual_2023_2940460', annualText, '2,940,460');
    assertDigits('annual_2022_2808408', annualText, '2,808,408');
    assertDigits('annual_2021_2909532', annualText, '2,909,532');
    assertDigits('annual_2024_2740258', annualText, '2,740,258');
    assertDigits('matched_749', t, '749');
    assertDigits('matched_2022_2804254', t, '2,804,254');
    assertDigits('matched_2023_2892597', t, '2,892,597');
    results.steps[2].checks.matched_pct_label = /749 matched units \(3\.2% change\)/.test(t);
    results.steps[2].note = 'the cohort tab renders the matched label as "(3.2% change)" — the exact ratio is 3.1503% (≈3.15%), rounded to 1 dp on screen; annual +4.70% is derivable from the two verified annual totals.';
  }

  // ---- 4 Data Quality ----
  await step(4, 'Data Quality', '/quality');
  {
    const t = fs.readFileSync(path.join(OUT, 'step4_text.txt'), 'utf8');
    assertDigits('retained_546198', t, '546,198');
    assertDigits('aggregate_20880', t, '20,880');
    assertDigits('zeros_323296', t, '3,23,296');
    assertText('nulls_label', t, 'Missing / null values');
    results.steps[3].note = 'canonical 567,078 = 546,198 + 20,880 (both displayed); the page does not print it as one figure.';
  }

  // ---- 5 PCA ----
  await step(5, 'PCA', '/pca');
  {
    const t = fs.readFileSync(path.join(OUT, 'step5_text.txt'), 'utf8');
    assertText('pc1_159', t, '15.9');
    assertText('pc2_46', t, '4.6');
    assertText('cum_205', t, '20.5');
    assertText('score_plot_label', t, 'PCA Score Plot');
    results.steps[4].checks.no_stale_227 = !t.includes('22.7');
  }

  // ---- 6 Clusters ----
  await step(6, 'Clusters', '/clusters', async p => {
    const kSel = p.locator('select').filter({ hasText: 'k = 3' }).first();
    if (await kSel.count()) await kSel.selectOption('3').catch(() => {});
    await p.waitForTimeout(500);
  });
  {
    const t = fs.readFileSync(path.join(OUT, 'step6_text.txt'), 'utf8');
    assertDigits('size_190', t, '190');
    assertDigits('size_168', t, '168');
    assertDigits('size_416', t, '416');
  }

  // ---- 7 Anomalies ----
  await step(7, 'Anomalies', '/anomalies', async p => {
    await p.getByRole('button', { name: /High-Volume Outliers/ }).first().click().catch(() => {});
    await p.waitForTimeout(800);
  });
  {
    const t = fs.readFileSync(path.join(OUT, 'step7_text.txt'), 'utf8');
    results.steps[6].checks.rare_z_2778 = t.includes('27.78');
    results.steps[6].checks.high_volume_tab = t.includes('High-Volume Outliers (≥20 cases) (1307)');
    results.steps[6].checks.high_volume_rows = t.includes('High Recorded Volume');
    results.steps[6].checks.sample_std_note = /n−1 denominator/.test(t);
    results.steps[6].note = 'the high-volume tab lists flagged rows by descending z (top row ≈ +27.65σ); the documented z = 10.8875 instance is a saved-artifact value (findings), not the first-page row.';
  }

  // ---- 8 Association Rules ----
  await step(8, 'Association Rules', '/rules', async p => {
    await p.waitForFunction(() => document.body.innerText.includes('of 697 rules'), null, { timeout: 45000 });
    current.checks.pagination_owner = (await p.locator('.pagination').count()) === 1;
    await p.getByLabel('Next page').click().catch(() => {});
    await p.waitForFunction(() => /Page 2 of 35/.test(document.querySelector('.pagination')?.textContent || ''), null, { timeout: 45000 }).catch(() => {});
    current.checks.page2 = /Page 2 of 35/.test(await p.locator('.pagination').innerText());
    await p.getByLabel('Last page').click().catch(() => {});
    await p.waitForFunction(() => /Page 35 of 35/.test(document.querySelector('.pagination')?.textContent || ''), null, { timeout: 45000 }).catch(() => {});
    current.checks.last_page = /Page 35 of 35/.test(await p.locator('.pagination').innerText());
  });
  {
    const t = fs.readFileSync(path.join(OUT, 'step8_text.txt'), 'utf8');
    assertDigits('rules_697', t, '697');
    assertDigits('rules_739_transactions', t, '739');
  }

  // ---- 9 Methodology ----
  await step(9, 'Methodology', '/methodology', async p => {
    await p.getByText('Data Provenance & Active Release Manifest').first().click().catch(() => {});
    await p.waitForTimeout(600);
  });
  {
    const t = fs.readFileSync(path.join(OUT, 'step9_text.txt'), 'utf8');
    assertText('live_release', t, 'ecec48b772bc');
    assertText('run_label', t, 'Current Run');
    assertText('live_run_v4', t, 'v4');
  }

  await browser.close();
  results.finishedAt = new Date().toISOString();
  results.automatedWalkthroughMs = results.steps.reduce((a, s) => a + s.autoDurationMs, 0);
  results.checkTotals = (() => {
    let pass = 0, total = 0;
    for (const s of results.steps) for (const v of Object.values(s.checks)) { total++; if (v) pass++; }
    return { pass, total };
  })();
  results.note = 'autoDurationMs is machine wall-clock only; it excludes human speaking time in the 8-10 min demo.';
  const allPass = results.checkTotals.pass === results.checkTotals.total && results.pageErrors.length === 0;
  results.status = allPass ? 'completed' : 'interrupted';
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 2));
  console.log(`\n=== Demo walkthrough: ${results.status} ===`);
  console.log(`Output: ${OUT}`);
  console.log(`Checks: ${results.checkTotals.pass}/${results.checkTotals.total}; automated duration ${results.automatedWalkthroughMs} ms`);
  for (const s of results.steps) for (const [k, v] of Object.entries(s.checks)) if (!v) console.log(`  FAIL step${s.step} ${k}`);
  console.log(`console errors=${results.consoleErrors.length} page errors=${results.pageErrors.length}`);
  process.exit(results.status === 'completed' ? 0 : 1);
}

main().catch(err => {
  results.finishedAt = new Date().toISOString();
  results.fatal = String((err && err.stack) || err);
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 2));
  console.error('FATAL', err);
  process.exit(1);
});
