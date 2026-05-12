import { db } from "./server/db.ts";
import { addClient, listInbounds } from "./server/x3ui.ts";

async function main() {
  const inbounds = db.queryEntries(`
    SELECT si.panel, si.inbound_id, s.client_email, s.client_uuid, s.expiry_ms, s.total_bytes, s.id as sub_id
    FROM subscription_inbounds si
    JOIN subscriptions s ON si.subscription_id = s.id
  `) as any[];

  console.log(`Found ${inbounds.length} client-inbound mappings in database.`);

  for (const ib of inbounds) {
    console.log(`Checking client ${ib.client_email} on panel ${ib.panel} inbound ${ib.inbound_id}...`);
    try {
      const panelInbounds = await listInbounds(ib.panel);
      const targetInbound = panelInbounds.find((i: any) => i.id === ib.inbound_id);
      if (!targetInbound) {
        console.warn(`Inbound ${ib.inbound_id} not found on panel ${ib.panel}.`);
        continue;
      }

      let settings: any = {};
      try { settings = JSON.parse(targetInbound.settings ?? "{}"); } catch {}
      const clients = settings.clients ?? [];
      
      const exists = clients.find((c: any) => c.email === ib.client_email);
      if (exists) {
        console.log(`Client ${ib.client_email} already exists on panel ${ib.panel} inbound ${ib.inbound_id}.`);
      } else {
        console.log(`Adding client ${ib.client_email} to panel ${ib.panel} inbound ${ib.inbound_id}...`);
        await addClient(ib.panel, ib.inbound_id, {
          id: ib.client_uuid,
          email: ib.client_email,
          expiryTime: ib.expiry_ms,
          totalGB: ib.total_bytes,
          subId: ib.sub_id,
          flow: targetInbound.protocol === "vless" ? "xtls-rprx-vision" : "" // Add flow if needed
        });
        console.log(`Successfully added ${ib.client_email}.`);
      }
    } catch (e: any) {
      console.error(`Error processing ${ib.client_email} on ${ib.panel}: ${e.message}`);
    }
  }
}

main().catch(console.error);
