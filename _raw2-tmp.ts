import { Client } from 'ssh2';
const sh = String.raw`set +e
URL='https://de.panelsu.ru:9293/depanel_b3f9a2c1/'
CJ=$(mktemp)
PAGE=$(curl -sk -c "$CJ" -A 'Mozilla/5.0' "$URL")
CSRF=$(echo "$PAGE" | grep -oP 'csrf-token"\s*content="\K[^"]+')
echo "CSRF=$CSRF"
# Login: use -i to see status+body in one go
echo "=== LOGIN -i ==="
curl -ski -b "$CJ" -c "$CJ" -X POST -H "Content-Type: application/json" -H "Accept: application/json" -H "X-CSRF-Token: $CSRF" -A 'Mozilla/5.0' -d '{"username":"de_admin_q7K","password":"Mz8$Vp2Wq9Ld!4Bn7Hx"}' "${URL}login" | head -40
echo "=== LIST inbounds (GET) ==="
curl -sk -b "$CJ" "${URL}panel/api/inbounds/list" | head -c 500
echo
echo "=== ADD via form ==="
SET='{"clients":[{"id":"2a56beab-d0f7-48d8-bb2e-faf23fb282b4","flow":"xtls-rprx-vision","email":"cascade-ru-in","limitIp":0,"totalGB":0,"expiryTime":0,"enable":true,"tgId":"","subId":"","reset":0}]}'
curl -ski -b "$CJ" -X POST -H "Content-Type: application/x-www-form-urlencoded" -H "Accept: application/json" -H "X-CSRF-Token: $CSRF" -A 'Mozilla/5.0' --data-urlencode "id=26" --data-urlencode "settings=$SET" "${URL}panel/api/inbounds/addClient" | head -40
`;
const c = new Client();
c.on('ready',()=>c.exec(sh,(e,s)=>{if(e){console.log(e);return;}s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:process.env.RU_SSH_PASSWORD!,readyTimeout:15000});
