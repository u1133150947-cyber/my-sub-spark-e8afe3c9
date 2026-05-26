import { Client } from 'ssh2';
const c = new Client();
const script = `
ls -la /etc/hysteria/certs/
getfacl /etc/hysteria/certs/*.key 2>&1 | head -10
chmod 644 /etc/hysteria/certs/*.key /etc/hysteria/certs/*.crt
ls -la /etc/hysteria/certs/
systemctl restart hysteria-server
sleep 3
systemctl is-active hysteria-server
ss -lunp | grep ':443' | head -2 || echo NOT_LISTEN
journalctl -u hysteria-server -n 6 --no-pager | tail -6
`;
c.on('ready',()=>c.exec(script,(e,s)=>{
  s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));
})).on('error',e=>console.error(e.message))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:20000});