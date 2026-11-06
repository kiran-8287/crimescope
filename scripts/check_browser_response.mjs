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
    page.on('response', async resp => {
      if (resp.url().includes('/api/v1/dashboard')) {
        const text = await resp.text();
        const json = JSON.parse(text);
        console.log("=== URL:", resp.url());
        console.log("  releaseId:", json.meta?.releaseId);
        const admin2024 = json.regions?.filter(r => r.year === 2024 && r.regionType === 'administrative_district');
        console.log("  admin2024 count:", admin2024?.length);
        const obs2024 = json.observations?.filter(o => o.year === 2024);
        console.log("  obs2024 count:", obs2024?.length);
        console.log("  obs2024 sum:", obs2024?.reduce((a,b) => a + (b.cases||0), 0));
      }
    });

    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await browser.close();
  } finally {
    backend.kill();
    frontend.kill();
  }
}

testOverview().catch(console.error);
