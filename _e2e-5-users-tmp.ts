import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx',readyTimeout:15000});});}

const remote = `cat > /tmp/fix5.ts << 'TS'
import { db } from "/opt/sub-manager/server/db.ts";
import { listInbounds, addClient } from "/opt/sub-manager/server/x3ui.ts";

const PANEL = "pee9e3676f7";
const INBOUND = 1;

// Find broken users: DB row exists, but client missing on panel
const ibs = await listInbounds(PANEL);
const ib = ibs.find((i:any)=>i.id===INBOUND);
const settings = JSON.parse(ib.settings);
const panelEmails = new Set(settings.clients.map((c:any)=>c.email));
const panelUuids = new Set(settings.clients.map((c:any)=>c.id));

const links = db.queryEntries(\`
  SELECT si.client_email, si.stream_settings, s.client_uuid, s.name, s.slug, s.client_email as sub_email, s.expiry_ms, s.total_bytes
  FROM subscription_inbounds si
  JOIN subscriptions s ON s.id=si.subscription_id
  WHERE si.panel=? AND si.inbound_id=?
\`, [PANEL, INBOUND]) as any[];

const broken = links.filter(l => !panelEmails.has(l.client_email) && !panelUuids.has(l.client_uuid));
console.log("Will fix " + broken.length + " users:");
for (const b of broken) console.log("  - " + b.name + " uuid=" + b.client_uuid.slice(0,8) + " email=" + b.client_email);

let stream:any = {}; try { stream = JSON.parse(ib.streamSettings); } catch {}
const flow = (ib.protocol === "vless" && stream.security === "reality" && stream.network === "tcp") ? "xtls-rprx-vision" : "";
console.log("Protocol=" + ib.protocol + " flow=" + flow);

console.log("\\n=== Adding ===");
for (const b of broken) {
  const subId = String(b.slug).slice(0, 16);
  try {
    await addClient(PANEL, INBOUND, {
      id: b.client_uuid,
      email: b.client_email,
      expiryTime: b.expiry_ms ?? 0,
      totalGB: b.total_bytes ?? 0,
      subId,
      flow,
    }, ib.protocol);
    console.log("  ✓ " + b.name);
  } catch (e) {
    console.log("  ✗ " + b.name + " :: " + (e instanceof Error ? e.message : String(e)));
  }
}

console.log("\\n=== Verify ===");
const ibs2 = await listInbounds(PANEL);
const ib2 = ibs2.find((i:any)=>i.id===INBOUND);
const s2 = JSON.parse(ib2.settings);
console.log("Panel now has " + s2.clients.length + " clients on inbound #" + INBOUND + ":");
for (const c of s2.clients) console.log("  • " + (c.email||"").padEnd(40) + " uuid=" + (c.id||"").slice(0,8));
TS
cd /opt/sub-manager && deno run -A /tmp/fix5.ts 2>&1`;

console.log(await ssh(remote));
