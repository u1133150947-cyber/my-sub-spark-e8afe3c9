import { Client } from 'ssh2';
const c = new Client();
const cmd = `cat << 'TS' > /opt/sub-manager/warp-test.ts
import { panelFetch } from './server/x3ui.ts';
for (const action of ['data','reg','data']) {
  const r = await panelFetch('pd4e485d3c9', '/panel/warp/'+action, { method: 'POST' });
  console.log(action.toUpperCase(), JSON.stringify(r).slice(0,800));
}
TS
cd /opt/sub-manager && deno run -A warp-test.ts`;
c.on('ready', () => c.exec(cmd, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
