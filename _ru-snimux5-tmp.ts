import { Client } from 'ssh2';
const c=new Client();
const SCRIPT = String.raw`
set -e
systemctl restart nginx
sleep 2
echo '=== listeners ==='
ss -lntp | grep -E ':(8443|18443|18444|18445|18446) '
echo '=== nginx status ==='
systemctl is-active nginx
systemctl is-active x-ui
echo '=== test from RU itself: connect to 8443 with SNI=dzen.ru ==='
for sni in ya.ru dzen.ru mail.yandex.ru market.yandex.ru; do
  out=$(timeout 5 openssl s_client -connect 127.0.0.1:8443 -servername $sni -verify_return_error </dev/null 2>&1 | head -3)
  echo "SNI=$sni -> $(echo "$out" | head -1)"
done
echo '=== nginx error log ==='
tail -20 /var/log/nginx/error.log
`;
c.on('ready',()=>c.exec(SCRIPT,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'sdu~JFsRU42(',readyTimeout:20000});
