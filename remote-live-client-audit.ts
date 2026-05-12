import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cd /opt/sub-manager && cat > /tmp/live_client_audit.ts << 'TS2'
import { db } from './server/db.ts';
import { listInbounds } from './server/x3ui.ts';
const links = db.queryEntries('SELECT s.slug, s.client_uuid, si.panel, si.inbound_id, si.protocol, si.client_email FROM subscription_inbounds si JOIN subscriptions s ON s.id=si.subscription_id ORDER BY s.created_at, si.panel, si.inbound_id') as any[];
const byPanel = new Map<string, any[]>();
for (const l of links) byPanel.set(l.panel, [...(byPanel.get(l.panel) ?? []), l]);
let missing = 0;
for (const [panel, rows] of byPanel) {
  console.log('\\n== PANEL', panel, '==');
  const live = await listInbounds(panel);
  for (const l of rows) {
    const ib = live.find((x:any)=>Number(x.id)===Number(l.inbound_id));
    if (!ib) { console.log('MISSING_INBOUND', JSON.stringify(l)); missing++; continue; }
    let s:any={}; try { s=JSON.parse(ib.settings??'{}'); } catch {}
    const clients = Array.isArray(s.clients) ? s.clients : [];
    const client = clients.find((c:any)=>c.email===l.client_email || c.id===l.client_uuid || c.password===l.client_uuid);
    console.log(client ? 'OK' : 'MISSING_CLIENT', l.slug, l.panel, l.inbound_id, l.protocol, l.client_email, 'liveClients', clients.length, client ? JSON.stringify({email:client.email,id:client.id,password:client.password,enable:client.enable,flow:client.flow}) : '');
    if (!client) missing++;
  }
}
console.log('MISSING_TOTAL', missing);
TS2
deno run -A /tmp/live_client_audit.ts
printf '\n== port checks ==\n'
for h in ru.panelsu.ru cz.panelsu.ru; do for p in 8443 4430 2080 44433; do timeout 3 bash -c "</dev/tcp/$h/$p" >/dev/null 2>&1 && echo OPEN $h:$p || echo CLOSED $h:$p; done; done`;
conn.on('ready', () => conn.exec(cmd, (err, stream) => {
  if (err) throw err;
  stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
