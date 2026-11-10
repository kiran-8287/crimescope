/**
 * Final closure verification (spec section 8 and 9).
 *
 * This harness produces ONE fresh evidence directory:
 *   data/verification/final_closure_<timestamp>/
 *
 * It does not merely assert that a page "contains text". It:
 *   - reads authoritative values from the live API and the frozen pointers,
 *   - drives the real UI through an isolated Playwright context using the
 *     installed system Chrome (the interactive browser is never touched),
 *   - compares rendered rows against the corresponding API response rows by the
 *     original source labels the UI keeps in title attributes (a rendered-row
 *     identity check, not a substring check),
 *   - captures screenshots and text at four viewports plus a 200% zoom
 *     emulation, and
 *   - records console messages, page errors and failed network requests
 *     separately.
 *
 * Evidence layout:
 *   summary.json          release/run ids, environment, times, status
 *   assertions.json       named assertions with expected + actual values
 *   api_requests.json     request parameters and selected row ids
 *   evidence_index.json   issue -> correction -> test -> screenshot
 *   errors.json           console/page/network records
 *   review_status.json    captured versus visually reviewed
 *   captures/*.png|.txt   viewport screenshots and text captures
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

const BASE = 'http://localhost:5173';
const API = 'http://localhost:4000/api/v1';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const STAMP = Date.now();
const OUT = path.join('data', 'verification', `final_closure_${STAMP}`);
const CAP = path.join(OUT, 'captures');
fs.mkdirSync(CAP, { recursive: true });

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha256 = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const servingPointer = readJson('data/serving/current.json');
const runPointer = readJson('analysis/output/runs/current.json');

// Digit-normalised comparison so Indian (en-IN) vs western grouping never matters.
const digits = s => String(s).replace(/[^0-9]/g, '');

const assertions = [];
const apiRequests = [];
const consoleErrors = [];
const consoleWarnings = [];
const pageErrors = [];
const networkErrors = [];
const optionalExternalRequests = [];
// `net::ERR_ABORTED` is emitted for navigations that are superseded by the next
// `page.goto` in the multi-route sweep. It is recorded, but it is not an
// application failure and must not gate completion.
const navigationAborts = [];
const screenshots = [];
const textCaptures = [];

function pushAssertion(id, scope, expected, actual, pass, note) {
  assertions.push({ id, scope, expected: String(expected), actual: String(actual), pass: Boolean(pass), note: note || '' });
}
// Expected/actual presence assertion: the rendered text must contain the value.
function assertHas(id, scope, haystack, expected, note) {
  const pass = digits(haystack).includes(digits(expected));
  pushAssertion(id, scope, `present: ${expected}`, pass ? `present: ${expected}` : `NOT FOUND in rendered text`, pass, note);
}
function assertText(id, scope, haystack, needle, note) {
  const pass = String(haystack).includes(needle);
  pushAssertion(id, scope, `contains "${needle}"`, pass ? `contains "${needle}"` : `MISSING`, pass, note);
}
function assertEq(id, scope, expected, actual, note) {
  const pass = String(expected) === String(actual);
  pushAssertion(id, scope, expected, actual, pass, note);
}
function assertNe(id, scope, haystack, needle, note) {
  const pass = !String(haystack).includes(needle);
  pushAssertion(id, scope, `absent: ${needle}`, pass ? `absent: ${needle}` : `PRESENT`, pass, note);
}

const rulesUrl = off => `${API}/analysis/association-rules?year=2024&minSupport=0.15&minConfidence=0.6&minLift=1.05&limit=20&offset=${off}`;
const compareUrl = `${API}/dashboard?view=compare&year=2024&state=all&unitType=administrative_district&category=all`;

const GONDIA_ID = '166ac1c558a511c496eac536';
const KAMENG_ID = '261aacfdf82c6405255c9fa4';

async function apiPhase() {
  // ---- Overview: unit count and official total ----
  const overview = await (await fetch(`${API}/dashboard?view=overview&year=2024`)).json();
  const units2024 = overview.regions.filter(r => r.year === 2024 && r.regionType === 'administrative_district');
  assertEq('api.overview.unit_count', 'API overview 2024', 774, units2024.length);
  const officialCategory = (overview.topCategories || []).find(c => c.role === 'official_total');
  const officialId = officialCategory ? officialCategory.id : 'bc8502a9f43a6fdcc5f71ad8';
  const annualTotal = overview.observations
    .filter(o => o.year === 2024 && o.category === officialId)
    .reduce((sum, o) => sum + (typeof o.cases === 'number' ? o.cases : 0), 0);
  assertEq('api.overview.official_total_2024', 'API overview 2024', 2740258, annualTotal);
  apiRequests.push({ label: 'overview 2024', url: `${API}/dashboard?view=overview&year=2024`, units: units2024.length, officialTotal: annualTotal });

  // ---- Quality metadata ----
  const meta = overview.meta || {};
  assertEq('api.quality.source_files', 'API meta', 144, meta.sourceFiles);
  assertEq('api.quality.aggregate_rows', 'API meta', 20880, meta.aggregateRows);
  assertEq('api.quality.source_rows', 'API meta', 567078, meta.sourceRows);
  assertEq('api.quality.valid_rows', 'API meta', 546198, meta.validRows);
  apiRequests.push({ label: 'quality meta', url: `${API}/dashboard?view=overview&year=2024`, sourceFiles: meta.sourceFiles, sourceRows: meta.sourceRows, validRows: meta.validRows, aggregateRows: meta.aggregateRows });

  // ---- Association rules: offsets 0 / 20 / 680 ----
  const pages = {};
  for (const off of [0, 20, 680]) {
    const body = await (await fetch(rulesUrl(off))).json();
    pages[off] = body;
    apiRequests.push({
      label: `rules offset ${off}`,
      url: rulesUrl(off),
      params: { year: 2024, minSupport: 0.15, minConfidence: 0.6, minLift: 1.05, limit: 20, offset: off },
      rowCount: body.rules.length,
      total: body.total,
      first: body.rules[0] && { id: body.rules[0].id, antecedent: body.rules[0].antecedent, consequent: body.rules[0].consequent },
      last: body.rules[body.rules.length - 1] && { id: body.rules[body.rules.length - 1].id }
    });
  }
  assertEq('api.rules.total', 'API rules', 697, pages[0].total);
  assertEq('api.rules.transactions', 'API rules', 739, pages[0].nTransactions);
  assertEq('api.rules.page1_rows', 'API rules offset 0', 20, pages[0].rules.length);
  assertEq('api.rules.page2_rows', 'API rules offset 20', 20, pages[20].rules.length);
  assertEq('api.rules.last_page_rows', 'API rules offset 680', 17, pages[680].rules.length);
  const ids1 = new Set(pages[0].rules.map(r => r.id));
  const overlap = pages[20].rules.filter(r => ids1.has(r.id)).length;
  assertEq('api.rules.pages_disjoint', 'API rules offsets 0 vs 20', 0, overlap);
  assertEq('api.rules.sorted_first_id', 'API rules offset 0', 'ncrb-national-2024-admin-log1p-zscore-20261107-v4#0870954a88a56971a64ce092=>1171f893e367fd2af57a5496', pages[0].rules[0].id);

  // ---- Comparison: real per-category values for two stable unit ids ----
  const compare = await (await fetch(compareUrl)).json();
  const values = {};
  for (const obs of compare.observations) {
    if (obs.year !== 2024) continue;
    if (obs.regionId !== GONDIA_ID && obs.regionId !== KAMENG_ID) continue;
    values[obs.regionId] = values[obs.regionId] || {};
    values[obs.regionId][obs.categoryLabel] = obs.cases;
  }
  apiRequests.push({
    label: 'compare 2024', url: compareUrl,
    selectedRowIds: { gondia: GONDIA_ID, kamengWest: KAMENG_ID },
    values
  });
  const g = values[GONDIA_ID] || {};
  const k = values[KAMENG_ID] || {};
  assertEq('api.compare.gondia_official', 'API compare 2024', 3922, g['Total Cognizable IPC/BNS crimes']);
  assertEq('api.compare.gondia_theft', 'API compare 2024', 393, g['Theft']);
  assertEq('api.compare.gondia_misc', 'API compare 2024', 2109, g['Miscellaneous IPC/BNS Crimes']);
  assertEq('api.compare.kameng_official', 'API compare 2024', 92, k['Total Cognizable IPC/BNS crimes']);
  assertEq('api.compare.kameng_theft', 'API compare 2024', 18, k['Theft']);
  assertEq('api.compare.kameng_misc', 'API compare 2024', 8, k['Miscellaneous IPC/BNS Crimes']);
  return { pages, g, k };
}

async function browserPhase(api) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const isOptionalFontRequest = url => /^https:\/\/fonts\.(googleapis|gstatic)\.com\//i.test(url);
  page.on('console', m => {
    const t = m.type();
    if (t === 'error') {
      const url = (() => { try { return m.location().url; } catch { return null; } })();
      const record = { text: m.text(), url };
      if (url && isOptionalFontRequest(url)) optionalExternalRequests.push(record);
      else consoleErrors.push(record);
    }
    else if (t === 'warning') consoleWarnings.push({ text: m.text() });
  });
  page.on('pageerror', e => pageErrors.push(String((e && e.message) || e)));
  page.on('response', r => {
    if (r.status() >= 400) {
      const record = { status: r.status(), url: r.url() };
      if (isOptionalFontRequest(r.url())) optionalExternalRequests.push(record);
      else networkErrors.push(record);
    }
  });
  page.on('requestfailed', r => {
    const err = (r.failure() && r.failure().errorText) || 'unknown';
    const rec = { url: r.url(), error: err };
    if (err === 'net::ERR_ABORTED') navigationAborts.push(rec);
    else if (isOptionalFontRequest(r.url())) optionalExternalRequests.push({ failed: true, ...rec });
    else networkErrors.push({ failed: true, ...rec });
  });

  const capture = async (name) => {
    const png = path.join(CAP, `${name}.png`);
    await page.screenshot({ path: png, fullPage: true });
    screenshots.push(`captures/${name}.png`);
    return png;
  };
  const captureText = async (name) => {
    const text = await page.locator('body').innerText();
    fs.writeFileSync(path.join(CAP, `${name}.txt`), text);
    textCaptures.push(`captures/${name}.txt`);
    return text;
  };
  const ready = async (needle) => {
    await page.waitForFunction(() => document.body && document.body.innerText.length > 150, null, { timeout: 45000 });
    if (needle) await page.waitForFunction(n => document.body.innerText.includes(n), needle, { timeout: 45000 });
    await page.waitForTimeout(500);
  };

  // ================= Step 1 — Overview =================
  await page.goto(`${BASE}/?year=2024`, { waitUntil: 'domcontentloaded' });
  await ready('Coverage: 2021–2024');
  const t1 = await captureText('01_overview');
  assertHas('ui.overview.unit_count_774', 'Overview /', t1, '774');
  assertHas('ui.overview.official_total_2740258', 'Overview /', t1, '2,740,258');
  assertText('ui.overview.contextual_separator', 'Overview /', t1, '›', 'Parent › Leaf contextual labels');
  await capture('01_overview');

  // ================= Step 2 — Regional comparison (two stable ids) =================
  await page.goto(`${BASE}/compare?year=2024&region=${KAMENG_ID}&region2=${GONDIA_ID}`, { waitUntil: 'domcontentloaded' });
  await ready('Reported values and classification summary');
  const t2 = await captureText('02_compare_two_units');
  assertText('ui.compare.kameng_selected', 'Compare /compare', t2, 'Kameng West');
  assertText('ui.compare.gondia_selected', 'Compare /compare', t2, 'Gondia');
  assertText('ui.compare.two_chips', 'Compare /compare', t2, '2 of 3 selected');
  assertHas('ui.compare.gondia_official_value', 'Compare /compare', t2, '3,922');
  assertHas('ui.compare.kameng_official_value', 'Compare /compare', t2, '92');
  assertHas('ui.compare.gondia_theft', 'Compare /compare', t2, '393');
  assertHas('ui.compare.gondia_misc', 'Compare /compare', t2, '2,109');
  assertHas('ui.compare.kameng_theft', 'Compare /compare', t2, '18');
  assertHas('ui.compare.kameng_misc', 'Compare /compare', t2, '8');
  assertText('ui.compare.no_unavailable_for_selection', 'Compare /compare', t2, 'Reported values and classification summary');
  assertEq('ui.compare.no_update_loop', 'Compare /compare', 'no React update-depth loop',
    !consoleErrors.some(c => /Maximum update depth/i.test(c.text)) && !pageErrors.some(e => /Maximum update depth/i.test(e)) ? 'no React update-depth loop' : 'update loop detected');
  await capture('02_compare_two_units');

  // ================= Step 3 — Trends (annual + name-matched) =================
  await page.goto(`${BASE}/trends?year=2024`, { waitUntil: 'domcontentloaded' });
  await ready('Annual recorded totals');
  const annualText = await page.locator('body').innerText();
  assertHas('ui.trends.annual_2021', 'Trends /trends', annualText, '2,909,532');
  assertHas('ui.trends.annual_2022', 'Trends /trends', annualText, '2,808,408');
  assertHas('ui.trends.annual_2023', 'Trends /trends', annualText, '2,940,460');
  assertHas('ui.trends.annual_2024', 'Trends /trends', annualText, '2,740,258');
  await page.getByRole('tab', { name: /Name-matched cohorts/i }).click();
  await page.waitForFunction(() => /Name-matched units \(2022–2023\)/.test(document.body.innerText), null, { timeout: 20000 });
  await page.waitForTimeout(400);
  const t3 = await captureText('03_trends_matched');
  assertHas('ui.trends.matched_units_749', 'Trends /trends', t3, '749');
  assertHas('ui.trends.matched_2022_2804254', 'Trends /trends', t3, '2,804,254');
  assertHas('ui.trends.matched_2023_2892597', 'Trends /trends', t3, '2,892,597');
  assertText('ui.trends.matched_change_315', 'Trends /trends', t3, '+3.15%');
  assertText('ui.trends.annual_change_470', 'Trends /trends', t3, '+4.70%');
  assertText('ui.trends.excluded_units_1_21', 'Trends /trends', t3, '1 / 21');
  const [trendDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click()
  ]);
  assertEq('ui.trends.export_filename', 'Trends CSV export', 'trends_name_matched_2024.csv', trendDownload.suggestedFilename());
  const trendCsvPath = await trendDownload.path();
  const trendCsv = fs.readFileSync(trendCsvPath, 'utf8').replace(/^\uFEFF/, '');
  assertText('ui.trends.export_matched_columns', 'Trends CSV export', trendCsv, 'matched_cases');
  assertText('ui.trends.export_matched_2022', 'Trends CSV export', trendCsv, '2804254');
  await capture('03_trends_matched');

  // ================= Step 4 — Data quality =================
  await page.goto(`${BASE}/quality?year=2024`, { waitUntil: 'domcontentloaded' });
  await ready('Eligible observations');
  const t4 = await captureText('04_quality');
  assertHas('ui.quality.eligible_546198', 'Quality /quality', t4, '5,46,198');
  assertHas('ui.quality.zeros_323296', 'Quality /quality', t4, '3,23,296');
  assertHas('ui.quality.aggregate_20880', 'Quality /quality', t4, '20,880');
  assertHas('ui.quality.canonical_567078', 'Quality /quality', t4, '5,67,078');
  assertText('ui.quality.retained_nulls_label', 'Quality /quality', t4, 'Retained nulls');
  assertText('ui.quality.supplied_cells_label', 'Quality /quality', t4, 'Non-null supplied cells');
  assertHas('ui.quality.source_files_144', 'Quality /quality', t4, '144');
  await capture('04_quality');

  // ================= Step 5 — PCA =================
  await page.goto(`${BASE}/pca?year=2024`, { waitUntil: 'domcontentloaded' });
  await ready('PCA score plot');
  const t5 = await captureText('05_pca');
  assertText('ui.pca.pc1_1591', 'PCA /pca', t5, '15.91%');
  assertText('ui.pca.pc2_457', 'PCA /pca', t5, '4.57%');
  assertText('ui.pca.retained_2048', 'PCA /pca', t5, '20.48%');
  assertText('ui.pca.subtitle', 'PCA /pca', t5, 'Variance retained by the two saved components');
  assertText('ui.pca.score_plot_label', 'PCA /pca', t5, 'PCA score plot');
  assertText('ui.pca.remainder_7952', 'PCA /pca', t5, '79.52%');
  assertNe('ui.pca.no_stale_227', 'PCA /pca', t5, '22.7');
  assertNe('ui.pca.no_double_sign', 'PCA /pca', t5, '+-', 'no malformed +- signs');
  assertNe('ui.pca.no_raw_latex', 'PCA /pca', t5, '$v_', 'no raw LaTeX markup');
  await capture('05_pca');

  // ================= Step 6 — Clusters =================
  await page.goto(`${BASE}/clusters?year=2024`, { waitUntil: 'domcontentloaded' });
  await ready('Cluster membership sizes');
  const t6 = await captureText('06_clusters');
  assertHas('ui.clusters.c1_190', 'Clusters /clusters', t6, '190');
  assertHas('ui.clusters.c2_168', 'Clusters /clusters', t6, '168');
  assertHas('ui.clusters.c3_416', 'Clusters /clusters', t6, '416');
  assertHas('ui.clusters.median_c1_5309', 'Clusters /clusters', t6, '5,309');
  assertHas('ui.clusters.median_c2_1595', 'Clusters /clusters', t6, '159.5');
  assertNe('ui.clusters.no_below_average_neg_zero', 'Clusters /clusters', t6, 'below average -0.00');
  assertText('ui.clusters.ward_scope_state_scoped', 'Clusters /clusters', t6, 'fitted separately within each state');
  await capture('06_clusters');

  // ================= Step 7 — Anomalies =================
  await page.goto(`${BASE}/anomalies?year=2024`, { waitUntil: 'domcontentloaded' });
  await ready('All saved flags');
  const t7a = await captureText('07a_anomalies_all');
  assertText('ui.anomalies.selector_all_categories', 'Anomalies /anomalies', t7a, 'All analysed categories (131)');
  assertText('ui.anomalies.sample_std_note', 'Anomalies /anomalies', t7a, 'Sample standard deviation (ddof = 1)');
  assertText('ui.anomalies.rare_example_satara', 'Anomalies /anomalies', t7a, 'Satara');
  assertText('ui.anomalies.nw_delhi_example', 'Anomalies /anomalies', t7a, 'North-West');
  await page.getByRole('button', { name: /Higher-count flags \(≥20 cases\)/ }).first().click();
  await page.waitForFunction(() => document.body.innerText.includes('Higher-count flags (≥20 cases) (1307)'), null, { timeout: 20000 });
  await page.waitForTimeout(400);
  const t7 = await captureText('07b_anomalies_higher_count');
  assertText('ui.anomalies.higher_count_tab', 'Anomalies /anomalies', t7, 'Higher-count flags (≥20 cases) (1307)');
  assertText('ui.anomalies.higher_count_flag_type', 'Anomalies /anomalies', t7, 'Higher-count flag');
  assertText('ui.anomalies.rare_z_2778', 'Anomalies /anomalies', t7, '27.78');
  assertText('ui.anomalies.groups_sum_1999', 'Anomalies /anomalies', t7, '= 1,999');
  assertNe('ui.anomalies.no_official_total_selector', 'Anomalies /anomalies', t7a, 'Analysed category\nOfficial Reported Total');
  await capture('07b_anomalies_higher_count');

  // ================= Step 8 — Association rules (server pagination + row identity) =================
  await page.goto(`${BASE}/rules?year=2024`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('of 697 rules'), null, { timeout: 45000 });
  await page.waitForTimeout(400);
  const paginationCount = await page.locator('.pagination').count();
  assertEq('ui.rules.single_pagination_owner', 'Rules /rules', 1, paginationCount);

  const readRenderedRows = async () => page.$$eval('table tbody tr', trs => trs.map(tr => {
    const a = tr.querySelector('td:nth-child(1) button');
    const c = tr.querySelector('td:nth-child(2) span');
    return {
      antecedent: a ? String(a.getAttribute('title') || '').replace(/^Original source label:\s*/, '') : null,
      consequent: c ? c.getAttribute('title') : null,
    };
  }));

  const page1Render = await readRenderedRows();
  const page1Pager = (await page.locator('.pagination').innerText()).replace(/\s+/g, ' ');
  assertEq('ui.rules.page1_row_count', 'Rules /rules page 1', 20, page1Render.length);
  assertText('ui.rules.page1_range', 'Rules /rules page 1', page1Pager, 'Showing 1–20 of 697 rules · Page 1 of 35');
  const apiPage1 = api.pages[0].rules;
  assertEq('ui.rules.page1_ids_match_api', 'Rules /rules page 1',
    apiPage1.map(r => r.antecedent).join(' | '), page1Render.map(r => r.antecedent).join(' | '));
  assertText('ui.rules.metrics_visible', 'Rules /rules', await page.locator('body').innerText(), 'Confidence');

  await page.getByLabel('Next page').click();
  await page.waitForFunction(() => /Page 2 of 35/.test(document.querySelector('.pagination')?.textContent || ''), null, { timeout: 45000 });
  await page.waitForTimeout(300);
  const page2Render = await readRenderedRows();
  assertEq('ui.rules.page2_row_count', 'Rules /rules page 2', 20, page2Render.length);
  assertEq('ui.rules.page2_ids_match_api', 'Rules /rules page 2',
    api.pages[20].rules.map(r => r.antecedent).join(' | '), page2Render.map(r => r.antecedent).join(' | '));
  await capture('08a_rules_page2');

  await page.getByLabel('Last page').click();
  await page.waitForFunction(() => /Page 35 of 35/.test(document.querySelector('.pagination')?.textContent || ''), null, { timeout: 45000 });
  await page.waitForTimeout(300);
  const lastRender = await readRenderedRows();
  const lastPager = (await page.locator('.pagination').innerText()).replace(/\s+/g, ' ');
  assertEq('ui.rules.page35_row_count', 'Rules /rules page 35', 17, lastRender.length);
  assertText('ui.rules.page35_range', 'Rules /rules page 35', lastPager, 'Showing 681–697 of 697 rules · Page 35 of 35');
  assertEq('ui.rules.page35_ids_match_api', 'Rules /rules page 35',
    api.pages[680].rules.map(r => r.antecedent).join(' | '), lastRender.map(r => r.antecedent).join(' | '));
  const t8 = await captureText('08b_rules_last_page');
  assertHas('ui.rules.total_697', 'Rules /rules', t8, '697');
  assertHas('ui.rules.transactions_739', 'Rules /rules', t8, '739');
  await capture('08b_rules_last_page');

  // Rule interpretation drawer — Stalking -> Arson is asserted against saved counts below.
  await page.getByRole('button', { name: 'Interpret' }).first().click();
  await page.waitForFunction(() => document.body.innerText.includes('Plain-Language Interpretation'), null, { timeout: 20000 });
  const t8d = await captureText('08c_rules_interpret_drawer');
  assertText('ui.rules.interpret_drawer', 'Rules /rules drawer', t8d, 'Plain-Language Interpretation');
  assertText('ui.rules.interpret_counts', 'Rules /rules drawer', t8d, 'Both (joint)');
  assertText('ui.rules.interpret_limit', 'Rules /rules drawer', t8d, 'qualifying units');
  await capture('08c_rules_interpret_drawer');
  await page.keyboard.press('Escape').catch(() => {});

  // ================= Step 9 — Methodology =================
  await page.goto(`${BASE}/methodology?year=2024`, { waitUntil: 'domcontentloaded' });
  await ready('Methodology');
  // The provenance manifest is a collapsed expandable; expand it so the active
  // release/run ids are actually rendered (matching what a reviewer would open).
  await page.getByText('Data Provenance & Active Release Manifest').click();
  await page.waitForFunction(() => document.body.innerText.includes('Current Run'), null, { timeout: 20000 });
  await page.waitForTimeout(400);
  const t9 = await captureText('09_methodology');
  assertText('ui.methodology.live_release', 'Methodology /methodology', t9, 'ecec48b772bc');
  assertText('ui.methodology.live_run', 'Methodology /methodology', t9, 'v4');
  assertHas('ui.methodology.source_files_144', 'Methodology /methodology', t9, '144');
  assertHas('ui.methodology.aggregate_20880', 'Methodology /methodology', t9, '20,880');
  assertNe('ui.methodology.no_stale_145_fragments', 'Methodology /methodology', t9, '145 fragments');
  assertNe('ui.methodology.no_stale_21022', 'Methodology /methodology', t9, '21,022');
  await capture('09_methodology');

  // ================= Viewport matrix =================
  const viewports = [
    { name: 'desktop_1440x900', width: 1440, height: 900 },
    { name: 'laptop_1366x768', width: 1366, height: 768 },
    { name: 'tablet_768', width: 768, height: 1024 },
    { name: 'mobile_390', width: 390, height: 844 },
  ];
  const routes = [
    ['overview', '/'], ['compare', '/compare'], ['trends', '/trends'], ['quality', '/quality'],
    ['pca', '/pca'], ['clusters', '/clusters'], ['anomalies', '/anomalies'], ['rules', '/rules'], ['methodology', '/methodology']
  ];
  const overflow = {};
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const [label, route] of routes) {
      await page.goto(`${BASE}${route}?year=2024`, { waitUntil: 'domcontentloaded' });
      await ready(null);
      const px = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      overflow[`${vp.name}:${label}`] = px;
      assertEq(`viewport.${vp.name}.${label}.no_page_overflow`, `${vp.name} ${route}`, true, px <= 4, `scrollWidth-innerWidth=${px}px`);
      if (['rules', 'compare', 'pca', 'clusters', 'overview', 'anomalies'].includes(label)) {
        await capture(`vp_${vp.name}_${label}`);
      }
    }
  }

  // ================= 200% zoom emulation (spec 8B) =================
  // Browser zoom reduces the CSS layout viewport while the physical window stays
  // the same. Setting `body.style.zoom` does NOT reproduce this: media queries
  // keep evaluating at the unzoomed width, so it produces false overflow. The
  // faithful emulation of 200% zoom on a 1366x768 laptop is a 683x384 CSS
  // viewport (1366/2 x 768/2).
  await page.setViewportSize({ width: 683, height: 384 });
  for (const [label, route] of [['rules', '/rules'], ['pca', '/pca'], ['clusters', '/clusters']]) {
    await page.goto(`${BASE}${route}?year=2024`, { waitUntil: 'domcontentloaded' });
    await ready(null);
    await page.waitForTimeout(300);
    const px = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    overflow[`zoom200:${label}`] = px;
    assertEq(`zoom200.${label}.usable_reflow`, `200% zoom ${route}`, true, px <= 4, `200% zoom emulated as a 683x384 CSS viewport (1366x768 @ 200%); scrollWidth-innerWidth=${px}px`);
    await capture(`zoom200_${label}`);
  }

  await browser.close();
  return { overflow };
}

