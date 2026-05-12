import { Client } from 'ssh2';

const conn = new Client();
const cmd = `cat << 'TS' > /opt/sub-manager/test-add-inbound.ts
import { db } from "./server/db.ts";
import { handlePanel } from "./server/panel.ts";

async function main() {
  const sub = db.queryEntries("SELECT * FROM subscriptions LIMIT 1")[0];
  if (!sub) return console.log("No subs");
  console.log("Sub:", sub.slug);

  const req = new Request("http://localhost/functions/v1/panel?action=addInbounds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: sub.id,
      selections: [{ panel: "pd4e485d3c9", inboundId: 1 }]
    })
  });
  
  // We need to temporarily expose handlePanel without auth for testing, or we just call the logic.
  // Actually, I can just patch auth.ts temporarily or create a mock.
}
TS
`;

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end());
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
