import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => c.exec(`
echo '=== validate config ==='
hysteria server -c /etc/hysteria/config.yaml --disable-update-check check 2>&1 | head -20 || /usr/local/bin/hysteria server -c /etc/hysteria/config.yaml check 2>&1 | head -20 || echo 'no check subcmd'
echo '=== enable + start ==='
systemctl enable --now hysteria-server.service 2>&1
sleep 2
echo '=== status ==='
systemctl is-active hysteria-server.service
systemctl status hysteria-server.service --no-pager -n 15 2>&1 | head -25
echo '=== listening ==='
ss -lunpt 2>/dev/null | grep -E ':443 ' | head
echo '=== last logs ==='
journalctl -u hysteria-server -n 20 --no-pager 2>&1 | tail -20
`, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).on('error', e => console.error('SSH ERR', e.message))
  .connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl', readyTimeout: 30000 });
