import { Client } from 'ssh2';
function ssh(host:string, pass:string, cmd:string): Promise<string> {
  return new Promise((res, rej) => {
    const c = new Client(); let o = '';
    c.on('ready', () => c.exec(cmd, (e, s) => {
      if (e) return rej(e);
      s.on('close', () => { c.end(); res(o); })
       .on('data', (d:any) => o += d).stderr.on('data', (d:any) => o += d);
    })).on('error', rej).connect({ host, port: 22, username: 'root', password: pass });
  });
}

// Step 1: generate x25519 + shortId on RU
const keys = await ssh('82.202.128.147','K!E2QAGrxYFx',
  `/usr/local/x-ui/bin/xray x25519 && python3 -c "import secrets;print('SID='+secrets.token_hex(8))"`);
console.log('KEYS:\n', keys);
