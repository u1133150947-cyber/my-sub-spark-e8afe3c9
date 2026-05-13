import { Client } from 'ssh2';
function run(host:string,pass:string,cmd:string):Promise<string>{return new Promise((res,rej)=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e)return rej(e);s.on('close',()=>{c.end();res(o);}).on('data',(d:any)=>o+=d).stderr.on('data',(d:any)=>o+=d);})).on('error',rej).connect({host,port:22,username:'root',password:pass});});}
const UUID='80c4aa5b-607f-4143-9dd1-aa8b12ec4195';
const cfg=`server: reality.panelsu.ru:443\nauth: ${UUID}\ntls:\n  sni: reality.panelsu.ru\nsocks5:\n  listen: 127.0.0.1:11099\n`;
// Test from RU box (real cross-border)
console.log('=== from RU box ===');
console.log(await run('82.202.128.147','K!E2QAGrxYFx',`
which hysteria || curl -fsSL https://get.hy2.sh/ | bash >/dev/null 2>&1
printf '${cfg.replace(/\n/g,'\\n')}' > /tmp/vc.yaml
pkill -9 -f vc.yaml 2>/dev/null; sleep 1
nohup hysteria client -c /tmp/vc.yaml >/tmp/vc.log 2>&1 &
sleep 4
echo --- log ---; cat /tmp/vc.log
echo --- trace ---
timeout 12 curl -sS --max-time 10 --socks5 127.0.0.1:11099 https://1.1.1.1/cdn-cgi/trace; echo exit:$?
echo --- yt ---
timeout 12 curl -sS --max-time 10 --socks5 127.0.0.1:11099 https://www.youtube.com/ -o /dev/null -w "code:%{http_code} time:%{time_total}\\n"
pkill -9 -f vc.yaml
`));
console.log('=== CZ server log tail ===');
console.log(await run('185.87.148.138','hf6Ka8viMl',`/usr/bin/journalctl -u hysteria-server -n 8 --no-pager`));
