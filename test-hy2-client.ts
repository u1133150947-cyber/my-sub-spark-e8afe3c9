import { Client } from 'ssh2';

const conn = new Client();
const HOST = '185.87.148.138';
const USERNAME = 'root';
const PASSWORD = 'hf6Ka8viMl';

const commands = [
  'echo "=== DOWNLOADING HYSTERIA CLI ==="',
  'cat << "YAML" > /tmp/hy2-client.yaml',
  'server: reality.panelsu.ru:443',
  'tls:',
  '  sni: reality.panelsu.ru',
  '  insecure: false',
  'auth: TEST-KEY-REALITY-123',
  'YAML',
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
