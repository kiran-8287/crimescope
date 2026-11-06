import { spawn } from 'node:child_process';
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
    page.on('request', req => console.log('[browser-req]', req.method(), req.url()));
    page.on('response', resp => console.log('[browser-resp]', resp.status(), resp.url()));

    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const stats = await page.$$eval('.stat', els => els.map(e => e.innerText));
    console.log("Stats found on Overview page:", stats);

    await browser.close();
  } finally {
    backend.kill();
    frontend.kill();
  }
}

testOverview().catch(console.error);

