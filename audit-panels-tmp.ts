import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cat << 'TS' > /opt/sub-manager/list-panels.ts
import { db } from './server/db.ts';
console.log(JSON.stringify(db.queryEntries('SELECT slug, name, panel_url, country FROM panels'), null, 2));
TS
cd /opt/sub-manager && deno run -A list-panels.ts`;
conn.on('ready', () => conn.exec(cmd, (err, stream) => {
  stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
