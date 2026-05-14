import { Client } from 'ssh2';
function ssh(host:string, pass:string, cmd:string): Promise<string> {
  return new Promise((res, rej) => {
    const c = new Client(); let o = '';
    c.on('ready', () => c.exec(cmd, (e, s) => {
      if (e) return rej(e);
      s.on('close', () => { c.end(); res(o); })
       .on('data', (d:any) => o += d)
       .stderr.on('data', (d:any) => o += d);
    })).on('error', rej).connect({ host, port: 22, username: 'root', password: pass });
  });
}

const py = `python3 -c "
import sqlite3, json
d = sqlite3.connect('/etc/x-ui/x-ui.db')
print('=== INBOUNDS ===')
for r in d.execute('SELECT id,remark,port,protocol FROM inbounds'):
    print(r)
print('=== CASCADE/8443 DETAIL ===')
for r in d.execute(\\\"SELECT id,remark,port,settings,stream_settings,sniffing FROM inbounds WHERE port=8443 OR remark LIKE '%cascade%' OR remark LIKE '%youtube%' OR remark LIKE '%YouTube%'\\\"):
    print('---', r[0], r[1], r[2])
    print('S:', r[3])
    print('ST:', r[4])
"`;

console.log('===== CZ ====='); console.log(await ssh('185.87.148.138','hf6Ka8viMl', py));
console.log('===== RU ====='); console.log(await ssh('82.202.128.147','K!E2QAGrxYFx', py));
