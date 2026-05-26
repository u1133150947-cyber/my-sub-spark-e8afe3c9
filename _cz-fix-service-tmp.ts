import { Client } from 'ssh2';
const c = new Client();
const script = `
cat /etc/systemd/system/hysteria-server.service | head -40
echo '---'
getent passwd hysteria
ls -la /etc/hysteria /var/lib/hysteria 2>&1 | head -10
echo '--- ensure dirs and override ---'
mkdir -p /var/lib/hysteria /etc/hysteria
chown hysteria:hysteria /var/lib/hysteria /etc/hysteria 2>/dev/null || true
# usermod home
usermod -d /var/lib/hysteria hysteria 2>/dev/null || true
# override: WorkingDirectory + run as root if проблема
mkdir -p /etc/systemd/system/hysteria-server.service.d
cat > /etc/systemd/system/hysteria-server.service.d/override.conf <<'OV'
[Service]
WorkingDirectory=/etc/hysteria
User=root
Group=root
OV
systemctl daemon-reload
systemctl restart hysteria-server
sleep 2
systemctl is-active hysteria-server
ss -lunp | grep ':443' | head -2 || echo NOT_LISTEN
journalctl -u hysteria-server -n 10 --no-pager | tail -10
`;
c.on('ready',()=>c.exec(script,(e,s)=>{
  s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));
})).on('error',e=>console.error(e.message))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:20000});