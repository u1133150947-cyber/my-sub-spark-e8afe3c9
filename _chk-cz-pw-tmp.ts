import {Client} from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`
sqlite3 /etc/x-ui/x-ui.db "SELECT username, password FROM users;"
echo '=== test login ==='
curl -sk -o /dev/null -w '%{http_code}\n' https://127.0.0.1:2053/czpanel_a7f3k9/
echo '=== dns ==='
getent hosts cz.panelsu.ru
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
