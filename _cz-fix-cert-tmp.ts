import { Client } from 'ssh2';
const jump = new Client();
jump.on('ready', () => {
  jump.forwardOut('127.0.0.1', 0, '185.87.148.138', 22, (err, stream) => {
    if (err) { console.error(err.message); jump.end(); return; }
    const cz = new Client();
    cz.on('ready', () => cz.exec(`
echo '=== cdn-origin cert ==='
ls -la /root/.acme.sh/cdn-origin.panelsu.ru_ecc/ 2>&1
echo '=== 185 cert ==='
ls -la /root/.acme.sh/185.87.148.138_ecc/ 2>&1
echo '=== how RU server checks hy2 (auth URL is web.panelsu.ru/api/hy2/auth) ==='
echo '=== using cdn-origin cert ==='
cat > /etc/hysteria/config.yaml <<'YAML'
listen: :443

tls:
  cert: /root/.acme.sh/cdn-origin.panelsu.ru_ecc/fullchain.cer
  key: /root/.acme.sh/cdn-origin.panelsu.ru_ecc/cdn-origin.panelsu.ru.key

auth:
  type: http
  http:
    url: https://web.panelsu.ru/api/hy2/auth
    insecure: false

bandwidth:
  up: 1 gbps
  down: 1 gbps

ignoreClientBandwidth: false

quic:
  initStreamReceiveWindow: 16777216
  maxStreamReceiveWindow: 33554432
  initConnReceiveWindow: 33554432
  maxConnReceiveWindow: 67108864
  maxIdleTimeout: 30s
  maxIncomingStreams: 1024
  disablePathMTUDiscovery: false

masquerade:
  type: proxy
  proxy:
    url: https://bing.com
    rewriteHost: true
YAML
systemctl restart hysteria-server.service
sleep 3
echo '=== status ==='
systemctl is-active hysteria-server.service
journalctl -u hysteria-server -n 12 --no-pager 2>&1 | tail -12
echo '=== udp:443 ==='
ss -lunp 2>/dev/null | grep ':443'
`, (e, s) => {
      if (e) { console.error(e); cz.end(); jump.end(); return; }
      s.on('close', () => { cz.end(); jump.end(); })
       .on('data', d => process.stdout.write(d.toString()))
       .stderr.on('data', d => process.stderr.write(d.toString()));
    })).on('error', e => { console.error('CZ ERR', e.message); jump.end(); })
       .connect({ sock: stream, username: 'root', password: 'hf6Ka8viMl', readyTimeout: 25000 });
  });
}).on('error', e => console.error('JUMP ERR', e.message))
  .connect({ host: process.env.SSH_PANEL_HOST!, port: 22, username: process.env.SSH_PANEL_USER!, password: process.env.SSH_PANEL_PASSWORD!, readyTimeout: 15000 });
