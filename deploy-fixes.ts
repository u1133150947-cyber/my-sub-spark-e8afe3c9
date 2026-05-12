import { Client } from 'ssh2';
import { readFileSync } from 'fs';

const conn = new Client();
const files = [
  ['server/x3ui.ts', '/opt/sub-manager/server/x3ui.ts'],
  ['server/sub.ts', '/opt/sub-manager/server/sub.ts'],
  ['sync-clients.ts', '/opt/sub-manager/sync-clients.ts'],
] as const;

function putFile(sftp: any, local: string, remote: string) {
  return new Promise<void>((resolve, reject) => {
    const data = readFileSync(local);
    sftp.writeFile(remote, data, (err: Error | null) => err ? reject(err) : resolve());
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
      conn.exec('systemctl restart sub-manager && sleep 2 && systemctl is-active sub-manager && journalctl -u sub-manager -n 20 --no-pager', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
      });
    } catch (e) {
      console.error(e);
      conn.end();
      process.exitCode = 1;
    }
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
