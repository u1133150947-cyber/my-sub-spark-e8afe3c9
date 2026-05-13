import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx',readyTimeout:15000});});}

const c = `
DB=/opt/sub-manager/data/app.db
echo "═══ К каким подпискам привязаны MISSING строки ═══"
sqlite3 -header -column "$DB" "SELECT s.name, s.client_uuid, si.client_email, si.panel, si.inbound_id FROM subscription_inbounds si LEFT JOIN subscriptions s ON s.id=si.subscription_id WHERE si.client_email LIKE '%@sub.local%';"

echo ""
echo "═══ Все строки на inbound #1 RU ═══"
sqlite3 -header -column "$DB" "SELECT s.name, si.client_email FROM subscription_inbounds si LEFT JOIN subscriptions s ON s.id=si.subscription_id WHERE si.panel='pee9e3676f7' AND si.inbound_id=1;"

echo ""
echo "═══ Реально на панели (RU inb #1) ═══"
cat > /tmp/list1.ts << 'TS'
import { listInbounds } from "/opt/sub-manager/server/x3ui.ts";
const ibs = await listInbounds("pee9e3676f7");
const ib = ibs.find((i:any) => i.id === 1);
const s = JSON.parse(ib.settings);
for (const c of s.clients) console.log(\`  \${c.email.padEnd(40)} uuid=\${c.id.slice(0,8)}\`);
TS
cd /opt/sub-manager && deno run -A /tmp/list1.ts
`;
console.log(await ssh(c));
