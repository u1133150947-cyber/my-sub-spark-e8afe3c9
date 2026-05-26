import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => c.exec(`
sqlite3 /opt/sub-manager/data/app.db "SELECT id, name, host, port FROM standalone_servers;"
echo --- insert ---
sqlite3 /opt/sub-manager/data/app.db "
INSERT INTO standalone_servers (id, name, host, port, created_at)
VALUES (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
        '🇸🇪 Sweden Hysteria 2', 'se.panelsu.ru', 443, datetime('now'));
SELECT id, name, host, port FROM standalone_servers WHERE host='se.panelsu.ru';"
`, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: process.env.SSH_PANEL_HOST!, port: 22, username: process.env.SSH_PANEL_USER!, password: process.env.SSH_PANEL_PASSWORD! });