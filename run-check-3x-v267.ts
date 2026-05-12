import { Client } from 'ssh2';

const conn = new Client();

const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

const commands = [
  `/usr/local/x-ui/x-ui setting -show`,
  `systemctl status x-ui --no-pager`,
  `curl -I http://127.0.0.1:2053/`
];

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(commands.join('\n'), (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('--- SUCCESS ---');
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).connect({
  host: HOST,
  port: 22,
  username: USERNAME,
  password: PASSWORD
});
