import { Client } from 'ssh2';
function ssh(h:string,p:string,c:string):Promise<string>{return new Promise((r,j)=>{const cl=new Client();let o='';cl.on('ready',()=>cl.exec(c,(e,s)=>{if(e)return j(e);s.on('close',()=>{cl.end();r(o);}).on('data',(d:any)=>o+=d).stderr.on('data',(d:any)=>o+=d);})).on('error',j).connect({host:h,port:22,username:'root',password:p});});}
console.log(await ssh('82.202.128.147','K!E2QAGrxYFx',
  '/usr/local/x-ui/bin/xray-linux-amd64 x25519; echo SID=$(python3 -c "import secrets;print(secrets.token_hex(8))"); echo UUID=$(python3 -c "import uuid;print(uuid.uuid4())")'));
