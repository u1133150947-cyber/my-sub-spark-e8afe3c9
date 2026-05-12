import { Client } from 'ssh2';

const conn = new Client();
const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

conn.on('ready', () => {
  conn.exec("grep -r 'hysteria' /usr/local/x-ui/web/html || echo 'not found'", (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', (data: any) => out += data.toString())
          .on('close', () => {
            console.log(out.slice(0, 2000));
            conn.end();
          });
  });
}).connect({ host: HOST, port: 22, username: USERNAME, password: PASSWORD });