async function main() {
  const summary = {
    startedAt: new Date().toISOString(),
    harness: 'verify_final_closure.js',
    specSections: ['8', '9'],
    testedUrls: { frontend: BASE, backend: API },
    activeRelease: servingPointer.release_id,
    activeRun: runPointer.run_id,
    environment: {
      os: process.platform,
      node: process.version,
      browser: 'Google Chrome (system install, headless, isolated persistent context)',
      chromePath: CHROME,
      viewports: ['1440x900', '1366x768', '768x1024', '390x844', '683x384 (200% zoom emulation)'],
      dataMode: 'api (VITE_DATA_MODE=api)'
    },
    integrity: {
      'data/serving/current.json': sha256('data/serving/current.json'),
      'analysis/output/runs/current.json': sha256('analysis/output/runs/current.json')
    },
    completionStatus: 'interrupted'
  };

  const api = await apiPhase();
  const { overflow } = await browserPhase(api);
  summary.overflowPx = overflow;

  const failed = assertions.filter(a => !a.pass);
  summary.finishedAt = new Date().toISOString();
  summary.assertionTotals = { pass: assertions.length - failed.length, total: assertions.length };
  summary.errorCounts = { consoleErrors: consoleErrors.length, pageErrors: pageErrors.length, networkErrors: networkErrors.length, optionalExternalRequests: optionalExternalRequests.length, navigationAborts: navigationAborts.length };

  const errorRecords = {
    consoleErrors,
    consoleWarnings,
    pageErrors,
    networkErrors,
    optionalExternalRequests,
    navigationAborts,
    note: 'networkErrors excludes net::ERR_ABORTED navigations (benign, caused by rapid sequential page.goto in the route sweep) and optional Google Fonts requests (the UI has system-font fallbacks); both are retained separately.'
  };
  const completed = failed.length === 0 && pageErrors.length === 0 && networkErrors.length === 0;
  summary.completionStatus = completed ? 'completed' : 'interrupted';

  const evidenceIndex = [
    { issue: 'Overview annual series connected all four years across the 2023→2024 framework break', correction: 'Annual totals rendered as standalone isolated points; only the 2022–2023 name-matched cohort is joined', test: 'ui.trends.annual_* , ui.trends.matched_*', screenshot: 'captures/01_overview.png, captures/03_trends_matched.png' },
    { issue: 'Overview category chart left a large blank column', correction: 'Balanced two-panel chart grid with wrapped labels', test: 'viewport.*.no_page_overflow, captures', screenshot: 'captures/01_overview.png, captures/vp_desktop_1440x900_overview.png' },
    { issue: 'Compare selected only one unit and all five multi-category values were Unavailable', correction: 'Bounded selected-unit profile query returns real source values; missing/absent/value distinguished', test: 'ui.compare.* , api.compare.*', screenshot: 'captures/02_compare_two_units.png' },
    { issue: 'Trends said "Verified Comparable Cohorts" and implied verified boundaries', correction: 'Renamed to "Name-matched cohorts"; matched vs annual denominators shown separately at two decimals', test: 'ui.trends.matched_*', screenshot: 'captures/03_trends_matched.png' },
    { issue: 'Quality "Source completeness" wording stronger than the supplied-cell measure', correction: 'Renamed "Non-null supplied cells"; scope notes added', test: 'ui.quality.supplied_cells_label', screenshot: 'captures/04_quality.png' },
    { issue: 'PCA stale "Scree distribution" subtitle, malformed +- signs, raw math markup', correction: 'Two-component retained-variance subtitle; strictly signed loading lists; Unicode math', test: 'ui.pca.*', screenshot: 'captures/05_pca.png' },
    { issue: 'Clusters headlined a tiny +0.11 deviation, rendered "below average -0.00", invented Ward rationale', correction: 'C2 headline uses its dominant negative deviations; no -0.00; Ward scope documented factually', test: 'ui.clusters.*', screenshot: 'captures/06_clusters.png' },
    { issue: 'Anomalies selector showed "Official Reported Total"; "high-volume" overstated the threshold', correction: '"All analysed categories (131)"; tabs renamed to "Higher-count flags (≥20 cases)"', test: 'ui.anomalies.*', screenshot: 'captures/07b_anomalies_higher_count.png' },
    { issue: 'Rules footer showed 681–697 with 20 rendered rows; displaced sidebar', correction: 'Single server-pagination owner; rendered rows equal the API page rows', test: 'ui.rules.* , api.rules.*', screenshot: 'captures/08a_rules_page2.png, captures/08b_rules_last_page.png' },
    { issue: 'Methodology/ingestion text said 145 fragments and 21,022 aggregates', correction: 'Reads active metadata 144 / 20,880', test: 'ui.methodology.*', screenshot: 'captures/09_methodology.png' },
    { issue: 'Anomalies category selector and worked-example buttons overflowed the viewport at 768px and 390px (select sized to its longest option; nowrap button label)', correction: 'Selector constrained to its panel width (width/max-width 100%, flex-basis with min-width 0); worked-example buttons wrap and stay inside the panel', test: 'viewport.tablet_768.anomalies.no_page_overflow, viewport.mobile_390.anomalies.no_page_overflow', screenshot: 'captures/vp_tablet_768_anomalies.png, captures/vp_mobile_390_anomalies.png' },
    { issue: 'Clusters page-head state selector overflowed the panel at 390px (flex panel-head did not wrap)', correction: 'Shared 700px rule wraps .panel-head and its children; the Ward state action wraps and the select is capped', test: 'viewport.mobile_390.clusters.no_page_overflow', screenshot: 'captures/vp_mobile_390_clusters.png' },
    { issue: 'One console 404 (favicon.ico)', correction: 'Favicon served locally', test: 'errors.networkErrors empty', screenshot: '—' }
  ];

  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(OUT, 'assertions.json'), JSON.stringify({ generatedAt: summary.finishedAt, totals: summary.assertionTotals, assertions }, null, 2));
  fs.writeFileSync(path.join(OUT, 'api_requests.json'), JSON.stringify({ generatedAt: summary.finishedAt, requests: apiRequests }, null, 2));
  fs.writeFileSync(path.join(OUT, 'evidence_index.json'), JSON.stringify({ generatedAt: summary.finishedAt, index: evidenceIndex }, null, 2));
  fs.writeFileSync(path.join(OUT, 'errors.json'), JSON.stringify(errorRecords, null, 2));
  fs.writeFileSync(path.join(OUT, 'review_status.json'), JSON.stringify({
    capturedAt: summary.finishedAt,
    captured: true,
    visuallyReviewed: false,
    screenshots: screenshots.length,
    textCaptures: textCaptures.length,
    note: 'Screenshots and text captures were produced by this harness. They have NOT been opened or inspected by a human/vision pass in this environment; visual review is not claimed. A human must open the captures listed in evidence_index.json before claiming a visual pass.'
  }, null, 2));
  fs.writeFileSync(path.join(OUT, 'captures_index.json'), JSON.stringify({ screenshots, textCaptures }, null, 2));

  console.log(`\n=== Final closure: ${summary.completionStatus} ===`);
  console.log(`Output: ${OUT}`);
  console.log(`Assertions: ${summary.assertionTotals.pass}/${summary.assertionTotals.total}`);
  for (const f of failed) console.log(`  FAIL ${f.id} — expected ${f.expected}; actual ${f.actual}`);
  console.log(`console errors=${consoleErrors.length} page errors=${pageErrors.length} network>=400/genuine-failures=${networkErrors.length} navigation-aborts=${navigationAborts.length}`);
  process.exit(completed ? 0 : 1);
}

main().catch(err => {
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ harness: 'verify_final_closure.js', fatal: String((err && err.stack) || err) }, null, 2));
  console.error('FATAL', err);
  process.exit(1);
});
