import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  const cmd = `cd /opt/sub-manager && cat << 'TS' > test-remote.ts
import { db } from "./server/db.ts";

async function main() {
  const resF = await fetch("http://127.0.0.1:8080/api/hy2/auth", {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ addr: "1.1.1.1:123", auth: "bad-uuid" })
  });
  console.log("bad:", await resF.json());

  const sub = db.queryEntries("SELECT client_uuid FROM subscriptions LIMIT 1")[0] as any;
  if(sub) {
    const resT = await fetch("http://127.0.0.1:8080/api/hy2/auth", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ addr: "1.1.1.1:123", auth: sub.client_uuid })
    });
    console.log("good:", await resT.json());
  }
}
main();
TS
deno run -A --unstable-kv test-remote.ts
`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => {
      console.log(out);
      conn.end();
    }).on('data', d => out += d).stderr.on('data', d => out += d);
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
