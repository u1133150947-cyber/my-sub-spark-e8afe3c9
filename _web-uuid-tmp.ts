import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => c.exec(`
find / -maxdepth 6 -name '*.db' 2>/dev/null | grep -iE 'sub-?manager|app\\.db' | head
echo ---
sqlite3 /opt/sub-manager/data/app.db 'SELECT id, name, client_uuid FROM subscriptions LIMIT 5;' 2>&1
`, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: process.env.SSH_PANEL_HOST!, port: 22, username: process.env.SSH_PANEL_USER!, password: process.env.SSH_PANEL_PASSWORD! });