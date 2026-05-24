import { Client } from 'ssh2';
const PW = process.env.RU_SSH_PASSWORD!;
const c = new Client();
const cmd = `
echo '=== UPTIME ==='; uptime
echo '=== DISK ==='; df -h / | tail -2
echo '=== MEM ==='; free -m | head -2
echo '=== SERVICES ==='
for s in x-ui nginx caddy hysteria-server; do printf "%-22s " "$s:"; systemctl is-active $s 2>/dev/null; done
echo '=== LISTENERS ==='
ss -lntp 2>/dev/null | grep -E ':(80|443|2053|8443|4430|10444) '
echo '=== X-UI STATUS ==='
systemctl status x-ui --no-pager -n 8 2>/dev/null
echo '=== X-UI LOG (errors) ==='
journalctl -u x-ui -n 60 --no-pager 2>/dev/null | grep -iE 'error|fail|panic|fatal' | tail -20
echo '=== X-UI LOG (last 25) ==='
journalctl -u x-ui -n 25 --no-pager 2>/dev/null
echo '=== SETTINGS ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT key,value FROM settings WHERE key IN ('webPort','webBasePath','webDomain','webCertFile','webKeyFile','webListen');" 2>/dev/null
echo '=== INBOUNDS ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id, remark, port, protocol, enable FROM inbounds;" 2>/dev/null
echo '=== LOCAL PANEL TEST ==='
PORT=$(sqlite3 /etc/x-ui/x-ui.db "SELECT value FROM settings WHERE key='webPort';" 2>/dev/null)
BP=$(sqlite3 /etc/x-ui/x-ui.db "SELECT value FROM settings WHERE key='webBasePath';" 2>/dev/null)
echo "configured webPort=$PORT webBasePath=$BP"
curl -sk -o /dev/null -w 'https://127.0.0.1:'$PORT'/ -> %{http_code} t=%{time_total}\n' --max-time 5 https://127.0.0.1:$PORT/
curl -sk -o /dev/null -w 'http://127.0.0.1:'$PORT'/ -> %{http_code} t=%{time_total}\n' --max-time 5 http://127.0.0.1:$PORT/
echo '=== CADDY STATUS ==='
systemctl status caddy --no-pager -n 8 2>/dev/null
echo '=== CADDY LOG ==='
journalctl -u caddy -n 30 --no-pager 2>/dev/null | tail -20
`;
c.on('ready', () => c.exec(cmd, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).on('error', e => console.error('SSH ERR:', e.message))
  .connect({ host: '82.202.128.147', port: 22, username: 'root', password: PW, readyTimeout: 15000 });
