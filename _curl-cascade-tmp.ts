import { Client } from 'ssh2';
const sh = String.raw`set +e
add() {
  local N=$1 URL=$2 USER=$3 PASS=$4 IBID=$5
  echo "=== $N ==="
  CJ=$(mktemp)
  # GET login page first
  curl -sk -c "$CJ" -A 'Mozilla/5.0' "$URL" -o /dev/null
  L=$(curl -sk -b "$CJ" -c "$CJ" -X POST -H "Content-Type: application/json" -H "Accept: application/json" -A 'Mozilla/5.0' -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" "${URL}login")
  echo "login: $L"
  SET='{"clients":[{"id":"2a56beab-d0f7-48d8-bb2e-faf23fb282b4","flow":"xtls-rprx-vision","email":"cascade-ru-in","limitIp":0,"totalGB":0,"expiryTime":0,"enable":true,"tgId":"","subId":"","reset":0}]}'
  R=$(curl -sk -b "$CJ" -X POST -H "Accept: application/json" -A 'Mozilla/5.0' --data-urlencode "id=$IBID" --data-urlencode "settings=$SET" "${URL}panel/api/inbounds/addClient")
  echo "add: $R"
  rm -f "$CJ"
}
add DE 'https://de.panelsu.ru:9293/depanel_b3f9a2c1/' 'de_admin_q7K' 'Mz8$Vp2Wq9Ld!4Bn7Hx' 26
add FI 'https://fi.panelsu.ru:47821/h93kf2lq8w/' 'admin' '3CVUSO30z0as2qDNK2SlCR2Z' 1
add SE 'https://se.panelsu.ru:51904/m7tp4xv2bn/' 'admin' '4yWgotqEfupz0tLm9rgjLg' 1
`;
const c = new Client();
c.on('ready',()=>c.exec(sh,(e,s)=>{if(e){console.log(e);return;}s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:process.env.RU_SSH_PASSWORD!,readyTimeout:15000});
