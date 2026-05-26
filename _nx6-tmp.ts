import { Client } from 'ssh2';
const c=new Client();
const SCRIPT=String.raw`
set -e
rm -f /etc/nginx/sites-enabled/xui
nginx -t
systemctl restart nginx
sleep 2
systemctl is-active nginx
echo '=== listeners ==='
ss -lntp | grep -E ':(8443|18443|18444|18445|18446|80|443) '
echo '=== local SNI tests ==='
for sni in ya.ru dzen.ru mail.yandex.ru market.yandex.ru other.com; do
  printf "SNI=%-18s: " "$sni"
  out=$(timeout 5 openssl s_client -connect 127.0.0.1:8443 -servername $sni </dev/null 2>&1)
  echo "$out" | grep -E 'subject=|errno|alert' | head -1
done
`;
c.on('ready',()=>c.exec(SCRIPT,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:20000});
