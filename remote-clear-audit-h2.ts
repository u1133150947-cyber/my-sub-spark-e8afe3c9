import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cd /opt/sub-manager && cat << 'TS2' > clear-audit-h2.ts
import { listInbounds, panelFetch } from './server/x3ui.ts';
for (const [slug,id] of [['pee9e3676f7',3], ['pd4e485d3c9',29]] as any[]) {
  const ib=(await listInbounds(slug)).find((x:any)=>x.id===id);
  if (!ib) continue;
  const s=JSON.parse(ib.settings||'{}');
  const before=(s.clients||[]).length;
  s.clients=(s.clients||[]).filter((c:any)=>!String(c.email||'').startsWith('audit_'));
  const payload:any={up:Number(ib.up??0),down:Number(ib.down??0),total:Number(ib.total??0),remark:String(ib.remark??''),enable:ib.enable!==false,expiryTime:Number(ib.expiryTime??0),listen:String(ib.listen??''),port:Number(ib.port),protocol:String(ib.protocol),settings:JSON.stringify(s),streamSettings:String(ib.streamSettings??'{}'),sniffing:String(ib.sniffing??'{"enabled":false,"destOverride":[]}')};
  const r=await panelFetch(slug, '/panel/api/inbounds/update/'+id, {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(Object.entries(payload).map(([k,v])=>[k,String(v)])).toString()});
  console.log(slug,id,'before',before,'after',s.clients.length,r.body);
}
TS2
deno run -A clear-audit-h2.ts`;
conn.on('ready', () => conn.exec(cmd, (err, stream) => {
  if (err) throw err;
  stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
