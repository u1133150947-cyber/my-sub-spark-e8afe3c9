import { Client } from 'ssh2';
const AUTH = 'c92866b0-40bd-4e2e-ad0f-3dfdd90332e6';
const cfg = JSON.stringify({
  log: { loglevel: 'warning' },
  inbounds: [{ listen: '127.0.0.1', port: 19091, protocol: 'socks', settings: { auth: 'noauth', udp: true }, tag: 'socks' }],
  outbounds: [{
    tag: 'proxy', protocol: 'hysteria2',
    settings: { servers: [{ address: 'se.panelsu.ru', port: 443, password: AUTH }] },
    streamSettings: { network: 'raw', security: 'tls', tlsSettings: { serverName: 'se.panelsu.ru', alpn: ['h3'] } }
  }]
}).replace(/'/g, "'\\''");

const cmd = `
XRAY=/usr/local/x-ui/bin/xray-linux-amd64
echo "xray: $XRAY"
printf '%s' '${cfg}' > /tmp/sehy.json
pkill -f 'sehy.json' 2>/dev/null; sleep 0.5
nohup $XRAY run -c /tmp/sehy.json > /tmp/sehy.log 2>&1 </dev/null &
disown
for i in $(seq 1 30); do ss -lnt 2>/dev/null | grep -q ':19091' && break; sleep 0.3; done
ss -lnt | grep ':19091' || echo 'NO LISTEN'
echo '--- curl ifconfig.me ---'
curl -x socks5h://127.0.0.1:19091 -m 12 -sS -w '\\nHTTP=%{http_code} IP=%{remote_ip} TIME=%{time_total}\\n' https://ifconfig.me 2>&1 || echo CURL_FAIL=$?
echo '--- curl gen_204 ---'
curl -x socks5h://127.0.0.1:19091 -m 12 -sS -w 'GEN204=%{http_code} TIME=%{time_total}\\n' -o /dev/null http://cp.cloudflare.com/generate_204 2>&1 || echo CURL_FAIL=$?
echo '--- xray log ---'
tail -25 /tmp/sehy.log 2>&1
pkill -f 'sehy.json' 2>/dev/null
true
`;

const c = new Client();
c.on('ready', () => c.exec(cmd, { pty: true }, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl' });