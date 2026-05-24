import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => c.exec(`
echo '=== PING CZ ==='
ping -c 3 -W 2 185.87.148.138 2>&1 | tail -4
echo '=== TCP 22 CZ ==='
timeout 5 bash -c '</dev/tcp/185.87.148.138/22' && echo OPEN || echo CLOSED
echo '=== TCP 443 CZ ==='
timeout 5 bash -c '</dev/tcp/185.87.148.138/443' && echo OPEN || echo CLOSED
echo '=== DNS cz.panelsu.ru ==='
getent hosts cz.panelsu.ru
echo '=== APP DB panel status ==='
sqlite3 /opt/sub-manager/data/app.db "SELECT slug,name,host,status,status_message,updated_at FROM panels WHERE country='CZ' OR name LIKE '%Чех%';" 2>&1
echo '=== sub-manager service ==='
systemctl is-active sub-manager
`, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).on('error', e => console.error('SSH ERR', e.message))
  .connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx', readyTimeout: 10000 });
