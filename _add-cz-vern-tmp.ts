import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
cd /opt/sub-manager && cat > _add-cz.ts <<'TS'
import { db, uid } from "./server/db.ts";
import { addClient, listInbounds, deleteClient } from "./server/x3ui.ts";

const subId = "7ecaa558-e0b0-499d-8b07-6466f96bee24";
const sub = db.queryEntries("SELECT * FROM subscriptions WHERE id=?", [subId])[0] as any;
const panelSlug = "pd4e485d3c9";
const inboundId = 28;

const ibs = await listInbounds(panelSlug);
const ib = ibs.find((x:any) => x.id === inboundId);
if (!ib) { console.error("No inbound"); Deno.exit(1); }

let ss:any={}; try{ ss=JSON.parse(ib.streamSettings||"{}"); }catch{}
const flow = (ib.protocol==="vless" && ss.security==="reality" && ss.network==="tcp") ? "xtls-rprx-vision" : "";
const clientEmail = sub.client_email + "_" + panelSlug + inboundId;

try { await deleteClient(panelSlug, inboundId, sub.client_uuid, ib.protocol); } catch {}
await addClient(panelSlug, inboundId, {
  id: sub.client_uuid, email: clientEmail,
  expiryTime: 0, totalGB: 0, subId: sub.slug.slice(0,16), flow
}, ib.protocol);

const exists = db.queryEntries("SELECT id FROM subscription_inbounds WHERE subscription_id=? AND panel=? AND inbound_id=?", [subId, panelSlug, inboundId]);
if (exists.length === 0) {
  db.query("INSERT INTO subscription_inbounds (id, subscription_id, panel, inbound_id, remark, protocol, port, host, stream_settings, client_email) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [uid(), subId, panelSlug, inboundId, ib.remark, ib.protocol, ib.port, "cz.panelsu.ru", ib.streamSettings||"{}", clientEmail]);
}
console.log("OK: added CZ vless", inboundId, "to vern");

const all = db.queryEntries("SELECT panel, inbound_id, remark, protocol, port, host FROM subscription_inbounds WHERE subscription_id=? ORDER BY panel", [subId]);
for (const r of all) console.log(JSON.stringify(r));
TS
DB_PATH=/opt/sub-manager/data/app.db /usr/local/bin/deno run -A --unstable-kv --env=/opt/sub-manager/.env _add-cz.ts
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
