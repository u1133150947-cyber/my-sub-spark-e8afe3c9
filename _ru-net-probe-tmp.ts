import { Client } from 'ssh2';
const c=new Client();
const SH=String.raw`
echo '=== iptables filter ==='
iptables -S OUTPUT 2>/dev/null | head -30
echo '=== nft ==='
nft list ruleset 2>/dev/null | grep -iE 'output|8443|drop|reject' | head -30
echo '=== ufw ==='
ufw status 2>/dev/null
echo '=== outbound probes from RU ==='
for ipport in 87.121.105.143:22 87.121.105.143:443 87.121.105.143:2053 87.121.105.143:8443 87.121.105.143:18443 31.76.77.237:22 31.76.77.237:443 31.76.77.237:8443 185.87.148.138:22 185.87.148.138:443 185.87.148.138:8443; do
  ip=\${ipport%:*}; pt=\${ipport#*:}
  timeout 4 bash -c "echo > /dev/tcp/$ip/$pt" 2>/dev/null && echo "  $ipport OPEN" || echo "  $ipport blocked"
done
echo '=== curl outbound to 1.1.1.1:443 (sanity) ==='
timeout 5 curl -sI https://1.1.1.1 -o /dev/null -w 'http=%{http_code} t=%{time_total}\n'
echo '=== route ==='
ip route get 87.121.105.143
ip route get 185.87.148.138
echo '=== mtr to 87.121.105.143:8443 ==='
which mtr && mtr -rwzc 4 -T -P 8443 87.121.105.143 2>&1 | head -15 || traceroute -n -T -p 8443 -w 2 -q 1 87.121.105.143 2>&1 | head -15
`;
c.on('ready',()=>c.exec(SH,(e,s)=>{if(e){console.error(e);return}s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()))}))
.on('error',(e:any)=>console.error('SSH',e.message))
.connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:15000});
