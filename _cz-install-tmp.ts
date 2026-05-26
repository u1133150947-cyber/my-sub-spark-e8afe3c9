import { Client } from 'ssh2';
const DOMAIN = 'czcdn.panelsu.ru';
const script = `set -e
echo '== state =='
id hysteria 2>&1 | head -1
which hysteria || echo NO_BIN
ls /root/.acme.sh/${DOMAIN}_ecc/ 2>&1 | head -3

echo '== kill stuck apt =='
pkill -9 -f 'apt-get|dpkg|unattended' 2>/dev/null || true
rm -f /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/cache/apt/archives/lock 2>/dev/null || true
dpkg --configure -a 2>&1 | tail -3 || true

echo '== deps =='
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl socat ca-certificates 2>&1 | tail -3
which curl

echo '== acme =='
if [ ! -d /root/.acme.sh ]; then
  curl -fsSL https://get.acme.sh | sh -s email=admin@panelsu.ru 2>&1 | tail -3
fi
/root/.acme.sh/acme.sh --set-default-ca --server letsencrypt >/dev/null 2>&1 || true

echo '== cert =='
if [ ! -f /root/.acme.sh/${DOMAIN}_ecc/${DOMAIN}.cer ]; then
  # на CZ панель использует nginx на 80? проверим
  ss -lntp | grep ':80 ' || echo '80 free'
  systemctl stop nginx 2>/dev/null || true
  fuser -k 80/tcp 2>/dev/null || true
  sleep 1
  /root/.acme.sh/acme.sh --issue -d ${DOMAIN} --standalone -k ec-256 2>&1 | tail -10
  systemctl start nginx 2>/dev/null || true
fi
ls -la /root/.acme.sh/${DOMAIN}_ecc/${DOMAIN}.cer

echo '== hy2 =='
if [ ! -x /usr/local/bin/hysteria ]; then
  bash <(curl -fsSL https://get.hy2.sh/) 2>&1 | tail -5
fi
/usr/local/bin/hysteria version | head -2
if ! id hysteria >/dev/null 2>&1; then
  useradd -r -s /usr/sbin/nologin -M hysteria || true
fi

echo '== certs perms =='
mkdir -p /etc/hysteria/certs
cp -f /root/.acme.sh/${DOMAIN}_ecc/fullchain.cer /etc/hysteria/certs/${DOMAIN}.crt
cp -f /root/.acme.sh/${DOMAIN}_ecc/${DOMAIN}.key /etc/hysteria/certs/${DOMAIN}.key
chown -R hysteria:hysteria /etc/hysteria/certs 2>/dev/null || true
chmod 640 /etc/hysteria/certs/*
/root/.acme.sh/acme.sh --install-cert -d ${DOMAIN} --ecc \
  --fullchain-file /etc/hysteria/certs/${DOMAIN}.crt \
  --key-file /etc/hysteria/certs/${DOMAIN}.key \
  --reloadcmd "chown hysteria:hysteria /etc/hysteria/certs/* 2>/dev/null; systemctl restart hysteria-server" >/dev/null 2>&1 || true

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

echo '== start =='
systemctl daemon-reload
systemctl enable hysteria-server.service >/dev/null 2>&1
systemctl restart hysteria-server
sleep 3
systemctl is-active hysteria-server
ss -lunp | grep ':443' | head -2 || echo 'NOT LISTENING'
journalctl -u hysteria-server -n 8 --no-pager | tail -8
`;

const c = new Client();
c.on('ready',()=>{console.log('connected');c.exec(script,(e,s)=>{
  s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write('E: '+d.toString()));
})}).on('error',e=>console.error('ERR',e.message))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:30000,keepaliveInterval:10000});