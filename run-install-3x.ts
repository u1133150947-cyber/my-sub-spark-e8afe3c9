import { Client } from 'ssh2';

const conn = new Client();

const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';

const panelUser = 'admin_3x';
const panelPass = 'XUI' + Math.random().toString(36).substring(2, 8) + '!';

const commands = [
  // 1. Install latest 3x-ui non-interactively
  `echo -e "y\n${panelUser}\n${panelPass}\n2053\n" | bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh)`,
  // 2. Ensure Caddy config for ru.panelsu.ru
  `if ! grep -q "ru.panelsu.ru" /etc/caddy/Caddyfile; then
cat << 'CADDY' >> /etc/caddy/Caddyfile

ru.panelsu.ru {
  encode gzip
  request_body {
    max_size 200MB
  }
  reverse_proxy 127.0.0.1:2053
}
CADDY
  fi`,
  `systemctl restart caddy`,
  `systemctl restart x-ui`,
  `systemctl status x-ui --no-pager`
];

conn.on('ready', () => {
  console.log('Client :: ready');
  const execCmd = commands.join('\n');
  console.log('Executing:', execCmd);
  conn.exec(execCmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      console.log('--- SUCCESS ---');
      console.log('USER:', panelUser);
      console.log('PASS:', panelPass);
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
