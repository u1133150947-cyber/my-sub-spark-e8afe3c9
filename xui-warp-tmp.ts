import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => c.exec(`strings /usr/local/x-ui/x-ui | grep -iE 'warp|create.warp|outbound.*cloudflare' | head -20; echo ===; cat /etc/x-ui/x-ui.db | strings | grep -i warp | head`, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl' });
