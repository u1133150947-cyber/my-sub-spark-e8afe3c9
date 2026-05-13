import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
echo '=== h-ui db location ==='
ls -la /usr/local/h-ui/ 2>&1 | head
find /etc/h-ui /usr/local/h-ui /var/lib/h-ui -maxdepth 3 -name '*.db' 2>/dev/null
echo '=== hysteria process? ==='
ps aux | grep -E 'hysteria|h-ui' | grep -v grep
echo '=== ports udp ==='
ss -lunp | head -20
echo '=== try login ==='
curl -sS -c /tmp/cj.txt -X POST http://127.0.0.1:8081/hui/login -H 'Content-Type: application/json' -d '{"username":"wLrggS","loginPwd":"vxJ2Jq"}' ; echo
echo '=== hysteria2 config get ==='
TOKEN=\$(curl -sS -c /tmp/cj.txt -X POST http://127.0.0.1:8081/hui/login -H 'Content-Type: application/json' -d '{"username":"wLrggS","loginPwd":"vxJ2Jq"}' | jq -r '.data')
echo "TOKEN=\$TOKEN"
curl -sS -H "Authorization: \$TOKEN" http://127.0.0.1:8081/hui/hysteria2/getHysteria2Config | head -200
echo
echo '=== users list ==='
curl -sS -H "Authorization: \$TOKEN" 'http://127.0.0.1:8081/hui/account/page?pageNum=1&pageSize=50' | head -200
echo
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
