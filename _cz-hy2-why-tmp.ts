import { Client } from 'ssh2';
const jump = new Client();
jump.on('ready', () => {
  jump.forwardOut('127.0.0.1', 0, '185.87.148.138', 22, (err, stream) => {
    if (err) { console.error(err.message); jump.end(); return; }
    const cz = new Client();
    cz.on('ready', () => cz.exec(`
echo '=== cert files ==='
ls -la /root/.acme.sh/reality.panelsu.ru_ecc/ 2>&1 | head
echo '=== all acme certs ==='
ls /root/.acme.sh/ 2>&1 | grep -E 'panelsu|_ecc' | head
echo '=== service logs full ==='
journalctl -u hysteria-server -n 30 --no-pager 2>&1 | tail -25
echo '=== override ==='
cat /etc/systemd/system/hysteria-server.service.d/override.conf 2>&1
echo '=== unit ==='
grep -E 'ExecStart|User|Group' /etc/systemd/system/hysteria-server.service
`, (e, s) => {
      if (e) { console.error(e); cz.end(); jump.end(); return; }
      s.on('close', () => { cz.end(); jump.end(); })
       .on('data', d => process.stdout.write(d.toString()))
       .stderr.on('data', d => process.stderr.write(d.toString()));
    })).on('error', e => { console.error('CZ ERR', e.message); jump.end(); })
       .connect({ sock: stream, username: 'root', password: 'hf6Ka8viMl', readyTimeout: 25000 });
  });
}).on('error', e => console.error('JUMP ERR', e.message))
  .connect({ host: process.env.SSH_PANEL_HOST!, port: 22, username: process.env.SSH_PANEL_USER!, password: process.env.SSH_PANEL_PASSWORD!, readyTimeout: 15000 });
