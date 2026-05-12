import { Client } from 'ssh2';
import { readFileSync } from 'fs';
const conn = new Client();
const files = [
  ['server/x3ui.ts', '/opt/sub-manager/server/x3ui.ts'],
  ['server/panel.ts', '/opt/sub-manager/server/panel.ts'],
  ['server/sub.ts', '/opt/sub-manager/server/sub.ts'],
] as const;
function putFile(sftp: any, local: string, remote: string) {
  return new Promise<void>((resolve, reject) => sftp.writeFile(remote, readFileSync(local), (err: Error | null) => err ? reject(err) : resolve()));
}
conn.on('ready', () => conn.sftp(async (err, sftp) => {
  if (err) throw err;
  for (const [local, remote] of files) { await putFile(sftp, local, remote); console.log('uploaded', local); }
  conn.exec('systemctl restart sub-manager && sleep 2 && systemctl is-active sub-manager', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
  });
})).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
