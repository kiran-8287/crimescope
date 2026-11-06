import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';

async function testQuality() {
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
    await page.goto('http://127.0.0.1:5173/quality', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const stats = await page.$$eval('.stat', els => els.map(e => e.innerText));
    console.log("Stats found on Quality page:", stats);

    await browser.close();
  } finally {
    backend.kill();
    frontend.kill();
  }
}

testQuality().catch(console.error);

