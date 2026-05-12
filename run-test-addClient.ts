import { Client } from 'ssh2';

const conn = new Client();
const cmd = `cd /opt/sub-manager && cat << 'TS' > test-addClient.ts
import { panelFetch, loginPanel, getPanelBySlug, panelCfg, rawFetch } from "./server/x3ui.ts";

async function main() {
  const slug = "pee9e3676f7";
  const inboundId = 3;
  const c = { id: crypto.randomUUID(), email: "test_addclient@test.com", expiryTime: 0, totalGB: 0, subId: "test", flow: "" };
  
  const settings = JSON.stringify({
    clients: [{ id: c.id, flow: c.flow ?? "", email: c.email, limitIp: 0, totalGB: c.totalGB, expiryTime: c.expiryTime, enable: true, tgId: "", subId: c.subId, reset: 0 }],
  });

  const res = await panelFetch(slug, "/panel/api/inbounds/addClient", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id: String(inboundId), settings }).toString(),
  });
  
  console.log("Status:", res.status);
  console.log("Body:", res.body);
}
main();
TS
deno run -A test-addClient.ts
`;

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString())).stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
