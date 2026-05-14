import { Client } from 'ssh2';
function ssh(host:string, pass:string, cmd:string): Promise<string> {
  return new Promise((res, rej) => { const c = new Client(); let o = '';
    c.on('ready', () => c.exec(cmd, (e, s) => { if (e) return rej(e);
      s.on('close', () => { c.end(); res(o); }).on('data', (d:any) => o += d).stderr.on('data', (d:any) => o += d);
    })).on('error', rej).connect({ host, port: 22, username: 'root', password: pass });
  });
}
console.log(await ssh('82.202.128.147','K!E2QAGrxYFx',
  'find / -name xray -type f 2>/dev/null | head -5; echo ---; ls /etc/x-ui/ 2>/dev/null; echo ---; systemctl status x-ui --no-pager 2>&1 | head -5; echo ---; ls /usr/local/ 2>/dev/null; ls /opt/ 2>/dev/null'));
