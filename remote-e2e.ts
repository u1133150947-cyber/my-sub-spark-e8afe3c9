import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cd /opt/sub-manager && deno run -A sync-clients.ts && cat << 'TS2' > e2e-audit.ts
import { db, uid } from './server/db.ts';
import { listInbounds } from './server/x3ui.ts';

const token = 'audit_' + crypto.randomUUID();
const expires = new Date(Date.now() + 15 * 60_000).toISOString();
db.query('INSERT INTO admin_sessions (id, token, expires_at) VALUES (?, ?, ?)', [uid(), token, expires]);

const base = 'http://127.0.0.1:8080/functions/v1/panel';
async function api(action: string, body: any) {
  const r = await fetch(base + '?action=' + action, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': token }, body: JSON.stringify(body) });
  const text = await r.text();
  let j:any; try { j = JSON.parse(text); } catch { j = { raw: text }; }
  console.log('API', action, r.status, JSON.stringify(j));
  if (!r.ok || j.error) throw new Error(action + ': ' + (j.error || text));
  return j;
}

function findClient(ib: any, email: string, uuid: string) {
  const s = JSON.parse(ib.settings ?? '{}');
  return (s.clients ?? []).find((c: any) => c.email === email || c.id === uuid || c.password === uuid);
}

const before = Object.fromEntries((db.queryEntries('SELECT panel || ":" || inbound_id k, COUNT(*) c FROM subscription_inbounds GROUP BY panel,inbound_id') as any[]).map(x => [x.k, x.c]));
const created = await api('create', { name: 'AuditFull', days: 0, totalGB: 0, selections: [
  { panel: 'pd4e485d3c9', inboundId: 28 },
  { panel: 'pd4e485d3c9', inboundId: 29 },
  { panel: 'pee9e3676f7', inboundId: 1 },
  { panel: 'pee9e3676f7', inboundId: 2 },
  { panel: 'pee9e3676f7', inboundId: 3 },
] });
const sub = created.subscription;
console.log('CREATED_SLUG', sub.slug, 'createdCount', created.created.length, 'errors', JSON.stringify(created.errors));
const links = db.queryEntries('SELECT panel,inbound_id,protocol,client_email FROM subscription_inbounds WHERE subscription_id=? ORDER BY panel,inbound_id', [sub.id]) as any[];
console.log('DB_LINKS', JSON.stringify(links));
for (const l of links) {
  const ib = (await listInbounds(l.panel)).find((x:any)=>x.id === Number(l.inbound_id));
  const client = findClient(ib, l.client_email, sub.client_uuid);
  console.log('LIVE_CLIENT', l.panel, l.inbound_id, l.protocol, !!client, client ? JSON.stringify({email:client.email,id:client.id,password:client.password,flow:client.flow,enable:client.enable}) : '');
  if (!client) throw new Error('missing live client '+JSON.stringify(l));
}
const subResp = await fetch('http://127.0.0.1:8080/sub/' + sub.slug);
const encoded = await subResp.text();
const decoded = new TextDecoder().decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0)));
console.log('SUB_STATUS', subResp.status);
console.log('SUB_DECODED\\n' + decoded);
const lines = decoded.split(/\\n/).filter(Boolean);
console.log('LINE_COUNTS', { total: lines.length, vless: lines.filter(x=>x.startsWith('vless://')).length, h2: lines.filter(x=>x.startsWith('hysteria2://')).length });
if (lines.filter(x=>x.startsWith('vless://')).length < 3) throw new Error('not enough vless lines');
if (lines.filter(x=>x.startsWith('hysteria2://')).length < 2) throw new Error('not enough hysteria2 lines');
const upd = await api('update', { id: sub.id, days: 3, totalGB: 5 });
console.log('UPDATE_ERRORS', JSON.stringify(upd.errors));
if (upd.errors?.length) throw new Error('update had errors');
const del = await api('delete', { id: sub.id });
console.log('DELETE_ERRORS', JSON.stringify(del.errors));
const afterRows = db.queryEntries('SELECT COUNT(*) c FROM subscriptions WHERE id=?', [sub.id]) as any[];
console.log('DB_SUB_AFTER_DELETE', afterRows[0].c);
for (const [k,c] of Object.entries(before)) console.log('COUNT_BEFORE', k, c);
TS2
deno run -A e2e-audit.ts`;
conn.on('ready', () => conn.exec(cmd, (err, stream) => {
  if (err) throw err;
  stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
