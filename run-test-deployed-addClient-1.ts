import { Client } from 'ssh2';

const conn = new Client();
const cmd = `cd /opt/sub-manager && cat << 'TS' > test-deployed-addClient-1.ts
import { addClient } from "./server/x3ui.ts";

async function main() {
  try {
    const c = { id: crypto.randomUUID(), email: "client_test", expiryTime: 0, totalGB: 0, subId: "test", flow: "" };
    const res = await addClient("pee9e3676f7", 1, c, "vless");
    console.log("Success:", res);
  } catch (e) {
    console.error("Error:", e);
  }
}
main();
TS
deno run -A test-deployed-addClient-1.ts
`;

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString())).stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
