import { addInbound } from './server/x3ui.ts';
async function test() {
  try {
    const resCZ = await addInbound('pcd6225b652', { // CZ slug
      up: 0, down: 0, total: 0, remark: '🚀 Hysteria Европа (Direct)', enable: true, expiryTime: 0,
      listen: '', port: 44433, protocol: 'hysteria2',
      settings: JSON.stringify({
        clients: [{ id: crypto.randomUUID(), email: 'h2-cz@sub.local', password: crypto.randomUUID().replace(/-/g, '') }],
        obfs: "salamander",
        obfsPassword: "test"
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
      sniffing: JSON.stringify({ enabled: true, destOverride: ['http', 'tls', 'quic'] })
    });
    console.log('Success CZ:', resCZ);
  } catch (e) {
    console.log('Failed CZ:', e.message);
  }

  try {
    const resRU = await addInbound('pdfc697ecd5', { // RU slug
      up: 0, down: 0, total: 0, remark: '⚡ Hysteria RU (Только YouTube)', enable: true, expiryTime: 0,
      listen: '', port: 44433, protocol: 'hysteria2',
      settings: JSON.stringify({
        clients: [{ id: crypto.randomUUID(), email: 'h2-ru@sub.local', password: crypto.randomUUID().replace(/-/g, '') }],
        obfs: "salamander",
        obfsPassword: "test"
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
    console.log('Success RU:', resRU);
  } catch (e) {
    console.log('Failed RU:', e.message);
  }
}
test();
