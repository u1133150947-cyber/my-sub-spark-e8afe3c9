const { Client } = require('ssh2');

const host = "185.87.148.138";
const user = "root";
const password = "hf6Ka8viMl";
const domain = "3xcz.panelsu.ru";

const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  
  const cmd = `ls -la /root/.acme.sh/3xcz.panelsu.ru_ecc/ || echo "not found"`;
  
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
}).on('error', (err) => {
  console.error('Connection error:', err);
}).connect({
  host,
  port: 22,
  username: user,
  password,
  tryKeyboard: true,
  algorithms: {
    cipher: ["aes128-ctr", "aes192-ctr", "aes256-ctr", "aes128-cbc", "aes256-cbc"],
  }
});
