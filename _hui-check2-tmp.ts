import {Client} from 'ssh2';
function ssh(c:string){return new Promise<string>(r=>{const x=new Client();let o='';x.on('ready',()=>x.exec(c,(e,s)=>{if(e){r(String(e));return}s.on('close',()=>{x.end();r(o)}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString())})).on('error',e=>r('SSH:'+e.message)).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'})})}
console.log(await ssh(`sqlite3 /usr/local/h-ui/data/h_ui.db "SELECT key,substr(value,1,400) FROM config WHERE key IN ('HYSTERIA2_CONFIG','H_UI_CRT_PATH','H_UI_KEY_PATH','H_UI_PORT');"
echo ---PORT---
ss -lntp | grep -E ':443|:8081'
ss -lunp | grep ':443'
echo ---PROC---
ps aux | grep -E 'hysteria|h-ui' | grep -v grep
echo ---AUTH---
curl -sS -o /dev/null -w 'panel_http=%{http_code}\n' http://127.0.0.1:8081/
curl -sS -o /dev/null -w 'panel_https=%{http_code}\n' -k https://127.0.0.1:8081/
curl -sS -X POST http://127.0.0.1:8081/hui/hysteria2/auth -H 'Content-Type: application/json' -d '{"auth":"80c4aa5b-607f-4143-9dd1-aa8b12ec4195","addr":"1.2.3.4:1234","tx":0}' -w '\nHTTP=%{http_code}\n'
`))
