import { Client } from 'ssh2';
const cmd = `
printf 'DIRS\n'; ls -d /root/sub-manager /opt/sub-manager 2>/dev/null || true
for d in /root/sub-manager /opt/sub-manager; do if [ -d "$d" ]; then echo "== $d =="; ls "$d" | head; fi; done
cd /root/sub-manager 2>/dev/null || cd /opt/sub-manager || exit 1
cat > /opt/sub-manager/h2_manager_audit.ts <<'TS2'
import { db } from './server/db.ts';
import { listInbounds, updateClient } from './server/x3ui.ts';
const slug='4p3y8viw1txl';
const sub:any = db.queryEntries('SELECT * FROM subscriptions WHERE slug=?',[slug])[0];
console.log('SUB', JSON.stringify(sub,null,2));
const rows:any[] = db.queryEntries('SELECT * FROM subscription_inbounds WHERE subscription_id=? ORDER BY panel,inbound_id',[sub?.id]);
console.log('LINKS', JSON.stringify(rows.map(r=>({panel:r.panel,inbound_id:r.inbound_id,protocol:r.protocol,client_email:r.client_email,port:r.port,host:r.host,remark:r.remark})),null,2));
for (const panel of [...new Set(rows.map(r=>r.panel))]) {
  console.log('PANEL', panel);
  const live = await listInbounds(panel);
  for (const r of rows.filter(x=>x.panel===panel)) {
    const ib = live.find((x:any)=>Number(x.id)===Number(r.inbound_id));
    if (!ib) { console.log('NO_IB', r.panel, r.inbound_id); continue; }
    let s:any={}; try{s=JSON.parse(ib.settings||'{}')}catch(e){console.log('SETTINGS_PARSE_ERR',e)}
    const clients=Array.isArray(s.clients)?s.clients:[];
    const matches=clients.filter((c:any)=>c.email===r.client_email || c.id===sub.client_uuid || c.password===sub.client_uuid);
    console.log('IB', r.panel, r.inbound_id, ib.protocol, ib.port, ib.remark, 'clients', clients.length, 'matches', matches.length, JSON.stringify(matches));
  }
}
TS2
cd /opt/sub-manager && deno run -A h2_manager_audit.ts
`;
const c=new Client(); c.on('ready',()=>c.exec(cmd,(err,s)=>{if(err)throw err; s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()))})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
