import {Client} from 'ssh2';
const NEWPW='CZ_p@nel_2026!xK9';
const c=new Client();
c.on('ready',()=>c.exec(`
HASH=$(htpasswd -bnBC 10 "" '${NEWPW}' | tr -d ':\n' | sed 's/^\\$2y/\\$2a/')
echo "hash=$HASH"
sqlite3 /etc/x-ui/x-ui.db "UPDATE users SET password='$HASH' WHERE username='cz_admin_x9K';"
echo '=== test login ==='
curl -sk -c /tmp/ck -X POST -d "username=cz_admin_x9K&password=${NEWPW}" https://127.0.0.1:2053/czpanel_a7f3k9/login
echo
curl -sk -b /tmp/ck -o /dev/null -w 'panel=%{http_code}\n' https://127.0.0.1:2053/czpanel_a7f3k9/panel/
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
