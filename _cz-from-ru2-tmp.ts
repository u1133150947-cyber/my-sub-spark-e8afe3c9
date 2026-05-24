import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => c.exec(`
echo '=== PING CZ from RU ==='
ping -c 3 -W 2 185.87.148.138 2>&1 | tail -4
echo '=== TCP 22 ==='
timeout 5 bash -c '</dev/tcp/185.87.148.138/22' && echo OPEN || echo CLOSED
echo '=== TCP 443 ==='
timeout 5 bash -c '</dev/tcp/185.87.148.138/443' && echo OPEN || echo CLOSED
echo '=== TCP 2053 ==='
timeout 5 bash -c '</dev/tcp/185.87.148.138/2053' && echo OPEN || echo CLOSED
echo '=== DNS cz.panelsu.ru ==='
getent hosts cz.panelsu.ru
echo '=== mtr CZ (10 hops) ==='
timeout 8 mtr -rn -c 2 185.87.148.138 2>&1 | head -15 || traceroute -n -m 12 -w 1 185.87.148.138 2>&1 | head -15
echo '=== app.db CZ panel ==='
sqlite3 /opt/sub-manager/data/app.db "SELECT slug,name,host,status,status_message,updated_at FROM panels;" 2>&1
echo '=== sub-manager logs (last cz errors) ==='
journalctl -u sub-manager -n 200 --no-pager 2>/dev/null | grep -iE 'cz|185.87|чех' | tail -15
`, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).on('error', e => console.error('SSH ERR', e.message))
  .connect({ host: process.env.SSH_PANEL_HOST!, port: 22, username: process.env.SSH_PANEL_USER!, password: process.env.SSH_PANEL_PASSWORD!, readyTimeout: 10000 });
