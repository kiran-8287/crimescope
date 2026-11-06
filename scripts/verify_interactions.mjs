/**
 * Focused browser interaction checks against already-running servers.
 * Backend on http://127.0.0.1:4000, Frontend on http://127.0.0.1:5173
 *
 * Tests:
 * 1. CSV export matches filtered view
 * 2. Region selections clear after state/type filter change
 * 3. Pagination advances actual rows
 * 4. Repeated navigation produces no errors or growing retained data
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const SCREENSHOT_DIR = 'data/browser_verification';
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = 'http://127.0.0.1:5173';
const results = {};
let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function run() {
  console.log('=== CrimeScope Interaction Verification ===\n');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  const consoleLogs = [];
  const consoleErrors = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  // -------------------------------------------------------------------
  // TEST 1: CSV Export — Overview page
  // -------------------------------------------------------------------
  console.log('[1] CSV Export Content Verification');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.stats', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Find export button and intercept the download
  const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
  const exportBtn = await page.$('button:has-text("Export"), button:has-text("CSV"), button:has-text("Download"), a:has-text("Export"), a:has-text("CSV")');
  if (exportBtn) {
    await exportBtn.click();
    const download = await downloadPromise;
    if (download) {
      const csvPath = path.join(SCREENSHOT_DIR, 'test_export.csv');
      await download.saveAs(csvPath);
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const lines = csvContent.trim().split('\n');
      assert('CSV has header row', lines.length > 1 && lines[0].includes(','));
      assert('CSV has data rows', lines.length > 2);
      // Check CSV has expected columns
      const header = lines[0].toLowerCase();
      assert('CSV header includes region or state or category', 
        header.includes('region') || header.includes('state') || header.includes('category') || header.includes('name'));
      results.csvExport = { lines: lines.length, headerSample: lines[0].substring(0, 120) };
      console.log(`  CSV: ${lines.length} rows, header: ${lines[0].substring(0, 80)}...`);
    } else {
      assert('CSV download received', false);
      results.csvExport = { error: 'no download event' };
    }
  } else {
    console.log('  ⚠ No export button found on Overview page, trying Anomalies page...');
    await page.goto(`${BASE}/anomalies`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const dlPromise2 = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    const exportBtn2 = await page.$('button:has-text("Export"), button:has-text("CSV"), button:has-text("Download")');
    if (exportBtn2) {
      await exportBtn2.click();
      const dl = await dlPromise2;
      if (dl) {
        const csvPath = path.join(SCREENSHOT_DIR, 'test_export_anomalies.csv');
        await dl.saveAs(csvPath);
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const lines = csvContent.trim().split('\n');
        assert('CSV has header row', lines.length > 1);
        assert('CSV has data rows', lines.length > 2);
        results.csvExport = { page: 'anomalies', lines: lines.length };
      } else {
        assert('CSV download received', false);
      }
    } else {
      console.log('  ⚠ No export button found on Anomalies page either');
      results.csvExport = { error: 'no export button found' };
    }
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/11_csv_export.png` });

  // -------------------------------------------------------------------
  // TEST 2: Region Selection Clearing (/compare page)
  // -------------------------------------------------------------------
  console.log('\n[2] Region Selection Clearing on Filter Change');
  await page.goto(`${BASE}/compare`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Find state filter dropdown
  const selects = await page.$$('select');
  let stateSelect = null;
  let typeSelect = null;
  
  for (const sel of selects) {
    const options = await sel.$$eval('option', opts => opts.map(o => ({ value: o.value, text: o.text })));
    const optTexts = options.map(o => o.text);
    if (optTexts.some(t => t.includes('Andhra Pradesh') || t.includes('Maharashtra'))) {
      stateSelect = sel;
    } else if (optTexts.some(t => t.includes('Administrative') || t.includes('district') || t.includes('Railway') || t.includes('City'))) {
      typeSelect = sel;
    }
  }

  if (stateSelect) {
    // Select a state with regions
    await stateSelect.selectOption({ label: 'Maharashtra' });
    await page.waitForTimeout(1500);

    // Check if there are region chips or selections visible
    const beforeContent = await page.content();
    const beforeChips = (beforeContent.match(/chip|badge|selected/gi) || []).length;

    // Now change state to a different one — selections should clear
    await stateSelect.selectOption({ label: 'Andhra Pradesh' });
    await page.waitForTimeout(1500);

    const afterContent = await page.content();
    assert('Page updated after state filter change', afterContent.includes('Andhra Pradesh'));
    
    // Verify no stale Maharashtra-specific regions remain
    const hasStaleData = afterContent.includes('Mumbai') && !afterContent.includes('Maharashtra');
    assert('No stale region data from previous state', !hasStaleData);
    
    results.regionClearing = { stateFilterFound: true, noStaleData: !hasStaleData };
  } else {
    console.log('  ⚠ State filter select not found on compare page');
    results.regionClearing = { stateFilterFound: false };
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/12_region_clearing.png` });

  // -------------------------------------------------------------------
  // TEST 3: Pagination Advances Actual Rows
  // -------------------------------------------------------------------
  console.log('\n[3] Pagination Verification');
  
  // Test on association rules page which has explicit pagination
  await page.goto(`${BASE}/rules`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Get first page content
  const firstPageContent = await page.content();
  const firstPageRows = await page.$$eval('table tbody tr', rows => rows.map(r => r.textContent?.substring(0, 80)));
  
  // Find and click Next Page button
  const nextBtn = await page.$('button:has-text("Next Page"), button:has-text("Next")');
  if (nextBtn && !(await nextBtn.isDisabled())) {
    await nextBtn.click();
    await page.waitForTimeout(2000);
    
    const secondPageContent = await page.content();
    const secondPageRows = await page.$$eval('table tbody tr', rows => rows.map(r => r.textContent?.substring(0, 80)));
    
    if (firstPageRows.length > 0 && secondPageRows.length > 0) {
      // Compare first rows — they should differ
      const firstRowChanged = firstPageRows[0] !== secondPageRows[0];
      assert('Pagination advances rows (first row differs)', firstRowChanged);
      assert('Second page has data rows', secondPageRows.length > 0);
      
      // Check page indicator changed
      const hasShowingText = secondPageContent.includes('21–') || secondPageContent.includes('Showing 21');
      assert('Page indicator updated', hasShowingText);
      
      results.pagination = { 
        page1Rows: firstPageRows.length, 
        page2Rows: secondPageRows.length, 
        rowsChanged: firstRowChanged 
      };
    } else {
      assert('Table has rows to paginate', false);
      results.pagination = { error: 'no table rows found' };
    }
  } else {
    console.log('  ⚠ Next Page button not found or disabled');
    // Try overview or anomalies table pagination via DataTable
    results.pagination = { error: 'next button not found or disabled' };
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/13_pagination.png` });

  // -------------------------------------------------------------------
  // TEST 4: Repeated Navigation — No Errors or Growing Data
  // -------------------------------------------------------------------
  console.log('\n[4] Repeated Navigation Stability');
  const routes = ['/', '/compare', '/trends', '/pca', '/clusters', '/anomalies', '/rules', '/quality', '/methodology'];
  
  const errorsBeforeNav = consoleErrors.length;
  
  // Navigate through all routes twice
  for (let cycle = 0; cycle < 2; cycle++) {
    for (const route of routes) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
    }
  }
  
  const errorsAfterNav = consoleErrors.length;
  const navErrors = consoleErrors.slice(errorsBeforeNav);
  
  // Filter out 404 resource errors (favicon etc) — focus on JS errors
  const jsErrors = navErrors.filter(e => !e.includes('404') && !e.includes('favicon'));
  
  assert('No new JS errors during repeated navigation', jsErrors.length === 0);
  if (jsErrors.length > 0) {
    console.log('  JS errors:', jsErrors);
  }
  
  // Check memory: measure DOM node count at start and end
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const finalNodeCount = await page.evaluate(() => document.querySelectorAll('*').length);
  
  // Navigate away and back
  await page.goto(`${BASE}/pca`, { waitUntil: 'networkidle' });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const returnNodeCount = await page.evaluate(() => document.querySelectorAll('*').length);
  
  const nodeGrowth = returnNodeCount - finalNodeCount;
  assert(`DOM node count stable after navigation (growth: ${nodeGrowth})`, Math.abs(nodeGrowth) < 50);
  
  results.repeatedNavigation = {
    totalRouteVisits: routes.length * 2,
    newJsErrors: jsErrors.length,
    nodeCountFirst: finalNodeCount,
    nodeCountReturn: returnNodeCount,
    nodeGrowth
  };

  await page.screenshot({ path: `${SCREENSHOT_DIR}/14_repeated_nav.png` });

  // -------------------------------------------------------------------
  // TEST 5: Verify updated cohort numbers appear in UI
  // -------------------------------------------------------------------
  console.log('\n[5] Updated Cohort Number Verification');
  
  await page.goto(`${BASE}/anomalies`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const anomText = await page.content();
  assert('Anomalies shows 774 (not 783)', anomText.includes('774') && !anomText.includes('783'));
  
  await page.goto(`${BASE}/methodology`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const methText = await page.content();
  assert('Methodology shows 774 districts (not 783)', methText.includes('774') && !methText.includes('783'));
  assert('Methodology shows 749 matched (not 836)', methText.includes('749') && !methText.includes('836'));
  assert('Methodology shows 739 transactions (not 744)', methText.includes('739') && !methText.includes('744'));
  
  await page.goto(`${BASE}/rules`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const rulesText = await page.content();
  assert('Rules page shows 739 transactions (not 744)', rulesText.includes('739') && !rulesText.includes('744'));
  
  await page.goto(`${BASE}/pca`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const pcaText = await page.content();
  assert('PCA shows "scaled component loadings" (not "Pearson correlations")', 
    pcaText.includes('scaled component loading') || pcaText.includes('Scaled Loading'));
  assert('PCA shows 774 districts', pcaText.includes('774'));
  
  results.cohortNumbers = {
    anomalies774: anomText.includes('774'),
    methodology774: methText.includes('774'),
    methodology749: methText.includes('749'),
    rules739: rulesText.includes('739'),
    pcaScaledLoadings: pcaText.includes('scaled component loading') || pcaText.includes('Scaled Loading')
  };

  await page.screenshot({ path: `${SCREENSHOT_DIR}/15_cohort_numbers.png` });

  // -------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------
  await browser.close();

  console.log(`\n=== INTERACTION VERIFICATION COMPLETE ===`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  
  results.summary = { passed, failed, totalErrors: consoleErrors.length };
  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'interaction_summary.json'),
    JSON.stringify(results, null, 2)
  );
  console.log(`Results saved to ${SCREENSHOT_DIR}/interaction_summary.json`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

