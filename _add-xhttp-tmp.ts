// Add VLESS+xHTTP inbound on port 8080 via 3x-ui API. Does NOT touch existing inbound 2.
const BASE = 'https://185.87.148.138:2053/czpanel_a7f3k9';
const USER = 'cz_admin_x9K', PW = 'Tz7$mQv2Lp8Wn4Rg!Hd';

// disable TLS verify
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const jar: string[] = [];
const headers = () => ({ 'cookie': jar.join('; '), 'content-type': 'application/x-www-form-urlencoded', 'accept': 'application/json' });
const captureCookies = (r: Response) => {
  const sc = r.headers.getSetCookie?.() ?? [];
  for (const c of sc) { const kv = c.split(';')[0]; jar.push(kv); }
};

// 1. login
const lr = await fetch(`${BASE}/login`, { method: 'POST', headers: headers(), body: `username=${encodeURIComponent(USER)}&password=${encodeURIComponent(PW)}` });
captureCookies(lr);
console.log('login', lr.status, await lr.text());

// 2. generate uuid + random path + random subId
const uuid = crypto.randomUUID();
const rand = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map(b=>b.toString(16).padStart(2,'0')).join('');
const path = '/' + rand(8);
const email = 'xhttp-' + rand(4);

const stream = {
  network: 'xhttp',
  security: 'none',
  externalProxy: [],
  xhttpSettings: {
    path,
    host: '',
    headers: {},
    scMaxBufferedPosts: 30,
    scMaxEachPostBytes: '1000000',
    noSSEHeader: false,
    xPaddingBytes: '100-1000',
    mode: 'auto'
  },
  sockopt: { acceptProxyProtocol: false, tcpFastOpen: false, mark: 0, tproxy: 'off' }
};

const settings = {
  clients: [{
    id: uuid, flow: '', email,
    limitIp: 0, totalGB: 0, expiryTime: 0, enable: true,
    tgId: '', subId: rand(8), reset: 0
  }],
  decryption: 'none', fallbacks: []
};

const sniffing = { enabled: true, destOverride: ['http','tls','quic','fakedns'], metadataOnly: false, routeOnly: false };
const allocate = { strategy: 'always', refresh: 5, concurrency: 3 };

const form = new URLSearchParams({
  up: '0', down: '0', total: '0',
  remark: 'cz-xhttp-cdn-8080',
  enable: 'true',
  expiryTime: '0',
  listen: '',
  port: '8080',
  protocol: 'vless',
  settings: JSON.stringify(settings),
  streamSettings: JSON.stringify(stream),
  sniffing: JSON.stringify(sniffing),
  allocate: JSON.stringify(allocate),
});

const ar = await fetch(`${BASE}/panel/api/inbounds/add`, { method: 'POST', headers: headers(), body: form.toString() });
const at = await ar.text();
console.log('add', ar.status, at);

console.log('\n=== CREATED ===');
console.log('uuid:', uuid);
console.log('path:', path);
console.log('email:', email);
console.log('port: 8080');
