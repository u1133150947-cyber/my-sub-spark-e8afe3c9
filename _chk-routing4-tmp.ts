import { Client } from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`
sqlite3 /etc/x-ui/x-ui.db "SELECT value FROM settings WHERE key='xrayTemplateConfig';" > /tmp/tpl.json
echo '=== outbounds ==='
jq '.outbounds | map({tag, addr:(.settings.vnext[0].address // null), port:(.settings.vnext[0].port // null), sni:(.streamSettings.realitySettings.serverName // null)})' /tmp/tpl.json
echo '=== routing ==='
jq '.routing' /tmp/tpl.json
echo '=== inbound 8443 ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id,tag,remark,port FROM inbounds;"
sqlite3 /etc/x-ui/x-ui.db "SELECT stream_settings FROM inbounds WHERE port=8443;" | jq '.realitySettings | {serverNames, shortIds, dest}'
echo '--- sniffing ---'
sqlite3 /etc/x-ui/x-ui.db "SELECT sniffing FROM inbounds WHERE port=8443;"
echo '=== access tail ==='
tail -40 /usr/local/x-ui/access.log 2>/dev/null
echo '=== error tail ==='
tail -20 /usr/local/x-ui/error.log 2>/dev/null
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));}))
.on('error',e=>console.error('ERR',e.message))
.connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:20000});
