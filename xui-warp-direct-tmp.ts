import { Client } from 'ssh2';
const c = new Client();
const cmd = `cat << 'TS' > /opt/sub-manager/warp-test2.ts
import { getPanelBySlug } from './server/x3ui.ts';
const p = await getPanelBySlug('pd4e485d3c9');
const base = p.panel_url.replace(/\\/$/,'');
// Login
const fd = new FormData();
fd.set('username', p.username); fd.set('password', p.password);
const lr = await fetch(base + '/login', { method: 'POST', body: fd, redirect:'manual' });
const cookie = lr.headers.get('set-cookie')?.split(';')[0] || '';
console.log('login:', lr.status, 'cookie:', cookie?'yes':'no');
for (const action of ['data','reg','data']) {
  const r = await fetch(base + '/panel/warp/' + action, { method:'POST', headers:{cookie} });
  const txt = await r.text();
  console.log(action, r.status, txt.slice(0,500));
}
TS
cd /opt/sub-manager && deno run -A warp-test2.ts`;
c.on('ready', () => c.exec(cmd, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
