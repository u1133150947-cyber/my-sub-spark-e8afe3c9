import { Client } from 'ssh2';

const conn = new Client();
const cmd = `cd /opt/sub-manager && cat << 'TS' > test-updateClient.ts
import { panelFetch, loginPanel, getPanelBySlug, panelCfg, rawFetch } from "./server/x3ui.ts";

async function main() {
  const slug = "pee9e3676f7";
  const inboundId = 1;
  const c = { id: "0b15a6b0-745a-4e20-9fbb-88b90c7cd7e4", email: "client_test", expiryTime: 0, totalGB: 0, subId: "test", flow: "" };
  
  const settings = JSON.stringify({
    clients: [{ id: c.id, flow: c.flow ?? "", email: c.email, limitIp: 0, totalGB: c.totalGB, expiryTime: c.expiryTime, enable: true, tgId: "", subId: c.subId, reset: 0 }],
  });

  try {
    const res = await panelFetch(slug, \`/panel/api/inbounds/updateClient/\${c.id}\`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id: String(inboundId), settings }).toString(),
    });
    
    console.log("Status:", res.status);
    console.log("Body:", res.body);
  } catch (e) {
    console.error("Error:", e);
  }
}
main();
TS
deno run -A test-updateClient.ts
`;

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString())).stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
