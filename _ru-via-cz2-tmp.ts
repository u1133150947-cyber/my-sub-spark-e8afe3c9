import { Client } from 'ssh2';
const cz = new Client();
cz.on('ready', () => {
  console.log('CZ ready, forwarding to RU:22...');
  cz.forwardOut('127.0.0.1', 0, '82.202.128.147', 22, (err, stream) => {
    if (err) { console.error('forward fail:', err.message); cz.end(); return; }
    const ru = new Client();
    ru.on('ready', () => {
      console.log('RU SSH ready via CZ tunnel');
      const cmd = `
echo '=== UPTIME ==='; uptime
echo '=== SERVICES ==='
for s in x-ui nginx caddy hysteria-server; do printf "%-20s " "$s:"; systemctl is-active $s 2>/dev/null; done
echo '=== LISTENERS ==='
ss -lntp 2>/dev/null | grep -E ':(80|443|2053|8443|4430|10444) '
echo '=== X-UI STATUS ==='
systemctl status x-ui --no-pager -n 5 2>/dev/null
echo '=== X-UI LOG ==='
journalctl -u x-ui -n 30 --no-pager 2>/dev/null
echo '=== SETTINGS ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT key,value FROM settings WHERE key IN ('webPort','webBasePath','webDomain','webCertFile','webKeyFile');" 2>/dev/null
echo '=== INBOUNDS ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id, remark, port, protocol, enable FROM inbounds;" 2>/dev/null
echo '=== LOCAL PANEL TEST ==='
curl -sk -o /dev/null -w 'local 2053=%{http_code}\n' --max-time 5 https://127.0.0.1:2053/
echo '=== CADDY STATUS ==='
systemctl status caddy --no-pager -n 10 2>/dev/null
`;
      ru.exec(cmd, (e, s) => {
        if (e) { console.error('exec err:', e.message); ru.end(); cz.end(); return; }
        s.on('close', () => { ru.end(); cz.end(); }).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
      });
    }).on('error', e => { console.error('RU err:', e.message); cz.end(); })
      .connect({ sock: stream, username: 'root', password: 'K!E2QAGrxYFx', readyTimeout: 15000 });
  });
}).on('error', e => console.error('CZ err:', e.message))
  .connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl', readyTimeout: 15000 });
