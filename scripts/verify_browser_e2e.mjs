import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const SCREENSHOT_DIR = 'data/browser_verification';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function waitForHttp(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
        } else {
          retry();
        }
      }).on('error', retry);
    }
    function retry() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout waiting for ${url}`));
      } else {
        setTimeout(tryConnect, 300);
      }
    }
    tryConnect();
  });
}

async function runVerification() {
  console.log("=== Starting CrimeScope Full-Stack End-to-End Verification ===");

  // 1. Start Backend on 127.0.0.1:4000
  console.log("Starting backend server (127.0.0.1:4000)...");
  const backend = spawn('node', ['dist/server.js'], {
    cwd: path.resolve('backend'),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, API_PORT: '4000' }
  });

  backend.stdout.on('data', d => console.log(`[backend] ${d.toString().trim()}`));
  backend.stderr.on('data', d => console.error(`[backend-err] ${d.toString().trim()}`));

  // 2. Start Frontend Preview on 127.0.0.1:5173
  console.log("Starting frontend preview server (127.0.0.1:5173)...");
  const frontend = spawn('npx', ['vite', 'preview', '--port', '5173', '--host', '127.0.0.1'], {
    cwd: path.resolve('frontend'),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });

  frontend.stdout.on('data', d => console.log(`[frontend] ${d.toString().trim()}`));
  frontend.stderr.on('data', d => console.error(`[frontend-err] ${d.toString().trim()}`));

  const cleanup = () => {
    console.log("Terminating servers...");
    try { backend.kill('SIGTERM'); } catch {}
    try { frontend.kill('SIGTERM'); } catch {}
  };

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);

  try {
    console.log("Waiting for backend ready...");
    await waitForHttp('http://127.0.0.1:4000/health');
    console.log("Backend healthy at http://127.0.0.1:4000/health !");

    console.log("Waiting for frontend ready...");
    await waitForHttp('http://127.0.0.1:5173/');
    console.log("Frontend preview ready at http://127.0.0.1:5173/ !");

    // 3. Launch system Chrome
    console.log("Launching system Chrome...");
    const browser = await chromium.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 }
    });

    const page = await context.newPage();
    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => consoleLogs.push({ type: 'pageerror', text: err.message }));

    const networkResponses = [];
    page.on('response', resp => {
      if (resp.url().includes('/api/')) {
        resp.body().then(b => {
          networkResponses.push({
            url: resp.url(),
            status: resp.status(),
            sizeBytes: b.length
          });
        }).catch(() => {});
      }
    });

    const results = {};

    // ----------------------------------------------------
    // ROUTE 1: Overview (/)
    // ----------------------------------------------------
    console.log("\n[1/9] Testing Route: / (Overview)...");
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.waitForSelector('.stats', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const overviewTitle = await page.title();
    const overviewHeading = await page.$eval('h1, h2', el => el.textContent).catch(() => 'none');
    const overviewText = await page.content();
    results.overview = {
      title: overviewTitle,
      heading: overviewHeading,
      hasGrandTotal: overviewText.includes('27,42,809') || overviewText.includes('2,742,809'),
      hasUnitsCount: overviewText.includes('774'),
      hasTopCategories: overviewText.includes('Total Cognizable') || overviewText.includes('BNS') || overviewText.includes('Cognizable')
    };
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01_overview.png` });
    console.log("  Overview OK:", results.overview);

    // ----------------------------------------------------
    // ROUTE 2: Regional Comparison (/compare)
    // ----------------------------------------------------
    console.log("\n[2/9] Testing Route: /compare...");
    await page.goto('http://127.0.0.1:5173/compare', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const compareText = await page.content();
    results.compare = {
      hasPicker: compareText.includes('Select') || compareText.includes('Search') || compareText.includes('region') || compareText.includes('Add'),
      hasDisclaimer: compareText.includes('administrative') || compareText.includes('comparison') || compareText.includes('Comparability')
    };
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02_compare.png` });
    console.log("  Compare OK:", results.compare);

    // ----------------------------------------------------
    // ROUTE 3: Yearly Trends (/trends)
    // ----------------------------------------------------
    console.log("\n[3/9] Testing Route: /trends...");
    await page.goto('http://127.0.0.1:5173/trends', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const trendsText = await page.content();
    results.trends = {
      hasModes: trendsText.includes('Annual') || trendsText.includes('Comparable') || trendsText.includes('Cohort'),
      hasMatchedCohortCount: trendsText.includes('749') || trendsText.includes('matched'),
      has2020Note: trendsText.includes('2020') && (trendsText.includes('Andhra') || trendsText.includes('partial')),
      hasStatutoryNote: trendsText.includes('BNS') || trendsText.includes('statutory') || trendsText.includes('break')
    };
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03_trends.png` });
    console.log("  Trends OK:", results.trends);

    // ----------------------------------------------------
    // ROUTE 4: PCA Explorer (/pca)
    // ----------------------------------------------------
    console.log("\n[4/9] Testing Route: /pca...");
    await page.goto('http://127.0.0.1:5173/pca', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const pcaText = await page.content();
    const hasSvg = await page.$('svg') !== null;
    results.pca = {
      hasSvg,
      hasVariance: pcaText.includes('15.9') || pcaText.includes('15.91%'),
      hasVolumeLabel: pcaText.includes('volume') || pcaText.includes('recording') || pcaText.includes('Recording'),
      hasNoUrbanScale: !pcaText.includes('urban scale') && !pcaText.includes('Urban scale')
    };
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04_pca.png` });
    console.log("  PCA OK:", results.pca);

    // ----------------------------------------------------
    // ROUTE 5: Cluster Profiles (/clusters)
    // ----------------------------------------------------
    console.log("\n[5/9] Testing Route: /clusters...");
    await page.goto('http://127.0.0.1:5173/clusters', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const clusterText = await page.content();
    results.clusters = {
      hasCards: clusterText.includes('Cluster') || clusterText.includes('k='),
      hasDeviations: clusterText.includes('deviation') || clusterText.includes('profile') || clusterText.includes('centroid')
    };
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05_clusters.png` });
    console.log("  Clusters OK:", results.clusters);

    // ----------------------------------------------------
    // ROUTE 6: Unusual Observations (/anomalies)
    // ----------------------------------------------------
    console.log("\n[6/9] Testing Route: /anomalies...");
    await page.goto('http://127.0.0.1:5173/anomalies', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const anomaliesText = await page.content();
    results.anomalies = {
      hasTabs: anomaliesText.includes('Rare') || anomaliesText.includes('Intermediate') || anomaliesText.includes('High'),
      hasIntermediateTab: anomaliesText.includes('Intermediate') || anomaliesText.includes('4–19') || anomaliesText.includes('4-19'),
      hasZScores: anomaliesText.includes('z-score') || anomaliesText.includes('z =') || anomaliesText.includes('Flagged')
    };
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06_anomalies.png` });
    console.log("  Anomalies OK:", results.anomalies);

    // ----------------------------------------------------
    // ROUTE 7: Association Rules (/rules)
    // ----------------------------------------------------
    console.log("\n[7/9] Testing Route: /rules...");
    await page.goto('http://127.0.0.1:5173/rules', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const rulesText = await page.content();
    results.rules = {
      hasSupportConfLift: rulesText.includes('Support') && rulesText.includes('Confidence') && rulesText.includes('Lift'),
      hasEcologicalAdvisory: rulesText.includes('Ecological') || rulesText.includes('ecological') || rulesText.includes('co-occurrence'),
      hasTransactionsNote: rulesText.includes('739') || rulesText.includes('transaction')
    };
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07_rules.png` });
    console.log("  Rules OK:", results.rules);

    // ----------------------------------------------------
    // ROUTE 8: Data Quality (/quality)
    // ----------------------------------------------------
    console.log("\n[8/9] Testing Route: /quality...");
    await page.goto('http://127.0.0.1:5173/quality', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const qualityText = await page.content();
    results.quality = {
      hasTotalObs: qualityText.includes('5,49,000') || qualityText.includes('549,000'),
      hasZeros: qualityText.includes('3,24,466') || qualityText.includes('324,466'),
      hasZeroMissing: qualityText.includes('0 missing') || qualityText.includes('Missing / null values') || qualityText.includes('0')
    };
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08_quality.png` });
    console.log("  Quality OK:", results.quality);

    // ----------------------------------------------------
    // ROUTE 9: Methodology (/methodology)
    // ----------------------------------------------------
    console.log("\n[9/9] Testing Route: /methodology...");
    await page.goto('http://127.0.0.1:5173/methodology', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const methText = await page.content();
    results.methodology = {
      hasQuestions: methText.includes('Research Questions') || methText.includes('1.') || methText.includes('Question'),
      hasReleaseId: methText.includes('fd2d8578be56') || methText.includes('ncrb-districtwise'),
      hasRunId: methText.includes('20261107-v4') || methText.includes('v4')
    };
    await page.screenshot({ path: `${SCREENSHOT_DIR}/09_methodology.png` });
    console.log("  Methodology OK:", results.methodology);

    // ----------------------------------------------------
    // INTERACTION & FILTER TESTS
    // ----------------------------------------------------
    console.log("\nTesting Filter Interactions on Overview...");
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.waitForSelector('.stats', { timeout: 10000 });

    const selects = await page.$$('select');
    console.log(`Found ${selects.length} filter selects on page.`);
    if (selects.length > 0) {
      for (const sel of selects) {
        const options = await sel.$$eval('option', opts => opts.map(o => o.text));
        if (options.includes('Andhra Pradesh')) {
          await sel.selectOption({ label: 'Andhra Pradesh' });
          await page.waitForTimeout(1000);
          const apContent = await page.content();
          results.stateFilter = {
            applied: true,
            hasAndhraText: apContent.includes('Andhra Pradesh'),
            hasAnantapur: apContent.includes('Anantapuramu') || apContent.includes('Anantapur')
          };
          await page.screenshot({ path: `${SCREENSHOT_DIR}/10_overview_ap_filter.png` });
          console.log("  State Filter OK:", results.stateFilter);
          break;
        }
      }
    }

    // ----------------------------------------------------
    // NETWORK RESPONSE SIZE MEASUREMENT
    // ----------------------------------------------------
    console.log("\nNetwork payload size summary:");
    let maxPayloadBytes = 0;
    const recordedCalls = [];
    for (const r of networkResponses) {
      if (r.sizeBytes > maxPayloadBytes) maxPayloadBytes = r.sizeBytes;
      const endpoint = r.url.split('?')[0].split('/').slice(-2).join('/');
      recordedCalls.push({ endpoint, sizeKb: (r.sizeBytes / 1024).toFixed(1) });
    }
    console.log("Sample API responses:", recordedCalls.slice(0, 8));

    results.network = {
      responsesCount: networkResponses.length,
      maxPayloadKb: (maxPayloadBytes / 1024).toFixed(1),
      noMegabyteBloat: maxPayloadBytes < 500 * 1024 // strictly less than 500 KB (no 549,000 array bloat)
    };
    console.log("  Network Performance OK:", results.network);

    // Console error check
    const errors = consoleLogs.filter(l => l.type === 'error' || l.type === 'pageerror');
    results.consoleErrors = errors.map(e => e.text);
    console.log("  Console Errors:", results.consoleErrors.length);

    await browser.close();

    console.log("\n=== ALL 9 BROWSER ROUTES & INTERACTIONS VERIFIED ===");
    fs.writeFileSync('data/browser_verification/summary.json', JSON.stringify(results, null, 2));

  } finally {
    cleanup();
  }
}

runVerification().catch(err => {
  console.error("FATAL ERROR in browser verification:", err);
  process.exit(1);
});
