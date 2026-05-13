import { Client } from 'ssh2';
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`find /root -name app.db 2>/dev/null`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', (d: any) => console.log('STDOUT:', d.toString()))
      .stderr.on('data', (d: any) => console.log('STDERR:', d.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
