import { Client } from 'ssh2';

const conn = new Client();

const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

const panelUser = 'admin_3x';
const panelPass = 'XUIhh5sj3!';

const commands = [
  `/usr/local/x-ui/x-ui setting -username ${panelUser} -password ${panelPass}`,
  `/usr/local/x-ui/x-ui setting -port 2053`,
  `/usr/local/x-ui/x-ui setting -webBasePath ""`,
  `systemctl restart x-ui`,
  `systemctl status x-ui --no-pager`
];

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(commands.join('\n'), (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('--- SUCCESS ---');
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: HOST,
  port: 22,
  username: USERNAME,
  password: PASSWORD
});
