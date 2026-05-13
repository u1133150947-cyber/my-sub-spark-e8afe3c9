import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
systemctl restart sub-manager
sleep 3
systemctl status sub-manager --no-pager | head -8
echo '== local curl =='
curl -sS -o /dev/null -w 'http=%{http_code} t=%{time_total}\n' --max-time 5 http://127.0.0.1:8080/api/health
echo '== public curl =='
curl -sS -o /dev/null -w 'http=%{http_code} t=%{time_total}\n' --max-time 10 https://web.panelsu.ru/api/health
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
