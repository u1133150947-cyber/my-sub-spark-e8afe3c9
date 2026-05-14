import {Client} from 'ssh2';
const NEWPW='CZ_p@nel_2026!xK9';
const c=new Client();
c.on('ready',()=>c.exec(`
apt-get install -y apache2-utils >/dev/null 2>&1
HASH=$(htpasswd -bnBC 10 "" '${NEWPW}' | tr -d ':\n' | sed 's/^\\$2y/\\$2a/')
echo "hash=$HASH"
sqlite3 /etc/x-ui/x-ui.db "UPDATE users SET password='$HASH' WHERE username='cz_admin_x9K';"
sqlite3 /etc/x-ui/x-ui.db "SELECT username,substr(password,1,15)||'...' FROM users;"
systemctl restart x-ui
sleep 3
echo '=== test login ==='
curl -sk -c /tmp/ck -X POST -d "username=cz_admin_x9K&password=${NEWPW}" https://127.0.0.1:2053/czpanel_a7f3k9/login
echo
echo '=== via domain ==='
curl -sk --resolve cz.panelsu.ru:2053:185.87.148.138 -o /dev/null -w '%{http_code}\n' https://cz.panelsu.ru:2053/czpanel_a7f3k9/
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
