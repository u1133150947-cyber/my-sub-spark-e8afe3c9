const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`sqlite3 /root/data/app.db "SELECT slug, name, host FROM panels"`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', d => console.log('STDOUT:', d.toString()))
      .stderr.on('data', d => console.log('STDERR:', d.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
