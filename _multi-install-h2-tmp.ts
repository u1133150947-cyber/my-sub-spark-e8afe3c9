import { Client } from 'ssh2';

const TARGETS = [
  { name: 'CZ', host: '185.87.148.138', pw: 'hf6Ka8viMl', domain: 'czcdn.panelsu.ru' },
  { name: 'DE', host: '171.22.31.25',  pw: 'ObAvtvfpvQFUfSVCXyW99Mdi', domain: 'decdn.panelsu.ru' },
  { name: 'RU', host: '82.202.128.147', pw: process.env.RU_SSH_PASSWORD!, domain: 'rucdn.panelsu.ru' },
];

const mkScript = (DOMAIN: string) => `set -e
echo '=== deps ==='
apt-get update -qq >/dev/null 2>&1
apt-get install -y -qq curl socat ca-certificates >/dev/null 2>&1

echo '=== acme.sh ==='
if [ ! -d /root/.acme.sh ]; then
  curl -fsSL https://get.acme.sh | sh -s email=admin@panelsu.ru >/dev/null 2>&1
fi
/root/.acme.sh/acme.sh --set-default-ca --server letsencrypt >/dev/null 2>&1 || true

echo '=== free port 80 for standalone ==='
# nginx/apache могут держать 80 — временно стопаем
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true
# x-ui обычно слушает свой порт, не 80, но на всякий
fuser -k 80/tcp 2>/dev/null || true
sleep 1

echo '=== issue cert ==='
if [ ! -f /root/.acme.sh/${DOMAIN}_ecc/${DOMAIN}.cer ]; then
  /root/.acme.sh/acme.sh --issue -d ${DOMAIN} --standalone -k ec-256 2>&1 | tail -8
else
  echo 'cert exists'
fi

# вернуть веб обратно
systemctl start nginx 2>/dev/null || true
systemctl start apache2 2>/dev/null || true

echo '=== install hy2 ==='
if [ ! -x /usr/local/bin/hysteria ]; then
  bash <(curl -fsSL https://get.hy2.sh/) 2>&1 | tail -3
fi
/usr/local/bin/hysteria version | head -2

echo '=== certs perms ==='
mkdir -p /etc/hysteria/certs
cp /root/.acme.sh/${DOMAIN}_ecc/fullchain.cer /etc/hysteria/certs/${DOMAIN}.crt
cp /root/.acme.sh/${DOMAIN}_ecc/${DOMAIN}.key /etc/hysteria/certs/${DOMAIN}.key
chown -R hysteria:hysteria /etc/hysteria/certs
chmod 640 /etc/hysteria/certs/*

# reloadcmd чтоб после обновления копировались
/root/.acme.sh/acme.sh --install-cert -d ${DOMAIN} --ecc \
  --fullchain-file /etc/hysteria/certs/${DOMAIN}.crt \
  --key-file /etc/hysteria/certs/${DOMAIN}.key \
  --reloadcmd "chown hysteria:hysteria /etc/hysteria/certs/*.crt /etc/hysteria/certs/*.key && systemctl restart hysteria-server" >/dev/null 2>&1 || true

echo '=== config ==='
cat > /etc/hysteria/config.yaml <<'YAML'
listen: :443

tls:
  cert: /etc/hysteria/certs/${DOMAIN}.crt
  key: /etc/hysteria/certs/${DOMAIN}.key

auth:
  type: http
  http:
    url: https://web.panelsu.ru/api/hy2/auth
    insecure: false

bandwidth:
  up: 1 gbps
  down: 1 gbps

quic:
  initStreamReceiveWindow: 16777216
  maxStreamReceiveWindow: 33554432
  initConnReceiveWindow: 33554432
  maxConnReceiveWindow: 67108864
  maxIdleTimeout: 30s
  maxIncomingStreams: 1024

masquerade:
  type: proxy
  proxy:
    url: https://bing.com
    rewriteHost: true
YAML

echo '=== start ==='
systemctl daemon-reload
systemctl enable --now hysteria-server.service >/dev/null 2>&1
systemctl restart hysteria-server
sleep 2
systemctl is-active hysteria-server
ss -lunp | grep ':443' | head -2 || echo 'NOT LISTENING UDP/443'
journalctl -u hysteria-server -n 8 --no-pager | tail -8
`;

function runOne(t: typeof TARGETS[0]) {
  return new Promise<void>((resolve) => {
    const c = new Client();
    const prefix = `[${t.name}]`;
    c.on('ready', () => {
      console.log(`${prefix} connected`);
      c.exec(mkScript(t.domain), (e, s) => {
        if (e) { console.error(prefix, 'exec err', e.message); c.end(); return resolve(); }
        s.on('close', () => { c.end(); resolve(); })
         .on('data', (d: Buffer) => d.toString().split('\n').forEach(l => l && console.log(prefix, l)))
         .stderr.on('data', (d: Buffer) => d.toString().split('\n').forEach(l => l && console.error(prefix, 'E', l)));
      });
    }).on('error', e => { console.error(prefix, 'ERR', e.message); resolve(); })
      .connect({ host: t.host, port: 22, username: 'root', password: t.pw, readyTimeout: 30000 });
  });
}

(async () => {
  await Promise.all(TARGETS.map(runOne));
  console.log('=== DONE ===');
})();