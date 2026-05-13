import { Client } from 'ssh2';

const script = `
import { db } from "./server/db.ts";
import { addClient, listInbounds, uuidv4, randomSlug } from "./server/x3ui.ts";

async function main() {
  const targetSlug = "uia3c088ozg3";
  const existing = db.queryEntries("SELECT id FROM subscriptions WHERE slug = ?", [targetSlug]);
  if (existing.length > 0) { console.log("Already exists."); return; }

  const name = "user_" + targetSlug;
  const email = "user_" + targetSlug + "@panelsu.ru";
  const clientUuid = uuidv4();
  const subIdShort = randomSlug(16);
  const subId = uuidv4();

  db.query("INSERT INTO subscriptions (id, slug, name, client_email, client_uuid, expiry_ms, total_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [subId, targetSlug, name, email, clientUuid, 0, 0]);

  const panels = db.queryEntries("SELECT slug, id FROM panels") as any[];
  for (const p of panels) {
    try {
      const panelSlug = p.slug;
      const inbounds = await listInbounds(panelSlug);
      for (const ib of inbounds) {
        if (!ib.enable) continue;
        let flow = ""; let ss: any = {}; try { ss = JSON.parse(ib.streamSettings || "{}"); } catch {}
        if (ib.protocol === "vless" && ss.security === "reality" && ss.network === "tcp") flow = "xtls-rprx-vision";
        
        await addClient(panelSlug, ib.id, {
          id: clientUuid, email: email + "_" + panelSlug + ib.id, expiryTime: 0, totalGB: 0, subId: subIdShort, flow
        }, ib.protocol);

        db.query("INSERT INTO subscription_inbounds (id, subscription_id, panel, inbound_id, remark, protocol, port, host, stream_settings, client_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [uuidv4(), subId, panelSlug, ib.id, ib.remark, ib.protocol, ib.port, "web.panelsu.ru", ib.streamSettings || "{}", email + "_" + panelSlug + ib.id]);
        console.log("[+] Added to " + panelSlug + " inbound " + ib.id);
      }
    } catch (e: any) { console.error("[-] Error on panel " + p.slug + ": " + e.message); }
  }
  console.log("Done.");
}
main().catch(console.error);
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`cat << 'EOF2' > /opt/sub-manager/add-user2.ts\n${script}\nEOF2\ncd /opt/sub-manager && DB_PATH=/opt/sub-manager/data/app.db /usr/local/bin/deno run -A --unstable-kv --env=/opt/sub-manager/.env add-user2.ts`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', (d: any) => process.stdout.write(d.toString()))
      .stderr.on('data', (d: any) => process.stderr.write(d.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
