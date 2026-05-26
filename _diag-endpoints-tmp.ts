import { Client } from 'ssh2';
const endpoints = [
  { name:'cz', host:'185.87.148.138', pw:'hf6Ka8viMl' },
  { name:'se', host:'87.121.105.143', pw:'f4OQrEBYUQnEmwkgqPnwDD' },
  { name:'fi', host:'31.76.77.237',   pw:'LqWp4FK0EdcfkeYjw0UIHbS' },
  { name:'de', host:'171.22.31.25',   pw:null },
];
const SH=`
echo HOST=\`hostname\`
echo '--- x-ui status ---'; systemctl is-active x-ui 2>/dev/null
echo '--- listeners ---'; ss -lntp 2>/dev/null | grep -E ':(443|8443|2053) '
echo '--- inbounds ---'
sqlite3 /etc/x-ui/x-ui.db -json "SELECT id,remark,port,tag,stream_settings FROM inbounds;" 2>/dev/null | python3 -c "
import json,sys
for r in json.loads(sys.stdin.read() or '[]'):
 ss=json.loads(r['stream_settings'])
 rs=ss.get('realitySettings',{})
 print(' inb',r['id'],'port',r['port'],'tag',r['tag'],'serverNames',rs.get('serverNames'),'shortIds',rs.get('shortIds'),'pbk_priv',('privateKey' in rs),'pbkPrefix',(rs.get('publicKey') or rs.get('settings',{}).get('publicKey') or '')[:14],'dest',rs.get('dest'))
"
echo '--- xray errors tail ---'
tail -20 /usr/local/x-ui/error.log 2>/dev/null
echo '--- clients in inbound ---'
sqlite3 /etc/x-ui/x-ui.db "SELECT id,port,settings FROM inbounds;" 2>/dev/null | python3 -c "
import json,sys
for line in sys.stdin:
 try:
  parts=line.strip().split('|',2)
  if len(parts)<3: continue
  s=json.loads(parts[2])
  for cl in s.get('clients',[]):
    print(' inb',parts[0],'port',parts[1],'email',cl.get('email'),'id',(cl.get('id') or '')[:8],'flow',cl.get('flow'))
 except: pass
"
`;
async function one(e:any){
  if(!e.pw){console.log('### '+e.name+' '+e.host+' SKIP (no password)'); return}
  await new Promise<void>(res=>{
    const c=new Client();
    console.log('\n### '+e.name+' '+e.host);
    c.on('ready',()=>c.exec(SH,(err,s)=>{if(err){console.error(err);res();return}s.on('close',()=>{c.end();res()}).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()))}))
    .on('error',(er:any)=>{console.error('ssh',e.name,er.message);res()})
    .connect({host:e.host,port:22,username:'root',password:e.pw,readyTimeout:12000});
  });
}
for(const e of endpoints) await one(e);
