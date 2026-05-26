import { Client } from 'ssh2';
const HOST = '87.121.105.143';
const PW = 'f4OQrEBYUQnEmwkgqPnwDD';
const DOMAIN = 'se.panelsu.ru';

const script = `set -e
echo '=== install deps ==='
apt-get update -qq >/dev/null 2>&1
apt-get install -y -qq curl socat sqlite3 ca-certificates >/dev/null 2>&1

echo '=== acme.sh ==='
if [ ! -d /root/.acme.sh ]; then
  curl -fsSL https://get.acme.sh | sh -s email=admin@panelsu.ru >/dev/null 2>&1
fi
/root/.acme.sh/acme.sh --set-default-ca --server letsencrypt >/dev/null 2>&1 || true

echo '=== issue cert (standalone, port 80) ==='
if [ ! -f /root/.acme.sh/${DOMAIN}_ecc/${DOMAIN}.cer ]; then
  /root/.acme.sh/acme.sh --issue -d ${DOMAIN} --standalone -k ec-256 2>&1 | tail -10
else
  echo 'cert already exists'
fi
ls -la /root/.acme.sh/${DOMAIN}_ecc/ 2>&1 | head -5

echo '=== install hysteria 2 ==='
if [ ! -x /usr/local/bin/hysteria ]; then
  bash <(curl -fsSL https://get.hy2.sh/) 2>&1 | tail -5
fi
/usr/local/bin/hysteria version 2>&1 | head -3

echo '=== write config ==='
mkdir -p /etc/hysteria
cat > /etc/hysteria/config.yaml <<'YAML'
listen: :443

tls:
  cert: /root/.acme.sh/${DOMAIN}_ecc/fullchain.cer
  key: /root/.acme.sh/${DOMAIN}_ecc/${DOMAIN}.key

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

echo '=== enable + start ==='
systemctl daemon-reload
systemctl enable --now hysteria-server.service 2>&1 | tail -3
sleep 2
systemctl is-active hysteria-server
echo '--- logs ---'
journalctl -u hysteria-server -n 15 --no-pager | tail -15
echo '--- udp:443 ---'
ss -lunp | grep ':443' || echo 'NOT LISTENING'
echo '--- firewall ---'
ufw status 2>/dev/null | head -5
iptables -S INPUT 2>/dev/null | grep -E '443|DROP|REJECT' | head -5
`;

const c = new Client();
c.on('ready', () => c.exec(script, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).on('error', e => console.error('ERR', e.message))
  .connect({ host: HOST, port: 22, username: 'root', password: PW, readyTimeout: 30000 });