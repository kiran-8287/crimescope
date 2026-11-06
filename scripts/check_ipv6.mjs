import http from 'node:http';

function check(host) {
  return new Promise((resolve) => {
    const req = http.get({ host, port: 4000, path: '/health', family: host === '::1' ? 6 : 4 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ host, status: res.statusCode, data }));
    });
    req.on('error', err => resolve({ host, error: err.message }));
  });
}

async function main() {
  console.log("Checking [::1]:4000...");
  const ipv6 = await check('::1');
  console.log("IPv6 result:", ipv6);

  console.log("Checking 127.0.0.1:4000...");
  const ipv4 = await check('127.0.0.1');
  console.log("IPv4 result:", ipv4);
}

main();

