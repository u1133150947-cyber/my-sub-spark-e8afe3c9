import { Client } from 'ssh2';
const c = new Client();
const script = `
chmod 644 /etc/hysteria/certs/*.crt
chmod 640 /etc/hysteria/certs/*.key
chown hysteria:hysteria /etc/hysteria/certs/*
# verify override
cat /etc/systemd/system/hysteria-server.service.d/override.conf
echo '---'
systemctl daemon-reload
systemctl restart hysteria-server
sleep 3
systemctl is-active hysteria-server
ss -lunp | grep ':443' | head -2 || echo NOT_LISTEN
journalctl -u hysteria-server -n 8 --no-pager | tail -8
`;
c.on('ready',()=>c.exec(script,(e,s)=>{
  s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));
})).on('error',e=>console.error(e.message))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:20000});