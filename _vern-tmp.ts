import { Client } from 'ssh2';
function run(cmd:string):Promise<string>{return new Promise((res,rej)=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e)return rej(e);s.on('close',()=>{c.end();res(o);}).on('data',(d:any)=>o+=d).stderr.on('data',(d:any)=>o+=d);})).on('error',rej).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});});}
console.log(await run(`sqlite3 -header -column /opt/sub-manager/data/app.db "SELECT id,slug,name,client_email,client_uuid,expiry_ms FROM subscriptions WHERE name LIKE '%vern%' OR client_email LIKE '%vern%' OR slug LIKE '%vern%';"`));
console.log('---inbounds for that sub---');
console.log(await run(`sqlite3 /opt/sub-manager/data/app.db ".schema subscription_inbounds"`));
