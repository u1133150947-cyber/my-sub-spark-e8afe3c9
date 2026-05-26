import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => {
  console.log('SSH OK');
  c.exec('uname -a; cat /etc/os-release | head -3; echo ---; systemctl is-active nginx caddy x-ui hysteria-server 2>/dev/null; echo ---PORTS---; ss -lntup | grep -E ":(80|443|22) " | grep LISTEN', (e, s) => {
    s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).on('error', e => console.error('SSH ERR:', e.message))
  .connect({ host: '87.121.105.143', port: 22, username: 'root', password: 'f4OQrEBYUQnEmwkgqPnwDD', readyTimeout: 20000 });
