import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:15000});});}

const VERN_UUID='80c4aa5b-607f-4143-9dd1-aa8b12ec4195';
const CON_PASS=`vern.${VERN_UUID}`;

const hy2cfg = `listen: :443
tls:
  cert: /root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.cer
  key: /root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.key
auth:
  type: http
  http:
    url: http://127.0.0.1:8081/hui/hysteria2/auth
    insecure: false
trafficStats:
  listen: 127.0.0.1:7653
  secret: hui-stat-secret
masquerade:
  type: proxy
  proxy:
    url: https://bing.com
    rewriteHost: true
`;

const cmd = `set +e
DB=/usr/local/h-ui/data/h_ui.db
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

# Login - try common payload variants
for PAYLOAD in '{"username":"wLrggS","pass":"vxJ2Jq"}' '{"username":"wLrggS","loginPwd":"vxJ2Jq"}' '{"username":"wLrggS","password":"vxJ2Jq"}'; do
  R=$(curl -sS -X POST http://127.0.0.1:8081/hui/auth/login -A "$UA" -H 'Content-Type: application/json' -H 'Origin: http://127.0.0.1:8081' -H 'Referer: http://127.0.0.1:8081/' -d "$PAYLOAD")
  echo "payload=$PAYLOAD -> $R"
  T=$(echo "$R" | jq -r '.data // empty')
  [ -n "$T" ] && [ "$T" != "null" ] && { TOKEN=$T; break; }
done
echo "TOKEN=$TOKEN"
[ -z "$TOKEN" ] && exit 1

CFG=$(cat <<'YAML' | jq -Rs .
${hy2cfg}YAML
)
echo "--- updateHysteria2Config ---"
curl -sS -X POST http://127.0.0.1:8081/hui/config/updateHysteria2Config -A "$UA" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -d "{\\"hysteria2Config\\":$CFG}"
echo
echo "--- enable + cert paths ---"
curl -sS -X POST http://127.0.0.1:8081/hui/config/updateConfigs -A "$UA" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -d '[{"key":"HYSTERIA2_ENABLE","value":"1"},{"key":"H_UI_CRT_PATH","value":"/root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.cer"},{"key":"H_UI_KEY_PATH","value":"/root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.key"}]'
echo
echo '--- restart ---'
curl -sS -X POST http://127.0.0.1:8081/hui/config/restartServer -A "$UA" -H "Authorization: $TOKEN"
echo
sleep 3
echo '--- save vern ---'
curl -sS -X POST http://127.0.0.1:8081/hui/account/saveAccount -A "$UA" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -d '{"username":"vern","pass":"vern-pass-1234","conPass":"${CON_PASS}","quota":0,"deviceNo":5,"expireTime":0,"role":"user"}'
echo
echo '--- accounts ---'
sqlite3 $DB "SELECT id,username,con_pass,role,deleted FROM account;"
echo '--- ports ---'
ss -lunp | grep -E ':443'
echo '--- h-ui log ---'
journalctl -u h-ui -n 25 --no-pager | tail -25
`;
console.log(await ssh(cmd));
