import { Client } from 'ssh2';

const conn = new Client();
const cmd = `cd /opt/sub-manager && cat << 'TS' > test-h2.ts
import { panelFetch, loginPanel, getPanelBySlug, panelCfg } from "./server/x3ui.ts";

async function main() {
  const slug = "pee9e3676f7";
  const inboundId = 3;
  const cookie = await loginPanel(slug);
  const cfg = panelCfg(getPanelBySlug(slug));
  
  // Try passing only email and password
  const settings = JSON.stringify({
    clients: [{ password: crypto.randomUUID(), email: "client_test2", limitIp: 0, totalGB: 0, expiryTime: 0, enable: true }]
  });

  const res = await fetch(\`\${cfg.url}/panel/api/inbounds/addClient\`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": cookie.cookie, "Accept": "application/json" },
    body: new URLSearchParams({ id: String(inboundId), settings }).toString()
  });
  console.log(await res.text());
}
main();
TS
deno run -A test-h2.ts
`;

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString())).stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
