// Focused capture: Overview + both Trends modes at representative widths.
// Also measures SVG text bounding boxes against their chart frame to detect
// clipped axis labels (a screenshot alone is not visual verification).
// Run from the repository root: node data/verification/presentation_charts_20261109/capture_charts.mjs
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const OUT = HERE;
const WIDTHS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 }
];

function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => http.get(url, res => {
      if (res.statusCode >= 200 && res.statusCode < 400) resolve(true);
      else retry();
    }).on('error', retry);
    const retry = () => { Date.now() - start > timeoutMs ? reject(new Error(`timeout ${url}`)) : setTimeout(attempt, 300); };
    attempt();
  });
}

// Measure every text node against the containing <svg> frame for overflow.
async function measureClipping(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('svg').forEach((svg, i) => {
      const fr = svg.getBoundingClientRect();
      if (fr.width < 40 || fr.height < 40) return;
      let overflow = 0;
      let worst = 0;
      svg.querySelectorAll('text, tspan').forEach(node => {
        const r = node.getBoundingClientRect();
        if (!r.width && !r.height) return;
        const dx = Math.max(fr.left - r.left, r.right - fr.right, 0);
        const dy = Math.max(fr.top - r.top, r.bottom - fr.bottom, 0);
        const d = Math.max(dx, dy);
        if (d > 1) { overflow += 1; worst = Math.max(worst, Math.round(d)); }
      });
      out.push({ index: i, w: Math.round(fr.width), h: Math.round(fr.height), overflowingText: overflow, worstOverflowPx: worst });
    });
    return out;
  });
}

async function run() {
  const results = { widths: [], capturedAt: new Date().toISOString() };
  const backend = spawn('node', ['dist/server.js'], { cwd: path.join(ROOT, 'backend'), stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, API_PORT: '4000' } });
  const frontend = spawn('npx', ['vite', 'preview', '--port', '5173', '--host', '127.0.0.1'], { cwd: path.join(ROOT, 'frontend'), stdio: ['ignore', 'pipe', 'pipe'], shell: true });
  const cleanup = () => { try { backend.kill('SIGTERM'); } catch {} try { frontend.kill('SIGTERM'); } catch {} };
  process.on('exit', cleanup); process.on('SIGINT', cleanup);

  try {
    await waitForHttp('http://127.0.0.1:4000/health');
    await waitForHttp('http://127.0.0.1:5173/');
    const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

    for (const vp of WIDTHS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e.message));
      const rec = { ...vp, charts: {} };

      // Overview
      await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
      await page.waitForSelector('svg', { timeout: 15000 });
      await page.waitForTimeout(800);
      rec.charts.overview = await measureClipping(page);
      await page.screenshot({ path: path.join(OUT, `overview_${vp.name}.png`), fullPage: true });

      // Trends
      await page.goto('http://127.0.0.1:5173/trends', { waitUntil: 'networkidle' });
      await page.waitForSelector('[role="tab"]', { timeout: 15000 });
      await page.waitForTimeout(800);

      const tabs = await page.$$('[role="tab"]');
      await tabs[0].click();
      await page.waitForTimeout(700);
      rec.charts.trends_annual = await measureClipping(page);
      await page.screenshot({ path: path.join(OUT, `trends_annual_${vp.name}.png`), fullPage: true });

      await tabs[1].click();
      await page.waitForTimeout(700);
      rec.charts.trends_matched = await measureClipping(page);
      await page.screenshot({ path: path.join(OUT, `trends_matched_${vp.name}.png`), fullPage: true });

      rec.pageErrors = pageErrors;
      results.widths.push(rec);
      await context.close();
    }
    await browser.close();
    fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 2));
    const totalOverflow = results.widths.reduce((n, w) =>
      n + Object.values(w.charts).reduce((m, arr) => m + arr.reduce((k, c) => k + c.overflowingText, 0), 0), 0);
    console.log(`Captured ${WIDTHS.length} widths x 3 views. Total overflowing text nodes: ${totalOverflow}`);
    console.log(JSON.stringify(results.widths.map(w => ({ width: w.name, overview: w.charts.overview, trends_annual: w.charts.trends_annual, trends_matched: w.charts.trends_matched, pageErrors: w.pageErrors })), null, 2));
  } finally {
    cleanup();
  }
}

run().catch(e => { console.error('FATAL', e); process.exit(1); });
