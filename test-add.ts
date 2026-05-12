import { Client } from 'ssh2';

const conn = new Client();
const cmd = `cat > /opt/sub-manager/test-add.ts << 'TS'
import { db } from "./server/db.ts";

const sub = db.queryEntries("SELECT * FROM subscriptions LIMIT 1")[0];
console.log("Sub:", sub);
TS
deno run -A /opt/sub-manager/test-add.ts
`;

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString())).stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
