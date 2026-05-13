import { Client } from 'ssh2';
function ssh(host:string,pw:string,cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host,port:22,username:'root',password:pw,readyTimeout:15000});});}

const ruCmd = `
set +e
DB=/opt/sub-manager/data/app.db
[ ! -f "$DB" ] && DB=/opt/sub-manager/app.db
echo "DB=$DB"
echo "== tables =="
sqlite3 "$DB" ".tables"
echo "== subscriptions count =="
sqlite3 "$DB" "SELECT COUNT(*) FROM subscriptions;"
echo "== sample raw_links search for hysteria =="
sqlite3 "$DB" "SELECT slug,name FROM subscriptions WHERE raw_links LIKE '%hysteria%' OR raw_links LIKE '%hy2%' LIMIT 50;"
echo "== inbounds tables? =="
sqlite3 "$DB" ".schema subscription_inbounds" 2>/dev/null | head -20
sqlite3 "$DB" "SELECT panel,protocol,COUNT(*) FROM subscription_inbounds GROUP BY panel,protocol;" 2>/dev/null
echo "== H2 inbound rows =="
sqlite3 "$DB" "SELECT id,panel,inbound_id,protocol,port,remark FROM subscription_inbounds WHERE protocol LIKE '%hysteria%' OR protocol='hy2';" 2>/dev/null
`;
console.log(await ssh('82.202.128.147','K!E2QAGrxYFx',ruCmd));
