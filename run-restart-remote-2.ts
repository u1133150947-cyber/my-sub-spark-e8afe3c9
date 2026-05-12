import { Client } from 'ssh2';
import { readFileSync } from 'fs';

const conn = new Client();
const fileX3UI = readFileSync('server/x3ui.ts');

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const stream = sftp.createWriteStream('/opt/sub-manager/server/x3ui.ts');
    stream.on('close', () => {
      conn.exec('systemctl restart sub-manager && systemctl status sub-manager --no-pager | grep Active', (err2, out) => {
        if (err2) throw err2;
        out.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
      });
    });
    stream.end(fileX3UI);
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
