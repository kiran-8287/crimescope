import http from 'node:http';
import zlib from 'node:zlib';

const req = http.get('http://localhost:4000/api/v1/dashboard?view=overview&year=2024&state=all&unitType=administrative_district&category=all', res => {
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    let buf = Buffer.concat(chunks);
    if (res.headers['content-encoding'] === 'gzip') {
      buf = zlib.gunzipSync(buf);
    }
    const json = JSON.parse(buf.toString('utf-8'));
    console.log("meta.releaseId:", json.meta?.releaseId);
    console.log("regions count:", json.regions?.length);
    const admin2024 = json.regions?.filter(r => r.year === 2024 && r.regionType === 'administrative_district');
    console.log("admin 2024 count:", admin2024?.length);
    console.log("sample admin regions 2024:", admin2024?.slice(0, 5).map(r => r.name));
    console.log("observations count:", json.observations?.length);
    const obs2024 = json.observations?.filter(o => o.year === 2024);
    console.log("observations 2024 count:", obs2024?.length);
    console.log("total cases in observations 2024:", obs2024?.reduce((a, b) => a + (b.cases || 0), 0));
  });
});
req.on('error', console.error);

