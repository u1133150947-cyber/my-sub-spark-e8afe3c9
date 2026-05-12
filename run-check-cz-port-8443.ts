import { Client } from 'ssh2';

const conn = new Client();
const HOST = 'cz.panelsu.ru';
const USERNAME = 'root';
const PASSWORD = 'hf6Ka8viMl';

conn.on('ready', () => {
  conn.exec(`netstat -tulpn | grep :8443`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: HOST,
  port: 22,
  username: USERNAME,
  password: PASSWORD
});
