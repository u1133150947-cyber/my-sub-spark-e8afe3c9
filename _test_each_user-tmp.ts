import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== app.db tables ==='
sqlite3 /root/data/app.db ".tables"
echo
echo '=== subscriptions count ==='
sqlite3 /root/data/app.db "SELECT count(*) FROM subscriptions;"
echo
echo '=== sample subs ==='
sqlite3 -header /root/data/app.db "SELECT id,slug,name,client_email,client_uuid FROM subscriptions LIMIT 5;"
echo
echo '=== ALL UUIDs (one per line) ==='
sqlite3 /root/data/app.db "SELECT client_uuid||'|'||COALESCE(name,'')||'|'||COALESCE(slug,'') FROM subscriptions WHERE client_uuid IS NOT NULL AND client_uuid<>'';" > /tmp/uuids.txt
wc -l /tmp/uuids.txt
echo
echo '=== Test hy2 auth for each (calls panel api) ==='
total=0; ok=0; bad=0
while IFS='|' read -r uuid name slug; do
  total=\$((total+1))
  code=\$(curl -sk -o /tmp/r.json -w '%{http_code}' -X POST https://web.panelsu.ru/api/hy2/auth -H 'Content-Type: application/json' -d "{\\"addr\\":\\"127.0.0.1:443\\",\\"auth\\":\\"\$uuid\\",\\"tx\\":0}")
  body=\$(cat /tmp/r.json)
  if echo "\$body" | grep -q '"ok":true'; then
    ok=\$((ok+1))
  else
    bad=\$((bad+1))
    echo "FAIL [\$name] uuid=\${uuid:0:8} http=\$code body=\$body"
  fi
done < /tmp/uuids.txt
echo "TOTAL=\$total OK=\$ok FAIL=\$bad"
`;
c.on('ready',()=>c.exec(cmd,(_e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
