import { Client } from 'ssh2';
import { readFileSync } from 'fs';

const conn = new Client();
const fileX3UI = readFileSync('server/x3ui.ts');
const filePanel = readFileSync('server/panel.ts');
const fileSync = readFileSync('sync-clients.ts');

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    let written = 0;
    const write = (path: string, data: Buffer) => {
      const stream = sftp.createWriteStream(path);
      stream.on('close', () => {
        written++;
        if (written === 3) {
          conn.exec('systemctl restart sub-manager && systemctl status sub-manager --no-pager | grep Active', (err2, out) => {
            if (err2) throw err2;
            out.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
          });
        }
      });
      stream.end(data);
    };
    write('/opt/sub-manager/server/x3ui.ts', fileX3UI);
    write('/opt/sub-manager/server/panel.ts', filePanel);
    write('/opt/sub-manager/sync-clients.ts', fileSync);
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
