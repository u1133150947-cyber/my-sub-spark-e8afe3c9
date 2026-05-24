import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== UPTIME ==='; uptime
echo '=== DISK ==='; df -h / | tail -2
echo '=== MEM ==='; free -m | head -2
echo '=== SERVICES ==='
for s in x-ui nginx caddy hysteria-server; do
  printf "%-20s " "$s:"; systemctl is-active $s 2>/dev/null
done
echo '=== LISTENERS ==='
ss -lntp 2>/dev/null | grep -E ':(80|443|2053|8443|4430|10444) '
echo '=== X-UI STATUS ==='
systemctl status x-ui --no-pager -n 10 2>/dev/null
echo '=== X-UI LOG TAIL ==='
journalctl -u x-ui -n 40 --no-pager 2>/dev/null | tail -40
echo '=== PANEL LOCAL TEST ==='
curl -sk -o /dev/null -w 'panel root https=%{http_code} t=%{time_total}\n' https://127.0.0.1:2053/
curl -sk -o /dev/null -w 'panel root http=%{http_code}\n' http://127.0.0.1:2053/
echo '=== PANEL DOMAIN TEST ==='
curl -sk -o /dev/null -w 'ru.panelsu.ru/=%{http_code} t=%{time_total}\n' https://ru.panelsu.ru/
echo '=== X-UI SETTINGS ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT key,value FROM settings WHERE key IN ('webPort','webBasePath','webDomain','webCertFile','webKeyFile');" 2>/dev/null
echo '=== INBOUNDS ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id, remark, port, protocol, enable FROM inbounds;" 2>/dev/null
`;
c.on('ready', () => c.exec(cmd, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).on('error', e => console.error('SSH ERROR:', e.message))
  .connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx', readyTimeout: 15000 });
