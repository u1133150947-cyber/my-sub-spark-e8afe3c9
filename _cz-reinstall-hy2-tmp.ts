import { Client } from 'ssh2';
const jump = new Client();
jump.on('ready', () => {
  jump.forwardOut('127.0.0.1', 0, '185.87.148.138', 22, (err, stream) => {
    if (err) { console.error('FORWARD ERR', err.message); jump.end(); return; }
    const cz = new Client();
    cz.on('ready', () => cz.exec(`
set -e
echo '=== search any hysteria binary ==='
find / -maxdepth 6 -name 'hysteria*' -type f 2>/dev/null | head
echo '=== arch ==='
uname -m
echo '=== install via official script ==='
bash <(curl -fsSL https://get.hy2.sh/) 2>&1 | tail -20
echo '=== binary present? ==='
ls -la /usr/local/bin/hysteria 2>&1
/usr/local/bin/hysteria version 2>&1 | head -3
echo '=== restart service ==='
systemctl daemon-reload
systemctl restart hysteria-server.service
sleep 2
systemctl is-active hysteria-server.service
echo '=== status ==='
systemctl status hysteria-server.service --no-pager -n 8 2>&1 | tail -12
echo '=== udp:443 ==='
ss -lunp 2>/dev/null | grep ':443'
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
