import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cat << 'TS' > /opt/sub-manager/del-orphans.ts
import { listInbounds, deleteClient } from './server/x3ui.ts';
import { db } from './server/db.ts';

const validByPanel: Record<string, Set<string>> = {};
for (const r of db.queryEntries('SELECT panel, client_email FROM subscription_inbounds') as any[]) {
  (validByPanel[r.panel] ??= new Set()).add(r.client_email);
}

for (const slug of ['pee9e3676f7','pd4e485d3c9']) {
  console.log('\\n=== '+slug+' ===');
  const inbounds = await listInbounds(slug);
  for (const ib of inbounds) {
    const settings = typeof ib.settings === 'string' ? JSON.parse(ib.settings) : ib.settings;
    const clients = settings?.clients || [];
    for (const c of clients) {
      const email = c.email || '';
      if (validByPanel[slug]?.has(email)) continue;
      try {
        const proto = ib.protocol;
        const idForDel = proto === 'hysteria' ? email : c.id;
        await deleteClient(slug, ib.id, idForDel, proto);
        console.log('  deleted: ib#'+ib.id+' '+email+' (id='+idForDel+')');
      } catch (e:any) {
        console.log('  FAIL: ib#'+ib.id+' '+email+' — '+e.message);
      }
    }
  }
}
TS
cd /opt/sub-manager && deno run -A del-orphans.ts`;
conn.on('ready', () => conn.exec(cmd, (err, stream) => {
  stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
