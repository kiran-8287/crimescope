/**
 * Phase 4 focused browser verification.
 *
 * Uses an isolated Playwright context with the installed system Chrome. Opens
 * real pages, records console warnings, console errors and uncaught page errors
 * SEPARATELY, captures screenshots at desktop and narrow viewports, and asserts
 * displayed values against the active release/run artifacts.
 *
 * Evidence is written to data/verification/phase4_<timestamp>/summary.json.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5173';
const API = 'http://localhost:4000/api/v1';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = path.join('data', 'verification', `phase4_${Date.now()}`);
fs.mkdirSync(OUT, { recursive: true });

const servingPointer = JSON.parse(fs.readFileSync('data/serving/current.json', 'utf8'));
const runPointer = JSON.parse(fs.readFileSync('analysis/output/runs/current.json', 'utf8'));
const runDir = path.dirname(runPointer.manifest);

const readKmeans = k => JSON.parse(fs.readFileSync(path.join(runDir, 'kmeans', `kmeans_2024_k${k}.json`), 'utf8'));

const results = {
  startedAt: new Date().toISOString(),
  testedUrl: BASE,
  apiUrl: API,
  serverBuildIdentity: 'vite dev (frontend :5173) + tsx watch backend (:4000)',
  activeRelease: servingPointer.release_id,
  activeRun: runPointer.run_id,
  checks: {},
  consoleWarnings: [],
  consoleErrors: [],
  pageErrors: [],
  httpErrors: [],
  screenshots: [],
  narrowViewportOverflow: {},
  expectedDrawerMembership: {},
  status: 'interrupted',
};

const record = (name, pass, detail) => { results.checks[name] = { pass: Boolean(pass), detail: String(detail) }; };
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  page.on('console', msg => {
    const t = msg.type();
    const loc = (() => { try { return msg.location(); } catch { return null; } })();
    const entry = { text: msg.text(), url: loc && loc.url };
    if (t === 'warning') results.consoleWarnings.push(entry);
    else if (t === 'error') results.consoleErrors.push(entry);
  });
  page.on('pageerror', err => results.pageErrors.push(String((err && err.message) || err)));
  page.on('response', res => { if (res.status() >= 400) results.httpErrors.push({ status: res.status(), url: res.url() }); });

  const shot = async name => { const p = path.join(OUT, name); await page.screenshot({ path: p, fullPage: true }); results.screenshots.push(p); };
  const bodyText = () => page.locator('body').innerText();

  // ================= RULES: server pagination, one owner, metrics =================
  await page.goto(`${BASE}/rules`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('of 697 rules'), null, { timeout: 45000 });

  const paginationCount = await page.locator('.pagination').count();
  record('rules_single_pagination_owner', paginationCount === 1, `.pagination controls = ${paginationCount}`);
  const showingCount = await page.evaluate(() => (document.body.innerText.match(/Showing \d+–\d+ of 697 rules/g) || []).length);
  record('rules_single_visible_range', showingCount === 1, `visible range labels = ${showingCount}`);

  const page1 = await page.locator('.pagination').innerText();
  record('rules_page1_range', /Showing 1–20 of 697 rules · Page 1 of 35/.test(page1), page1.replace(/\s+/g, ' '));

  await page.getByLabel('Next page').click();
  await page.waitForFunction(() => /Page 2 of 35/.test(document.querySelector('.pagination')?.textContent || ''), null, { timeout: 45000 });
  const page2 = await page.locator('.pagination').innerText();
  record('rules_page2_range', /Showing 21–40 of 697 rules · Page 2 of 35/.test(page2), page2.replace(/\s+/g, ' '));
  const rulesText = await bodyText();
  record('rules_metrics_visible', ['Support', 'Confidence', 'Lift'].every(h => rulesText.includes(h)), 'Support/Confidence/Lift headers');
  record('rules_search_disabled_server_mode', !rulesText.includes('Search records'), 'no client search box in server mode');
  await shot('01_rules_page2.png');

  await page.getByLabel('Last page').click();
  await page.waitForFunction(() => /Page 35 of 35/.test(document.querySelector('.pagination')?.textContent || ''), null, { timeout: 45000 });
  const lastPage = await page.locator('.pagination').innerText();
  record('rules_last_page_range', /Showing 681–697 of 697 rules · Page 35 of 35/.test(lastPage), lastPage.replace(/\s+/g, ' '));
  await shot('02_rules_last_page.png');

  // Rule interpretation drawer.
  await page.goto(`${BASE}/rules`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('of 697 rules'), null, { timeout: 45000 });
  await page.getByRole('button', { name: 'Interpret' }).first().click();
  await page.waitForFunction(() => document.body.innerText.includes('Plain-Language Interpretation'), null, { timeout: 20000 });
  const ruleDrawer = await bodyText();
  record('rules_interpret_drawer', ruleDrawer.includes('Plain-Language Interpretation') && ruleDrawer.includes('also recorded at least 10 cases'), 'interpretation drawer opens with plain-language text');
  await shot('03_rules_interpret_drawer.png');

  // ================= PCA: cards + captions agree, dynamic =================
  await page.goto(`${BASE}/pca`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('Cumulative Variance'), null, { timeout: 45000 });
  const statTexts = await page.evaluate(() => [...document.querySelectorAll('.stat')].map(s => s.innerText));
  record('pca_pc1_card', statTexts.some(s => /PC1 Explained Variance\s*15\.9%/.test(s.replace(/\n/g, ' '))), statTexts.find(s => s.includes('PC1 Explained Variance')) || 'missing');
  record('pca_pc2_card', statTexts.some(s => /PC2 Explained Variance\s*4\.6%/.test(s.replace(/\n/g, ' '))), statTexts.find(s => s.includes('PC2 Explained Variance')) || 'missing');
  record('pca_cumulative_card', statTexts.some(s => /Cumulative Variance \(2 PCs\)\s*20\.5%/.test(s.replace(/\n/g, ' '))), statTexts.find(s => s.includes('Cumulative Variance')) || 'missing');
  const pcaText = await bodyText();
  record('pca_caption_agrees', pcaText.includes('retains 20.5% of total variance'), 'panel subtitle retains 20.5%');
  record('pca_no_stale_227', !pcaText.includes('22.7'), 'stale 22.7% absent');
  record('pca_score_plot_label', pcaText.includes('PCA Score Plot'), 'labelled score plot');
  await shot('04_pca_captions.png');

  // Drawer opened from PCA must label the DEFAULT k=3 explicitly (no k passed).
  // Overlapping SVG circles intercept pointer events, so force the click.
  await page.locator('svg[aria-label="PCA scatter plot of regional crime profiles"] circle').first().click({ force: true });
  await page.getByRole('button', { name: 'View Complete Regional Profile' }).click();
  await page.waitForFunction(() => /K-Means Cluster \(k = 3\)/.test(document.body.innerText), null, { timeout: 20000 });
  const pcaDrawer = await bodyText();
  record('drawer_default_k_labeled', pcaDrawer.includes('read from the default saved model (k = 3)'), 'drawer labelled default k=3 when no k is passed');
  await shot('05_pca_drawer_default_k3.png');

  // ================= CLUSTERS: drawer membership matches saved model for k=3,4,5 =================
  for (const k of [3, 4, 5]) {
    const art = readKmeans(k);
    const first = art.assignment_records[0];
    const [stateName, regionName] = first.region.split(' · ');
    const expectedClusterNumber = Number(first.cluster_id) + 1;
    results.expectedDrawerMembership[k] = { region: first.region, region_id: first.region_id, cluster_number: expectedClusterNumber, source: `kmeans_2024_k${k}.json` };

    await page.goto(`${BASE}/clusters`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.innerText.includes('Cluster Profiles'), null, { timeout: 45000 });
    await page.locator('select').filter({ hasText: 'k = 3' }).first().selectOption(String(k));
    await page.waitForTimeout(600);

    // The first saved assignment record is always a representative (first member) of its cluster,
    // so its badge is rendered on the cluster card in every model.
    const badge = page.getByRole('button', { name: new RegExp(`${esc(regionName)} \\(${esc(stateName)}\\)`) }).first();
    await badge.waitFor({ timeout: 20000 });
    await badge.click();
    await page.waitForFunction(() => /K-Means Cluster \(k = \d\)/.test(document.body.innerText), null, { timeout: 20000 });

    // Scope the assertion to the region drawer element itself (the page behind it
    // always contains every "Cluster N" label, so reading body text is not discriminating).
    const drawer = page.locator('div[style*="420px"]').last();
    const drawerText = await drawer.innerText();
    const membership = (drawerText.match(/K-Means Cluster \(k = \d\)\s*Cluster (\d+)/) || [])[1];
    record(`clusters_drawer_k${k}_membership`, Number(membership) === expectedClusterNumber, `${regionName}: expected Cluster ${expectedClusterNumber}; drawer membership = ${membership ?? 'none'}`);
    record(`clusters_drawer_k${k}_model_label`, drawerText.includes(`read from the saved k = ${k} model selected on the Clusters page`), `drawer cites saved k=${k} model`);
    await shot(`06_clusters_drawer_k${k}.png`);
    await page.keyboard.press('Escape').catch(() => {});
  }

  // Cluster page narrative checks (seed is metadata, inertia not a fit score).
  await page.goto(`${BASE}/clusters`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('Cluster Profiles'), null, { timeout: 45000 });
  const cText = await bodyText();
  record('clusters_seed_is_metadata', cText.includes('reproducibility metadata, not a stability measure'), 'seed labelled as reproducibility metadata');
  record('clusters_no_random_seed_card', !cText.includes('Random Seed'), 'no "Random Seed / Stability" card');
  record('clusters_inertia_explained', /not a goodness-of-fit/i.test(cText), 'inertia behaviour explained');
  record('clusters_saved_cohort_order', /example member units \(saved cohort order\)/i.test(cText), 'representatives labelled saved cohort order (CSS-uppercased)');
  await shot('07_clusters.png');

  // ================= CATEGORY CONTEXT LABELS + unresolved handling =================
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.filterbar select', { timeout: 45000 });
  const categorySelect = page.locator('select').filter({ hasText: 'Select a crime category' });
  await categorySelect.selectOption('custom');
  const panel = page.locator('.category-dropdown-panel');
  await panel.waitFor({ timeout: 20000 });
  await panel.locator('input[type=search]').fill('Any other place');
  await page.waitForTimeout(500);
  const panelText = await panel.innerText();
  record('category_context_label', panelText.includes('Sexual Harassment › In Any other place'), panelText.split('\n').filter(l => /Any other place/.test(l)).join(' | ') || 'missing');
  record('category_no_unknown_leak', !panelText.includes('[Unknown category'), 'no raw unknown-category placeholder in dropdown');
  await shot('08_category_context.png');
  await page.keyboard.press('Escape').catch(() => {});

  // ================= REGIONAL COMPARISON =================
  const overview = await (await fetch(`${API}/dashboard?view=overview&year=2024`)).json();
  const names = [...new Set(overview.regions.map(r => r.name))];
  const nameA = names.find(n => /pune/i.test(n)) || names[0];
  const nameB = names.find(n => /patna/i.test(n)) || names[1];
  await page.goto(`${BASE}/compare?region=${encodeURIComponent(nameA)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(n => document.body.innerText.includes(n), nameA, { timeout: 45000 });
  const searchInput = page.locator('input[placeholder*="Type district"]');
  await searchInput.fill(nameB);
  await page.waitForTimeout(700);
  await page.getByText(nameB, { exact: false }).first().click();
  await page.waitForTimeout(1000);
  const compareText = await bodyText();
  record('compare_two_units_selected', compareText.includes(nameA) && compareText.includes(nameB), `${nameA} + ${nameB}`);
  record('compare_table_rendered', compareText.includes('Reported values and classification summary'), 'comparison table present');
  record('compare_no_update_loop', !results.consoleErrors.some(c => /Maximum update depth/i.test(c.text)) && !results.pageErrors.some(e => /Maximum update depth/i.test(e)), 'no React update-depth loop');
  await shot('09_compare.png');

  // ================= NARROW VIEWPORT OVERFLOW =================
  await page.setViewportSize({ width: 720, height: 900 });
  for (const [label, route] of [['rules', '/rules'], ['pca', '/pca'], ['clusters', '/clusters']]) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    results.narrowViewportOverflow[label] = overflow;
    record(`narrow_${label}_no_page_overflow`, overflow <= 4, `documentElement.scrollWidth - innerWidth = ${overflow}px at 720px wide`);
    await shot(`10_narrow_${label}.png`);
  }

  await browser.close();
  results.finishedAt = new Date().toISOString();
  results.remainingLimitations = [
    'Screenshots are the only visual record; no pixel-diff baselines are stored.',
    'Console warnings from third-party/dev-tooling (if any) are recorded but not treated as failures.',
    'Overflow tolerance is 4px to allow sub-pixel rounding.',
  ];
  const allPass = Object.values(results.checks).every(c => c.pass);
  const noFatal = results.pageErrors.length === 0;
  results.status = allPass && noFatal ? 'completed' : 'interrupted';
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 2));
  console.log(`\n=== Phase 4 verification: ${results.status} ===`);
  console.log(`Output: ${OUT}`);
  console.log(`Checks: ${Object.values(results.checks).filter(c => c.pass).length}/${Object.values(results.checks).length} passed`);
  for (const [name, c] of Object.entries(results.checks)) if (!c.pass) console.log(`  FAIL ${name}: ${c.detail}`);
  console.log(`console warnings=${results.consoleWarnings.length} console errors=${results.consoleErrors.length} page errors=${results.pageErrors.length} http>=400=${results.httpErrors.length}`);
  process.exit(results.status === 'completed' ? 0 : 1);
}

main().catch(err => {
  results.finishedAt = new Date().toISOString();
  results.fatal = String((err && err.stack) || err);
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 2));
  console.error('FATAL', err);
  process.exit(1);
});
