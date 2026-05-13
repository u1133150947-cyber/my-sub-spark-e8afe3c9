import { Client } from 'ssh2';

const conn = new Client();
const HOST = '185.87.148.138';
const USERNAME = 'root';
const PASSWORD = 'hf6Ka8viMl';

const commands = [
  'echo "nameserver 8.8.8.8" > /etc/resolv.conf',
  'echo "=== INSTALLING HYSTERIA 2 ==="',
  'curl -L -o /usr/local/bin/hysteria https://github.com/apernet/hysteria/releases/latest/download/hysteria-linux-amd64',
  'chmod +x /usr/local/bin/hysteria',
  'cat << "SVC" > /etc/systemd/system/hysteria-server.service',
  '[Unit]',
  'Description=Hysteria Server',
  'After=network.target',
  '',
  '[Service]',
  'Type=simple',
  'ExecStart=/usr/local/bin/hysteria server -c /etc/hysteria/config.yaml',
  'WorkingDirectory=/etc/hysteria',
  'User=root',
  'Group=root',
  'Environment=GOGC=20',
  'Restart=always',
  'RestartSec=3s',
  'LimitNOFILE=1048576',
  '',
  '[Install]',
  'WantedBy=multi-user.target',
  'SVC',
  'systemctl daemon-reload',
  
  'echo "=== CONFIGURING HYSTERIA 2 ==="',
  'mkdir -p /etc/hysteria',
  'cat << "YAML" > /etc/hysteria/config.yaml',
  'listen: :443',
  '',
  'tls:',
  '  cert: /root/cert/cz.panelsu.ru/fullchain.pem',
  '  key: /root/cert/cz.panelsu.ru/privkey.pem',
  '',
  'auth:',
  '  type: password',
  '  password: TEST-KEY-REALITY-123',
  '',
  'masquerade:',
  '  type: proxy',
  '  proxy:',
  '    url: https://bing.com',
  '    rewriteHost: true',
  '',
  'outbounds:',
  '  - name: default',
  '    type: direct',
  'YAML',
  
  'echo "=== ENABLING AND RESTARTING SERVICE ==="',
  'systemctl enable hysteria-server.service',
  'systemctl start hysteria-server.service',
  'systemctl status hysteria-server.service --no-pager | head -n 10',
  'ss -lunpt | grep -E "hysteria|443"'
];

conn.on('ready', () => {
  conn.exec(commands.join('\n'), (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', (data) => process.stdout.write(data.toString()))
      .stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
}).connect({ host: HOST, port: 22, username: USERNAME, password: PASSWORD });