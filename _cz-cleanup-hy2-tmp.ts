import { Client } from 'ssh2';
const jump = new Client();
jump.on('ready', () => {
  jump.forwardOut('127.0.0.1', 0, '185.87.148.138', 22, (err, stream) => {
    if (err) { console.error(err.message); jump.end(); return; }
    const cz = new Client();
    cz.on('ready', () => cz.exec(`
echo '=== stop + disable hysteria ==='
systemctl disable --now hysteria-server.service 2>&1 | tail -3
systemctl disable --now hysteria-server@*.service 2>&1 | tail -3

echo '=== uninstall hysteria (official script) ==='
bash <(curl -fsSL https://get.hy2.sh/) --remove 2>&1 | tail -8

echo '=== cleanup leftovers ==='
rm -rf /etc/hysteria /etc/systemd/system/hysteria-server.service /etc/systemd/system/hysteria-server@.service /etc/systemd/system/hysteria-server.service.d /usr/local/bin/hysteria /root/hysteria-config.yaml.bak.* 2>&1
systemctl daemon-reload

echo '=== cleanup h-ui (inactive, leftover) ==='
ls /etc/systemd/system/ | grep -i h-ui
rm -rf /usr/local/h-ui /etc/systemd/system/h-ui.service 2>&1
systemctl daemon-reload

echo '=== final state ==='
echo '-- services --'
for s in x-ui hysteria-server h-ui nginx caddy warp-svc; do
  printf "%-20s " "$s:"; systemctl is-active $s 2>/dev/null || echo "n/a"
done
echo '-- listening --'
ss -lntup 2>/dev/null | grep LISTEN | grep -vE '127.0.0.1|::1'
ss -lunp 2>/dev/null | grep UNCONN | grep -vE '127.0.0.1|::1'
echo '-- inbounds --'
sqlite3 /etc/x-ui/x-ui.db "SELECT id, remark, port, protocol, enable FROM inbounds;"
echo '-- leftover dirs --'
ls -d /etc/hysteria /usr/local/h-ui /usr/local/bin/hysteria 2>&1
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
