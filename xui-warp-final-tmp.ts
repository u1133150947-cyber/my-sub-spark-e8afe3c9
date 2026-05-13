import { Client } from 'ssh2';
const c = new Client();
const cmd = `cat << 'TS' > /opt/sub-manager/warp-test3.ts
import { loginPanel, getPanelBySlug } from './server/x3ui.ts';
const p = await getPanelBySlug('pd4e485d3c9');
const sess = await loginPanel('pd4e485d3c9');
const base = p.panel_url.replace(/\\/$/,'');
console.log('logged in, csrf len:', sess.csrf.length);
for (const action of ['data','reg','data']) {
  const r = await fetch(base + '/panel/warp/' + action, {
    method:'POST',
    headers:{ Cookie: sess.cookie, Accept:'application/json', 'X-CSRF-Token': sess.csrf, 'Content-Type':'application/x-www-form-urlencoded' },
    body: ''
  });
  const txt = await r.text();
  console.log(action, r.status, txt.slice(0,1500));
}
TS
cd /opt/sub-manager && deno run -A warp-test3.ts`;
c.on('ready', () => c.exec(cmd, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
