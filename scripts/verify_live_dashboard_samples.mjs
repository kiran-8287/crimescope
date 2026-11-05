// Stream the live gzip API response and validate two exact observation objects
// without retaining the full 160 MB expanded JSON document in memory.
const response = await fetch("http://localhost:4000/api/v1/dashboard");
if (!response.ok || !response.body) throw new Error(`Dashboard API returned ${response.status}`);
const patterns = new Map([
  ["arunachal", /\{"regionId":"[^"]+","region":"Anjaw","state":"Arunachal Pradesh","regionType":"administrative_district","year":2024,"category":"[^"]+","categoryLabel":"Rape","cases":0,/],
  ["andhra", /\{"regionId":"[^"]+","region":"Anantapuramu","state":"Andhra Pradesh","regionType":"administrative_district","year":2024,"category":"[^"]+","categoryLabel":"Murder BNS \/Section 302 IPC\)","cases":62,/],
]);
const found = new Map();
let carry = "";
for await (const chunk of response.body) {
  const text = carry + Buffer.from(chunk).toString("utf8");
  for (const [key, pattern] of patterns) {
    if (!found.has(key)) {
      const match = pattern.exec(text);
      if (match) found.set(key, match[0]);
    }
  }
  carry = text.slice(-512);
  if (found.size === patterns.size) break;
}
if (found.size !== patterns.size) throw new Error(`API sample records not found: ${[...patterns.keys()].filter(k => !found.has(k)).join(", ")}`);
console.log(JSON.stringify({ status: response.status, contentEncoding: response.headers.get("content-encoding"), records: Object.fromEntries(found) }, null, 2));
