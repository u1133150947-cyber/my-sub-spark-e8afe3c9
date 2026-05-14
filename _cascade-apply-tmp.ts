import { Client } from 'ssh2';
import fs from 'fs';
function ssh(h:string,p:string,c:string,input?:Buffer):Promise<string>{return new Promise((r,j)=>{const cl=new Client();let o='';cl.on('ready',()=>cl.exec(c,(e,s)=>{if(e)return j(e);s.on('close',()=>{cl.end();r(o);}).on('data',(d:any)=>o+=d).stderr.on('data',(d:any)=>o+=d);if(input){s.stdin.end(input);}})).on('error',j).connect({host:h,port:22,username:'root',password:p});});}
const py = fs.readFileSync('/tmp/cascade-apply.py');
// upload via stdin to a remote file then run
const upload = await ssh('82.202.128.147','K!E2QAGrxYFx',"cat > /root/cascade-apply.py", py);
console.log('upload:', upload);
const out = await ssh('82.202.128.147','K!E2QAGrxYFx',"python3 /root/cascade-apply.py && systemctl restart x-ui && sleep 3 && systemctl is-active x-ui && tail -n 30 /usr/local/x-ui/bin/config.json | head -3 && echo --- && /usr/local/x-ui/bin/xray-linux-amd64 test -c /usr/local/x-ui/bin/config.json 2>&1 | tail -10");
console.log(out);
