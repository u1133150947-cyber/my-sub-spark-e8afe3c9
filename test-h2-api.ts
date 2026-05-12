import { db } from "./server/db.ts";
import { getPanelBySlug, panelFetch, listInbounds } from "./server/x3ui.ts";

async function run() {
  const inbounds = await listInbounds("ru");
  const h2ib = inbounds.find(x => x.protocol === "hysteria");
  console.log("H2 Inbound settings:", h2ib.settings);
}
run();
