import { Client } from 'ssh2';
const conn = new Client();
const cmd = String.raw`
sqlite3 /opt/sub-manager/data/app.db "UPDATE panels SET username='XRL5vJ94', password='ZSLFw8KE', panel_url='https://cz.panelsu.ru:35978/xeTpFidUtYR5eNrCJB/', host='cz.panelsu.ru', public_host='cz.panelsu.ru' WHERE name='Чехия';"
sqlite3 /opt/sub-manager/data/app.db "UPDATE panels SET username='admin', password='6WYia!Y5gV5D', panel_url='https://ru.panelsu.ru/', host='ru.panelsu.ru', public_host='ru.panelsu.ru' WHERE name='Россия';"
sqlite3 /opt/sub-manager/data/app.db "SELECT name, panel_url, username, host, public_host FROM panels;"
`;
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString())).stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
