import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== ALL xray clients (id|email|inbound_remark) ==='
sqlite3 /root/data/app.db "SELECT 'app:'||json_extract(value,'\\$.id')||'|'||COALESCE(json_extract(value,'\\$.email'),'') FROM (SELECT 1)"  >/dev/null
# Better: pull from x-ui sqlite directly
python3 - <<'PY'
import sqlite3, json
c=sqlite3.connect('/etc/x-ui/x-ui.db')
out=[]
for inb_id, remark, settings in c.execute("SELECT id,remark,settings FROM inbounds"):
    s=json.loads(settings)
    for cl in s.get('clients',[]):
        out.append((cl.get('id'),cl.get('email',''),remark))
print('TOTAL CLIENTS:',len(out))
for u,e,r in out: print(u,'|',e,'|',r)
open('/tmp/uuids.txt','w').write('\\n'.join(f"{u}|{e}|{r}" for u,e,r in out))
PY
echo
echo '=== Test hy2 auth for each ==='
ok=0; bad=0; total=0
while IFS='|' read -r uuid email remark; do
  [ -z "\$uuid" ] && continue
  total=\$((total+1))
  body=\$(curl -sk --max-time 5 -X POST https://web.panelsu.ru/api/hy2/auth -H 'Content-Type: application/json' -d "{\\"addr\\":\\"127.0.0.1:443\\",\\"auth\\":\\"\$uuid\\",\\"tx\\":0}")
  if echo "\$body" | grep -q '"ok":true'; then
    ok=\$((ok+1)); echo "OK   \$email (\$remark)"
  else
    bad=\$((bad+1)); echo "FAIL \$email (\$remark) -> \$body"
  fi
done < /tmp/uuids.txt
echo "=== TOTAL=\$total OK=\$ok FAIL=\$bad ==="
echo
echo '=== End-to-end Hysteria handshake test (one UUID) ==='
head -1 /tmp/uuids.txt
PY
`;
c.on('ready',()=>c.exec(cmd,(_e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
