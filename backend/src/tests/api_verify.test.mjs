import { describe, it } from 'node:test';
import assert from 'node:assert';
import zlib from 'zlib';
import http from 'http';

async function get(port, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      headers: { 'Accept-Encoding': 'gzip, deflate' }
    };
    const req = http.get(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        let body = buffer;
        if (res.headers['content-encoding'] === 'gzip') {
          body = zlib.gunzipSync(buffer);
        }
        resolve({status: res.statusCode, body: body.toString('utf8')});
      });
    });
    req.on('error', reject);
  });
}

describe('CrimeScope API - 2021-2024 scope', () => {
  it('rejects year 2020 on dashboard endpoint', async () => {
    const res = await get(4000, '/api/v1/dashboard?year=2020');
    assert.strictEqual(res.status, 400);
  });

  it('accepts year 2024 on dashboard endpoint', async () => {
    const res = await get(4000, '/api/v1/dashboard?year=2024');
    assert.strictEqual(res.status, 200);
    const d = JSON.parse(res.body);
    assert.deepStrictEqual(d.meta.years, [2021, 2022, 2023, 2024]);
    assert.strictEqual(d.meta.releaseId, 'ncrb-districtwise-2021-2024-ecec48b772bc');
    assert.strictEqual(d.meta.geographyScope, '36 state/UT fragments in 2021-2024');
  });

  it('rejects year 2020 on regions endpoint', async () => {
    const res = await get(4000, '/api/v1/regions?year=2020');
    assert.strictEqual(res.status, 400);
  });

  it('rejects year 2020 on categories endpoint', async () => {
    const res = await get(4000, '/api/v1/categories/top?year=2020');
    assert.strictEqual(res.status, 400);
  });

  it('rejects year 2020 on correlations endpoint', async () => {
    const res = await get(4000, '/api/v1/correlations?year=2020');
    assert.strictEqual(res.status, 400);
  });

  it('serves all analysis methods as available', async () => {
    const res = await get(4000, '/api/v1/dashboard?year=2024');
    const d = JSON.parse(res.body);
    assert.strictEqual(d.methods.pca.status, 'available');
    assert.strictEqual(d.methods.kmeans.status, 'available');
    assert.strictEqual(d.methods.hierarchical.status, 'available');
    assert.strictEqual(d.methods.anomalies.status, 'available');
    assert.strictEqual(d.methods.association.status, 'available');
  });

  it('only offers 2022-2023 comparison pair', async () => {
    const res = await get(4000, '/api/v1/dashboard?year=2024');
    const d = JSON.parse(res.body);
    const pairIds = d.meta.comparisonPairs.map(p => p.id);
    assert.ok(pairIds.includes('2022-2023'));
    assert.ok(!pairIds.includes('2020-2021'));
    assert.ok(!pairIds.includes('2023-2024'));
  });

  it('quality summary excludes 2020', async () => {
    const res = await get(4000, '/api/v1/dashboard?view=quality&year=2024');
    assert.strictEqual(res.status, 200);
    const d = JSON.parse(res.body);
    assert.ok(d.qualitySummary);
    assert.strictEqual(d.qualitySummary.observations, 546198);
  });
});