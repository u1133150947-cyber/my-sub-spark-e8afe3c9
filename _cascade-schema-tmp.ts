import { Client } from 'ssh2';
function ssh(h:string,p:string,c:string):Promise<string>{return new Promise((r,j)=>{const cl=new Client();let o='';cl.on('ready',()=>cl.exec(c,(e,s)=>{if(e)return j(e);s.on('close',()=>{cl.end();r(o);}).on('data',(d:any)=>o+=d).stderr.on('data',(d:any)=>o+=d);})).on('error',j).connect({host:h,port:22,username:'root',password:p});});}
const py=`python3 -c "
import sqlite3,json
d=sqlite3.connect('/etc/x-ui/x-ui.db')
print('inbounds cols:')
for r in d.execute(\\\"PRAGMA table_info(inbounds)\\\"): print(r)
print('settings table cols:')
for r in d.execute(\\\"PRAGMA table_info(settings)\\\"): print(r)
print('settings keys:')
for r in d.execute(\\\"SELECT key FROM settings\\\"): print(r)
print('xrayTemplate present:', d.execute(\\\"SELECT length(value) FROM settings WHERE key='xrayTemplateConfig'\\\").fetchone())
print('full inbound row 2:')
import json as j
row=d.execute(\\\"SELECT * FROM inbounds WHERE id=2\\\").fetchone()
cols=[c[1] for c in d.execute(\\\"PRAGMA table_info(inbounds)\\\")]
print(j.dumps(dict(zip(cols,[str(x) if not isinstance(x,(int,float,type(None))) else x for x in row])),indent=2,ensure_ascii=False))
"`;
console.log(await ssh('82.202.128.147','K!E2QAGrxYFx', py));
