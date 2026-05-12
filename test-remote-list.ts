import { Client } from 'ssh2';
const conn = new Client();
const cmd = String.raw`cd /opt/sub-manager && cat > /tmp/test-list.ts <<'TS'
import { listInbounds } from './server/x3ui.ts';
console.log('CZ', (await listInbounds('pd4e485d3c9')).length);
console.log('RU', (await listInbounds('pee9e3676f7')).length);
TS
deno run -A /tmp/test-list.ts`;
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString())).stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
