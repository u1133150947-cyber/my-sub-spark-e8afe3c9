import { Client } from 'ssh2';
const SH=`
echo HOST=\`hostname\`
echo '--- x-ui ---'; systemctl is-active x-ui
echo '--- listeners 8443 ---'; ss -lntp 2>/dev/null | grep -E ':(8443|443) '
echo '--- inbounds ---'
sqlite3 /etc/x-ui/x-ui.db -json "SELECT id,remark,port,tag,enable,stream_settings,settings FROM inbounds;" 2>/dev/null | python3 -c "
import json,sys
for r in json.loads(sys.stdin.read() or '[]'):
 ss=json.loads(r['stream_settings'])
 rs=ss.get('realitySettings',{})
 s=json.loads(r['settings'])
 print(' inb',r['id'],'port',r['port'],'tag',r['tag'],'enabled',r['enable'])
 print('   serverNames',rs.get('serverNames'),'shortIds',rs.get('shortIds'),'dest',rs.get('dest'),'pbk_priv',('privateKey' in rs))
 for cl in s.get('clients',[]):
  print('   client email',cl.get('email'),'id',cl.get('id'),'flow',cl.get('flow'))
"
echo '--- xray error ---'; tail -25 /usr/local/x-ui/error.log 2>/dev/null
echo '--- xray access tail ---'; tail -15 /usr/local/x-ui/access.log 2>/dev/null
`;
async function run(name:string, host:string, pw:string){
  await new Promise<void>(res=>{
    const c=new Client();
    console.log('\n### '+name+' '+host);
    c.on('ready',()=>c.exec(SH,(err,s)=>{if(err){console.error(err);res();return}s.on('close',()=>{c.end();res()}).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()))}))
    .on('error',(er:any)=>{console.error('ssh',name,er.message);res()})
    .connect({host,port:22,username:'root',password:pw,readyTimeout:12000});
  });
}
await run('cz','185.87.148.138','hf6Ka8viMl');
await run('de','171.22.31.25','ObAvtvfpvQFUfSVCXyW99Mdi');
