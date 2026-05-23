// Test WS through Cloudflare CDN: cdn.panelsu.ru -> CF -> origin
// First just check basic HTTPS + Host:cdn.panelsu.ru works through CF
const tests = [
  { name: 'CF GET /', url: 'https://cdn.panelsu.ru/' },
  { name: 'CF GET /twcdn-ws (expect 400 from xray = WS endpoint alive)', url: 'https://cdn.panelsu.ru/twcdn-ws' },
];
for (const t of tests) {
  try {
    const r = await fetch(t.url, { method: 'GET' });
    const txt = await r.text();
    console.log(`${t.name}: ${r.status} ${r.headers.get('server')||''} body[0..80]=${txt.slice(0,80)}`);
  } catch (e: any) {
    console.log(`${t.name}: ERR ${e.message}`);
  }
}
