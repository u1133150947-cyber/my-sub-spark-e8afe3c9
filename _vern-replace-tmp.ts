import { Client } from 'ssh2';
function run(cmd:string):Promise<string>{return new Promise((res,rej)=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e)return rej(e);s.on('close',()=>{c.end();res(o);}).on('data',(d:any)=>o+=d).stderr.on('data',(d:any)=>o+=d);})).on('error',rej).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});});}
const SUB='7ecaa558-e0b0-499d-8b07-6466f96bee24';
console.log('--- before ---');
console.log(await run(`sqlite3 -header -column /opt/sub-manager/data/app.db "SELECT id,panel,inbound_id,remark FROM subscription_inbounds WHERE subscription_id='${SUB}';"`));
console.log('--- delete CZ standalone 1001 ---');
console.log(await run(`sqlite3 /opt/sub-manager/data/app.db "DELETE FROM subscription_inbounds WHERE subscription_id='${SUB}' AND panel='standalone' AND inbound_id=1001;" && echo deleted`));
console.log('--- re-add fresh ---');
console.log(await run(`sqlite3 /opt/sub-manager/data/app.db "INSERT INTO subscription_inbounds (id,subscription_id,panel,inbound_id,remark,protocol,port,host,stream_settings,client_email) VALUES (lower(hex(randomblob(16))),'${SUB}','standalone',1001,'Hysteria 2 - CZ (NEW)','hysteria2',443,'reality.panelsu.ru','{}','vern_cz_'||strftime('%s','now'));" && echo inserted`));
console.log('--- after ---');
console.log(await run(`sqlite3 -header -column /opt/sub-manager/data/app.db "SELECT id,panel,inbound_id,remark,client_email FROM subscription_inbounds WHERE subscription_id='${SUB}';"`));
console.log('--- bump sub-manager to flush sub cache ---');
console.log(await run(`systemctl restart sub-manager && sleep 2 && systemctl is-active sub-manager`));
