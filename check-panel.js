const { Client } = require('ssh2');

const host = "185.87.148.138";
const user = "root";
const password = "hf6Ka8viMl";

const conn = new Client();

conn.on('ready', () => {
  conn.exec(`curl -k https://127.0.0.1/YRL5vJ/ -I`, { pty: true }, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data));
  });
}).connect({ host, port: 22, username: user, password });
