const { Client } = require('ssh2');

const host = "185.87.148.138";
const user = "root";
const password = "hf6Ka8viMl";

const conn = new Client();

conn.on('ready', () => {
  const cmd = `tail -n 30 /root/.acme.sh/acme.sh.log`;
  
  conn.exec(cmd, { pty: true }, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    });
  });
}).connect({ host, port: 22, username: user, password });
