import { Client } from 'ssh2';
const SH=`
echo '=== Inbounds + client count ==='
sqlite3 /etc/x-ui/x-ui.db -json "SELECT id,tag,port,settings FROM inbounds WHERE port IN (18443,18444,18445,18446);" | python3 -c "
import json,sys
for r in json.loads(sys.stdin.read() or '[]'):
 s=json.loads(r['settings']); cls=s.get('clients',[])
 print('inb',r['id'],'tag',r['tag'],'port',r['port'],'clients=',len(cls))
 for c in cls:
  print('  ',c.get('email'),'id',c.get('id'),'flow',c.get('flow'))
"
echo '=== client_traffics ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT inbound_id,email,enable FROM client_traffics ORDER BY inbound_id;"
`;
const c=new Client();
c.on('ready',()=>c.exec(SH,(e,s)=>{if(e){console.error(e);return}s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()))}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:15000});
