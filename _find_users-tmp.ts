import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== sub-manager dir ==='
ls -la /opt/sub-manager
echo
echo '=== data dir ==='
ls -la /root/data
echo
echo '=== look for sqlite/db files ==='
find /opt/sub-manager /root/data -maxdepth 3 -type f \\( -name '*.db' -o -name '*.json' -o -name '*.sqlite*' \\) 2>/dev/null | head
echo
echo '=== environment & config ==='
cat /opt/sub-manager/.env 2>/dev/null | head
ls /opt/sub-manager/server 2>/dev/null
echo
echo '=== test hy2 auth with random uuid ==='
curl -sk -X POST https://web.panelsu.ru/api/hy2/auth -H 'Content-Type: application/json' -d '{"addr":"1.2.3.4:443","auth":"deadbeef-dead-beef-dead-beefdeadbeef","tx":0}' -w '\\nHTTP %{http_code}\\n'
`;
c.on('ready',()=>c.exec(cmd,(_e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
