import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
echo '== listening ports =='
ss -lntp | grep -E ':(443|80|8080|2053|54321|2080|8443)' || true
echo '== 3x-ui inbounds =='
sqlite3 /etc/x-ui/x-ui.db "SELECT id, remark, port, protocol, enable FROM inbounds;" 2>/dev/null || echo "no db"
echo '== caddy? =='
systemctl is-active caddy 2>/dev/null || echo no-caddy
systemctl is-active nginx 2>/dev/null || echo no-nginx
echo '== xray version =='
/usr/local/x-ui/bin/xray-linux-amd64 -version 2>/dev/null | head -1 || xray -version 2>/dev/null | head -1
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));}))
.connect({host:'185.87.148.138',port:22,username:'root',password:process.env.CZ_PW||'K!E2QAGrxYFx'});
