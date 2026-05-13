import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cat << 'TS' > /opt/sub-manager/del-h2-inb.ts
import { panelFetch, listInbounds } from './server/x3ui.ts';
import { db } from './server/db.ts';

for (const slug of ['pee9e3676f7','pd4e485d3c9']) {
  const inbounds = await listInbounds(slug);
  for (const ib of inbounds) {
    if (ib.protocol !== 'hysteria') continue;
    console.log('Deleting '+slug+' inbound #'+ib.id+' "'+ib.remark+'"');
    const r = await panelFetch(slug, '/panel/api/inbounds/del/'+ib.id, { method: 'POST' });
    console.log('  ->', JSON.stringify(r));
    // remove DB rows
    db.query('DELETE FROM subscription_inbounds WHERE panel = ? AND inbound_id = ?', [slug, ib.id]);
    db.query('DELETE FROM inbound_overrides WHERE panel = ? AND inbound_id = ?', [slug, ib.id]);
  }
}
console.log('done');
TS
cd /opt/sub-manager && deno run -A del-h2-inb.ts`;
conn.on('ready', () => conn.exec(cmd, (err, stream) => {
  stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
