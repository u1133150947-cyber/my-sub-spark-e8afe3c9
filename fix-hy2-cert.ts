import { Client } from 'ssh2';

const conn = new Client();
const HOST = '185.87.148.138';
const USERNAME = 'root';
const PASSWORD = 'hf6Ka8viMl';

const commands = [
  'echo "=== UPDATING HYSTERIA 2 CONFIG TO USE FULLCHAIN ==="',
  'sed -i "s/reality.panelsu.ru.cer/fullchain.cer/g" /etc/hysteria/config.yaml',
  'echo "=== RESTARTING HYSTERIA 2 ==="',
  'systemctl restart hysteria-server.service',
  'echo "=== TESTING LOCALLY ==="',
  'timeout 5 /usr/local/bin/hysteria client -c /tmp/hy2-client.yaml || true'
];

conn.on('ready', () => {
  conn.exec(commands.join('\n'), (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', (data) => process.stdout.write(data.toString()))
      .stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
}).connect({ host: HOST, port: 22, username: USERNAME, password: PASSWORD });
