import {Client} from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`
systemctl cat sub-manager | head -40
echo '--- proc env ---'
PID=$(systemctl show -p MainPID --value sub-manager)
cat /proc/$PID/environ 2>/dev/null | tr '\\0' '\\n' | grep -E 'GITHUB|APP_DIR' | sed 's/=.*TOKEN.*/=***/'
echo '--- test token directly ---'
TOKEN=$(grep '^GITHUB_TOKEN=' /etc/sub-manager.env | cut -d= -f2)
echo "token len: \${#TOKEN}"
curl -s -o /tmp/r1.json -w "user: %{http_code}\\n" -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" https://api.github.com/user
cat /tmp/r1.json | head -c 300; echo
curl -s -o /tmp/r2.json -w "repo: %{http_code}\\n" -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" https://api.github.com/repos/u1133150947-cyber/my-sub-spark-df6a54d2
cat /tmp/r2.json | head -c 300; echo
curl -s -o /tmp/r3.json -w "commit: %{http_code}\\n" -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" https://api.github.com/repos/u1133150947-cyber/my-sub-spark-df6a54d2/commits/main
cat /tmp/r3.json | head -c 300; echo
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
