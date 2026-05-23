import { Client } from 'ssh2';
import { createWriteStream, chmodSync } from 'fs';
const c = new Client();
c.on('ready', () => {
  c.sftp((err, sftp) => {
    if (err) throw err;
    const rs = sftp.createReadStream('/usr/local/x-ui/bin/xray-linux-amd64');
    const ws = createWriteStream('/tmp/xray-linux-amd64');
    rs.pipe(ws);
    ws.on('finish', () => { chmodSync('/tmp/xray-linux-amd64', 0o755); console.log('downloaded /tmp/xray-linux-amd64'); c.end(); });
    rs.on('error', e => { console.error(e); process.exit(1); });
  });
}).on('error', e => { console.error('SSH', e.message); process.exit(1); })
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl',readyTimeout:10000});
