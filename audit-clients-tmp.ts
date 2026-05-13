import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cat << 'TS' > /opt/sub-manager/audit-x.ts
import { db } from './server/db.ts';
const subs = db.queryEntries('SELECT id, name, client_email, client_uuid FROM subscriptions');
const inb = db.queryEntries('SELECT subscription_id, panel, client_email FROM subscription_inbounds');
console.log(JSON.stringify({subs, inb}, null, 2));
TS
cd /opt/sub-manager && deno run -A audit-x.ts`;
conn.on('ready', () => conn.exec(cmd, (err, stream) => {
  if (err) throw err;
  stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
