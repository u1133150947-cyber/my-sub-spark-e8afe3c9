import { Client } from 'ssh2';
const conn = new Client();
conn.on('ready', () => {
  conn.exec('systemctl status hysteria-server.service --no-pager && journalctl -u hysteria-server.service -n 50 --no-pager', (err, stream) => {
    stream.on('close', () => conn.end())
      .on('data', d => process.stdout.write(d.toString()))
      .stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl' });
