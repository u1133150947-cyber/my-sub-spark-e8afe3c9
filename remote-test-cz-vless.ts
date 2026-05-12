import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cd /opt/sub-manager && cat << 'TS2' > test-cz-vless.ts
import { addClient, listInbounds, panelFetch } from './server/x3ui.ts';
const slug='pd4e485d3c9';
const inboundId=28;
const id=crypto.randomUUID();
const email='audit_cz_vless_'+Date.now();
try {
  const res = await addClient(slug, inboundId, { id, email, expiryTime: 0, totalGB: 0, subId: 'audit', flow: 'xtls-rprx-vision' }, 'vless');
  console.log('add res', JSON.stringify(res));
} catch(e) { console.log('add err', e?.message ?? String(e)); }
const ib=(await listInbounds(slug)).find((x:any)=>x.id===inboundId);
const s=JSON.parse(ib.settings ?? '{}');
console.log('found', (s.clients ?? []).filter((c:any)=>c.email===email));
try { await panelFetch(slug, '/panel/api/inbounds/'+inboundId+'/delClient/'+id, { method:'POST' }); } catch {}
TS2
deno run -A test-cz-vless.ts`;
conn.on('ready', () => conn.exec(cmd, (err, stream) => {
  if (err) throw err;
  stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
