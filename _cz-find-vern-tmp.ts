import { Client } from 'ssh2';
function run(host:string,pass:string,cmd:string):Promise<string>{return new Promise((res,rej)=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e)return rej(e);s.on('close',()=>{c.end();res(o);}).on('data',(d:any)=>o+=d).stderr.on('data',(d:any)=>o+=d);})).on('error',rej).connect({host,port:22,username:'root',password:pass});});}
console.log('=== panels ===');
console.log(await run('82.202.128.147','K!E2QAGrxYFx',`sqlite3 /opt/sub-manager/data/app.db "SELECT id,slug,name,host FROM panels;"`));
console.log('=== vern subs ===');
console.log(await run('82.202.128.147','K!E2QAGrxYFx',`sqlite3 -header /opt/sub-manager/data/app.db "SELECT id,client_uuid,panel_slug,inbound_id,email,expiry_ms FROM subscriptions WHERE email LIKE '%vern%' OR id LIKE '%vern%';"`));
console.log('=== inbounds CZ panel ===');
console.log(await run('82.202.128.147','K!E2QAGrxYFx',`sqlite3 -header /opt/sub-manager/data/app.db "SELECT panel_slug,inbound_id,protocol,remark FROM panel_inbounds WHERE panel_slug LIKE '%cz%' OR panel_slug LIKE '%че%';" 2>&1 | head -30`));
