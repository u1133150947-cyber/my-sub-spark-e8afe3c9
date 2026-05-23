import { Client } from 'ssh2';
const c = new Client();
const cmd = `
echo '=== xray access log (tail 40) ==='
tail -40 /usr/local/x-ui/bin/access.log 2>/dev/null || echo "no access.log"
echo
echo '=== xray error log (tail 40) ==='
tail -40 /usr/local/x-ui/bin/error.log 2>/dev/null || echo "no error.log"
echo
echo '=== nginx access log (last 30, only /twcdn-xhttp) ==='
grep 'twcdn-xhttp' /var/log/nginx/access.log 2>/dev/null | tail -30
echo
echo '=== nginx error log (tail 20) ==='
tail -20 /var/log/nginx/error.log 2>/dev/null
echo
echo '=== full GET test through CDN with verbose ==='
curl -sS -m 10 -v https://kclxvgxzs7.cdn.twcstorage.ru/twcdn-xhttp/abc 2>&1 | tail -30
echo
echo '=== GET test through origin directly (verbose) ==='
curl -k -sS -m 10 -v https://cdn-origin.panelsu.ru/twcdn-xhttp/abc 2>&1 | tail -30
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
