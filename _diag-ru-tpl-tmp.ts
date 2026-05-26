import { Client } from 'ssh2';
const c=new Client();
const SH=String.raw`
sqlite3 /etc/x-ui/x-ui.db "SELECT value FROM settings WHERE key='xrayTemplateConfig';" | python3 -c "
import json,sys
t=json.loads(sys.stdin.read())
print('=== OUTBOUNDS ===')
for o in t.get('outbounds',[]):
 rs=(o.get('streamSettings') or {}).get('realitySettings') or {}
 vn=((o.get('settings') or {}).get('vnext') or [{}])[0]
 us=(vn.get('users') or [{}])[0]
 print(' tag=',o.get('tag'),'proto=',o.get('protocol'),'addr=',vn.get('address'),'port=',vn.get('port'),'sni=',rs.get('serverName'),'shortId=',rs.get('shortId'),'pbk=',(rs.get('publicKey') or '')[:12],'uuid=',(us.get('id') or '')[:8])
print('=== RULES ===')
for r in t.get('routing',{}).get('rules',[]):
 print(' in=',r.get('inboundTag'),'-> out=',r.get('outboundTag'),'dom=',r.get('domain'))
"
echo '=== INBOUNDS ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id,remark,listen,port,tag FROM inbounds;"
echo '=== INBOUND REALITY DETAILS ==='
sqlite3 /etc/x-ui/x-ui.db -json "SELECT id,tag,port,stream_settings FROM inbounds;" | python3 -c "
import json,sys
for r in json.loads(sys.stdin.read() or '[]'):
 ss=json.loads(r['stream_settings'])
 rs=ss.get('realitySettings',{})
 print(' inb',r['id'],'port',r['port'],'tag',r['tag'],'serverNames',rs.get('serverNames'),'shortIds',rs.get('shortIds'),'dest',rs.get('dest'))
"
echo '=== XRAY ERROR TAIL ==='
tail -50 /usr/local/x-ui/error.log 2>/dev/null
echo '=== TCP probe to cascade endpoints ==='
for ip_port in 87.121.105.143:8443 31.76.77.237:8443 185.87.148.138:8443; do
  ip=\${ip_port%:*}; pt=\${ip_port#*:}
  timeout 4 bash -c "</dev/tcp/$ip/$pt" 2>/dev/null && echo "  $ip_port OPEN from RU" || echo "  $ip_port DOWN from RU"
done
echo '=== TLS handshake test via openssl (each SNI from RU) ==='
for sni in ya.ru dzen.ru mail.yandex.ru market.yandex.ru; do
  echo "-- SNI=$sni to 87.121.105.143:8443 --"
  timeout 6 openssl s_client -connect 87.121.105.143:8443 -servername $sni -tls1_3 < /dev/null 2>&1 | grep -E 'subject=|CONNECTED|alert|error|Verify' | head -5
done
`;
c.on('ready',()=>c.exec(SH,(e,s)=>{if(e){console.error(e);return}s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()))}))
.on('error',(e:any)=>console.error('SSH',e.message))
.connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:15000});
