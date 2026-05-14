import { Client } from 'ssh2';
const c = new Client();
const script = String.raw`
cd /opt/sub-manager && cat > _add-cz-all.ts <<'TS'
import { db, uid } from "./server/db.ts";
import { addClient, listInbounds, deleteClient } from "./server/x3ui.ts";

const panelSlug = "pd4e485d3c9";
const inboundId = 28;
const host = "cz.panelsu.ru";

const ibs = await listInbounds(panelSlug);
const ib = ibs.find((x:any) => x.id === inboundId);
if (!ib) { console.error("No CZ inbound"); Deno.exit(1); }
let ss:any={}; try{ ss=JSON.parse(ib.streamSettings||"{}"); }catch{}
const flow = (ib.protocol==="vless" && ss.security==="reality" && ss.network==="tcp") ? "xtls-rprx-vision" : "";

const subs = db.queryEntries("SELECT * FROM subscriptions") as any[];
console.log("Total subs:", subs.length);
for (const sub of subs) {
  const clientEmail = sub.client_email + "_" + panelSlug + inboundId;
  try { await deleteClient(panelSlug, inboundId, sub.client_uuid, ib.protocol); } catch {}
  try {
    await addClient(panelSlug, inboundId, {
      id: sub.client_uuid, email: clientEmail,
      expiryTime: 0, totalGB: 0, subId: sub.slug.slice(0,16), flow
    }, ib.protocol);
  } catch (e:any) { console.error("addClient FAIL", sub.slug, e.message); continue; }
  const exists = db.queryEntries("SELECT id FROM subscription_inbounds WHERE subscription_id=? AND panel=? AND inbound_id=?", [sub.id, panelSlug, inboundId]);
  if (exists.length === 0) {
    db.query("INSERT INTO subscription_inbounds (id, subscription_id, panel, inbound_id, remark, protocol, port, host, stream_settings, client_email) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [uid(), sub.id, panelSlug, inboundId, ib.remark, ib.protocol, ib.port, host, ib.streamSettings||"{}", clientEmail]);
  } else {
    db.query("UPDATE subscription_inbounds SET remark=?, protocol=?, port=?, host=?, stream_settings=?, client_email=? WHERE subscription_id=? AND panel=? AND inbound_id=?",
      [ib.remark, ib.protocol, ib.port, host, ib.streamSettings||"{}", clientEmail, sub.id, panelSlug, inboundId]);
  }
  console.log("OK", sub.slug, clientEmail);
}
console.log("\n--- final per-sub inbound list ---");
for (const sub of subs) {
  const rows = db.queryEntries("SELECT panel, inbound_id, remark, protocol FROM subscription_inbounds WHERE subscription_id=? ORDER BY panel", [sub.id]);
  console.log(sub.slug, "->", rows.map((r:any)=>r.panel+":"+r.inbound_id+"/"+r.protocol).join(", "));
}
TS
DB_PATH=/opt/sub-manager/data/app.db /usr/local/bin/deno run -A --unstable-kv --env=/opt/sub-manager/.env _add-cz-all.ts
`;
c.on('ready',()=>c.exec(script,(e,s)=>{
  s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));
})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx',readyTimeout:30000});
