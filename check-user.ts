import { Client } from 'ssh2';
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`sqlite3 /root/my-sub-spark/data/app.db "SELECT * FROM subscriptions WHERE slug='uia3c088ozg3';"`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', (d: any) => console.log('STDOUT:', d.toString()))
      .stderr.on('data', (d: any) => console.log('STDERR:', d.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
