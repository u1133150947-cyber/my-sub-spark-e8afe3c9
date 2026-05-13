import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx',readyTimeout:15000});});}
console.log(await ssh(`
DB=$(ls /opt/sub-manager/*.db /opt/sub-manager/data/*.db 2>/dev/null | head -1)
echo "DB=$DB"
slugs=$(sqlite3 "$DB" "SELECT slug FROM subscriptions WHERE name IN ('Dmitry','alina','Andrey','Test_z7didjgr05po','anton');")
echo "slugs:" $slugs
for s in $slugs; do
  echo "=== $s ==="
  curl -s -m 5 -o /tmp/r.txt -w "code=%{http_code} size=%{size_download}\n" -A 'v2rayN/6.0' "http://127.0.0.1:8080/sub/$s"
  echo "vless lines:"
  base64 -d /tmp/r.txt 2>/dev/null | grep -cE '^vless://' || echo 0
  base64 -d /tmp/r.txt 2>/dev/null | grep -E '^vless://' | sed 's/#.*//' | head -2
done
`));
