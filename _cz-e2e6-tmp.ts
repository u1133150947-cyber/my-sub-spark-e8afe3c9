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
const UUID = '16b16b4b-ae36-4b89-a794-888fdaffc9b3';
console.log('--- step1: write config & start ---');
console.log(await run(`pkill -9 -f "hysteria client"; sleep 1; printf 'server: reality.panelsu.ru:443\\nauth: ${UUID}\\ntls:\\n  sni: reality.panelsu.ru\\nsocks5:\\n  listen: 127.0.0.1:11080\\n' > /tmp/hy2c.yaml; (setsid hysteria client -c /tmp/hy2c.yaml </dev/null >/tmp/hy2c.log 2>&1 &); sleep 1; echo done`));
console.log('--- step2: wait & check ---');
await new Promise(r=>setTimeout(r,4000));
console.log(await run('cat /tmp/hy2c.log; echo ===PORT===; ss -lntp | grep 11080; echo ===PROC===; pgrep -af "hysteria client"'));
console.log('--- step3: test ---');
console.log(await run('timeout 15 curl -sS --max-time 12 --socks5 127.0.0.1:11080 https://1.1.1.1/cdn-cgi/trace 2>&1; echo exit:$?'));
console.log('--- step4: youtube ---');
console.log(await run('timeout 15 curl -sS --max-time 12 --socks5 127.0.0.1:11080 https://www.youtube.com/ -o /dev/null -w "code:%{http_code} time:%{time_total}\\n" 2>&1'));
console.log('--- step5: log tail & cleanup ---');
console.log(await run('tail -30 /tmp/hy2c.log; pkill -9 -f "hysteria client"'));
