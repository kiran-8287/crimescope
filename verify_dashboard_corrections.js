/**
 * Browser verification for the four dashboard corrections.
 * Uses an isolated session with the installed system Chrome via Playwright.
 * Writes a timestamped, self-describing output directory and asserts displayed
 * values/interactions (screenshots are evidence, not the verification itself).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5173';
const API = 'http://localhost:4000/api/v1';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = path.join('data', 'verification', `dashboard_corrections_${Date.now()}`);
fs.mkdirSync(OUT, { recursive: true });

const results = {
  startedAt: new Date().toISOString(),
  base: BASE,
  activeRelease: JSON.parse(fs.readFileSync('data/serving/current.json', 'utf8')).release_id,
  activeRun: JSON.parse(fs.readFileSync('analysis/output/runs/current.json', 'utf8')).run_id,
  checks: {},
  console: [],
  pageErrors: [],
  httpErrors: [],
  screenshots: [],
  status: 'interrupted',
};

const record = (name, pass, detail) => { results.checks[name] = { pass: Boolean(pass), detail: String(detail) }; };

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') results.console.push({ type, text: msg.text() });
  });
  page.on('pageerror', err => results.pageErrors.push(String((err && err.message) || err)));
  page.on('response', res => { if (res.status() >= 400) results.httpErrors.push({ status: res.status(), url: res.url() }); });

  const shot = async name => { const p = path.join(OUT, name); await page.screenshot({ path: p, fullPage: true }); results.screenshots.push(p); };
  const bodyText = () => page.locator('body').innerText();

  // ---- Evidence 1: association rules, page 2, single pagination owner ----
  await page.goto(`${BASE}/rules`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('of 697 rules'), null, { timeout: 40000 });
  const paginationCount = await page.locator('.pagination').count();
  record('rules_single_pagination_control', paginationCount === 1, `pagination controls visible = ${paginationCount}`);
  const showingCount = await page.evaluate(() => (document.body.innerText.match(/Showing \d+–\d+ of 697 rules/g) || []).length);
  record('rules_single_visible_range', showingCount === 1, `visible-range labels = ${showingCount}`);
  const page1 = await page.locator('.pagination').innerText();
  record('rules_page1_range', /Showing 1–20 of 697 rules · Page 1 of 35/.test(page1), page1.replace(/\s+/g, ' '));

  await page.getByLabel('Next page').click();
  await page.waitForFunction(() => /Page 2 of 35/.test(document.querySelector('.pagination')?.textContent || ''), null, { timeout: 40000 });
  const page2 = await page.locator('.pagination').innerText();
  record('rules_page2_range', /Showing 21–40 of 697 rules · Page 2 of 35/.test(page2), page2.replace(/\s+/g, ' '));
  const rulesText = await bodyText();
  record('rules_metrics_visible', ['Support', 'Confidence', 'Lift'].every(h => rulesText.includes(h)), 'Support/Confidence/Lift headers present');
  await shot('01_association_page2.png');

  // ---- Evidence 2: PCA cards and captions agree with the artifact ----
  await page.goto(`${BASE}/pca`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('Cumulative Variance'), null, { timeout: 40000 });
  const statTexts = await page.evaluate(() => [...document.querySelectorAll('.stat')].map(s => s.innerText));
  record('pca_pc1_card', statTexts.some(s => /PC1 Explained Variance[\s\S]*15\.9%/.test(s)), statTexts.find(s => s.includes('PC1 Explained Variance')) || 'missing');
  record('pca_pc2_card', statTexts.some(s => /PC2 Explained Variance[\s\S]*4\.6%/.test(s)), statTexts.find(s => s.includes('PC2 Explained Variance')) || 'missing');
  record('pca_cumulative_card', statTexts.some(s => /Cumulative Variance \(2 PCs\)[\s\S]*20\.5%/.test(s)), statTexts.find(s => s.includes('Cumulative Variance')) || 'missing');
  const pcaText = await bodyText();
  record('pca_caption_agrees', pcaText.includes('retains 20.5% of total variance'), 'panel subtitle retains 20.5%');
  record('pca_no_stale_227', !pcaText.includes('22.7'), 'stale 22.7% absent');
  record('pca_score_plot_label', pcaText.includes('PCA Score Plot'), 'labelled score plot (not biplot)');
  await shot('02_pca_captions.png');

  // ---- Evidence 3: ambiguous category shown with verified parent context ----
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.filterbar select', { timeout: 40000 });
  const categorySelect = page.locator('select').filter({ hasText: 'Select a crime category' });
  await categorySelect.selectOption('custom');
  const panel = page.locator('.category-dropdown-panel');
  await panel.waitFor({ timeout: 15000 });
  await panel.locator('input[type=search]').fill('Any other place');
  await page.waitForTimeout(400);
  const panelText = await panel.innerText();
  record('category_context_label', panelText.includes('Sexual Harassment › In Any other place'), panelText.split('\n').filter(l => /Any other place/.test(l)).join(' | ') || 'missing');
  await shot('03_category_context.png');
  await page.keyboard.press('Escape').catch(() => {});

  // ---- Evidence 4: cluster descriptions traceable to the artifact ----
  await page.goto(`${BASE}/clusters`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('Cluster Profiles'), null, { timeout: 40000 });
  const cText = await bodyText();
  record('clusters_no_random_seed_card', !cText.includes('Random Seed'), 'no "Random Seed / Stability" card');
  record('clusters_seed_is_metadata', cText.includes('reproducibility metadata, not a stability measure'), 'seed labelled as reproducibility metadata');
  record('clusters_inertia_explained', cText.includes('always falls as k rises') && /not a goodness-of-fit/i.test(cText), 'inertia behaviour explained');
  record('clusters_no_clearest_separation', !/clearest separation/i.test(cText), 'unsupported "clearest separation" removed');
  record('clusters_no_urban_centers', !/high-volume urban centers/i.test(cText), 'unsupported "high-volume urban centers" removed');
  record('clusters_feature_profiles', cText.includes('Distinguishing feature deviations') && cText.includes('standardized mean deviations'), 'feature deviations with transformed-value note');
  record('clusters_saved_order_representatives', /saved cohort order/i.test(cText), 'representatives labelled as saved cohort order');
  await shot('04_clusters.png');

  // ---- Evidence 5: regional comparison smoke test ----
  const overview = await (await fetch(`${API}/dashboard?view=overview&year=2024`)).json();
  const names = [...new Set(overview.regions.map(r => r.name))];
  const nameA = names.find(n => /pune/i.test(n.val)) || names.find(n => /pune/i.test(n)) || names[0];
  const nameB = names.find(n => /patna/i.test(n)) || names[1];
  await page.goto(`${BASE}/compare?region=${encodeURIComponent(nameA)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(n => document.body.innerText.includes(n), nameA, { timeout: 40000 });
  const searchInput = page.locator('input[placeholder*="Type district"]');
  await searchInput.fill(nameB);
  await page.waitForTimeout(600);
  await page.getByText(nameB, { exact: false }).first().click();
  await page.waitForTimeout(900);
  const compareText = await bodyText();
  record('compare_two_units_selected', compareText.includes(nameA) && compareText.includes(nameB), `${nameA} + ${nameB}`);
  record('compare_table_rendered', compareText.includes('Reported values and classification summary'), 'comparison table present');
  record('compare_no_update_loop', !results.console.some(c => /Maximum update depth/i.test(c.text)) && !results.pageErrors.some(e => /Maximum update depth/i.test(e)), 'no React update-depth loop');
  await shot('05_compare.png');

  await browser.close();
  results.finishedAt = new Date().toISOString();
  results.status = Object.values(results.checks).every(c => c.pass) && results.pageErrors.length === 0 ? 'completed' : 'interrupted';
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.status === 'completed' ? 0 : 1);
}

main().catch(err => {
  results.finishedAt = new Date().toISOString();
  results.fatal = String((err && err.stack) || err);
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 2));
  console.error('FATAL', err);
  process.exit(1);
});
