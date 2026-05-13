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
  secret: hui-secret-${Math.random().toString(36).slice(2,10)}
masquerade:
  type: proxy
  proxy:
    url: https://bing.com
    rewriteHost: true
`;

const cmd = `set +e
DB=/usr/local/h-ui/data/h_ui.db
# 1. Login
TOKEN=$(curl -sS -X POST http://127.0.0.1:8081/hui/auth/login -H 'Content-Type: application/json' -d '{"username":"wLrggS","pass":"vxJ2Jq"}' | jq -r '.data')
echo "TOKEN=$TOKEN"
[ -z "$TOKEN" ] || [ "$TOKEN" = "null" ] && { echo 'login failed'; curl -sS -X POST http://127.0.0.1:8081/hui/auth/login -H 'Content-Type: application/json' -d '{"username":"wLrggS","pass":"vxJ2Jq"}'; exit 1; }

# 2. Write hysteria2 config + enable
CFG=$(cat <<'YAML' | jq -Rs .
${hy2cfg}YAML
)
echo "--- update hysteria2 config ---"
curl -sS -X POST http://127.0.0.1:8081/hui/config/updateHysteria2Config -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -d "{\\"hysteria2Config\\":$CFG}"
echo
echo "--- enable + listen 443 ---"
curl -sS -X POST http://127.0.0.1:8081/hui/config/updateConfigs -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -d '[{"key":"HYSTERIA2_ENABLE","value":"1"},{"key":"H_UI_CRT_PATH","value":"/root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.cer"},{"key":"H_UI_KEY_PATH","value":"/root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.key"}]'
echo

# 3. Restart hysteria
echo '--- restart hysteria ---'
curl -sS -X POST http://127.0.0.1:8081/hui/config/restartServer -H "Authorization: $TOKEN"
echo
sleep 3

# 4. Add Vern account
echo '--- save vern account ---'
curl -sS -X POST http://127.0.0.1:8081/hui/account/saveAccount -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -d '{"username":"vern","pass":"vern-pass-1234","conPass":"${CON_PASS}","quota":0,"deviceNo":5,"expireTime":0,"kickUtilTime":0,"role":"user"}'
echo

# 5. Verify
echo '--- accounts ---'
sqlite3 $DB "SELECT id,username,con_pass,role,deleted FROM account;"
echo '--- config ---'
sqlite3 $DB "SELECT key,substr(value,1,80) FROM config WHERE key LIKE 'HYSTERIA2%' OR key LIKE 'H_UI_CRT%' OR key LIKE 'H_UI_KEY%';"
echo '--- hy2 listening UDP 443 ? ---'
ss -lunp | grep -E ':443|hysteria'
echo '--- h-ui logs tail ---'
journalctl -u h-ui -n 30 --no-pager | tail -30
`;
console.log(await ssh(cmd));
