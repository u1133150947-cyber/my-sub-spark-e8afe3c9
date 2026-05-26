import { Client } from 'ssh2';
const c = new Client();
const script = `
systemctl status hysteria-server --no-pager 2>&1 | head -25
echo '---'
journalctl -u hysteria-server -n 40 --no-pager
echo '--- config ---'
head -30 /etc/hysteria/config.yaml
echo '--- 443 ---'
ss -lunp | grep 443 || echo none udp
ss -lntp | grep 443 || echo none tcp
`;
c.on('ready',()=>c.exec(script,(e,s)=>{
  s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));
})).on('error',e=>console.error(e.message))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:20000});