import { Client } from 'ssh2';

const conn = new Client();
const cmd = `cd /opt/sub-manager && cat << 'TS' > test-inbounds.ts
import { listInbounds } from "./server/x3ui.ts";

async function main() {
  const list = await listInbounds("pee9e3676f7");
  const ib3 = list.find((i: any) => i.id === 3);
  console.log("Inbound 3 protocol:", ib3?.protocol);
}
main();
TS
deno run -A test-inbounds.ts
`;

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString())).stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
