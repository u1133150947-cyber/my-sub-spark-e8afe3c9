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

// account.pass column is bcrypt of password normally. For h-ui auth via http it queries con_pass only — pass field used only for panel login, not connection. So we can leave pass = anything (bcrypt of dummy). Actually account is used for hy2 auth where conPass passed. Let me set pass to bcrypt-style; but since this is a "user" role it likely isn't used to login to panel. Use empty.

const cmd = `set +e
DB=/usr/local/h-ui/data/h_ui.db
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

# Write config directly
sqlite3 $DB "UPDATE config SET value='1', update_time=CURRENT_TIMESTAMP WHERE key='HYSTERIA2_ENABLE';"
sqlite3 $DB "UPDATE config SET value='/root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.cer', update_time=CURRENT_TIMESTAMP WHERE key='H_UI_CRT_PATH';"
sqlite3 $DB "UPDATE config SET value='/root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.key', update_time=CURRENT_TIMESTAMP WHERE key='H_UI_KEY_PATH';"
sqlite3 $DB <<'SQL'
UPDATE config SET value=readfile('/tmp/hy2-cfg.yaml'), update_time=CURRENT_TIMESTAMP WHERE key='HYSTERIA2_CONFIG';
SQL
cat > /tmp/hy2-cfg.yaml <<'YAML'
${hy2cfg}YAML
sqlite3 $DB "UPDATE config SET value=readfile('/tmp/hy2-cfg.yaml'), update_time=CURRENT_TIMESTAMP WHERE key='HYSTERIA2_CONFIG';"

# Insert vern account (pass is for panel login - irrelevant for connection)
sqlite3 $DB "INSERT OR REPLACE INTO account (id,username,pass,con_pass,quota,download,upload,expire_time,kick_util_time,device_no,role,deleted) VALUES ((SELECT id FROM account WHERE username='vern'),'vern','disabled','${CON_PASS}',0,0,0,0,0,5,'user',0);"

echo '--- accounts ---'
sqlite3 $DB "SELECT id,username,con_pass,role,deleted FROM account;"
echo '--- config ---'
sqlite3 $DB "SELECT key,substr(value,1,80) FROM config WHERE key IN ('HYSTERIA2_ENABLE','H_UI_CRT_PATH','H_UI_KEY_PATH');"
echo
echo '--- login + restart ---'
LOGIN=$(curl -sS -X POST http://127.0.0.1:8081/hui/auth/login -A "$UA" -H 'Origin: http://127.0.0.1:8081' -H 'Referer: http://127.0.0.1:8081/' -H 'Content-Type: application/json' -d '{"username":"wLrggS","pass":"vxJ2Jq"}')
TOKEN=$(echo "$LOGIN" | jq -r '.data.accessToken')
curl -sS -X POST http://127.0.0.1:8081/hui/config/restartServer -A "$UA" -H 'Origin: http://127.0.0.1:8081' -H 'Referer: http://127.0.0.1:8081/' -H "Authorization: Bearer $TOKEN"
echo
sleep 5
echo '--- ports udp 443 ---'
ss -lunp | grep -E ':443'
echo '--- hysteria proc ---'
ps -ef | grep -i hysteria | grep -v grep
echo '--- h-ui hysteria log ---'
tail -50 /usr/local/h-ui/logs/hysteria.log 2>/dev/null
echo '--- h-ui main log ---'
tail -30 /usr/local/h-ui/logs/h-ui.log 2>/dev/null
echo '--- journalctl ---'
journalctl -u h-ui -n 25 --no-pager | tail -25
`;
console.log(await ssh(cmd));
