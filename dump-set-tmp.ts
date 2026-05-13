import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => c.exec(`sqlite3 /etc/x-ui/x-ui.db "SELECT key, length(value) FROM settings ORDER BY length(value) DESC LIMIT 5;"; echo ===; /usr/local/x-ui/x-ui setting -show 2>&1 | head -5; echo ===; /usr/local/x-ui/x-ui v 2>&1`, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl' });
