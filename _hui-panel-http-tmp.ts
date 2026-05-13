import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});});}
console.log(await ssh(`set +e
DB=/usr/local/h-ui/data/h_ui.db
sqlite3 $DB "UPDATE config SET value='' WHERE key='H_UI_CRT_PATH';"
sqlite3 $DB "UPDATE config SET value='' WHERE key='H_UI_KEY_PATH';"
# auth url для hysteria-server теперь должен быть http
cat > /tmp/hy2.yaml <<'YAML'
listen: :443
tls:
  cert: /root/.acme.sh/reality.panelsu.ru_ecc/fullchain.cer
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
YAML
sqlite3 $DB "UPDATE config SET value=readfile('/tmp/hy2.yaml') WHERE key='HYSTERIA2_CONFIG';"
systemctl restart h-ui
sleep 4
echo '--- panel scheme test ---'
curl -sS -o /dev/null -w 'http=%{http_code}\n' http://127.0.0.1:8081/
curl -sS -o /dev/null -w 'auth_http=%{http_code} body=' -X POST http://127.0.0.1:8081/hui/hysteria2/auth -H 'Content-Type: application/json' -d '{"auth":"80c4aa5b-607f-4143-9dd1-aa8b12ec4195","addr":"1.2.3.4:1234","tx":0}'; echo
curl -sS -X POST http://127.0.0.1:8081/hui/hysteria2/auth -H 'Content-Type: application/json' -d '{"auth":"80c4aa5b-607f-4143-9dd1-aa8b12ec4195","addr":"1.2.3.4:1234","tx":0}'; echo
echo '--- udp 443 ---'; ss -lunp | grep :443
`));
