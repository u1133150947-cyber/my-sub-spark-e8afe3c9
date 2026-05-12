import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cd /opt/sub-manager && cat << 'TS2' > inspect-h2-update.ts
import { listInbounds } from './server/x3ui.ts';
const ib=(await listInbounds('pee9e3676f7')).find((x:any)=>x.id===3);
console.log(Object.keys(ib).sort());
for (const k of Object.keys(ib).sort()) {
  const v=ib[k];
  console.log(k, typeof v, Array.isArray(v) ? 'array len '+v.length : String(v).slice(0,200));
}
TS2
deno run -A inspect-h2-update.ts`;
conn.on('ready', () => conn.exec(cmd, (err, stream) => {
  if (err) throw err;
  stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
