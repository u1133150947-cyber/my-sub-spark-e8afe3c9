import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx',readyTimeout:15000});});}
console.log(await ssh("ss -tlnp | grep -E 'deno|sub-manager|LISTEN' | head -20; echo ---; systemctl status sub-manager --no-pager 2>&1 | head -10"));
