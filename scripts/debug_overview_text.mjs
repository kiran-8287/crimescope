import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

async function testOverview() {
  const backend = spawn('node', ['dist/server.js'], {
    cwd: path.resolve('backend'),
    stdio: 'ignore',
    env: { ...process.env, API_PORT: '4000' }
  });
  const frontend = spawn('npx', ['vite', 'preview', '--port', '5173', '--host', '127.0.0.1'], {
    cwd: path.resolve('frontend'),
    stdio: 'ignore',
    shell: true
  });

  await new Promise(r => setTimeout(r, 3000));

  try {
    const browser = await chromium.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true
    });
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const stats = await page.$$eval('.stat, .stat-value, .stat-label', els => els.map(e => e.textContent));
    console.log("Stats found on Overview page:", stats);

    const text = await page.$eval('main', el => el.innerText).catch(() => 'no main');
    console.log("Main text preview (first 1000 chars):");
    console.log(text.slice(0, 1000));

    await browser.close();
  } finally {
    backend.kill();
    frontend.kill();
  }
}

testOverview().catch(console.error);

