import { Client } from 'ssh2';

const conn = new Client();
const cmd = `cd /opt/sub-manager && cat << 'TS' > test-csrf-json.ts
import { panelFetch, loginPanel, getPanelBySlug, panelCfg, rawFetch } from "./server/x3ui.ts";

async function main() {
  const slug = "pee9e3676f7";
  const inboundId = 3;
  const c = { id: crypto.randomUUID(), email: "client_test", expiryTime: 0, totalGB: 0, subId: "test", flow: "" };
  
  const settings = JSON.stringify({
    clients: [{ id: c.id, flow: c.flow ?? "", email: c.email, limitIp: 0, totalGB: c.totalGB, expiryTime: c.expiryTime, enable: true, tgId: "", subId: c.subId, reset: 0 }],
  });

  const cfg = panelCfg(getPanelBySlug(slug));
  const cookie = await loginPanel(slug);

  const page = await rawFetch(\`\${cfg.url}/\`, { headers: { Cookie: cookie, Accept: "text/html" } });
  const html = await page.text();
  const csrf = html.match(/<meta\\s+name=["']csrf-token["']\\s+content=["']([^"']+)["']/i)?.[1];

  try {
    const r = await rawFetch(\`\${cfg.url}/panel/api/inbounds/addClient\`, {
      method: "POST", 
      headers: { 
        "Content-Type": "application/json", 
        "Accept": "application/json",
        "Cookie": cookie,
        ...(csrf ? { "X-CSRF-Token": csrf } : {})
      },
      body: JSON.stringify({ id: inboundId, settings }),
    });
    
    console.log("Status:", r.status);
    console.log("Body:", await r.text());
  } catch (e) {
    console.error("Error:", e);
  }
}
main();
TS
deno run -A test-csrf-json.ts
`;

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString())).stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
