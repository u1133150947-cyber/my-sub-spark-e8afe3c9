import { Client } from 'ssh2';
const conn = new Client();
conn.on('ready', () => {
  const commands = [
    'echo "=== UPDATING CADDY CONFIG ==="',
    'cat << "CADDY" > /etc/caddy/Caddyfile',
    '{',
    '  servers {',
    '    protocols h1 h2',
    '  }',
    '}',
    'web.panelsu.ru {',
    '  encode gzip',
    '  request_body { max_size 200MB }',
    '  reverse_proxy 127.0.0.1:8080',
    '}',
    'ru.panelsu.ru {',
    '  encode gzip',
    '  request_body { max_size 200MB }',
    '  reverse_proxy 127.0.0.1:2053',
    '}',
    'CADDY',
    'systemctl restart caddy',
    'sleep 2',
    'echo "=== PORTS ==="',
    'ss -lunpt | grep 443 || echo "No UDP 443"',
    'systemctl stop caddy',
    'echo "=== ISSUING CERTIFICATE ==="',
    'curl -fsSL https://get.acme.sh | sh || true',
    '/root/.acme.sh/acme.sh --issue -d realityru.panelsu.ru --standalone -k ec-256 --force || true',
    'systemctl start caddy'
  ];
  conn.exec(commands.join('\n'), (err, stream) => {
    stream.on('close', () => conn.end())
      .on('data', d => process.stdout.write(d.toString()))
      .stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });