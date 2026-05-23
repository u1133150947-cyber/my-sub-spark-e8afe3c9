import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== nginx configs ==='
ls /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null
echo
echo '=== effective server blocks for 443 ==='
nginx -T 2>/dev/null | grep -A 30 'listen 443' | head -120
echo
echo '=== GET / via origin (no path) ==='
curl -k -sS -m 5 https://cdn-origin.panelsu.ru/ -o /dev/null -w 'GET / -> %{http_code}\n'
echo
echo '=== GET with explicit Host ==='
curl -k -sS -m 5 --resolve cdn-origin.panelsu.ru:443:127.0.0.1 https://cdn-origin.panelsu.ru/twcdn-xhttp/ -o /tmp/r -w 'GET -> %{http_code}\n'
cat /tmp/r; echo
echo
echo '=== check xray inbound listen and a direct local hit ==='
curl -sS -m 5 http://127.0.0.1:10444/twcdn-xhttp/ -o /tmp/r2 -w '\nDirect xray -> %{http_code}\n'
cat /tmp/r2; echo
echo
echo '=== nginx server_names_hash ==='
nginx -T 2>/dev/null | grep -E 'server_name|listen' | head -40
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
