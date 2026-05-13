import { Client } from 'ssh2';
function run(cmd: string): Promise<string> {
  return new Promise((res,rej)=>{
    const c = new Client();
    let out = '';
    c.on('ready',()=>c.exec(cmd,(e,s)=>{
      if(e) return rej(e);
      s.on('close',()=>{c.end();res(out);}).on('data',(d:any)=>out+=d.toString()).stderr.on('data',(d:any)=>out+=d.toString());
    })).on('error',rej).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
  });
}
console.log(await run(`cat > /tmp/start_hyc.sh <<'SH'
#!/bin/bash
nohup hysteria client -c /tmp/hy2c.yaml </dev/null >/tmp/hy2c.log 2>&1 &
echo $! > /tmp/hyc.pid
SH
chmod +x /tmp/start_hyc.sh
systemd-run --scope --unit=hyc-test bash /tmp/start_hyc.sh 2>&1 | head -5
sleep 3
echo ===LOG===
cat /tmp/hy2c.log 2>&1
echo ===PORT===
ss -lntp | grep 11080
echo ===PROC===
pgrep -af hy2c.yaml`));
console.log('--- test ---');
console.log(await run(`timeout 15 curl -sS --max-time 12 --socks5 127.0.0.1:11080 https://1.1.1.1/cdn-cgi/trace; echo exit:$?
echo ---YT---
timeout 15 curl -sS --max-time 12 --socks5 127.0.0.1:11080 https://www.youtube.com/ -o /dev/null -w "code:%{http_code} time:%{time_total}\\n"
echo ---LOG---
tail -40 /tmp/hy2c.log`));
console.log('--- cleanup ---');
console.log(await run(`systemctl stop hyc-test.scope 2>&1; for p in $(pgrep -f hy2c.yaml); do kill -9 $p; done; echo done`));
