import {Client} from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`
cat > /tmp/pw.txt <<'EOP'
Tz7$mQv2Lp8Wn4Rg!Hd
EOP
PW=$(cat /tmp/pw.txt | head -1)
echo "len=$(echo -n "$PW" | wc -c)"
HASH=$(htpasswd -bnBC 10 "" "$PW" | tr -d ':\n' | sed 's/^\\$2y/\\$2a/')
echo "hash=$HASH"
sqlite3 /etc/x-ui/x-ui.db "UPDATE users SET password='$HASH' WHERE username='cz_admin_x9K';"
systemctl restart x-ui
sleep 3
curl -sk --data-urlencode "username=cz_admin_x9K" --data-urlencode "password=$PW" https://127.0.0.1:2053/czpanel_a7f3k9/login
echo
rm /tmp/pw.txt
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
