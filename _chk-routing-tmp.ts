import { Client } from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`
echo '=== inbound 8443 ==='
sqlite3 /etc/x-ui/x-ui.db -json "SELECT id,remark,port,protocol,tag,sniffing,stream_settings FROM inbounds;" | head -200
echo
echo '=== xrayTemplateConfig outbounds+routing ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT value FROM settings WHERE key='xrayTemplateConfig';" > /tmp/tpl.json
jq '.outbounds | map({tag, protocol, addr:(.settings.vnext[0].address // null), port:(.settings.vnext[0].port // null), sni:(.streamSettings.realitySettings.serverName // null)})' /tmp/tpl.json
echo '--- routing ---'
jq '.routing' /tmp/tpl.json
echo '--- inbound sniffing+serverNames ---'
sqlite3 /etc/x-ui/x-ui.db "SELECT stream_settings FROM inbounds WHERE port=8443;" | jq '.realitySettings.serverNames, .realitySettings.shortIds'
sqlite3 /etc/x-ui/x-ui.db "SELECT sniffing FROM inbounds WHERE port=8443;"
echo
echo '=== xray live access log tail ==='
tail -40 /usr/local/x-ui/access.log 2>/dev/null || tail -40 /var/log/xray/access.log 2>/dev/null || echo no-log
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
