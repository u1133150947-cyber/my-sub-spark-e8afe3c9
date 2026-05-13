import { Client } from 'ssh2';

const conn = new Client();
const HOST = '185.87.148.138'; // CZ
const USERNAME = 'root';
const PASSWORD = 'hf6Ka8viMl';

const commands = [
  'echo "=== DISK SPACE ==="',
  'df -h',
  'echo "=== MEMORY ==="',
  'free -m',
  'echo "=== CPU ==="',
  'lscpu || cat /proc/cpuinfo | grep "model name" | head -n 1',
  'echo "=== PORTS ==="',
  'ss -lunpt | grep 443'
];

conn.on('ready', () => {
  conn.exec(commands.join('\n'), (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', (data) => process.stdout.write(data.toString())).stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
}).connect({ host: HOST, port: 22, username: USERNAME, password: PASSWORD });
