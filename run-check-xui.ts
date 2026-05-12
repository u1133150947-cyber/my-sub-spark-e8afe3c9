import { Client } from 'ssh2';

const conn = new Client();

const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

conn.on('ready', () => {
  conn.exec(`python3 -c "import sqlite3; conn = sqlite3.connect('/etc/x-ui/x-ui.db'); conn.execute('UPDATE settings SET value=\\'\\' WHERE key=\\'webBasePath\\''); conn.commit();" && systemctl restart x-ui && /usr/local/x-ui/x-ui setting -show`, (err, stream) => {
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
