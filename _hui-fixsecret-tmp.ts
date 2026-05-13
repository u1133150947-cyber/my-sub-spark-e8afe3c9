import {Client} from 'ssh2';
function ssh(c:string){return new Promise<string>(r=>{const x=new Client();let o='';x.on('ready',()=>x.exec(c,(e,s)=>{if(e){r(String(e));return}s.on('close',()=>{x.end();r(o)}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString())})).on('error',e=>r('SSH:'+e.message)).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'})})}
console.log(await ssh(`
DB=/usr/local/h-ui/data/h_ui.db
JWT=\$(sqlite3 $DB "SELECT value FROM config WHERE key='JWT_SECRET';")
echo "JWT_SECRET=\$JWT"
cat > /tmp/hy2.yaml <<YAML
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
  secret: \$JWT
masquerade:
  type: proxy
  proxy:
    url: https://bing.com
    rewriteHost: true
YAML
sqlite3 $DB "UPDATE config SET value=readfile('/tmp/hy2.yaml') WHERE key='HYSTERIA2_CONFIG';"
systemctl restart h-ui
sleep 4
echo --- yaml ---
cat /usr/local/h-ui/bin/hysteria2.yaml
echo --- auth ---
curl -sS -X POST http://127.0.0.1:8081/hui/hysteria2/auth -A 'Hysteria/2.6.0' -H 'Content-Type: application/json' -d '{"auth":"80c4aa5b607f41439dd1aa8b12ec4195","addr":"1.2.3.4:1234","tx":0}'
echo
`))
