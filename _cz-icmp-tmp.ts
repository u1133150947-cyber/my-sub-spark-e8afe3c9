import {Client} from 'ssh2';
const c=new Client();
c.on('ready',()=>c.exec(`
echo '=== icmp_echo_ignore_all (0=отвечает, 1=игнорит) ==='
sysctl net.ipv4.icmp_echo_ignore_all
echo '=== firewall ICMP правила ==='
iptables -S INPUT 2>/dev/null | grep -iE 'icmp|ping' || echo 'нет правил против icmp'
nft list ruleset 2>/dev/null | grep -iE 'icmp' || true
echo '=== убедимся что включён ==='
sysctl -w net.ipv4.icmp_echo_ignore_all=0
grep -v icmp_echo_ignore /etc/sysctl.conf > /tmp/s.conf 2>/dev/null; echo 'net.ipv4.icmp_echo_ignore_all=0' >> /tmp/s.conf; mv /tmp/s.conf /etc/sysctl.conf
echo '=== готово ==='
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
