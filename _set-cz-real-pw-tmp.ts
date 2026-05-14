import {Client} from 'ssh2';
const PW='Tz7$mQv2Lp8Wn4Rg!Hd';
const c=new Client();
c.on('ready',()=>c.exec(`
HASH=$(htpasswd -bnBC 10 "" '${PW}' | tr -d ':\n' | sed 's/^\\$2y/\\$2a/')
sqlite3 /etc/x-ui/x-ui.db "UPDATE users SET password='$HASH' WHERE username='cz_admin_x9K';"
systemctl restart x-ui
sleep 3
echo '=== test ==='
curl -sk -X POST -d "username=cz_admin_x9K&password=${PW}" https://127.0.0.1:2053/czpanel_a7f3k9/login
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
