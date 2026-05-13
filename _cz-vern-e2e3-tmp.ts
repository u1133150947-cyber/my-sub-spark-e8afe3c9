import { Client } from 'ssh2';
function run(cmd:string):Promise<string>{return new Promise((res,rej)=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e)return rej(e);s.on('close',()=>{c.end();res(o);}).on('data',(d:any)=>o+=d).stderr.on('data',(d:any)=>o+=d);})).on('error',rej).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});});}
const UUID='80c4aa5b-607f-4143-9dd1-aa8b12ec4195';
console.log('S1');
console.log(await run(`pkill -9 -f vc.yaml 2>/dev/null; cat > /tmp/vc.yaml <<YAML
server: reality.panelsu.ru:443
auth: ${UUID}
tls:
  sni: reality.panelsu.ru
socks5:
  listen: 127.0.0.1:11099
YAML
which hysteria; cat /tmp/vc.yaml`));
console.log('S2 start');
console.log(await run(`systemd-run --unit=vchy --scope -q hysteria client -c /tmp/vc.yaml >/tmp/vc.log 2>&1 &
sleep 5
ss -lntp | grep 11099
echo --- log ---
cat /tmp/vc.log`));
console.log('S3 test');
console.log(await run(`timeout 15 curl -sS --max-time 12 --socks5 127.0.0.1:11099 https://1.1.1.1/cdn-cgi/trace; echo exit:$?
echo --- yt ---
timeout 15 curl -sS --max-time 12 --socks5 127.0.0.1:11099 https://www.youtube.com/ -o /dev/null -w "code:%{http_code} time:%{time_total}\\n"
echo --- log final ---
cat /tmp/vc.log
systemctl stop vchy.scope 2>/dev/null; pkill -9 -f vc.yaml 2>/dev/null; echo done`));
