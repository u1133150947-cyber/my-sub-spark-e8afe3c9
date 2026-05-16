import { Client } from 'ssh2';
const conn = new Client();
const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

const commands = [
  `/usr/local/x-ui/x-ui setting -show 2>/dev/null || echo "x-ui setting failed"`,
  `sqlite3 /etc/x-ui/x-ui.db "SELECT username, password FROM users LIMIT 1;" 2>/dev/null || echo "sqlite3 failed"`,
  `systemctl is-active x-ui 2>/dev/null || echo "status check failed"`
];

conn.on('ready', () => {
  console.log('SSH connected');
  conn.exec(commands.join('\n'), (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    let stdout = '';
    let stderr = '';
    stream.on('close', () => {
      console.log(stdout);
      if (stderr) console.error(stderr);
      conn.end();
    }).on('data', (data) => { stdout += data.toString(); }).stderr.on('data', (data) => { stderr += data.toString(); });
  });
}).connect({ host: HOST, port: 22, username: USERNAME, password: PASSWORD });
