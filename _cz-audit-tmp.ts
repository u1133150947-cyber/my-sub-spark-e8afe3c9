import { Client } from 'ssh2';
const jump = new Client();
jump.on('ready', () => {
  jump.forwardOut('127.0.0.1', 0, '185.87.148.138', 22, (err, stream) => {
    if (err) { console.error(err.message); jump.end(); return; }
    const cz = new Client();
    cz.on('ready', () => cz.exec(`
echo '=== inbounds in 3x-ui ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id, remark, port, protocol, enable FROM inbounds;"
echo
echo '=== listening ports ==='
ss -lntup 2>/dev/null | grep -vE '127.0.0.1|::1' | grep LISTEN
ss -lunp 2>/dev/null | grep -vE '127.0.0.1|::1' | grep UNCONN
echo
echo '=== services ==='
for s in x-ui hysteria-server nginx caddy h-ui warp-svc; do
  printf "%-20s " "$s:"; systemctl is-active $s 2>/dev/null || echo "n/a"
done
echo
echo '=== leftover hysteria stuff ==='
ls /etc/hysteria/ 2>&1
ls /etc/systemd/system/ | grep -i hysteria
echo
echo '=== leftover h-ui ==='
ls /usr/local/h-ui/ 2>&1 | head
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
