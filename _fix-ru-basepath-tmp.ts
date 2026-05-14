import {Client} from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`
sqlite3 /etc/x-ui/x-ui.db "UPDATE settings SET value='/' WHERE key='webBasePath';"
sqlite3 /etc/x-ui/x-ui.db "SELECT key,value FROM settings WHERE key='webBasePath';"
systemctl restart x-ui
sleep 3
systemctl is-active x-ui
curl -sk -o /dev/null -w 'root=%{http_code}\n' https://ru.panelsu.ru/
curl -sk -o /dev/null -w 'login=%{http_code}\n' https://ru.panelsu.ru/login
echo '=== xray still listening ==='
ss -lntp | egrep ':(8443|4430)'
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
