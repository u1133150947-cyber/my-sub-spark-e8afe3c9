import { Client } from 'ssh2';

const conn = new Client();
const cmd = `cat << 'TS' > /opt/sub-manager/test-add-inbound-web.ts
import { db } from "./server/db.ts";
import { handlePanel } from "./server/panel.ts";

async function main() {
  const sub = db.queryEntries("SELECT * FROM subscriptions LIMIT 1")[0];
  if (!sub) return console.log("No subs");
  console.log("Sub:", sub.slug);

  // let's grab an inbound not in this sub
  const existing = db.queryEntries("SELECT inbound_id FROM subscription_inbounds WHERE subscription_id = ? AND panel = 'pee9e3676f7'", [sub.id]).map(r => r.inbound_id);
  // find first available inbound ID to add
  const avail = [1,2,3,4,5,6].find(id => !existing.includes(id)) || 1;

  const req = new Request("http://localhost/functions/v1/panel?action=addInbounds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: sub.id,
      selections: [{ panel: "pee9e3676f7", inboundId: avail }]
    })
  });
  
  // monkey patch verifyAdminSession
  const auth = await import("./server/auth.ts");
  const orig = auth.verifyAdminSession;
  (auth as any).verifyAdminSession = () => true;

  try {
    const res = await handlePanel(req, new URL(req.url));
    console.log("Status:", res.status);
    console.log("Response:", await res.text());
  } finally {
    (auth as any).verifyAdminSession = orig;
  }
}
main();
TS
cd /opt/sub-manager && deno run -A test-add-inbound-web.ts
`;

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString())).stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
