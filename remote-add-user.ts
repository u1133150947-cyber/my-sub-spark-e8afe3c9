import { Client } from 'ssh2';

const script = `
import { db } from "./server/db.ts";
import { addClient, getPanelBySlug, uuidv4, randomSlug, listInbounds } from "./server/x3ui.ts";

async function main() {
  const targetSlug = "uia3c088ozg3";
  
  const existing = db.queryEntries("SELECT id FROM subscriptions WHERE slug = ?", [targetSlug]);
  if (existing.length > 0) {
    console.log("Subscription already exists.");
    return;
  }

  const name = "user_" + targetSlug;
  const email = "user_" + targetSlug + "@panelsu.ru";
  const clientUuid = uuidv4();
  const expiryMs = 0;
  const totalBytes = 0;
  const subIdShort = randomSlug(16);
  const subId = uuidv4();

  console.log("Adding subscription:", targetSlug);
  
  db.query(\`INSERT INTO subscriptions (id, slug, name, client_email, client_uuid, expiry_ms, total_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)\`,
    [subId, targetSlug, name, email, clientUuid, expiryMs, totalBytes]);

  const panels = db.queryEntries("SELECT slug, id FROM panels") as any[];
  for (const p of panels) {
    try {
      const panelSlug = p.slug;
      
      const inbounds = await listInbounds(panelSlug);
      for (const ib of inbounds) {
        if (!ib.enable) continue;
        
        let protocol = ib.protocol;
        let flow = "";
        let streamSettings: any = {};
        try { streamSettings = JSON.parse(ib.streamSettings || "{}"); } catch {}
        
        if (protocol === "vless" && streamSettings.security === "reality" && streamSettings.network === "tcp") {
          flow = "xtls-rprx-vision";
        }
        
        await addClient(panelSlug, ib.id, {
          id: clientUuid,
          email: \`\${email}_\${panelSlug}\${ib.id}\`,
          expiryTime: expiryMs,
          totalGB: totalBytes,
          subId: subIdShort,
          flow
        }, protocol);

        db.query(\`INSERT INTO subscription_inbounds (id, subscription_id, panel, inbound_id, remark, protocol, port, host, stream_settings, client_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
          [uuidv4(), subId, panelSlug, ib.id, ib.remark, protocol, ib.port, "web.panelsu.ru", ib.streamSettings || "{}", \`\${email}_\${panelSlug}\${ib.id}\`]);

        console.log(\`[+] Added to \${panelSlug} inbound \${ib.id}\`);
      }
    } catch (e: any) {
      console.error(\`[-] Error on panel \${p.slug}: \${e.message}\`);
    }
  }
  console.log("Done.");
}
main().catch(console.error);
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`cat << 'EOF2' > /root/3x-ui-sub-manager-update/add-specific-user.ts\n${script}\nEOF2\ncd /root/3x-ui-sub-manager-update && deno run -A --unstable-kv add-specific-user.ts`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', (d: any) => console.log('STDOUT:', d.toString()))
      .stderr.on('data', (d: any) => console.log('STDERR:', d.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
