import { Client } from 'ssh2';

const conn = new Client();
const cmd = "cd /opt/sub-manager && sqlite3 data/app.db \"SELECT id, action, error, ts FROM audit_log WHERE action = 'panel_error' OR error IS NOT NULL ORDER BY ts DESC LIMIT 10;\"";
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString())).stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
