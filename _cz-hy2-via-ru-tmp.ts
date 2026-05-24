import { Client } from 'ssh2';
const jump = new Client();
jump.on('ready', () => {
  jump.forwardOut('127.0.0.1', 0, '185.87.148.138', 22, (err, stream) => {
    if (err) { console.error('FORWARD ERR', err.message); jump.end(); return; }
    const cz = new Client();
    cz.on('ready', () => cz.exec(`
echo '=== before ==='
systemctl is-active hysteria-server.service
echo '=== enable+start ==='
systemctl enable --now hysteria-server.service 2>&1 | tail -5
sleep 2
echo '=== after ==='
systemctl is-active hysteria-server.service
systemctl status hysteria-server.service --no-pager -n 12 2>&1 | tail -18
echo '=== udp:443 listen ==='
ss -lunp 2>/dev/null | grep ':443 ' | head
echo '=== last logs ==='
journalctl -u hysteria-server -n 15 --no-pager 2>&1 | tail -15
`, (e, s) => {
      if (e) { console.error(e); cz.end(); jump.end(); return; }
      s.on('close', () => { cz.end(); jump.end(); })
       .on('data', d => process.stdout.write(d.toString()))
       .stderr.on('data', d => process.stderr.write(d.toString()));
    })).on('error', e => { console.error('CZ ERR', e.message); jump.end(); })
       .connect({ sock: stream, username: 'root', password: 'hf6Ka8viMl', readyTimeout: 20000 });
  });
}).on('error', e => console.error('JUMP ERR', e.message))
  .connect({ host: process.env.SSH_PANEL_HOST!, port: 22, username: process.env.SSH_PANEL_USER!, password: process.env.SSH_PANEL_PASSWORD!, readyTimeout: 15000 });
