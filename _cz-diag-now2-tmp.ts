import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== UPTIME / LOAD ==='
uptime
echo '=== DISK ==='
df -h / 2>/dev/null | tail -3
echo '=== MEMORY ==='
free -m | head -2
echo '=== SERVICES ==='
for s in x-ui hysteria-server nginx caddy; do
  printf "%-20s " "$s:"; systemctl is-active $s 2>/dev/null || echo "n/a"
done
echo '=== LISTENING PORTS (web/vpn) ==='
ss -lntup 2>/dev/null | grep -E ':(80|443|2053|2080|8443|44433|10444) ' | head -20
echo '=== X-UI STATUS ==='
systemctl status x-ui --no-pager -n 5 2>/dev/null | head -15
echo '=== HYSTERIA STATUS ==='
systemctl status hysteria-server --no-pager -n 5 2>/dev/null | head -15
echo '=== RECENT X-UI ERRORS ==='
journalctl -u x-ui -n 30 --no-pager 2>/dev/null | grep -iE 'error|fail|panic' | tail -10
echo '=== RECENT HY2 ERRORS ==='
journalctl -u hysteria-server -n 30 --no-pager 2>/dev/null | grep -iE 'error|fail|panic' | tail -10
echo '=== CONNECTIVITY TO PANEL ==='
curl -sk -o /dev/null -w 'panel HTTPS code=%{http_code} time=%{time_total}s\n' https://127.0.0.1:2053/czpanel_a7f3k9/ 2>&1
echo '=== INBOUNDS ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id, remark, port, protocol, enable FROM inbounds;" 2>/dev/null
echo '=== DNS ==='
getent hosts cz.panelsu.ru
`;
c.on('ready', () => c.exec(cmd, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).on('error', e => console.error('SSH ERROR:', e.message))
  .connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl', readyTimeout: 10000 });
