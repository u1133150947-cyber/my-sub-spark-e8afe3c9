import { Client } from 'ssh2';

const conn = new Client();
const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

conn.on('ready', () => {
  conn.exec("/usr/local/x-ui/bin/xray-linux-amd64 -version; cat /usr/local/x-ui/bin/config.json | grep -A 2 -B 2 hysteria || echo 'no hysteria in config'", (err, stream) => {
    if (err) throw err;
    stream.on('data', (data: any) => process.stdout.write(data.toString()))
          .on('close', () => conn.end());
  });
}).connect({ host: HOST, port: 22, username: USERNAME, password: PASSWORD });
