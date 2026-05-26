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

const cmd = `set -e
XRAY=$(ls /usr/local/x-ui/bin/xray* 2>/dev/null | head -1)
[ -z "$XRAY" ] && XRAY=$(which xray)
echo "xray: $XRAY"
$XRAY version 2>&1 | head -1
printf '%s' '${cfg}' > /tmp/sehy.json
pkill -f 'xray.*sehy' 2>/dev/null; sleep 0.5
($XRAY run -c /tmp/sehy.json > /tmp/sehy.log 2>&1 &)
for i in $(seq 1 20); do ss -lnt | grep -q ':19091' && break; sleep 0.2; done
echo '--- curl via SE hy2 ---'
curl -x socks5h://127.0.0.1:19091 -m 10 -sS -w 'HTTP=%{http_code} IP=%{remote_ip} TIME=%{time_total}\\n' https://ifconfig.me; echo
curl -x socks5h://127.0.0.1:19091 -m 10 -sS -w 'GEN204=%{http_code} TIME=%{time_total}\\n' -o /dev/null http://cp.cloudflare.com/generate_204
echo '--- xray log tail ---'
tail -20 /tmp/sehy.log
pkill -f 'xray.*sehy' 2>/dev/null
`;

const c = new Client();
c.on('ready', () => c.exec(cmd, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });