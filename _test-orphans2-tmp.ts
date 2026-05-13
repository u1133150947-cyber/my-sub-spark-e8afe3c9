import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx',readyTimeout:15000});});}

const remote = `cat > /tmp/orphans.ts << 'TS'
import { db } from "/opt/sub-manager/server/db.ts";
import { listInbounds, getAllPanels } from "/opt/sub-manager/server/x3ui.ts";

const subRows = db.queryEntries("SELECT id, name, client_uuid FROM subscriptions") as any[];
const linkRows = db.queryEntries("SELECT subscription_id, panel, inbound_id, client_email FROM subscription_inbounds") as any[];

const subById = new Map(subRows.map(s => [s.id, s]));
const dbByPanel: Record<string, {emails:Set<string>, uuids:Set<string>}> = {};
for (const l of linkRows) {
  const p = dbByPanel[l.panel] ??= { emails:new Set(), uuids:new Set() };
  p.emails.add(l.client_email);
  const sub = subById.get(l.subscription_id); if (sub) p.uuids.add(sub.client_uuid);
}

console.log("=== DB summary ===");
console.log("Subs:", subRows.length, "Links:", linkRows.length);
for (const s of subRows) {
  const cnt = linkRows.filter(l => l.subscription_id === s.id).length;
  console.log(\`  \${s.name.padEnd(20)} uuid=\${s.client_uuid.slice(0,8)} inbounds=\${cnt}\`);
}

const panels = getAllPanels();
const orphans: any[] = [];
const missing: any[] = [];

for (const p of panels) {
  console.log(\`\\n=== Panel \${p.slug} ===\`);
  let ibs: any[] = [];
  try { ibs = await listInbounds(p.slug); } catch (e) { console.log("  err:", String(e).slice(0,120)); continue; }
  const dbset = dbByPanel[p.slug] ?? { emails:new Set(), uuids:new Set() };
  
  for (const ib of ibs) {
    let s: any = {}; try { s = JSON.parse(ib.settings); } catch {}
    const clients = s.clients ?? [];
    console.log(\`  inbound #\${ib.id} '\${(ib.remark||"").slice(0,30)}' port=\${ib.port} → \${clients.length} clients\`);
    for (const c of clients) {
      const inDb = dbset.emails.has(c.email);
      if (!inDb) {
        orphans.push({ panel:p.slug, inbound:ib.id, email:c.email, uuid:c.id?.slice(0,8) });
        console.log(\`     ⚠ ORPHAN: \${c.email} uuid=\${c.id?.slice(0,8)}\`);
      }
    }
    // missing on panel?
    const panelEmails = new Set(clients.map((c:any)=>c.email));
    for (const l of linkRows.filter(l => l.panel===p.slug && l.inbound_id===ib.id)) {
      if (!panelEmails.has(l.client_email)) {
        missing.push({ panel:p.slug, inbound:ib.id, email:l.client_email });
      }
    }
  }
}

console.log("\\n═══ FINAL ═══");
console.log("Orphans on panel (NOT in DB):", orphans.length);
console.log("Missing on panel (in DB but not on panel):", missing.length);
for (const m of missing) console.log("  MISSING:", JSON.stringify(m));
TS
cd /opt/sub-manager && deno run -A --unstable-ffi /tmp/orphans.ts 2>&1`;

console.log(await ssh(remote));
