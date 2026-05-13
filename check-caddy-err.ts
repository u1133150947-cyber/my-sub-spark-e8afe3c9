import { Client } from 'ssh2';
const conn = new Client();
conn.on('ready', () => {
  conn.exec('journalctl -u caddy -n 20 --no-pager', (err, stream) => {
    stream.on('close', () => conn.end())
      .on('data', d => process.stdout.write(d.toString()))
      .stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });