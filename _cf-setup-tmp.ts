import { Client } from 'ssh2';
const c = new Client();
const sh = `set -e
echo '=== DNS check cdn.panelsu.ru ==='
dig +short cdn.panelsu.ru @1.1.1.1
echo
echo '=== existing nginx site for cdn-origin ==='
ls /etc/nginx/sites-enabled/
grep -l cdn-origin /etc/nginx/sites-enabled/* 2>/dev/null
echo
echo '=== check acme.sh ==='
ls /root/.acme.sh/acme.sh 2>/dev/null && echo OK || echo NO
echo
echo '=== webroot for ACME ==='
grep -r 'well-known/acme-challenge' /etc/nginx/ 2>/dev/null | head -5
`;
c.on('ready',()=>c.exec(sh,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
