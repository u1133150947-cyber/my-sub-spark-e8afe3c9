import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});});}
console.log(await ssh(`
UA='Mozilla/5.0'
echo '--- vern ---'
curl -ksS --http1.1 -A "$UA" -X POST https://127.0.0.1:8081/hui/hysteria2/auth -H 'Content-Type: application/json' -d '{"auth":"vern.80c4aa5b-607f-4143-9dd1-aa8b12ec4195","addr":"1.2.3.4:1234","tx":0}'; echo
echo '--- bad ---'
curl -ksS --http1.1 -A "$UA" -X POST https://127.0.0.1:8081/hui/hysteria2/auth -H 'Content-Type: application/json' -d '{"auth":"bad","addr":"1.2.3.4:1234","tx":0}'; echo
`));
