import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
echo '== listeners =='
ss -lntp | grep -E ':(443|8080|8443|2053)'
echo '== xray status =='
systemctl is-active x-ui
echo '== test xhttp endpoint =='
curl -sS -o /dev/null -w 'http=%{http_code}\n' --max-time 5 http://127.0.0.1:8080/b989653e28f6841f
echo '== existing inbound 8443 still up? =='
ss -lntp | grep 8443 && echo OK
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));}))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
