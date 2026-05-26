import { Client } from 'ssh2';
const pw = process.env.RU_SSH_PASSWORD!;
const SH = `
echo '=== x-ui inbounds ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id,remark,port,tag,enable FROM inbounds ORDER BY id;"
echo '=== xray_setting outbounds & routing tags ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT value FROM settings WHERE key='xrayTemplateConfig';" | python3 -c "
import json,sys
v=sys.stdin.read().strip()
if not v: print('(empty)'); sys.exit()
c=json.loads(v)
print('OUTBOUNDS:')
for o in c.get('outbounds',[]): print(' tag=',o.get('tag'),'proto=',o.get('protocol'),'srv=',[(s.get('address'),s.get('port')) for s in (o.get('settings',{}).get('vnext') or o.get('settings',{}).get('servers') or [])])
print('ROUTING RULES:')
for r in c.get('routing',{}).get('rules',[]): print(' ',r)
"
echo '=== nginx sites ==='
ls /etc/nginx/conf.d/ 2>/dev/null; ls /etc/nginx/sites-enabled/ 2>/dev/null
echo '=== nginx stream maps with SNI ==='
grep -rEn 'ya.ru|dzen|mail.yandex|market.yandex|18443|18444|18445|18446' /etc/nginx/ 2>/dev/null | head -60
`;
await new Promise<void>(res=>{
  const c=new Client();
  c.on('ready',()=>c.exec(SH,(e,s)=>{if(e){console.error(e);res();return}s.on('close',()=>{c.end();res()}).on('data',(d:any)=>process.stdout.write(d)).stderr.on('data',(d:any)=>process.stderr.write(d))}))
   .on('error',(e:any)=>{console.error(e.message);res()})
   .connect({host:'ru.panelsu.ru',port:22,username:'root',password:pw,readyTimeout:15000});
});
