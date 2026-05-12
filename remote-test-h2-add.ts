import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cd /opt/sub-manager && cat << 'TS2' > test-h2-add-live.ts
import { addClient, listInbounds } from './server/x3ui.ts';
const slug='pee9e3676f7';
const inboundId=3;
const id=crypto.randomUUID();
const email='audit_h2_'+Date.now();
console.log('adding', id, email);
try {
  const res = await addClient(slug, inboundId, { id, email, expiryTime: 0, totalGB: 0, subId: 'audit', flow: '' }, 'hysteria2');
  console.log('add res', JSON.stringify(res));
} catch(e) { console.log('add err', e?.message ?? String(e)); }
const ib=(await listInbounds(slug)).find((x:any)=>x.id===inboundId);
const s=JSON.parse(ib.settings ?? '{}');
console.log('client count', (s.clients ?? []).length);
console.log('found', (s.clients ?? []).filter((c:any)=>c.email===email));
TS2
deno run -A test-h2-add-live.ts`;
conn.on('ready', () => conn.exec(cmd, (err, stream) => {
  if (err) throw err;
  stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
