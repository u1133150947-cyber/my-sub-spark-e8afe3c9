import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  conn.exec("sqlite3 /opt/sub-manager/data/app.db \"SELECT host, password FROM panels WHERE name LIKE '%CZ%';\"", (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => {
      console.log('Result:', out);
      conn.end();
    }).on('data', d => out += d).stderr.on('data', d => out += d);
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
