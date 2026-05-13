import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cat << 'TS' > /opt/sub-manager/audit-orphans.ts
import { db } from './server/db.ts';
import { listInbounds } from './server/x3ui.ts';

const validByPanel: Record<string, Set<string>> = {};
for (const r of db.queryEntries('SELECT panel, client_email FROM subscription_inbounds') as any[]) {
  (validByPanel[r.panel] ??= new Set()).add(r.client_email);
}

for (const slug of ['pee9e3676f7','pd4e485d3c9']) {
  console.log('\\n=== PANEL '+slug+' ===');
  const inbounds = await listInbounds(slug);
  for (const ib of inbounds) {
    const settings = typeof ib.settings === 'string' ? JSON.parse(ib.settings) : ib.settings;
    const clients = settings?.clients || [];
    if (!clients.length) continue;
    console.log('-- inbound #'+ib.id+' ('+ib.protocol+', '+ib.remark+') — '+clients.length+' clients');
    for (const c of clients) {
      const email = c.email || '(no-email)';
      const valid = validByPanel[slug]?.has(email);
      console.log('   '+(valid?'✓':'✗ ORPHAN')+'  '+email+'   id='+c.id);
    }
  }
}
TS
cd /opt/sub-manager && deno run -A audit-orphans.ts`;
conn.on('ready', () => conn.exec(cmd, (err, stream) => {
  stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
