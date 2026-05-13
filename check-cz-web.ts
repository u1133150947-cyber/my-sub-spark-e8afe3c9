import { Client } from 'ssh2';

const conn = new Client();
const HOST = '185.87.148.138';
const USERNAME = 'root';
const PASSWORD = 'hf6Ka8viMl';

const commands = [
  'echo "=== PORT 80/443 ==="',
  'ss -lunpt | grep -E ":80|:443"',
  'echo "=== NGINX CONFIGS ==="',
  'ls -la /etc/nginx/conf.d/ || echo "no nginx conf.d"',
  'cat /etc/nginx/conf.d/*.conf || true',
  'echo "=== ACME.SH CERTS ==="',
  '/root/.acme.sh/acme.sh --list || echo "no acme.sh"'
];

conn.on('ready', () => {
  conn.exec(commands.join('\n'), (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', (data) => process.stdout.write(data.toString())).stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
}).connect({ host: HOST, port: 22, username: USERNAME, password: PASSWORD });
