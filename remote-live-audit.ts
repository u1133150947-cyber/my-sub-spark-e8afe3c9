import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cd /opt/sub-manager && cat << 'TS2' > audit-live.ts
import { listInbounds } from './server/x3ui.ts';
import { db } from './server/db.ts';
for (const p of db.queryEntries('SELECT slug,name FROM panels') as any[]) {
  console.log('\\n== PANEL', p.slug, p.name, '==');
  try {
    const ibs = await listInbounds(p.slug);
    console.log('inbounds', ibs.length);
    for (const ib of ibs) {
      let s:any={}; let ss:any={};
      try { s = JSON.parse(ib.settings ?? '{}'); } catch(e) { console.log('settings parse err', e.message); }
      try { ss = JSON.parse(ib.streamSettings ?? '{}'); } catch(e) { console.log('stream parse err', e.message); }
      console.log(JSON.stringify({id:ib.id,remark:ib.remark,protocol:ib.protocol,port:ib.port,listen:ib.listen,enable:ib.enable,clientCount:(s.clients??[]).length,firstClient:(s.clients??[])[0],settingsKeys:Object.keys(s),stream:ss}, null, 2));
    }
  } catch(e) { console.log('ERROR', e?.message ?? String(e)); }
}
TS2
deno run -A audit-live.ts`;
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
