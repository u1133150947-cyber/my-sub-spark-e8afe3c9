import { Client } from 'ssh2';
function run(cmd:string):Promise<string>{return new Promise((res,rej)=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e)return rej(e);s.on('close',()=>{c.end();res(o);}).on('data',(d:any)=>o+=d).stderr.on('data',(d:any)=>o+=d);})).on('error',rej).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});});}
console.log(await run(`sqlite3 /opt/sub-manager/data/app.db ".schema subscriptions"`));
console.log('---tables---');
console.log(await run(`sqlite3 /opt/sub-manager/data/app.db ".tables"`));
console.log('---vern---');
console.log(await run(`sqlite3 -header /opt/sub-manager/data/app.db "SELECT * FROM subscriptions WHERE email LIKE '%vern%' OR remark LIKE '%vern%' LIMIT 5;" 2>&1`));
