import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => c.exec(`cd /usr/local/x-ui && ./x-ui -h 2>&1 | head -3; echo ===; strings ./x-ui | grep -E 'outbound.add|outbound.del|/panel/.*outbound' | head -20; echo ===; sqlite3 /etc/x-ui/x-ui.db ".schema inbounds" | head -3`, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl' });
