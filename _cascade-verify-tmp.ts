import { Client } from 'ssh2';
function ssh(h:string,p:string,c:string):Promise<string>{return new Promise((r,j)=>{const cl=new Client();let o='';cl.on('ready',()=>cl.exec(c,(e,s)=>{if(e)return j(e);s.on('close',()=>{cl.end();r(o);}).on('data',(d:any)=>o+=d).stderr.on('data',(d:any)=>o+=d);})).on('error',j).connect({host:h,port:22,username:'root',password:p});});}
console.log(await ssh('82.202.128.147','K!E2QAGrxYFx',
  `python3 -c "import json;c=json.load(open('/usr/local/x-ui/bin/config.json'));print('outbounds:',[o['tag'] for o in c['outbounds']]);print('rules:',json.dumps(c['routing']['rules'],ensure_ascii=False));print('inbounds ports:',[i['port'] for i in c['inbounds']])"
echo --- xray reachability to CZ:8443 ---
nc -zv -w 5 185.87.148.138 8443 2>&1
echo --- recent xray errors ---
journalctl -u x-ui -n 20 --no-pager 2>&1 | tail -15
echo --- listen 8443 ---
ss -tlnp | grep 8443`));
