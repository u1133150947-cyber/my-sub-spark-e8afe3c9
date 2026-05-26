import { Client } from 'ssh2';
const sh = String.raw`set +e
URL='https://de.panelsu.ru:9293/depanel_b3f9a2c1/'
PAGE=$(curl -sk -A 'Mozilla/5.0' "$URL")
JS=$(echo "$PAGE" | grep -oP 'assets/axios-init[^"]+\.js' | head -1)
echo "JS: $JS"
curl -sk -A 'Mozilla/5.0' "${URL}${JS}" | head -c 2000
echo
echo "--- search api routes in main inbound JS ---"
# Get the main app JS  
for f in $(curl -sk -A 'Mozilla/5.0' "$URL" | grep -oP '/depanel_b3f9a2c1/assets/[^"]+\.js' | sort -u); do
  C=$(curl -sk -A 'Mozilla/5.0' "https://de.panelsu.ru:9293${f}")
  if echo "$C" | grep -q 'addClient\|inbounds/add\|api/inbounds'; then
    echo "=== $f ==="
    echo "$C" | grep -oE '"[^"]*api[^"]*"|inbounds/[a-zA-Z]+' | sort -u | head -40
  fi
done
`;
const c = new Client();
c.on('ready',()=>c.exec(sh,(e,s)=>{if(e){console.log(e);return;}s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:process.env.RU_SSH_PASSWORD!,readyTimeout:15000});
