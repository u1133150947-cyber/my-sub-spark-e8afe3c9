import {Client} from 'ssh2';
function ssh(c:string){return new Promise<string>(r=>{const x=new Client();let o='';x.on('ready',()=>x.exec(c,(e,s)=>{if(e){r(String(e));return}s.on('close',()=>{x.end();r(o)}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString())})).on('error',e=>r('SSH:'+e.message)).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'})})}
// shorter conPass - 32 chars max. Use UUID without dashes (32 chars exactly).
const NEW='80c4aa5b607f41439dd1aa8b12ec4195';
console.log(await ssh(`
sqlite3 /usr/local/h-ui/data/h_ui.db "UPDATE account SET con_pass='${NEW}' WHERE username='vern';"
sqlite3 /usr/local/h-ui/data/h_ui.db "SELECT id,username,con_pass,length(con_pass) FROM account;"
echo ---test---
sleep 1
curl -sS -X POST http://127.0.0.1:8081/hui/hysteria2/auth -A 'Hysteria/2.6.0' -H 'Content-Type: application/json' -d '{"auth":"${NEW}","addr":"1.2.3.4:1234","tx":0}'
echo
`))
