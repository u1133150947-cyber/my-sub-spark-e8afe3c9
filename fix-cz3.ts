import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  const cmd = `cd /opt/sub-manager && deno eval 'import { decryptField } from "./server/crypto.ts"; console.log(await decryptField("ZSLFw8KE"))'`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => {
      console.log('Result:', out);
      conn.end();
    }).on('data', d => out += d).stderr.on('data', d => out += d);
  });
}).connect({ host: '82.202.128.147', port: 22, username: 'root', password: 'K!E2QAGrxYFx' });
