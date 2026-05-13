import { Client } from 'ssh2';
function run(cmd:string):Promise<string>{return new Promise((res,rej)=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e)return rej(e);s.on('close',()=>{c.end();res(o);}).on('data',(d:any)=>o+=d).stderr.on('data',(d:any)=>o+=d);})).on('error',rej).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});});}
console.log('--- vern inbounds ---');
console.log(await run(`sqlite3 -header -column /opt/sub-manager/data/app.db "SELECT panel,inbound_id,protocol,port,host,remark FROM subscription_inbounds WHERE subscription_id='7ecaa558-e0b0-499d-8b07-6466f96bee24';"`));
console.log('--- auth probe with vern uuid ---');
console.log(await run(`curl -s -X POST https://web.panelsu.ru/api/hy2/auth -H 'content-type: application/json' -d '{"addr":"1.2.3.4:1","auth":"80c4aa5b-607f-4143-9dd1-aa8b12ec4195","tx":0}' --max-time 8`));
