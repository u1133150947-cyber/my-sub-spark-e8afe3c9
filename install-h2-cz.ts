import { Client } from 'ssh2';

const conn = new Client();
const HOST = '185.87.148.138';
const USERNAME = 'root';
const PASSWORD = 'hf6Ka8viMl';

const commands = [
  'echo "=== STOPPING NGINX ==="',
  'systemctl stop nginx',
  
  'echo "=== ISSUING CERTIFICATE ==="',
  '/root/.acme.sh/acme.sh --issue -d reality.panelsu.ru --standalone -k ec-256 --force',
  
  'echo "=== STARTING NGINX ==="',
  'systemctl start nginx',
  
  'echo "=== INSTALLING HYSTERIA 2 ==="',
  'bash <(curl -fsSL https://app.hysteria.network/get.sh)',
  
  'echo "=== CONFIGURING HYSTERIA 2 ==="',
  'mkdir -p /etc/hysteria',
  `cat << 'YAML' > /etc/hysteria/config.yaml
listen: :443

tls:
  cert: /root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.cer
  key: /root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.key

auth:
  type: password
  password: TEST-KEY-REALITY-123

masquerade:
  type: proxy
  proxy:
    url: https://bing.com
    rewriteHost: true

outbounds:
  - name: default
    type: direct
YAML`,
  
  'echo "=== ENABLING AND RESTARTING SERVICE ==="',
  'systemctl enable hysteria-server.service',
  'systemctl restart hysteria-server.service',
  'systemctl status hysteria-server.service --no-pager | head -n 10',
  'ss -lunpt | grep hysteria'
];

conn.on('ready', () => {
  conn.exec(commands.join('\n'), (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', (data) => process.stdout.write(data.toString())).stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
}).connect({ host: HOST, port: 22, username: USERNAME, password: PASSWORD });
