import { Client } from 'ssh2';
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`sqlite3 /opt/sub-manager/data/app.db "SELECT panel, inbound_id, client_email FROM subscription_inbounds WHERE client_email LIKE '%uia3c088ozg3%';"`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', d => process.stdout.write(d.toString()))
      .stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
