import { Client } from 'ssh2';

const conn = new Client();
const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

conn.on('ready', () => {
  conn.exec("systemctl status x-ui | grep -o 'loaded.*'", (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', (data: any) => out += data.toString())
          .on('close', () => {
            console.log(out);
            conn.end();
          });
  });
}).connect({ host: HOST, port: 22, username: USERNAME, password: PASSWORD });
