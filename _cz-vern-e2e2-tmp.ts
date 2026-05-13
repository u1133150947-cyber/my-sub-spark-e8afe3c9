import { Client } from 'ssh2';
function run(host:string,pass:string,cmd:string):Promise<string>{return new Promise((res,rej)=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e)return rej(e);s.on('close',()=>{c.end();res(o);}).on('data',(d:any)=>o+=d).stderr.on('data',(d:any)=>o+=d);})).on('error',rej).connect({host,port:22,username:'root',password:pass});});}
const UUID='80c4aa5b-607f-4143-9dd1-aa8b12ec4195';
console.log(await run('82.202.128.147','K!E2QAGrxYFx',`
cat > /tmp/vc.yaml <<YAML
server: reality.panelsu.ru:443
auth: ${UUID}
tls:
  sni: reality.panelsu.ru
socks5:
  listen: 127.0.0.1:11099
YAML
pkill -9 -f vc.yaml 2>/dev/null; sleep 1
which hysteria
nohup hysteria client -c /tmp/vc.yaml </dev/null >/tmp/vc.log 2>&1 &
disown
sleep 5
echo --- log ---; cat /tmp/vc.log
echo --- port ---; ss -lntp | grep 11099
echo --- trace ---
timeout 15 curl -sS --max-time 12 --socks5 127.0.0.1:11099 https://1.1.1.1/cdn-cgi/trace; echo exit:$?
echo --- yt ---
timeout 15 curl -sS --max-time 12 --socks5 127.0.0.1:11099 https://www.youtube.com/ -o /dev/null -w "code:%{http_code} time:%{time_total}\\n"
pkill -9 -f vc.yaml 2>/dev/null
`));
