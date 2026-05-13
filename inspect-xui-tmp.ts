import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => c.exec(`which sqlite3 || apt-get install -y -qq sqlite3 2>&1 | tail -2; sqlite3 /etc/x-ui/x-ui.db ".tables"; echo ---; sqlite3 /etc/x-ui/x-ui.db "SELECT key FROM settings;"`, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl' });
