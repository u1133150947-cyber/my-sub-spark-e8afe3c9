import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => c.exec(`set -e
mkdir -p /etc/hysteria/certs
cp /root/.acme.sh/se.panelsu.ru_ecc/fullchain.cer /etc/hysteria/certs/fullchain.cer
cp /root/.acme.sh/se.panelsu.ru_ecc/se.panelsu.ru.key /etc/hysteria/certs/key.pem
chown -R hysteria:hysteria /etc/hysteria/certs
chmod 750 /etc/hysteria/certs
chmod 640 /etc/hysteria/certs/*

# install acme reload-hook so cert renewals stay in place
/root/.acme.sh/acme.sh --install-cert -d se.panelsu.ru --ecc \\
  --fullchain-file /etc/hysteria/certs/fullchain.cer \\
  --key-file /etc/hysteria/certs/key.pem \\
  --reloadcmd "chown -R hysteria:hysteria /etc/hysteria/certs && chmod 640 /etc/hysteria/certs/* && systemctl restart hysteria-server" 2>&1 | tail -5

sed -i 's|/root/.acme.sh/se.panelsu.ru_ecc/fullchain.cer|/etc/hysteria/certs/fullchain.cer|; s|/root/.acme.sh/se.panelsu.ru_ecc/se.panelsu.ru.key|/etc/hysteria/certs/key.pem|' /etc/hysteria/config.yaml

echo '--- config tls block ---'
grep -A2 '^tls:' /etc/hysteria/config.yaml

systemctl restart hysteria-server
sleep 2
systemctl is-active hysteria-server
echo '--- logs ---'
journalctl -u hysteria-server -n 10 --no-pager | tail -10
echo '--- udp:443 ---'
ss -lunp | grep ':443' || echo 'NOT LISTENING'
`, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '87.121.105.143', port: 22, username: 'root', password: 'f4OQrEBYUQnEmwkgqPnwDD' });