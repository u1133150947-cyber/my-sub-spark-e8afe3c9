import { Client } from 'ssh2';

const TARGETS = [
  { name: 'CZ', host: '185.87.148.138', pw: 'hf6Ka8viMl', domain: 'czcdn.panelsu.ru' },
  { name: 'RU', host: '82.202.128.147', pw: process.env.RU_SSH_PASSWORD!, domain: 'rucdn.panelsu.ru' },
];

const mkScript = (DOMAIN: string) => `set -e
echo '== check state =='
id hysteria 2>&1 || echo 'NO_USER'
which hysteria || echo 'NO_BIN'
ls /root/.acme.sh/${DOMAIN}_ecc/ 2>&1 | head -3 || echo 'NO_CERT'

echo '== wait apt =='
for i in 1 2 3 4 5 6 7 8 9 10; do
  if ! fuser /var/lib/dpkg/lock-frontend 2>/dev/null; then break; fi
  echo apt locked, wait...; sleep 3
done

echo '== install deps =='
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl socat ca-certificates 2>&1 | tail -3

echo '== acme =='
if [ ! -d /root/.acme.sh ]; then
  curl -fsSL https://get.acme.sh | sh -s email=admin@panelsu.ru 2>&1 | tail -3
fi
/root/.acme.sh/acme.sh --set-default-ca --server letsencrypt >/dev/null 2>&1 || true

echo '== cert =='
if [ ! -f /root/.acme.sh/${DOMAIN}_ecc/${DOMAIN}.cer ]; then
  systemctl stop nginx 2>/dev/null || true
  systemctl stop apache2 2>/dev/null || true
  fuser -k 80/tcp 2>/dev/null || true
  sleep 1
  /root/.acme.sh/acme.sh --issue -d ${DOMAIN} --standalone -k ec-256 2>&1 | tail -10
  systemctl start nginx 2>/dev/null || true
  systemctl start apache2 2>/dev/null || true
fi
ls /root/.acme.sh/${DOMAIN}_ecc/${DOMAIN}.cer 2>&1

echo '== install hy2 =='
if [ ! -x /usr/local/bin/hysteria ]; then
  bash <(curl -fsSL https://get.hy2.sh/) 2>&1 | tail -5
fi
/usr/local/bin/hysteria version | head -2

echo '== ensure hysteria user =='
if ! id hysteria >/dev/null 2>&1; then
  useradd -r -s /usr/sbin/nologin -d /var/lib/hysteria -M hysteria || true
  id hysteria || echo 'STILL NO USER -- will run as root'
fi

echo '== certs =='
mkdir -p /etc/hysteria/certs
cp -f /root/.acme.sh/${DOMAIN}_ecc/fullchain.cer /etc/hysteria/certs/${DOMAIN}.crt
cp -f /root/.acme.sh/${DOMAIN}_ecc/${DOMAIN}.key /etc/hysteria/certs/${DOMAIN}.key
if id hysteria >/dev/null 2>&1; then
  chown -R hysteria:hysteria /etc/hysteria/certs
fi
chmod 640 /etc/hysteria/certs/*

/root/.acme.sh/acme.sh --install-cert -d ${DOMAIN} --ecc \
  --fullchain-file /etc/hysteria/certs/${DOMAIN}.crt \
  --key-file /etc/hysteria/certs/${DOMAIN}.key \
  --reloadcmd "(id hysteria >/dev/null 2>&1 && chown hysteria:hysteria /etc/hysteria/certs/*); systemctl restart hysteria-server" >/dev/null 2>&1 || true

echo '== config =='
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

# if no hysteria user — override service to run as root
if ! id hysteria >/dev/null 2>&1; then
  mkdir -p /etc/systemd/system/hysteria-server.service.d
  cat > /etc/systemd/system/hysteria-server.service.d/override.conf <<'OV'
[Service]
User=root
Group=root
OV
fi

echo '== start =='
systemctl daemon-reload
systemctl enable hysteria-server.service >/dev/null 2>&1
systemctl restart hysteria-server
sleep 3
systemctl is-active hysteria-server || echo INACTIVE
ss -lunp | grep ':443' | head -2 || echo 'NOT LISTENING'
journalctl -u hysteria-server -n 10 --no-pager | tail -10
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
      .connect({ host: t.host, port: 22, username: 'root', password: t.pw, readyTimeout: 30000, keepaliveInterval: 10000 });
  });
}

(async () => {
  await Promise.all(TARGETS.map(runOne));
  console.log('=== DONE ===');
})();