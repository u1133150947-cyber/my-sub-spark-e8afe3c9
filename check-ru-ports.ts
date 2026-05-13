import { Client } from 'ssh2';
const conn = new Client();
conn.on('ready', () => {
  conn.exec('ss -lunpt | grep -E ":80|:443" ; echo "---" ; ping -c 1 realityru.panelsu.ru', (err, stream) => {
    stream.on('close', () => conn.end())
      .on('data', d => process.stdout.write(d.toString()))
      .stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });