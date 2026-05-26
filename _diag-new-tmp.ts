import { Client } from 'ssh2';
const c=new Client();
const SH=String.raw`
echo '=== HOST ==='; hostname; uptime
echo '=== SERVICES ==='
for s in x-ui nginx caddy hysteria-server xray; do printf "%-20s " $s; systemctl is-active $s 2>/dev/null; done
echo '=== LISTENERS ==='
ss -lntp 2>/dev/null | grep -E ':(22|80|443|2053|8443|18443|18444|18445|18446|10444|4430) '
echo '=== INBOUNDS DB ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id,remark,enable,listen,port,protocol,tag FROM inbounds;" 2>/dev/null
echo '=== INBOUND DETAIL (8443 + 1844x) ==='
sqlite3 /etc/x-ui/x-ui.db -json "SELECT id,remark,port,tag,stream_settings,sniffing FROM inbounds WHERE port IN (8443,18443,18444,18445,18446);" 2>/dev/null | python3 -c "import json,sys
try:
 rows=json.loads(sys.stdin.read() or '[]')
 for r in rows:
  ss=json.loads(r.get('stream_settings') or '{}')
  rs=ss.get('realitySettings',{})
  print(' inb',r['id'],'port',r['port'],'tag',r['tag'],'serverNames',rs.get('serverNames'),'shortIds',rs.get('shortIds'),'dest',rs.get('dest'))
except Exception as e: print('parse err',e)"
echo '=== ROUTING (template) ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT value FROM settings WHERE key='xrayTemplateConfig';" 2>/dev/null | python3 -c "import json,sys
try:
 t=json.loads(sys.stdin.read())
 print('OUTBOUNDS:')
 for o in t.get('outbounds',[]):
  rs=(o.get('streamSettings') or {}).get('realitySettings') or {}
  vn=((o.get('settings') or {}).get('vnext') or [{}])[0]
  print(' -',o.get('tag'),o.get('protocol'),'addr',vn.get('address'),'port',vn.get('port'),'sni',rs.get('serverName'))
 print('RULES:')
 for r in t.get('routing',{}).get('rules',[]):
  print(' -',r.get('inboundTag'),'->',r.get('outboundTag'),'dom',r.get('domain'),'ip',r.get('ip'))
except Exception as e: print('tpl err',e)"
echo '=== NGINX STREAM ==='
ls /etc/nginx/ 2>/dev/null; grep -l stream-sni /etc/nginx/* 2>/dev/null; cat /etc/nginx/stream-sni.conf 2>/dev/null | head -40
echo '=== XRAY ERRORS (tail) ==='
tail -40 /usr/local/x-ui/error.log 2>/dev/null
echo '=== XRAY ACCESS (tail) ==='
tail -20 /usr/local/x-ui/access.log 2>/dev/null
echo '=== JOURNAL x-ui errors ==='
journalctl -u x-ui -n 50 --no-pager 2>/dev/null | grep -iE 'error|fail|panic|refused|denied' | tail -15
`;
c.on('ready',()=>c.exec(SH,(e,s)=>{if(e){console.error(e);return}s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()))}))
.on('error',(e:any)=>console.error('SSH',e.message))
.connect({host:'87.121.105.143',port:22,username:'root',password:'f4OQrEBYUQnEmwkgqPnwDD',readyTimeout:15000});
