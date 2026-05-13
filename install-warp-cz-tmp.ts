import { Client } from 'ssh2';
const c = new Client();
const cmd = `set -e
apt-get install -y -qq gpg curl lsb-release ca-certificates 2>&1 | tail -5
curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg | gpg --yes --dearmor -o /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ $(lsb_release -cs) main" > /etc/apt/sources.list.d/cloudflare-client.list
apt-get update -qq
apt-get install -y cloudflare-warp 2>&1 | tail -5
systemctl enable --now warp-svc || true
sleep 4
warp-cli --accept-tos registration new || true
warp-cli --accept-tos mode proxy
warp-cli --accept-tos proxy port 40000
warp-cli --accept-tos connect
sleep 5
warp-cli --accept-tos status
echo '--- WARP TEST ---'
curl -s --max-time 10 --socks5 127.0.0.1:40000 https://www.cloudflare.com/cdn-cgi/trace/ | grep -E '^(ip|warp|loc)='
echo '--- DIRECT ---'
curl -s --max-time 10 https://www.cloudflare.com/cdn-cgi/trace/ | grep -E '^(ip|warp|loc)='
`;
c.on('ready', () => c.exec(cmd, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl', readyTimeout: 30000 });
