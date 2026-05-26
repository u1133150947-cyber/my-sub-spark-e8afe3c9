import { Client } from 'ssh2';
const AUTH = 'c92866b0-40bd-4e2e-ad0f-3dfdd90332e6';
const cfgJson = JSON.stringify({
  log: { loglevel: 'warning' },
  inbounds: [{ listen: '127.0.0.1', port: 19091, protocol: 'socks', settings: { auth: 'noauth', udp: true }, tag: 'socks' }],
  outbounds: [{
    tag: 'proxy', protocol: 'hysteria2',
    settings: { servers: [{ address: 'se.panelsu.ru', port: 443, password: AUTH }] },
    streamSettings: { network: 'raw', security: 'tls', tlsSettings: { serverName: 'se.panelsu.ru', alpn: ['h3'] } }
  }]
});
const cfgB64 = Buffer.from(cfgJson).toString('base64');

const cmd = `
XRAY=/usr/local/x-ui/bin/xray-linux-amd64
echo "xray: $XRAY"
echo '${cfgB64}' | base64 -d > /tmp/hyse.json
ls -la /tmp/hyse.json
pkill -f 'xray.*hyse' 2>/dev/null; sleep 0.5
setsid $XRAY run -c /tmp/hyse.json > /tmp/hyse.log 2>&1 < /dev/null &
for i in $(seq 1 30); do ss -lnt 2>/dev/null | grep -q ':19091' && break; sleep 0.3; done
ss -lnt | grep ':19091' || echo 'NO LISTEN'
echo '--- curl ifconfig.me ---'
curl -x socks5h://127.0.0.1:19091 -m 12 -sS -w '\\nHTTP=%{http_code} IP=%{remote_ip} TIME=%{time_total}\\n' https://ifconfig.me 2>&1 || echo CURL_FAIL=$?
echo '--- curl gen_204 ---'
curl -x socks5h://127.0.0.1:19091 -m 12 -sS -w 'GEN204=%{http_code} TIME=%{time_total}\\n' -o /dev/null http://cp.cloudflare.com/generate_204 2>&1 || echo CURL_FAIL=$?
echo '--- xray log ---'
tail -25 /tmp/hyse.log 2>&1
pkill -f 'xray.*hyse' 2>/dev/null
true
`;

const c = new Client();
c.on('ready', () => c.exec(cmd, { pty: true }, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl' });