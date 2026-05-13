import { Client } from 'ssh2';
const c = new Client();
const cmd = `cd /opt/sub-manager && deno run -A --quiet -- bash 2>/dev/null; cat << 'TS' > /tmp/wt.ts
import { loginPanel, getPanelBySlug } from '/opt/sub-manager/server/x3ui.ts';
const p = await getPanelBySlug('pd4e485d3c9');
const sess = await loginPanel('pd4e485d3c9');
const base = p.panel_url.replace(/\\/$/,'');
for (const m of ['GET','POST']) {
  for (const a of ['data','reg']) {
    try {
      const r = await fetch(base+'/panel/warp/'+a, { method:m, headers:{Cookie:sess.cookie, 'X-CSRF-Token':sess.csrf, Accept:'application/json'}});
      const txt = await r.text();
      console.log(m, a, r.status, txt.slice(0,300).replace(/\\n/g,' '));
    } catch(e:any) { console.log(m, a, 'ERR', e.message); }
  }
}
TS
deno run -A /tmp/wt.ts`;
c.on('ready', () => c.exec(cmd, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
