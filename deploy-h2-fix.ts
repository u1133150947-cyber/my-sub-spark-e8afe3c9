import { Client } from 'ssh2';
import * as fs from 'fs';

const hosts = [
  { name: 'WEB', host: 'web.panelsu.ru', password: 'K!E2QAGrxYFx' }
];

async function deployOne(h: any) {
  return new Promise<void>((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) { conn.end(); reject(err); return; }
        const subContent = fs.readFileSync('server/sub.ts', 'utf8');
        const remoteSub = '/root/sub-manager/server/sub.ts';
        sftp.writeFile(remoteSub, subContent, (err) => {
          if (err) { conn.end(); reject(err); return; }
          console.log(`Uploaded sub.ts to ${h.name}`);
          conn.exec('cd /root/sub-manager && bun run build && systemctl restart sub-manager', (err, stream) => {
            if (err) { conn.end(); reject(err); return; }
            stream.on('data', d => process.stdout.write(d)).on('close', () => { conn.end(); resolve(); });
          });
        });
      });
    }).on('error', reject).connect({ host: '82.202.128.147', port: 22, username: 'root', password: h.password });
  });
}

async function main() {
  for (const h of hosts) await deployOne(h);
  console.log("Deployment complete.");
}
main();
