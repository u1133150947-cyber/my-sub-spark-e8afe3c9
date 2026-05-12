import { Client } from 'ssh2';
const conn = new Client();
const cmd = String.raw`
cat > /tmp/fix_panels.sql <<'SQL'
UPDATE panels SET username='XRL5vJ94', password='ZSLFw8KE', panel_url='https://cz.panelsu.ru:35978/xeTpFidUtYR5eNrCJB/', host='cz.panelsu.ru', public_host='cz.panelsu.ru' WHERE slug='pd4e485d3c9';
UPDATE panels SET username='admin', password='6WYia!Y5gV5D', panel_url='https://ru.panelsu.ru/', host='ru.panelsu.ru', public_host='ru.panelsu.ru' WHERE slug='pee9e3676f7';
SELECT changes();
SELECT slug, name, panel_url, username, password, host, public_host FROM panels;
SQL
sqlite3 /opt/sub-manager/data/app.db < /tmp/fix_panels.sql
`;
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString())).stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
