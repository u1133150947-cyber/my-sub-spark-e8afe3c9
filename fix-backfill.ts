import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  const cmd = `cd /opt/sub-manager && cat << 'BACKFILL' > backfill.ts
import { db, uid } from "./server/db.ts";

async function main() {
  const subs = db.queryEntries("SELECT id, client_email FROM subscriptions");
  const stRows = db.queryEntries("SELECT id, name, host, port FROM standalone_servers");
  
  let added = 0;
  for (const sub of subs) {
    for (const srv of stRows) {
      const inboundId = (srv as any).id === 'cz' ? 1001 : ((srv as any).id === 'ru' ? 1002 : parseInt((srv as any).id, 36) % 10000);
      const exists = db.queryEntries("SELECT id FROM subscription_inbounds WHERE subscription_id = ? AND panel = ? AND inbound_id = ?", [
        (sub as any).id, "standalone", inboundId
      ]);
      
      if (exists.length === 0) {
        const stream = { security: "tls", tlsSettings: { serverName: (srv as any).host } };
        const email = \`\${(sub as any).client_email}_standalone\${inboundId}\`;
        db.query(\`INSERT INTO subscription_inbounds (id, subscription_id, panel, inbound_id, remark, protocol, port, host, stream_settings, client_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
          [uid(), (sub as any).id, "standalone", inboundId, (srv as any).name, "hysteria2", (srv as any).port, (srv as any).host, JSON.stringify(stream), email]);
        added++;
        console.log("Backfilled", (srv as any).name, "for sub", (sub as any).client_email);
      }
    }
  }
  console.log("Total backfilled:", added);
}
main();
BACKFILL
systemctl stop sub-manager
deno run -A --unstable-kv backfill.ts
systemctl start sub-manager
systemctl is-active sub-manager
`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });

