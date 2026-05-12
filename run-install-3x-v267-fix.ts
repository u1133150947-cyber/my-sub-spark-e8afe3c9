import { Client } from 'ssh2';

const conn = new Client();

const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

const panelUser = 'admin_3x';
const panelPass = 'XUIhh5sj3!';
const port = '2053';

const commands = [
  // Provide y (install), 4 (Skip SSL), admin_3x, pass, 2053, empty path
  `echo -e "y\\n4\\n${panelUser}\\n${panelPass}\\n${port}\\n\\n" | bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh) v2.6.7`,
  `/usr/local/x-ui/x-ui setting -webBasePath "" || true`,
  `systemctl restart x-ui`,
  `systemctl status x-ui --no-pager`
];

conn.on('ready', () => {
  console.log('Client :: ready');
  const execCmd = commands.join('\n');
  
  conn.exec(execCmd, { pty: true }, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('\\n--- SUCCESS (' + code + ') ---');
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
