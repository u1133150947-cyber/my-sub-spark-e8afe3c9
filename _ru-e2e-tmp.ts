import { Client } from 'ssh2';
function run(cmd: string): Promise<string> {
  return new Promise((res,rej)=>{
    const c = new Client();
    let out = '';
    c.on('ready',()=>c.exec(cmd,(e,s)=>{
      if(e) return rej(e);
      s.on('close',()=>{c.end();res(out);}).on('data',(d:any)=>out+=d.toString()).stderr.on('data',(d:any)=>out+=d.toString());
    })).on('error',rej).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
  });
}
const UUID = '16b16b4b-ae36-4b89-a794-888fdaffc9b3';
console.log(await run(`printf 'server: realityru.panelsu.ru:443\\nauth: ${UUID}\\ntls:\\n  sni: realityru.panelsu.ru\\nsocks5:\\n  listen: 127.0.0.1:11081\\n' > /tmp/hy2c.yaml
cat > /tmp/start_hyc.sh <<'SH'
#!/bin/bash
nohup hysteria client -c /tmp/hy2c.yaml </dev/null >/tmp/hy2c.log 2>&1 &
SH
chmod +x /tmp/start_hyc.sh
systemctl reset-failed hyc-test.scope 2>/dev/null
systemd-run --scope --unit=hyc-test bash /tmp/start_hyc.sh 2>&1 | head -3
sleep 3
echo ===LOG===; cat /tmp/hy2c.log
echo ===TEST===
timeout 15 curl -sS --max-time 12 --socks5 127.0.0.1:11081 https://1.1.1.1/cdn-cgi/trace; echo exit:$?
echo ---YT---
timeout 15 curl -sS --max-time 12 --socks5 127.0.0.1:11081 https://www.youtube.com/ -o /dev/null -w "code:%{http_code} time:%{time_total}\\n"
echo ---LOG---; tail -20 /tmp/hy2c.log
systemctl stop hyc-test.scope 2>&1; for p in $(pgrep -f hy2c.yaml); do kill -9 $p; done`));
