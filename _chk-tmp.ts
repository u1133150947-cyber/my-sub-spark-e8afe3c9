import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
echo '== sub-manager service =='
systemctl status sub-manager --no-pager -l | head -20
echo '== port 8080 =='
ss -lntp | grep 8080 || echo NONE
echo '== caddy =='
systemctl status caddy --no-pager | head -10
echo '== curl local 8080 =='
curl -sS -o /dev/null -w 'http=%{http_code} t=%{time_total}\n' --max-time 5 http://127.0.0.1:8080/api/health
echo '== caddy tail =='
journalctl -u caddy -n 20 --no-pager
echo '== sub-manager tail =='
journalctl -u sub-manager -n 20 --no-pager
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
