async function addInbound(url: string, user: string, pass: string, payload: any) {
  // Login
  const loginRes = await fetch(\`\${url}login\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: user, password: pass }).toString(),
  });
  if (loginRes.status !== 200) throw new Error(\`Login failed \${loginRes.status}\`);
  const ck = loginRes.headers.get('set-cookie')?.split(';')[0];

  // Add
  const bodyParams = new URLSearchParams();
  for (const [k, v] of Object.entries(payload)) {
    bodyParams.append(k, String(v));
  }
  const addRes = await fetch(\`\${url}panel/api/inbounds/add\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': ck! },
    body: bodyParams.toString(),
  });
  const json = await addRes.json();
  if (!json.success) throw new Error(\`Add failed: \${json.msg}\`);
  return json;
}

async function run() {
  const czUrl = 'https://cz.panelsu.ru:35978/xeTpFidUtYR5eNrCJB/';
  const czUser = 'XRL5vJ94';
  const czPass = 'ZSLFw8KE';
  
  const ruUrl = 'https://ru.panelsu.ru/';
  const ruUser = 'admin';
  const ruPass = '6WYia!Y5gV5D';

  console.log('Adding to CZ...');
  try {
    await addInbound(czUrl, czUser, czPass, {
      up: 0, down: 0, total: 0, remark: '🚀 Hysteria Европа (Direct)', enable: true, expiryTime: 0,
      listen: '', port: 44433, protocol: 'hysteria2',
      settings: JSON.stringify({
        clients: [],
        obfs: "",
        obfsPassword: ""
      }),
      streamSettings: JSON.stringify({
        network: 'hysteria2', security: 'tls',
        tlsSettings: {
          serverName: 'cz.panelsu.ru',
          certificates: [{
            certificateFile: '/root/cert/cz.panelsu.ru/fullchain.pem',
            keyFile: '/root/cert/cz.panelsu.ru/privkey.pem'
          }]
        }
      }),
      sniffing: JSON.stringify({ enabled: true, destOverride: ['http', 'tls', 'quic'], routeOnly: false })
    });
    console.log('CZ Success');
  } catch (e) {
    console.error('CZ Error:', e);
  }

  console.log('Adding to RU...');
  try {
    await addInbound(ruUrl, ruUser, ruPass, {
      up: 0, down: 0, total: 0, remark: '⚡ Hysteria RU (Только YouTube)', enable: true, expiryTime: 0,
      listen: '', port: 44433, protocol: 'hysteria2',
      settings: JSON.stringify({
        clients: [],
        obfs: "",
        obfsPassword: ""
      }),
      streamSettings: JSON.stringify({
        network: 'hysteria2', security: 'tls',
        tlsSettings: {
          serverName: 'ru.panelsu.ru',
          certificates: [{
            certificateFile: '/var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/ru.panelsu.ru/ru.panelsu.ru.crt',
            keyFile: '/var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/ru.panelsu.ru/ru.panelsu.ru.key'
          }]
        }
      }),
      sniffing: JSON.stringify({ enabled: true, destOverride: ['http', 'tls', 'quic'], routeOnly: false })
    });
    console.log('RU Success');
  } catch (e) {
    console.error('RU Error:', e);
  }
}
run();
