import { Client } from 'ssh2';

async function fixSubTs() {
  return new Promise((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      const cmd = `
sed -i 's|/??sni=|?sni=|g' /opt/sub-manager/server/sub.ts
systemctl restart sub-manager
systemctl is-active sub-manager
`;
      conn.exec(cmd, (err, stream) => {
        let out = '';
        stream.on('close', () => { conn.end(); resolve(out); })
          .on('data', d => out += d).stderr.on('data', d => out += d);
      });
    }).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
  });
}

async function main() {
  console.log(await fixSubTs());
}
main();
