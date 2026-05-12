import { Client } from 'ssh2';
const conn = new Client();
const HOST = '185.87.148.138'; // CZ
const USERNAME = 'root';
const PASSWORD = 'hf6Ka8viMl';
const commands = [
  `ls -la /root/cert/cz.panelsu.ru/`
];
conn.on('ready', () => {
  conn.exec(commands.join('\n'), (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', (data) => process.stdout.write(data.toString()));
  });
}).connect({ host: HOST, port: 22, username: USERNAME, password: PASSWORD });
