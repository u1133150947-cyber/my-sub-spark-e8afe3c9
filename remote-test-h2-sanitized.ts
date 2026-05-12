import { Client } from 'ssh2';
const conn = new Client();
const cmd = `cd /opt/sub-manager && cat << 'TS2' > test-h2-sanitized.ts
import { listInbounds, panelFetch } from './server/x3ui.ts';
const slug='pee9e3676f7', inboundId=3;
const id=crypto.randomUUID();
const email='audit_h2_sanitized_'+Date.now();
const list=await listInbounds(slug);
const ib=list.find((x:any)=>x.id===inboundId);
const s=JSON.parse(ib.settings || '{}');
const client={id, password:id, email, limitIp:0, totalGB:0, expiryTime:0, enable:true, tgId:'', subId:'audit', reset:0, flow:''};
s.clients=[...(s.clients||[]), client];
const payload:any={
  up: Number(ib.up ?? 0),
  down: Number(ib.down ?? 0),
  total: Number(ib.total ?? 0),
  remark: String(ib.remark ?? ''),
  enable: ib.enable !== false,
  expiryTime: Number(ib.expiryTime ?? 0),
  listen: String(ib.listen ?? ''),
  port: Number(ib.port),
  protocol: String(ib.protocol),
  settings: JSON.stringify(s),
  streamSettings: String(ib.streamSettings ?? '{}'),
  sniffing: String(ib.sniffing ?? '{"enabled":false,"destOverride":[]}'),
};
const res=await panelFetch(slug, '/panel/api/inbounds/update/'+inboundId, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams(Object.entries(payload).map(([k,v])=>[k,String(v)])).toString()});
console.log('status/body', res.status, res.body);
const after=(await listInbounds(slug)).find((x:any)=>x.id===inboundId);
const as=JSON.parse(after.settings||'{}');
console.log('count', (as.clients||[]).length);
console.log('found', (as.clients||[]).filter((c:any)=>c.email===email));
TS2
deno run -A test-h2-sanitized.ts`;
conn.on('ready', () => conn.exec(cmd, (err, stream) => {
  if (err) throw err;
  stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
