import { Client } from 'ssh2';
const c = new Client();
const script = `
systemctl reset-failed caddy 2>/dev/null || true
systemctl start caddy
sleep 2
systemctl is-active caddy
ss -lntp | grep -E ':80 |:443 ' || echo 'NOT LISTENING'
journalctl -u caddy -n 15 --no-pager | tail -15
`;
c.on('ready',()=>c.exec(script,(e,s)=>{
  s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));
})).on('error',e=>console.error(e.message))
.connect({host:'82.202.128.147',port:22,username:'root',password:process.env.RU_SSH_PASSWORD,readyTimeout:20000});