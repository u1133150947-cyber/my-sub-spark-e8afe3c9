import { Client } from 'ssh2';
const cz = new Client();
cz.on('ready',()=>{
  cz.exec(`sshpass -p 'K!E2QAGrxYFx' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@82.202.128.147 bash -s << 'BASH'
sqlite3 /etc/x-ui/x-ui.db "SELECT value FROM settings WHERE key='xrayTemplateConfig';" > /tmp/tpl.json
echo '=== outbounds ==='
jq '.outbounds | map({tag, protocol, addr:(.settings.vnext[0].address // null), port:(.settings.vnext[0].port // null), sni:(.streamSettings.realitySettings.serverName // null), pbk:(.streamSettings.realitySettings.publicKey // null), sid:(.streamSettings.realitySettings.shortId // null)})' /tmp/tpl.json
echo '=== routing ==='
jq '.routing' /tmp/tpl.json
echo '=== inbound 8443 settings ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT stream_settings FROM inbounds WHERE port=8443;" | jq '.realitySettings | {serverNames, shortIds, dest}'
echo '=== inbound sniffing ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT sniffing FROM inbounds WHERE port=8443;"
echo '=== inbound tag ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id,tag,remark,port FROM inbounds;"
echo '=== xray access log tail ==='
tail -30 /usr/local/x-ui/access.log 2>/dev/null
echo '=== xray error log tail ==='
tail -30 /usr/local/x-ui/error.log 2>/dev/null
BASH`,(e,s)=>{s.on('close',()=>cz.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));});
}).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
