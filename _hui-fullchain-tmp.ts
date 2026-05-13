import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});});}
console.log(await ssh(`set +e
ls /root/.acme.sh/reality.panelsu.ru_ecc/
echo '--- update HYSTERIA2_CONFIG to use fullchain.cer ---'
DB=/usr/local/h-ui/data/h_ui.db
cat > /tmp/hy2.yaml <<'YAML'
listen: :443
tls:
  cert: /root/.acme.sh/reality.panelsu.ru_ecc/fullchain.cer
  key: /root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.key
auth:
  type: http
  http:
    url: https://127.0.0.1:8081/hui/hysteria2/auth
    insecure: true
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
sqlite3 $DB "UPDATE config SET value='/root/.acme.sh/reality.panelsu.ru_ecc/fullchain.cer' WHERE key='H_UI_CRT_PATH';"
systemctl restart h-ui
sleep 4
echo '--- ports ---'; ss -lunp | grep 443
echo '--- generated yaml ---'; cat /usr/local/h-ui/bin/hysteria2.yaml
`));
