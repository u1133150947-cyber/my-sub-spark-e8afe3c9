import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});});}
console.log(await ssh(`
echo '--- https auth vern ---'
curl -ksS -X POST https://127.0.0.1:8081/hui/hysteria2/auth -H 'Content-Type: application/json' -d '{"auth":"vern.80c4aa5b-607f-4143-9dd1-aa8b12ec4195","addr":"1.2.3.4:1234","tx":0}'; echo
echo '--- https auth bad ---'
curl -ksS -X POST https://127.0.0.1:8081/hui/hysteria2/auth -H 'Content-Type: application/json' -d '{"auth":"bad","addr":"1.2.3.4:1234","tx":0}'; echo
echo '--- udp probe ---'
timeout 3 bash -c 'echo > /dev/udp/127.0.0.1/443' 2>&1; echo done
echo '--- hysteria-server logs ---'
tail -30 /usr/local/h-ui/logs/hysteria.log 2>/dev/null || journalctl -u h-ui -n 10 --no-pager
`));
