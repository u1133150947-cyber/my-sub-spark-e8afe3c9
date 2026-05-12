import { Client } from 'ssh2';

const conn = new Client();
const cmd = `cd /opt/sub-manager && cat << 'TS' > test-h2-csrf.ts
import { loginPanel, getPanelBySlug, panelCfg, rawFetch } from "./server/x3ui.ts";

async function main() {
  const slug = "pee9e3676f7";
  const inboundId = 3;
  const session = await loginPanel(slug);
  const cfg = panelCfg(getPanelBySlug(slug));
  
  const settings = JSON.stringify({
    clients: [{ password: crypto.randomUUID(), id: crypto.randomUUID(), email: "client_test3", limitIp: 0, totalGB: 0, expiryTime: 0, enable: true }]
  });

  const res = await rawFetch(\`\${cfg.url}/panel/api/inbounds/addClient\`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": session.cookie, "Accept": "application/json", "X-CSRF-Token": session.csrf },
    body: new URLSearchParams({ id: String(inboundId), settings }).toString()
  });
  console.log(await res.text());
}
main();
TS
deno run -A test-h2-csrf.ts
`;

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString())).stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
