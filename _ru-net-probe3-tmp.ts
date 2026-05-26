import { Client } from 'ssh2';
const c=new Client();
const SH=`
echo '=== nc tests ==='
for target in 87.121.105.143/8443 87.121.105.143/443 87.121.105.143/22 185.87.148.138/8443 185.87.148.138/22 31.76.77.237/8443 8.8.8.8/443 8.8.8.8/53 google.com/443; do
  ip=\${target%/*}; pt=\${target#*/}
  echo "-- \$ip:\$pt --"
  timeout 6 nc -zv -w 4 \$ip \$pt 2>&1 | tail -2
done
echo '=== ping ==='
for ip in 87.121.105.143 185.87.148.138 31.76.77.237 8.8.8.8 google.com; do
  echo "-- \$ip --"
  ping -c2 -W2 \$ip 2>&1 | tail -2 | head -1
done
echo '=== curl ==='
timeout 8 curl -skv -o /dev/null https://87.121.105.143:8443/ 2>&1 | grep -iE 'connect|connected|trying|fail|timeout|refused' | head -5
echo '=== ssh out ==='
timeout 5 ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=4 root@87.121.105.143 'echo OK' 2>&1 | head -5
echo '=== curl host header ==='
timeout 6 curl -sk -o /dev/null -w 'cz https=%{http_code} t=%{time_total}\\n' https://cz.panelsu.ru:8443/
timeout 6 curl -sk -o /dev/null -w 'avg-coffee https=%{http_code} t=%{time_total}\\n' https://average-coffee.play2go.cloud:8443/
`;
c.on('ready',()=>c.exec(SH,(e,s)=>{if(e){console.error(e);return}s.on('close',()=>c.end()).on('data',(d:any)=>process.stdout.write(d.toString())).stderr.on('data',(d:any)=>process.stderr.write(d.toString()))}))
.on('error',(e:any)=>console.error('SSH',e.message))
.connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:15000});
