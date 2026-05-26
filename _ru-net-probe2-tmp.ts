import { Client } from 'ssh2';
const c=new Client();
const SH=String.raw`
echo '=== INTERFACES ==='
ip -o link show | awk -F': ' '{print $2}'
echo '=== WG/WARP/TUN ==='
ip a | grep -E 'wg|warp|tun|tap' || echo none
which wg && wg show 2>/dev/null
systemctl is-active warp-svc 2>/dev/null
systemctl is-active wg-quick@wg0 2>/dev/null
echo '=== nft FULL ruleset ==='
nft list ruleset 2>/dev/null | head -80
echo '=== nc tests (replace bash /dev/tcp) ==='
for ipport in 87.121.105.143:8443 87.121.105.143:443 87.121.105.143:22 185.87.148.138:8443 185.87.148.138:22 31.76.77.237:8443 8.8.8.8:443 8.8.8.8:53; do
  ip=\${ipport%:*}; pt=\${ipport#*:}
  r=\$(timeout 5 nc -zv -w 4 $ip $pt 2>&1)
  echo "  $ipport => $r"
done
echo '=== ping endpoints ==='
for ip in 87.121.105.143 185.87.148.138 31.76.77.237 8.8.8.8; do
  ping -c2 -W2 $ip 2>&1 | tail -2 | head -1
done
echo '=== curl to endpoint :8443 with verbose ==='
timeout 8 curl -skvI https://87.121.105.143:8443/ 2>&1 | head -15
echo '=== curl via interface eth0 explicit ==='
ip -o -4 addr show | head
echo '=== check if SSH out works ==='
timeout 5 ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=4 root@87.121.105.143 'echo ok' 2>&1 | head -5
`;
c.on('ready',()=>c.exec(SH,(e,s)=>{if(e){console.error(e);return}s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()))}))
.on('error',(e:any)=>console.error('SSH',e.message))
.connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:15000});
