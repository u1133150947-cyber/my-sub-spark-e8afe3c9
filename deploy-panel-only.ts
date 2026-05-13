import { Client } from 'ssh2';
import { readFileSync } from 'fs';

const conn = new Client();
const files = [
  ['server/panel.ts', '/opt/sub-manager/server/panel.ts'],
] as const;

function putFile(sftp: any, local: string, remote: string) {
  return new Promise<void>((resolve, reject) => {
    const data = readFileSync(local);
    sftp.writeFile(remote, data, (err) => err ? reject(err) : resolve());
  });
}

conn.on('ready', () => {
  conn.sftp(async (err, sftp) => {
    if (err) throw err;
    try {
      for (const [local, remote] of files) {
        await putFile(sftp, local, remote);
        console.log('uploaded', local, '->', remote);
      }
      
      const cmd = `systemctl restart sub-manager && systemctl is-active sub-manager`;
      conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
      });
    } catch (e) {
      console.error(e);
      conn.end();
    }
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
