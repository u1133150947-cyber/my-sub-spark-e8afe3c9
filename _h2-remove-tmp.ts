import { Client } from 'ssh2';
function ssh(host:string,pw:string,cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host,port:22,username:'root',password:pw,readyTimeout:15000});});}

const cmd = `
set +e
DB=/opt/sub-manager/data/app.db
echo "== before =="
sqlite3 "$DB" "SELECT panel,protocol,COUNT(*) FROM subscription_inbounds GROUP BY panel,protocol;"
sqlite3 "$DB" "DELETE FROM subscription_inbounds WHERE protocol='hysteria2' OR protocol LIKE '%hysteria%' OR protocol='hy2';"
echo "deleted rc=$?"
echo "== after =="
sqlite3 "$DB" "SELECT panel,protocol,COUNT(*) FROM subscription_inbounds GROUP BY panel,protocol;"
echo "== standalone_servers (kept) =="
sqlite3 "$DB" "SELECT id,name,host,port FROM standalone_servers;"
echo "== restart sub-manager to pick up =="
systemctl restart sub-manager 2>&1 | head -5
sleep 2
systemctl is-active sub-manager
`;
console.log(await ssh('82.202.128.147','K!E2QAGrxYFx',cmd));
