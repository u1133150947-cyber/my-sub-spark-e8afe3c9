import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx',readyTimeout:15000});});}
console.log(await ssh(`
slugs=$(sqlite3 /opt/sub-manager/data.db "SELECT slug FROM subscriptions WHERE name IN ('Dmitry','alina','Andrey','Test_z7didjgr05po','anton');")
for s in $slugs; do
  echo "=== $s ==="
  body=$(curl -s -m 5 -A 'v2rayN/6.0' "http://127.0.0.1:8080/sub/$s" | head -c 200)
  echo "len=$(echo -n "$body" | wc -c) head: $body"
  echo "decoded:" 
  curl -s -m 5 -A 'v2rayN/6.0' "http://127.0.0.1:8080/sub/$s" | base64 -d 2>/dev/null | grep -E '^vless' | head -3
done
`));
