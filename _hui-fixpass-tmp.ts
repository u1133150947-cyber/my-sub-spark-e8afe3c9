import {Client} from 'ssh2';
function ssh(c:string){return new Promise<string>(r=>{const x=new Client();let o='';x.on('ready',()=>x.exec(c,(e,s)=>{if(e){r(String(e));return}s.on('close',()=>{x.end();r(o)}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString())})).on('error',e=>r('SSH:'+e.message)).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'})})}
console.log(await ssh(`
echo "--- DB now ---"
sqlite3 /usr/local/h-ui/data/h_ui.db "SELECT id,username,con_pass,deleted,quota,download,upload,expire_time,kick_util_time FROM account WHERE username='vern';"
echo "--- query test ---"
NOW=\$(date +%s%3N); echo "now_ms=\$NOW"
sqlite3 /usr/local/h-ui/data/h_ui.db "SELECT id,username FROM account WHERE con_pass='80c4aa5b607f41439dd1aa8b12ec4195' AND deleted=0 AND (quota<0 OR quota>download+upload) AND \$NOW<expire_time AND \$NOW>kick_util_time;"
echo "--- raw curl ---"
curl -sSv -X POST http://127.0.0.1:8081/hui/hysteria2/auth -A 'Hysteria/2.6.0' -H 'Content-Type: application/json' --data-raw '{"auth":"80c4aa5b607f41439dd1aa8b12ec4195","addr":"1.2.3.4:1234","tx":0}' 2>&1 | tail -25
`))
