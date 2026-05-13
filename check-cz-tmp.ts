import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => c.exec('hostname; ip -4 addr | grep inet | grep -v 127; ls /etc/x-ui /etc/hysteria 2>/dev/null; cat /etc/hysteria/config.yaml 2>/dev/null | head -40', (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl' });
