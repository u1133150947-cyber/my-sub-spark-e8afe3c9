import { Client } from 'ssh2';
const jump = new Client();
jump.on('ready', () => {
  jump.forwardOut('127.0.0.1', 0, '185.87.148.138', 22, (err, stream) => {
    if (err) { console.error(err.message); jump.end(); return; }
    const cz = new Client();
    cz.on('ready', () => cz.exec(`
set -e
echo '=== backups available ==='
ls -la /root/hysteria-config.yaml.bak.* 2>/dev/null
echo '=== current (default) ==='
cat /etc/hysteria/config.yaml
echo '=== latest backup content ==='
LATEST=$(ls -t /root/hysteria-config.yaml.bak.* | head -1)
echo "Using: $LATEST"
cat "$LATEST"
echo '=== restoring ==='
cp /etc/hysteria/config.yaml /etc/hysteria/config.yaml.installer-default
cp "$LATEST" /etc/hysteria/config.yaml
chown hysteria:hysteria /etc/hysteria/config.yaml 2>/dev/null || true
echo '=== restart ==='
systemctl restart hysteria-server.service
sleep 3
systemctl is-active hysteria-server.service
echo '=== status tail ==='
systemctl status hysteria-server.service --no-pager -n 6 2>&1 | tail -8
echo '=== udp:443 ==='
ss -lunp 2>/dev/null | grep ':443'
echo '=== last logs ==='
journalctl -u hysteria-server -n 10 --no-pager 2>&1 | tail -10
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
