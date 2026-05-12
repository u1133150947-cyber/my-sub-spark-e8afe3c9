const { Client } = require('ssh2');

const host = "62.217.181.79";
const user = "root";
const password = "6WYia!Y5gV5D";

const conn = new Client();

conn.on('ready', () => {
  const cmd = `x-ui settings`;
  conn.exec(cmd, { pty: true }, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host, port: 22, username: user, password, tryKeyboard: true,
  algorithms: { cipher: ["aes128-ctr", "aes192-ctr", "aes256-ctr", "aes128-cbc", "aes256-cbc"] }
});
