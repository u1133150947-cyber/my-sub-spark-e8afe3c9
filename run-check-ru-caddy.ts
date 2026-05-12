import { Client } from 'ssh2';
const conn = new Client();
const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';
const commands = [
  `cat /etc/caddy/Caddyfile`,
];
conn.on('ready', () => {
  conn.exec(commands.join('\n'), (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', (data) => process.stdout.write(data.toString()));
  });
}).connect({ host: HOST, port: 22, username: USERNAME, password: PASSWORD });
