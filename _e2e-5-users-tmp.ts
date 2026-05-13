import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx',readyTimeout:15000});});}

const remote = String.raw`cat > /tmp/e2e5.ts << 'TS'
import { db } from "/opt/sub-manager/server/db.ts";
import { listInbounds } from "/opt/sub-manager/server/x3ui.ts";

const FIXED = ["Dmitry","alina","Andrey","Test_z7didjgr05po","anton"];
const PANEL = "pee9e3676f7";
const INBOUND = 1;

const ibs = await listInbounds(PANEL);
const ib = ibs.find((i:any)=>i.id===INBOUND);
const settings = JSON.parse(ib.settings);
const panelClients = new Map(settings.clients.map((c:any)=>[c.id,c]));

console.log("=== E2E test for 5 fixed users ===\n");

const placeholders = FIXED.map(()=>'?').join(',');
const subs = db.queryEntries("SELECT id, name, slug, client_uuid, client_email, expiry_ms FROM subscriptions WHERE name IN (" + placeholders + ")", FIXED) as any[];

let pass = 0, fail = 0;
for (const s of subs) {
  const tag = (s.name as string).padEnd(22);
  const checks: string[] = [];

  const pc:any = panelClients.get(s.client_uuid);
  checks.push(pc ? "panel:OK" : "panel:MISS");
  if (pc) checks.push("enable:" + pc.enable);

  let txt = "", status = 0;
  try {
    const r = await fetch("http://127.0.0.1:8080/sub/" + s.slug, { headers: { "User-Agent": "v2rayN/6.0" }, signal: AbortSignal.timeout(5000) });
    status = r.status;
    txt = await r.text();
    checks.push("http:" + status);
  } catch { checks.push("http:ERR"); }

  let body = txt;
  try { body = atob(txt.replace(/\s/g,'')); } catch {}

  const hasUuid = body.includes(s.client_uuid);
  checks.push(hasUuid ? "uuid:OK" : "uuid:MISS");

  const lines = body.split(/\n/).filter(Boolean);
  const vlessRu = lines.find(l => l.startsWith("vless://" + s.client_uuid) && /security=reality/.test(l) && /flow=xtls-rprx-vision/.test(l));
  checks.push(vlessRu ? "vlessRU:OK" : "vlessRU:MISS");

  const ok = pc && pc.enable && hasUuid && !!vlessRu;
  if (ok) pass++; else fail++;
  console.log((ok?"OK":"FAIL") + " " + tag + " " + checks.join(" "));
  if (vlessRu) {
    const port = vlessRu.match(/@[^:]+:(\d+)\?/)?.[1];
    const sni = vlessRu.match(/sni=([^&]+)/)?.[1];
    console.log("    -> port=" + port + " sni=" + sni + " links=" + lines.length);
  }
}
console.log("\n=== " + pass + " passed, " + fail + " failed ===");
TS
cd /opt/sub-manager && deno run -A /tmp/e2e5.ts 2>&1`;

console.log(await ssh(remote));
