import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});});}
console.log(await ssh(`
DB=/opt/sub-manager/data/app.db
echo '== schema subscription_inbounds =='
sqlite3 $DB ".schema subscription_inbounds"
echo '== vern subscription =='
sqlite3 $DB "SELECT id,slug,name,client_uuid FROM subscriptions WHERE name LIKE '%vern%';"
echo '== vern inbounds =='
sqlite3 $DB -header "SELECT id,panel,inbound_id,protocol,port,host,remark,client_email FROM subscription_inbounds WHERE subscription_id=(SELECT id FROM subscriptions WHERE name LIKE '%vern%');"
`));
