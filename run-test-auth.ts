import { Client } from 'ssh2';

const conn = new Client();
const cmd = `cd /opt/sub-manager && cat << 'TS' > test-add-inbound-web.ts
import { db } from "./server/db.ts";

async function main() {
  const sub = db.queryEntries("SELECT * FROM subscriptions LIMIT 1")[0];
  if (!sub) return console.log("No subs");
  console.log("Sub:", sub.slug);

  const existing = db.queryEntries("SELECT inbound_id FROM subscription_inbounds WHERE subscription_id = ? AND panel = 'pee9e3676f7'", [sub.id]).map(r => r.inbound_id);
  const avail = [1,2,3,4,5,6,7,8,9,10].find(id => !existing.includes(id)) || 1;
  console.log("Adding inbound:", avail);

  const tokenRow = db.queryEntries("SELECT token FROM admin_sessions LIMIT 1")[0];
  const token = tokenRow ? tokenRow.token : "";

  const req = await fetch("http://localhost:8080/functions/v1/panel?action=addInbounds", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
    body: JSON.stringify({
      id: sub.id,
      selections: [{ panel: "pee9e3676f7", inboundId: avail }]
    })
  });
  
  console.log("Status:", req.status);
  console.log("Response:", await req.text());
}
main();
TS
deno run -A test-add-inbound-web.ts
`;

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString())).stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
