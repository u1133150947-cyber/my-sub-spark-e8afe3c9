import { Client } from 'ssh2';
const conn = new Client();
const HOST = '85.208.108.57';
const USERNAME = 'root';
const PASSWORD = '1S{s8Q$s^Vl4';
const commands = [
  `/usr/local/x-ui/x-ui setting -show`,
];
conn.on('ready', () => {
  conn.exec(commands.join('\n'), (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', (data) => process.stdout.write(data.toString()));
  });
}).connect({ host: HOST, port: 22, username: USERNAME, password: PASSWORD });
