import { Client } from 'ssh2';
const AUTH = 'c92866b0-40bd-4e2e-ad0f-3dfdd90332e6';
const cfgYaml = `server: se.panelsu.ru:443
auth: ${AUTH}
tls:
  sni: se.panelsu.ru
  insecure: false
socks5:
  listen: 127.0.0.1:11080
`;
const b64 = Buffer.from(cfgYaml).toString('base64');

const cmd = `
if ! [ -x /tmp/hyclient ]; then
  curl -fsSL -o /tmp/hyclient https://github.com/apernet/hysteria/releases/latest/download/hysteria-linux-amd64
  chmod +x /tmp/hyclient
fi
/tmp/hyclient version 2>&1 | head -2
ls -la /usr/local/bin/hysteria 2>&1 | head -1
echo '${b64}' | base64 -d > /tmp/hcli.yaml
cat /tmp/hcli.yaml
rm -f /tmp/hcli.log /tmp/hcli.pid
( /tmp/hyclient client -c /tmp/hcli.yaml > /tmp/hcli.log 2>&1 & echo $! > /tmp/hcli.pid )
for i in $(seq 1 30); do ss -lnt | grep -q ':11080' && break; sleep 0.2; done
ss -lnt | grep ':11080' || echo NO_LISTEN
echo '--- curl ifconfig.me via SE-hy2 ---'
curl -x socks5h://127.0.0.1:11080 -m 12 -sS -w '\\nHTTP=%{http_code} IP=%{remote_ip} TIME=%{time_total}\\n' https://ifconfig.me 2>&1
echo '--- curl gen_204 ---'
curl -x socks5h://127.0.0.1:11080 -m 12 -sS -o /dev/null -w 'GEN204=%{http_code} TIME=%{time_total}\\n' http://cp.cloudflare.com/generate_204 2>&1
echo '--- client log ---'
tail -20 /tmp/hcli.log
kill $(cat /tmp/hcli.pid) 2>/dev/null
true
`;
const c = new Client();
c.on('ready', () => c.exec(cmd, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl' });