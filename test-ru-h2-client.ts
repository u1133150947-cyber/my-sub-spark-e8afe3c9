import { Client } from 'ssh2';
const conn = new Client();
conn.on('ready', () => {
  const commands = [
    'cat << "YAML" > /tmp/hy2-client.yaml',
    'server: realityru.panelsu.ru:443',
    'tls:',
    '  sni: realityru.panelsu.ru',
    '  insecure: false',
    'auth: TEST-KEY-REALITYRU-123',
    'YAML',
    'timeout 5 /usr/local/bin/hysteria client -c /tmp/hy2-client.yaml || true'
  ];
  conn.exec(commands.join('\n'), (err, stream) => {
    stream.on('close', () => conn.end())
      .on('data', d => process.stdout.write(d.toString()))
      .stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });