import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => c.exec(`
/usr/local/bin/hysteria version 2>&1 | head -3
echo '--- full status ---'
systemctl status hysteria-server --no-pager -n 30 2>&1 | tail -30
echo '--- journal ---'
journalctl -u hysteria-server -n 40 --no-pager
echo '--- cert key file ---'
ls -la /root/.acme.sh/se.panelsu.ru_ecc/se.panelsu.ru.key /root/.acme.sh/se.panelsu.ru_ecc/fullchain.cer 2>&1
echo '--- config ---'
cat /etc/hysteria/config.yaml | head -20
`, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '87.121.105.143', port: 22, username: 'root', password: 'f4OQrEBYUQnEmwkgqPnwDD' });