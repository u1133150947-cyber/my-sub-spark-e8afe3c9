import { Client } from 'ssh2';

const conn = new Client();
const HOST = '185.87.148.138';
const USERNAME = 'root';
const PASSWORD = 'hf6Ka8viMl';

const commands = [
  'echo "=== HYSTERIA 2 STATUS ==="',
  'systemctl status hysteria-server.service --no-pager',
  'echo "=== HYSTERIA 2 LOGS ==="',
  'journalctl -u hysteria-server.service -n 50 --no-pager',
  'echo "=== FIREWALL (UDP 443) ==="',
  'iptables -S | grep 443 || true',
  'nft list ruleset | grep 443 || true',
  'echo "=== PORTS ==="',
  'ss -lunpt | grep 443'
];

conn.on('ready', () => {
  conn.exec(commands.join('\n'), (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', (data) => process.stdout.write(data.toString()))
      .stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
}).connect({ host: HOST, port: 22, username: USERNAME, password: PASSWORD });
